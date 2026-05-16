/**
 * `generateSonnetDirectReport` — Column C orchestrator.
 *
 * End-to-end: load the reading + the 6 ORIGINAL stored photos (the same
 * 800×800 canonical crops the pipeline A/B consume — `canonical_storage_path`
 * when present, else the raw original sharp-normalized to 800×800), send them
 * DIRECTLY to Sonnet (no Modal, no RAG), parse the streamed report with the
 * SAME parser/audit as production, and persist to the dedicated
 * `*_sonnet_direct` columns. Production + SAM columns are never touched.
 *
 * Shared by the route (`/api/admin/calibration/sonnet-direct/[id]`) and the
 * vitest-executable runner — the route is a thin auth wrapper around this.
 *
 * Phase 7.4 | Column C | calibration harness
 */
import 'server-only'

import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  analyzeReadingDirect,
  SONNET_DIRECT_METHOD_VERSION,
  type DirectImage,
} from '@/lib/anthropic/analyze-direct'
import { MODEL } from '@/lib/anthropic/client'
import {
  findAllBoundaries,
  closeSections,
  extractEssencePhrase,
} from '@/lib/anthropic/parser'
import { runAudit } from '@/lib/anthropic/audit'
import { ENCERRAMENTO_LITERAL, type ReportJsonb } from '@/lib/anthropic/types'
import { logReportGeneration } from '@/lib/calibration/log-generation'

const SIGNED_URL_TTL_SECONDS = 600
const IMAGE_PX = 800

export interface SonnetDirectResult {
  ok: boolean
  reading_id: string
  status:
    | 'persisted'
    | 'persisted_empty'
    | 'no_images'
    | 'reading_not_found'
    | 'generation_failed'
  sections?: number
  sections_empty?: boolean
  audit_anchor_rate_pct?: number
  latency_ms?: number
  cost_usd?: number
  tokens_in?: number
  tokens_out?: number
  n_images?: number
  model_version?: string
  error?: string
  /** Populated only when opts.includeReport is set (runner eyeballing). */
  report?: ReportJsonb
}

interface ReadingRow {
  id: string
  client: { full_name?: string; birth_date?: string } | { full_name?: string; birth_date?: string }[] | null
}

function getClient(
  c: ReadingRow['client'],
): { full_name?: string; birth_date?: string } | null {
  if (!c) return null
  return Array.isArray(c) ? (c[0] ?? null) : c
}

/**
 * @param persist When false, generate + parse but DO NOT write to the DB and
 *   DO NOT log to report_generations (dry-run — usable before migration 0017
 *   is applied to validate the visual-analysis path end-to-end).
 */
export async function generateSonnetDirectReport(
  service: SupabaseClient,
  readingId: string,
  triggeredBy: string,
  opts: { persist?: boolean; signal?: AbortSignal; includeReport?: boolean } = {},
): Promise<SonnetDirectResult> {
  const persist = opts.persist !== false

  // 1. Reading + client (service-role: admin sees cross-therapist).
  const { data: reading, error: readErr } = await service
    .from('readings')
    .select('id, client:clients(full_name, birth_date)')
    .eq('id', readingId)
    .single<ReadingRow>()
  if (readErr || !reading) {
    return { ok: false, reading_id: readingId, status: 'reading_not_found', error: readErr?.message }
  }

  // 2. reading_images — prefer the canonical 800×800 crop the pipeline saw.
  const { data: images, error: imgErr } = await service
    .from('reading_images')
    .select('eye, angle, storage_path, canonical_storage_path')
    .eq('reading_id', readingId)
  if (imgErr || !images || images.length === 0) {
    return { ok: false, reading_id: readingId, status: 'no_images', error: imgErr?.message }
  }

  const paths = images.map(
    (i) => (i.canonical_storage_path as string | null) ?? (i.storage_path as string),
  )
  const { data: signed, error: signErr } = await service.storage
    .from('iris-captures')
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signed) {
    return {
      ok: false,
      reading_id: readingId,
      status: 'generation_failed',
      error: `signed URL creation failed: ${signErr?.message ?? 'unknown'}`,
    }
  }

  // 3. Fetch each photo, normalize to ≤800×800 JPEG, base64.
  let directImages: DirectImage[]
  try {
    directImages = await Promise.all(
      images.map(async (img, idx) => {
        const url = signed[idx]?.signedUrl
        if (!url) throw new Error(`missing signed URL for image ${idx}`)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`fetch image ${idx} → HTTP ${res.status}`)
        const input = Buffer.from(await res.arrayBuffer())
        const jpeg = await sharp(input)
          .resize(IMAGE_PX, IMAGE_PX, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer()
        return {
          eye: img.eye as string,
          angle: img.angle as string,
          mediaType: 'image/jpeg' as const,
          base64: jpeg.toString('base64'),
        }
      }),
    )
  } catch (err) {
    return {
      ok: false,
      reading_id: readingId,
      status: 'generation_failed',
      error: `image prep failed: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }

  // 4. Client context for the prompt.
  const client = getClient(reading.client)
  const clientName = client?.full_name ?? 'Cliente'
  const clientBirth = client?.birth_date ?? null
  const clientAge = clientBirth
    ? Math.floor((Date.now() - new Date(clientBirth).getTime()) / 31_557_600_000)
    : null

  // 5. Generate (Sonnet, direct vision).
  let buffer = ''
  let finalization: Awaited<ReturnType<Awaited<ReturnType<typeof analyzeReadingDirect>>['finalize']>>
  try {
    const analysis = await analyzeReadingDirect({
      readingId,
      therapistId: triggeredBy,
      images: directImages,
      clientName,
      clientAge,
      therapistNotes: null,
      signal: opts.signal,
    })
    for await (const text of analysis.stream) buffer += text
    finalization = await analysis.finalize()
  } catch (err) {
    return {
      ok: false,
      reading_id: readingId,
      status: 'generation_failed',
      error: `analyzeReadingDirect failed: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }

  // 6. Parse — identical to the production / SAM path.
  const completed: ReportJsonb = {}
  for (const section of closeSections(findAllBoundaries(buffer), buffer)) {
    completed[section.key] = section.content
  }
  const essence = extractEssencePhrase(buffer)
  if (essence) completed.essence_phrase = essence
  completed.encerramento_disclaimer = ENCERRAMENTO_LITERAL

  const audit = runAudit(completed)
  const sectionKeys = Object.keys(completed).filter(
    (k) => k !== 'encerramento_disclaimer' && k !== 'essence_phrase',
  )

  const summary: SonnetDirectResult = {
    ok: true,
    reading_id: readingId,
    status: sectionKeys.length === 0 ? 'persisted_empty' : 'persisted',
    sections: sectionKeys.length,
    sections_empty: sectionKeys.length === 0,
    audit_anchor_rate_pct: audit.anchor_rate_pct,
    latency_ms: finalization.latency_ms,
    cost_usd: Number(finalization.cost_estimate_usd.toFixed(5)),
    tokens_in: finalization.usage.input_tokens,
    tokens_out: finalization.usage.output_tokens,
    n_images: directImages.length,
    model_version: SONNET_DIRECT_METHOD_VERSION,
    ...(opts.includeReport ? { report: completed } : {}),
  }

  if (!persist) {
    return summary
  }

  // 7. Persist — dedicated columns only (production + SAM untouched).
  const metadata = {
    method_version: SONNET_DIRECT_METHOD_VERSION,
    model: MODEL,
    source: 'reprocess_existing',
    triggered_by: triggeredBy,
    triggered_at: new Date().toISOString(),
    n_images: directImages.length,
    image_px: IMAGE_PX,
    latency_ms: finalization.latency_ms,
    cost_usd: summary.cost_usd,
    tokens_in: finalization.usage.input_tokens,
    tokens_out: finalization.usage.output_tokens,
    report_audit_anchor_rate_pct: audit.anchor_rate_pct,
    report_sections: sectionKeys.length,
    report_empty: sectionKeys.length === 0,
    error_summary: null,
  }

  const { error: persistErr } = await service
    .from('readings')
    .update({
      report_generated_sonnet_direct: completed as unknown as never,
      report_generated_sonnet_direct_at: new Date().toISOString(),
      sonnet_direct_run_metadata: metadata as unknown as never,
    })
    .eq('id', readingId)
  if (persistErr) {
    return {
      ...summary,
      ok: false,
      status: 'generation_failed',
      error: `persist failed: ${persistErr.message} — harmless-looking but likely migration 0017 not applied (column report_generated_sonnet_direct missing)`,
    }
  }

  await logReportGeneration(service, {
    reading_id: readingId,
    method: 'sonnet_direct',
    latency_ms: finalization.latency_ms,
    cost_usd: summary.cost_usd ?? null,
    tokens_in: finalization.usage.input_tokens,
    tokens_out: finalization.usage.output_tokens,
    // report_generations.model_version = the Sonnet model that produced the
    // report (comparable across methods). The method id (sonnet_direct_0.1.0)
    // lives in `method` + sonnet_direct_run_metadata.method_version.
    model_version: MODEL,
  })

  return summary
}
