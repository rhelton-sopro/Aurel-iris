/**
 * POST /api/readings/[id]/analyze
 *
 * Streaming endpoint for the LLM analysis. Owned by the Reading detail page
 * (`/leituras/[id]`); user fires "Gerar análise" → fetch POST → consume
 * ReadableStream of text deltas → re-fetch on close.
 *
 * Phase 7.4 (2026-05-16): **flipped to the Sonnet-direct pipeline.** This is
 * now the single production path — Sonnet reads the 6 canonical 800×800
 * crops DIRECTLY (no Modal features, no RAG). The Modal vision-service / SAM
 * / RAG are retired (archived). Streaming, auth gates, regeneration cap/log,
 * audit, and `report_generated` storage are preserved unchanged so the
 * therapist UX + downstream consumers are byte-compatible.
 *
 * Auth gates (T-7-AUTH a-e):
 *   a) Session present
 *   b) reading.therapist_id === user.id
 *   c) reading.status === 'ready'  (now set by the canonicalize step, not
 *      the Modal webhook — see finalizeReadingAction / process route)
 *   d) reading.report_delivered IS NULL
 *   e) reading.regeneration_count < 3 (founder-bypassed for calibration)
 *
 * Phase 7 | Plan 07-08 → Phase 7.4 Sonnet-direct flip
 */
import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logReportGeneration } from '@/lib/calibration/log-generation'
import { analyzeReadingDirect } from '@/lib/anthropic/analyze-direct'
import { prepareDirectImages } from '@/lib/anthropic/prepare-direct-images'
import { isFounderEmail } from '@/lib/auth/founder'
import {
  findAllBoundaries,
  closeSections,
  extractEssencePhrase,
} from '@/lib/anthropic/parser'
import { runAudit } from '@/lib/anthropic/audit'
import { MODEL } from '@/lib/anthropic/client'
import {
  ENCERRAMENTO_LITERAL,
  type ReportJsonb,
  type RegenerationLogEntry,
} from '@/lib/anthropic/types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: readingId } = await params

  // Gate (a): session present
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Load reading (RLS + explicit therapist_id check). No vision_features /
  // canonical merge — the Sonnet-direct path consumes the photos directly.
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select(
      'id, therapist_id, status, report_delivered, regeneration_count, regeneration_log, client:clients(full_name, birth_date)',
    )
    .eq('id', readingId)
    .maybeSingle()

  if (readingError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!reading) {
    return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
  }
  // Gate (b): ownership
  if (reading.therapist_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Gate (c): status
  if (reading.status !== 'ready') {
    return NextResponse.json(
      { error: `Reading status '${reading.status}' is not ready for analysis` },
      { status: 409 },
    )
  }
  // Gate (d): not yet delivered.
  if (reading.report_delivered != null) {
    return NextResponse.json(
      { error: 'Reading already delivered. Cannot regenerate.' },
      { status: 409 },
    )
  }
  // Gate (e): regen cap — 3/3 for therapists (D-S4), founder-bypassed.
  const currentCount = reading.regeneration_count ?? 0
  const isFounder = isFounderEmail(user.email)
  if (currentCount >= 3 && !isFounder) {
    return NextResponse.json(
      { error: 'Regeneration limit reached (3/3). Edit manually instead.' },
      { status: 409 },
    )
  }

  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const clientBirth =
    (reading.client as { birth_date?: string } | null)?.birth_date ?? null
  const clientAge = clientBirth
    ? Math.floor((Date.now() - new Date(clientBirth).getTime()) / 31_557_600_000)
    : null

  // Prepare the 6 photos (canonical 800×800 ?? raw → sharp → base64).
  // Service client for storage signing (mirrors /process — avoids RLS tax);
  // ownership already enforced above with the user client.
  const service = createServiceClient()
  const prep = await prepareDirectImages(service, readingId)
  if (!prep.ok) {
    const status = prep.reason === 'no_images' ? 404 : 502
    return NextResponse.json(
      { error: `Image preparation failed: ${prep.reason} ${prep.message ?? ''}`.trim() },
      { status },
    )
  }

  // Open the Sonnet-direct stream (same {stream,finalize} contract).
  const analysis = await analyzeReadingDirect({
    readingId,
    therapistId: user.id,
    images: prep.images,
    clientName,
    clientAge,
    therapistNotes: null,
    signal: request.signal,
  })

  const encoder = new TextEncoder()
  const completedSections: ReportJsonb = {}
  let buffer = ''
  let lastBoundaryCount = 0

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const text of analysis.stream) {
          buffer += text
          controller.enqueue(encoder.encode(text))

          const boundaries = findAllBoundaries(buffer)
          if (boundaries.length > lastBoundaryCount) {
            const closed = closeSections(boundaries.slice(0, -1), buffer)
            for (const section of closed) {
              if (completedSections[section.key] !== section.content) {
                completedSections[section.key] = section.content
                await supabase
                  .from('readings')
                  .update({ report_generated: { ...completedSections } })
                  .eq('id', readingId)
              }
            }
            lastBoundaryCount = boundaries.length
          }
        }

        const finalBoundaries = findAllBoundaries(buffer)
        for (const section of closeSections(finalBoundaries, buffer)) {
          completedSections[section.key] = section.content
        }

        const sectionKeysBeforeEncerramento = Object.keys(completedSections)
        console.log(
          '[analyze/route] stream-finalize',
          JSON.stringify({
            readingId,
            buffer_length: buffer.length,
            sections_completed: sectionKeysBeforeEncerramento,
            boundaries_count: lastBoundaryCount,
            canonical_fallback_count: prep.fallbackCount,
          }),
        )

        const essence = extractEssencePhrase(buffer)
        if (essence) completedSections.essence_phrase = essence
        completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL

        if (sectionKeysBeforeEncerramento.length === 0) {
          console.error(
            `[analyze/route] EMPTY-REPORT reading=${readingId} buffer_head=${buffer.slice(0, 400).replace(/\n/g, ' ⏎ ')}`,
          )
        }

        const finalization = await analysis.finalize()
        const audit = runAudit(completedSections)

        const logEntry: RegenerationLogEntry = {
          timestamp: new Date().toISOString(),
          therapist_id: user.id,
          reading_id: readingId,
          model_version: MODEL,
          latency_ms: finalization.latency_ms,
          tokens_in: finalization.usage.input_tokens,
          tokens_out: finalization.usage.output_tokens,
          cache_creation_input_tokens: finalization.usage.cache_creation_input_tokens,
          cache_read_input_tokens: finalization.usage.cache_read_input_tokens,
          cost_estimate_usd: finalization.cost_estimate_usd,
        }

        const existingLog = Array.isArray(reading.regeneration_log)
          ? (reading.regeneration_log as unknown as RegenerationLogEntry[])
          : []

        // (f) Persist the canonicalization fallback count alongside the audit
        // (queryable for the >30%/2-week instrumentation + the in-report
        // notice rendered by ReportReadView).
        const auditWithFallback = {
          ...audit,
          canonical_fallback_count: prep.fallbackCount,
        }

        await supabase
          .from('readings')
          .update({
            report_generated: completedSections,
            report_generated_at: new Date().toISOString(),
            regeneration_count: currentCount + 1,
            regeneration_log: [...existingLog, logEntry] as unknown as never,
            audit_metadata: auditWithFallback as unknown as never,
            report_raw_text: buffer as unknown as never,
          })
          .eq('id', readingId)

        await logReportGeneration(service, {
          reading_id: readingId,
          method: 'sonnet_direct',
          latency_ms: finalization.latency_ms,
          cost_usd: Number(finalization.cost_estimate_usd.toFixed(5)),
          tokens_in: finalization.usage.input_tokens,
          tokens_out: finalization.usage.output_tokens,
          model_version: MODEL,
        })

        revalidatePath(`/leituras/${readingId}`)
        revalidatePath(`/leituras/${readingId}/editar`)
        revalidatePath('/leituras')

        controller.close()
      } catch (err) {
        console.error(
          '[analyze] stream error reading=' + readingId + ' err=',
          err instanceof Error ? err.message : 'unknown',
        )
        try {
          if (Object.keys(completedSections).length > 0 || buffer.length > 0) {
            const partialEssence = extractEssencePhrase(buffer)
            if (partialEssence) completedSections.essence_phrase = partialEssence
            await supabase
              .from('readings')
              .update({
                report_generated: completedSections,
                report_raw_text: buffer as unknown as never,
              })
              .eq('id', readingId)
          }
          controller.enqueue(
            encoder.encode(
              '\n\n[erro]: ' + (err instanceof Error ? err.message : 'desconhecido'),
            ),
          )
        } finally {
          controller.close()
        }
      }
    },

    async cancel() {
      console.info('[analyze] stream cancelled by caller reading=' + readingId)
    },
  })

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
