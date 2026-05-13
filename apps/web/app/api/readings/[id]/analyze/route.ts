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
import { analyzeReadingV2, ZodValidationFailedError } from '@/lib/anthropic/analyze-v2'
import { detectCompletedKeys } from '@/lib/anthropic/stream-parser-v2'
import { isFounderEmail } from '@/lib/auth/founder'
import { mergeCanonicalIrisColor } from '@/lib/canonicalize/merge-iris-color'
import type { CanonicalMetadata } from '@/lib/anthropic/types'
import type { IrisFeaturesForRag } from '@/lib/rag/build-queries'
import { findAllBoundaries, closeSections } from '@/lib/anthropic/parser'
import { runAudit } from '@/lib/anthropic/audit'
import { MODEL } from '@/lib/anthropic/client'
import { REPORT_SECTIONS } from '@/lib/anthropic/types'
import {
  ENCERRAMENTO_LITERAL,
  type ReportJsonb,
  type RegenerationLogEntry,
} from '@/lib/anthropic/types'
import { mapVisionFeaturesToTendencies } from '@/lib/tendency-engine'

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
      'id, therapist_id, status, vision_features, canonical_metadata, report_delivered, report_v2, report_v2_delivered, report_version, regeneration_count, regeneration_log, therapist_notes, client:clients(full_name, birth_date)',
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
  // Gate (d): not yet delivered. For V2 readings, check `report_v2_delivered`;
  // for legacy `'1.0'` readings, retain the original `report_delivered` check.
  const alreadyDelivered =
    reading.report_version === '2.0'
      ? reading.report_v2_delivered != null
      : reading.report_delivered != null
  if (alreadyDelivered) {
    return NextResponse.json(
      { error: 'Reading already delivered. Cannot regenerate.' },
      { status: 409 },
    )
  }
  // Gate (e): regen cap — 3/3 for therapists (D-S4), bypassed for the founder
  // during calibration iteration. regeneration_count still increments below for
  // telemetry parity. is_delivered gate above still applies — founder cannot
  // regenerate a delivered report (business rule, not a friction guard).
  const currentCount = reading.regeneration_count ?? 0
  const isFounder = isFounderEmail(user.email)
  if (currentCount >= 3 && !isFounder) {
    return NextResponse.json(
      { error: 'Regeneration limit reached (3/3). Edit manually instead.' },
      { status: 409 },
    )
  }

  // === Phase 7.4 V2 branch ===
  // Phase 7.4 | Plan 07.4-05 | Decisões: D-VAL1, D-VAL2, D-VAL3, D-UI3
  //
  // Branch on report_version. Legacy '1.0' (or null) falls through to the
  // existing Phase 7 path below. New '2.0' readings get the Iris Codex pipeline:
  //   tendency-engine → RAG → analyzeReadingV2 → stream text deltas + finalize +
  //   ZodValidationFailedError catch + canonical persist ONCE after finalize.
  //
  // Persistence model (V1): canonical report_v2 jsonb writes ONCE on stream
  // completion. detectCompletedKeys is used only for progress signaling. Mid-stream
  // disconnect = NO persisted state; caller retries. Per-key checkpoint persistence
  // is a V1.1 polish item.
  if (reading.report_version === '2.0') {
    // Normalize vision_features shape — same fallback pattern as Phase 7 analyze.ts
    const vf = reading.vision_features as Record<string, unknown> | null
    if (!vf) {
      return NextResponse.json({ error: 'vision_features ausente' }, { status: 422 })
    }
    const eyeSource =
      (vf.right_eye as Record<string, unknown>) ??
      (vf.left_eye as Record<string, unknown>) ??
      {}
    const constitutionRaw = eyeSource.constitution
    const constitutionObj =
      typeof constitutionRaw === 'string'
        ? { primary: constitutionRaw }
        : ((constitutionRaw as { primary?: string; secondary?: string } | null) ?? {
            primary: '',
          })
    const featuresForRag: IrisFeaturesForRag = {
      constitution: {
        primary: constitutionObj.primary ?? '',
        secondary: constitutionObj.secondary,
      },
      sectors:
        (eyeSource.sectors as Array<{
          hour: number
          findings: Array<{ type: string }>
        }>) ?? [],
      rings:
        (eyeSource.rings as Record<string, { present: boolean }>) ?? {},
    }

    // 1. Map vision features → tendencies (D-PR2, D-PR3)
    const tendencies = mapVisionFeaturesToTendencies(featuresForRag)

    // 2. RAG knowledge retrieval — reuses Fase 6 contract
    const { retrieveRelevantKnowledge } = await import('@/lib/rag/search')
    const knowledgeChunks = await retrieveRelevantKnowledge({
      features: featuresForRag,
      reportSections: REPORT_SECTIONS,
    })

    // 3. Compute client context for prompt
    const v2ClientName =
      (reading.client as { full_name?: string } | null)?.full_name ?? ''
    const v2ClientBirth =
      (reading.client as { birth_date?: string } | null)?.birth_date ?? null
    const v2ClientAge = v2ClientBirth
      ? Math.floor((Date.now() - new Date(v2ClientBirth).getTime()) / 31_557_600_000)
      : null

    // 4. Open V2 stream
    const analysisV2 = await analyzeReadingV2({
      readingId,
      therapistId: user.id,
      clientName: v2ClientName,
      clientAge: v2ClientAge,
      clientSex: null, // Phase 7 didn't expose sex; can be enriched in a future plan
      therapistNotes: reading.therapist_notes ?? null,
      tendencies,
      knowledgeChunks,
      signal: request.signal,
    })

    const v2Encoder = new TextEncoder()
    let v2Buffer = ''
    let v2LastCompletedCount = 0

    const v2ResponseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of analysisV2.stream) {
            v2Buffer += text
            controller.enqueue(v2Encoder.encode(text))

            // Client-progress signaling only — NO mid-stream DB writes.
            // Canonical persistence happens ONCE after finalize() below.
            const completed = detectCompletedKeys(v2Buffer)
            if (completed.length > v2LastCompletedCount) {
              v2LastCompletedCount = completed.length
            }
          }

          // 5. Finalize: zod validation + retry path (inside analyze-v2)
          const result = await analysisV2.finalize()

          // 6. Persist final state ONCE — full report_v2 + audit_metadata + timestamps.
          //    Single DB write for the generation flow. Mid-stream disconnect → no
          //    persisted state; caller retries by re-invoking the route handler.
          await supabase
            .from('readings')
            .update({
              report_v2: result.report as never,
              report_v2_generated_at: new Date().toISOString(),
              audit_metadata: result.audit as never,
              status: 'ready', // editor flips to 'edited' on first save
              regeneration_count:
                (reading.regeneration_count ?? 0) + (reading.report_v2 ? 1 : 0),
            })
            .eq('id', readingId)

          revalidatePath(`/leituras/${readingId}`)
          revalidatePath(`/leituras/${readingId}/editar`)
          revalidatePath('/leituras')

          controller.close()
        } catch (err) {
          if (err instanceof ZodValidationFailedError) {
            // D-VAL2 3rd-fail path: save raw + flag, do NOT block reading.
            // RESEARCH §V8 LGPD: redact client_name from raw before persist.
            const lgpdClientName =
              (reading.client as { full_name?: string } | null)?.full_name ?? ''
            const sanitizedRaw = lgpdClientName
              ? err.rawOutput.split(lgpdClientName).join('[CLIENT_NAME_REDACTED]')
              : err.rawOutput

            await supabase
              .from('readings')
              .update({
                audit_metadata: {
                  json_validation_failed: true,
                  invalid_json_output: sanitizedRaw.slice(0, 50000), // cap to avoid jsonb bloat
                  retry_count: err.attempts,
                  zod_error_summary: err.zodError.issues.slice(0, 10).map((i) => ({
                    path: i.path.join('.'),
                    message: i.message,
                  })),
                } as never,
                report_v2_generated_at: new Date().toISOString(),
                status: 'ready',
              })
              .eq('id', readingId)

            controller.enqueue(
              v2Encoder.encode('\n\n[ERRO_GERACAO: founder review needed]'),
            )
            controller.close()
            return
          }

          // Unknown error — close stream, do not corrupt DB
          const message = err instanceof Error ? err.message : 'unknown'
          console.error('[analyze-v2] stream error reading=' + readingId + ' err=', message)
          try {
            controller.error(err)
          } catch {
            /* already closed */
          }
        }
      },

      async cancel() {
        console.info('[analyze-v2] stream cancelled by caller reading=' + readingId)
      },
    })

    return new Response(v2ResponseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  // ----- end V2 branch — legacy '1.0' path continues below -----

  // Compute client age for prompt injection
  const clientName = (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const clientBirth = (reading.client as { birth_date?: string } | null)?.birth_date ?? null
  const clientAge = clientBirth
    ? Math.floor((Date.now() - new Date(clientBirth).getTime()) / 31_557_600_000)
    : null

  // Phase 07.1.6 UAT item 2: canonical iris_color is authoritative. Modal's
  // post-canonicalize callback overwrites vision_features.{eye}.iris_color with
  // its stale LAB-centroid analysis; merge canonical_metadata.iris_color_by_eye
  // back in here so the LLM sees the Sonnet-extracted color + iridological hint.
  // No-op when canonical_metadata is null (pre-07.1.6 readings).
  const rawVisionFeatures = reading.vision_features as Record<string, unknown> | null
  const rawCanonicalMetadata = reading.canonical_metadata as unknown as CanonicalMetadata | null
  const mergedVisionFeatures = mergeCanonicalIrisColor(
    rawVisionFeatures,
    rawCanonicalMetadata,
  )

  // Phase 07.1.6 UAT-1 diagnostic logging (2026-05-12).
  // Surfaces in Vercel logs whether the merge ran, what canonical iris_color
  // looked like, and which constitution value reached the LLM. Remove this
  // block when the report-generation pipeline is stable across canonical readings.
  const diagSnapshot = {
    readingId,
    has_canonical_metadata: !!rawCanonicalMetadata,
    canonical_iris_color_right: rawCanonicalMetadata?.iris_color_by_eye?.right?.primary ?? null,
    canonical_iris_color_left: rawCanonicalMetadata?.iris_color_by_eye?.left?.primary ?? null,
    pre_merge_top_constitution:
      (rawVisionFeatures as { constitution?: { primary?: string } } | null)?.constitution?.primary ?? null,
    pre_merge_right_eye_constitution:
      (rawVisionFeatures as { right_eye?: { constitution?: { primary?: string } } } | null)?.right_eye
        ?.constitution?.primary ?? null,
    merged_top_constitution:
      (mergedVisionFeatures as { constitution?: { primary?: string } }).constitution?.primary ?? null,
    merged_right_eye_constitution:
      (mergedVisionFeatures as { right_eye?: { constitution?: { primary?: string } } }).right_eye
        ?.constitution?.primary ?? null,
    has_right_eye_block: 'right_eye' in (mergedVisionFeatures ?? {}),
    has_left_eye_block: 'left_eye' in (mergedVisionFeatures ?? {}),
    has_right_eye_sectors: Array.isArray(
      (mergedVisionFeatures as { right_eye?: { sectors?: unknown[] } }).right_eye?.sectors,
    ),
    vision_features_keys: Object.keys(mergedVisionFeatures ?? {}),
  }
  console.log('[analyze/route] merge-diag', JSON.stringify(diagSnapshot))

  // Open the analysis stream
  const analysis = await analyzeReading({
    readingId,
    therapistId: user.id,
    visionFeatures: mergedVisionFeatures as unknown as IrisFeaturesForRag & Record<string, unknown>,
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

        // Phase 07.1.6 UAT-1 diagnostic: log stream output state BEFORE appending
        // encerramento. Reveals empty-report case (LLM produced no section
        // boundaries; previously this was masked by encerramento_disclaimer
        // being the only key, making hasReport=true on the page even though
        // the actual report is missing).
        const sectionKeysBeforeEncerramento = Object.keys(completedSections)
        console.log(
          '[analyze/route] stream-finalize',
          JSON.stringify({
            readingId,
            buffer_length: buffer.length,
            sections_completed: sectionKeysBeforeEncerramento,
            boundaries_count: lastBoundaryCount,
          }),
        )

        // D-P3 server-appended encerramento
        completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL

        // If LLM produced zero numbered sections, surface this loudly so the
        // founder sees a clear "report came back empty" error instead of a
        // page that looks blank. This is almost always upstream (missing
        // vision_features eye blocks, Modal didn't run, etc.) — leave the
        // partial buffer in report_raw_text below for forensic inspection.
        if (sectionKeysBeforeEncerramento.length === 0) {
          console.error(
            `[analyze/route] EMPTY-REPORT reading=${readingId} buffer_head=${buffer.slice(0, 400).replace(/\n/g, ' ⏎ ')}`,
          )
        }

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
