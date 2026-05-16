/**
 * POST /api/admin/calibration/sam-report/[reading_id]
 *
 * Phase 7.4 SAM comparison harness. Runs the PARALLEL SAM segmentation
 * branch on an existing (or new) reading's ORIGINAL stored photos, then
 * generates a parallel report — writing ONLY to the dedicated *_sam
 * columns. Production `vision_features` / `report_generated` /
 * `regeneration_count` are never touched (founder requirement: option (c) —
 * founder selects which readings to reprocess; works on the wife + Nailli
 * readings that already exist, no re-capture).
 *
 * Flow:
 *   1. Founder gate (defense-in-depth; middleware also guards /api/admin/*)
 *   2. Service-role: load reading + client + reading_images, sign URLs
 *      (mirror of scripts/reprocess-nailli.mjs — original photos in the
 *      iris-captures bucket)
 *   3. POST {reading_id, image_urls} to the SYNCHRONOUS SAM Modal endpoint
 *      (MODAL_ANALYZE_SAM_ENDPOINT_URL → analyze_iris_sam_endpoint) →
 *      vision_features_sam returned inline (no webhook, no spawn)
 *   4. Persist vision_features_sam + sam_run_metadata
 *   5. Generate the parallel report by reusing analyzeReading (same prompt,
 *      same parser, same audit as production /analyze) — sourced from the
 *      SAM features, written to report_generated_sam (+_at). To isolate
 *      "segmentation only", the canonical iris-color merge is applied
 *      identically to the production path (same canonical_metadata, eye-
 *      colour from the original photos — so the ONLY differing input is
 *      the SAM-vs-Hough geometry).
 *
 * Cost: one Sonnet call (~$0.30), same as a regen — acceptable per founder.
 * Not a regeneration: regeneration_count / regeneration_log untouched.
 *
 * Phase 7.4 | SAM harness
 */
import 'server-only'
import { NextResponse } from 'next/server'

import { analyzeReading } from '@/lib/anthropic/analyze'
import { runAudit } from '@/lib/anthropic/audit'
import {
  findAllBoundaries,
  closeSections,
  extractEssencePhrase,
} from '@/lib/anthropic/parser'
import { ENCERRAMENTO_LITERAL, type ReportJsonb } from '@/lib/anthropic/types'
import type { CanonicalMetadata } from '@/lib/anthropic/types'
import { mergeCanonicalIrisColor } from '@/lib/canonicalize/merge-iris-color'
import type { IrisFeaturesForRag } from '@/lib/rag/build-queries'
import { isFounderEmail } from '@/lib/auth/founder'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const maxDuration = 300

const SAM_MODAL_TIMEOUT_MS = 240_000
const SIGNED_URL_TTL_SECONDS = 600

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reading_id: string }> },
): Promise<NextResponse> {
  const { reading_id: readingId } = await params

  // 1. Founder gate (404 to non-founders — same as sibling admin routes).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return new NextResponse(null, { status: 404 })
  }

  const samEndpoint = process.env.MODAL_ANALYZE_SAM_ENDPOINT_URL
  const modalTokenId = process.env.MODAL_TOKEN_ID
  const modalTokenSecret = process.env.MODAL_TOKEN_SECRET
  if (!samEndpoint || !modalTokenId || !modalTokenSecret) {
    return NextResponse.json(
      {
        error:
          'SAM harness not configured. Set MODAL_ANALYZE_SAM_ENDPOINT_URL + MODAL_TOKEN_ID + MODAL_TOKEN_SECRET (after `modal deploy`).',
      },
      { status: 503 },
    )
  }

  // 2. Service-role: reading + client + images (admin sees cross-therapist).
  const service = createServiceClient()
  const { data: reading, error: readErr } = await service
    .from('readings')
    .select(
      'id, canonical_metadata, client:clients(full_name, birth_date)',
    )
    .eq('id', readingId)
    .single()
  if (readErr || !reading) {
    return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
  }

  const { data: images, error: imgErr } = await service
    .from('reading_images')
    .select('eye, angle, storage_path')
    .eq('reading_id', readingId)
  if (imgErr || !images || images.length === 0) {
    return NextResponse.json(
      { error: 'No reading_images for this reading' },
      { status: 400 },
    )
  }

  const paths = images.map((i) => i.storage_path as string)
  const { data: signed, error: signErr } = await service.storage
    .from('iris-captures')
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signed) {
    return NextResponse.json(
      { error: `Signed URL creation failed: ${signErr?.message ?? 'unknown'}` },
      { status: 500 },
    )
  }
  const imageUrls = images.map((img, idx) => {
    const url = signed[idx]?.signedUrl
    if (!url) throw new Error(`missing signed URL for ${img.storage_path}`)
    return { eye: img.eye, angle: img.angle, url }
  })

  // 3. Synchronous SAM Modal call → vision_features_sam inline.
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), SAM_MODAL_TIMEOUT_MS)
  let visionFeaturesSam: Record<string, unknown>
  try {
    const res = await fetch(samEndpoint, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        'Modal-Key': modalTokenId,
        'Modal-Secret': modalTokenSecret,
      },
      body: JSON.stringify({ reading_id: readingId, image_urls: imageUrls }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return NextResponse.json(
        { error: `SAM Modal ${res.status}: ${txt.slice(0, 300)}` },
        { status: 502 },
      )
    }
    const json = (await res.json()) as { vision_features_sam?: Record<string, unknown> }
    if (!json.vision_features_sam) {
      return NextResponse.json(
        { error: 'SAM Modal response missing vision_features_sam' },
        { status: 502 },
      )
    }
    visionFeaturesSam = json.vision_features_sam
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json(
      {
        error: aborted
          ? `SAM Modal timed out after ${SAM_MODAL_TIMEOUT_MS}ms`
          : `SAM Modal unreachable: ${err instanceof Error ? err.message : 'unknown'}`,
      },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }

  // 4. Persist SAM features + provenance (production columns untouched).
  const samMeta = {
    model_version:
      (visionFeaturesSam as { processing_metadata?: { model_version?: string } })
        .processing_metadata?.model_version ?? 'pipeline_sam',
    modal_call_id:
      (visionFeaturesSam as { processing_metadata?: { modal_call_id?: string } })
        .processing_metadata?.modal_call_id ?? null,
    source: 'reprocess_existing',
    triggered_by: user.id,
    triggered_at: new Date().toISOString(),
    error_summary:
      (visionFeaturesSam as { processing_metadata?: { error_summary?: string | null } })
        .processing_metadata?.error_summary ?? null,
  }
  await service
    .from('readings')
    .update({
      vision_features_sam: visionFeaturesSam as unknown as never,
      sam_run_metadata: samMeta as unknown as never,
    })
    .eq('id', readingId)

  // If both eyes failed in SAM, stop here — no point spending a Sonnet call.
  const samRight = (visionFeaturesSam as { right_eye?: unknown }).right_eye
  const samLeft = (visionFeaturesSam as { left_eye?: unknown }).left_eye
  if (samRight == null && samLeft == null) {
    return NextResponse.json(
      {
        reading_id: readingId,
        sam_vision_features: 'persisted',
        report_generated_sam: 'skipped (SAM produced no eye blocks)',
        sam_warnings:
          (visionFeaturesSam as { processing_metadata?: { warnings?: string[] } })
            .processing_metadata?.warnings ?? [],
      },
      { status: 200 },
    )
  }

  // 5. Parallel report — identical downstream to production /analyze, only
  //    the vision_features source differs (SAM vs Hough). Mirror the
  //    canonical iris-colour merge so segmentation is the ONLY variable.
  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const clientBirth =
    (reading.client as { birth_date?: string } | null)?.birth_date ?? null
  const clientAge = clientBirth
    ? Math.floor((Date.now() - new Date(clientBirth).getTime()) / 31_557_600_000)
    : null

  const mergedSam = mergeCanonicalIrisColor(
    visionFeaturesSam,
    reading.canonical_metadata as unknown as CanonicalMetadata | null,
  )

  let analysis
  try {
    analysis = await analyzeReading({
      readingId,
      therapistId: user.id,
      visionFeatures: mergedSam as unknown as IrisFeaturesForRag &
        Record<string, unknown>,
      clientName,
      clientAge,
      therapistNotes: null,
      irisMap: 'jensen',
    })
  } catch (err) {
    return NextResponse.json(
      {
        reading_id: readingId,
        sam_vision_features: 'persisted',
        error: `analyzeReading failed: ${err instanceof Error ? err.message : 'unknown'}`,
      },
      { status: 502 },
    )
  }

  let buffer = ''
  try {
    for await (const text of analysis.stream) buffer += text
    await analysis.finalize()
  } catch (err) {
    return NextResponse.json(
      {
        reading_id: readingId,
        sam_vision_features: 'persisted',
        error: `SAM report stream failed: ${err instanceof Error ? err.message : 'unknown'}`,
      },
      { status: 502 },
    )
  }

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

  await service
    .from('readings')
    .update({
      report_generated_sam: completed as unknown as never,
      report_generated_sam_at: new Date().toISOString(),
      sam_run_metadata: {
        ...samMeta,
        report_audit_anchor_rate_pct: audit.anchor_rate_pct,
        report_sections: sectionKeys.length,
        report_empty: sectionKeys.length === 0,
      } as unknown as never,
    })
    .eq('id', readingId)

  return NextResponse.json({
    reading_id: readingId,
    sam_model_version: samMeta.model_version,
    sam_vision_features: 'persisted',
    report_generated_sam: 'persisted',
    sections: sectionKeys.length,
    sections_empty: sectionKeys.length === 0,
    audit_anchor_rate_pct: audit.anchor_rate_pct,
    sam_warnings:
      (visionFeaturesSam as { processing_metadata?: { warnings?: string[] } })
        .processing_metadata?.warnings ?? [],
  })
}
