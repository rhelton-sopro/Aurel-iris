/**
 * POST /api/readings/[id]/analyze
 *
 * Streaming endpoint for Phase 7 LLM analysis. Owned by the Reading detail
 * page (`/leituras/[id]`); user fires "Gerar análise" button → fetch POST
 * → consume ReadableStream of text deltas → re-fetch on close.
 *
 * Auth gates (T-7-AUTH a-e):
 *   a) Session present (`auth.getUser()`)
 *   b) reading.therapist_id === user.id
 *   c) reading.status === 'ready'
 *   d) reading.report_delivered IS NULL (not yet delivered to client)
 *   e) reading.regeneration_count < 3 (D-S4 cap)
 *
 * Streaming (D-S1, D-S2):
 *   - Web Streams API: `Response(new ReadableStream({...}))`
 *   - Plain text/plain; charset=utf-8 + Transfer-Encoding: chunked
 *   - Section-boundary parser (07-04) detects each `^### N. ` and persists
 *     completed sections via UPDATE jsonb_set (D-S2 — 14 writes total)
 *   - ENCERRAMENTO_LITERAL appended server-side AFTER stream end (D-P3)
 *   - On error: partial save preserved; regeneration_count NOT incremented
 *     (D-S3 — infra failures don't punish the user)
 *
 * Phase 7 | Plan 07-08 | Decisions: D-S1, D-S2, D-S3, D-S4, D-P3, D-T1
 */
import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { analyzeReading } from '@/lib/anthropic/analyze'
import type { IrisFeaturesForRag } from '@/lib/rag/build-queries'
import { findAllBoundaries, closeSections } from '@/lib/anthropic/parser'
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

  // Load reading + features (RLS + explicit therapist_id check)
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select(
      'id, therapist_id, status, vision_features, report_delivered, regeneration_count, regeneration_log, client:clients(full_name, birth_date)',
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
  // Gate (d): not yet delivered
  if (reading.report_delivered != null) {
    return NextResponse.json(
      { error: 'Reading already delivered. Cannot regenerate.' },
      { status: 409 },
    )
  }
  // Gate (e): regen cap
  const currentCount = reading.regeneration_count ?? 0
  if (currentCount >= 3) {
    return NextResponse.json(
      { error: 'Regeneration limit reached (3/3). Edit manually instead.' },
      { status: 409 },
    )
  }

  // Compute client age for prompt injection
  const clientName = (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const clientBirth = (reading.client as { birth_date?: string } | null)?.birth_date ?? null
  const clientAge = clientBirth
    ? Math.floor((Date.now() - new Date(clientBirth).getTime()) / 31_557_600_000)
    : null

  // Open the analysis stream
  const analysis = await analyzeReading({
    readingId,
    therapistId: user.id,
    visionFeatures: reading.vision_features as unknown as IrisFeaturesForRag & Record<string, unknown>,
    clientName,
    clientAge,
    therapistNotes: null, // Phase 7 doesn't surface notes; Fase 9 polish may add
    irisMap: 'jensen',
    signal: request.signal,
  })

  // Web Streams shell — drives Anthropic deltas to client + DB
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

          // Detect new boundaries — only trigger persistence when section CLOSES
          const boundaries = findAllBoundaries(buffer)
          if (boundaries.length > lastBoundaryCount) {
            // Close all sections except the latest (still open)
            const closed = closeSections(boundaries.slice(0, -1), buffer)
            for (const section of closed) {
              if (completedSections[section.key] !== section.content) {
                completedSections[section.key] = section.content
                // Atomic write of just this key via jsonb_set
                await supabase
                  .from('readings')
                  .update({
                    report_generated: { ...completedSections },
                  })
                  .eq('id', readingId)
              }
            }
            lastBoundaryCount = boundaries.length
          }
        }

        // Stream ended — close last section
        const finalBoundaries = findAllBoundaries(buffer)
        const allClosed = closeSections(finalBoundaries, buffer)
        for (const section of allClosed) {
          completedSections[section.key] = section.content
        }

        // D-P3 server-appended encerramento
        completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL

        // Finalize: usage + audit + regeneration_log
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

        await supabase
          .from('readings')
          .update({
            report_generated: completedSections,
            report_generated_at: new Date().toISOString(),
            regeneration_count: currentCount + 1,
            regeneration_log: [...existingLog, logEntry] as unknown as never,
            audit_metadata: audit as unknown as never,
            report_raw_text: buffer as unknown as never,
          })
          .eq('id', readingId)

        revalidatePath(`/leituras/${readingId}`)
        revalidatePath(`/leituras/${readingId}/editar`)
        revalidatePath('/leituras')

        controller.close()
      } catch (err) {
        // D-S3: do NOT increment regeneration_count on error
        console.error(
          '[analyze] stream error reading=' + readingId + ' err=',
          err instanceof Error ? err.message : 'unknown',
        )
        try {
          // Persist partial sections that were already closed mid-stream +
          // raw buffer (defensive: lets us debug parser misses post-mortem
          // even when error aborts the stream before audit/finalize ran).
          if (Object.keys(completedSections).length > 0 || buffer.length > 0) {
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
      // Caller (browser) aborted the fetch → analyze.ts AbortSignal cascades
      // to llmStream.controller.abort() (already wired in analyze.ts)
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
