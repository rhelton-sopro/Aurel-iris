/**
 * Phase 07.1.6 — canonicalize orchestrator.
 *
 * Called by:
 *   - app/api/capture/canonicalize/route.ts (Wave 1 Plan 04) — POST endpoint
 *     hit by finalizeReadingAction (Wave 2 Plan 05) e admin Re-canonicalizar
 *     button (Wave 2 Plan 06).
 *
 * Fluxo:
 *   0. D-04 env-flag check (CANONICAL_CAPTURE_ENABLED !== 'false'; default ON)
 *   1. Fetch reading_images via service-role client (caller já fez auth check)
 *   2. Para cada imagem em paralelo (Promise.all):
 *      a. Download original do Storage
 *      b. Bake EXIF: sharp(raw).rotate().toBuffer() — coords pós-EXIF
 *      c. sharp(baked).metadata() pra obter origW/origH
 *      d. fetchIrisBbox(baked) → bbox + usage + cost
 *   3. Group bboxes por eye (LEFT/RIGHT, 3 ângulos cada) pra peer set D-02
 *   4. Para cada imagem em paralelo (Promise.all):
 *      a. isCanonicalAccepted(bbox, peers) → 'ok' | 'fallback'
 *      b. Se 'ok': cropToCanonical → upload canonical/ path → update
 *         reading_images.canonical_storage_path
 *      c. Se 'fallback': no upload, canonical_storage_path stays NULL
 *         (process route Plan 05 resolves canonical ?? storage_path)
 *   5. Aggregate usage/cost → update readings.canonical_metadata
 *   6. Return per-image results + aggregate metadata
 *
 * Idempotente: re-call sobrescreve canonical/* blob (storage upsert: true) +
 * re-update reading_images.canonical_storage_path. Admin Re-canonicalizar
 * (Wave 2 Plan 06) chama este mesmo caminho (D-05).
 *
 * Originais NUNCA são tocados: storage_path column NEVER atualizada por este
 * módulo, originais/{eye}_{angle}.jpg blob NUNCA sobrescrito.
 *
 * Phase 07.1.6 | Plan 03 Task 4 | Decisions: C-02, C-03, C-04, C-05,
 * D-01, D-02, D-03, D-04, D-05; threats T-07.1.6-09..15
 */
import 'server-only'
import sharp from 'sharp'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchIrisBbox } from './sonnet-bbox'
import { cropToCanonical } from './crop'
import { isCanonicalAccepted } from './sanity'
import { buildCanonicalStoragePath } from './storage-path'
import type {
  IrisBbox,
  CanonicalStatus,
  CanonicalMetadata,
} from '@/lib/anthropic/types'
import type { Eye } from '@/lib/capture/iris-geometry'
import type { Angle } from '@/lib/capture/sequence'
import type { Json } from '@/types/database'

const BUCKET = 'iris-captures'

export interface CanonicalizeResult {
  eye: Eye
  angle: Angle
  /** Canonical blob path. null em 'fallback' e 'disabled' (process route cai pra storage_path). */
  canonical_storage_path: string | null
  canonical_status: CanonicalStatus
  /** Sonnet cost desta foto (0 em 'disabled' / falhou antes do call). */
  cost_usd: number
  /** bbox raw (informational). null em 'disabled' ou erro de download/fetch. */
  bbox: IrisBbox | null
  /** Mensagem de erro humana se algo falhou (download, fetch, crop, upload). */
  error?: string
}

export interface CanonicalizeReadingOutput {
  results: CanonicalizeResult[]
  metadata: CanonicalMetadata
}

/**
 * Per-image bbox fetch + EXIF bake (internal — não exportado).
 * Captura erro per-imagem pro Promise.all não tombar o batch inteiro.
 */
interface PerImageBboxResult {
  eye: Eye
  angle: Angle
  storage_path: string
  bbox: IrisBbox | null
  /** Buffer já com EXIF baked, reusado pro crop step. null se download falhou. */
  bufferBaked: Buffer | null
  origW: number
  origH: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  error?: string
}

/**
 * Orchestrate canonicalize for 1 reading.
 *
 * @param readingId - UUID da reading alvo
 * @param therapistId - UUID do owner (caller — Wave 1 Plan 04 route.ts — já
 *                      validou ownership via auth + RLS antes de chamar)
 */
export async function canonicalizeReading(
  readingId: string,
  therapistId: string,
): Promise<CanonicalizeReadingOutput> {
  const enabled = process.env.CANONICAL_CAPTURE_ENABLED !== 'false' // D-04 default ON
  const service = createServiceClient()

  // Fetch the reading_images (typically 6: 2 eyes × 3 angles)
  const { data: images, error: imgError } = await service
    .from('reading_images')
    .select('eye, angle, storage_path')
    .eq('reading_id', readingId)

  if (imgError) {
    throw new Error(`[canonicalize] fetch images failed: ${imgError.message}`)
  }
  if (!images || images.length === 0) {
    throw new Error(`[canonicalize] no images found for reading ${readingId}`)
  }

  // ---------------------------------------------------------------------
  // D-04 kill-switch: skip Sonnet calls entirely, return all-disabled
  // (mantém shape estável pro caller). Default ON pra prod; flip via
  // `vercel env add CANONICAL_CAPTURE_ENABLED false` + redeploy pra rollback.
  // ---------------------------------------------------------------------
  if (!enabled) {
    const disabledResults: CanonicalizeResult[] = images.map(img => ({
      eye: img.eye as Eye,
      angle: img.angle as Angle,
      canonical_storage_path: null,
      canonical_status: 'disabled',
      cost_usd: 0,
      bbox: null,
    }))
    const metadata: CanonicalMetadata = {
      sonnet_input_tokens: 0,
      sonnet_output_tokens: 0,
      cost_usd: 0,
      status_summary: { ok: 0, fallback: 0, disabled: disabledResults.length },
      canonicalized_at: new Date().toISOString(),
    }
    return { results: disabledResults, metadata }
  }

  // ---------------------------------------------------------------------
  // Step 1: 6 Sonnet calls em paralelo (~3-5s wall clock; ~$0.05 total).
  // Erros per-image capturados (download/fetch falhar não tomba o batch).
  // ---------------------------------------------------------------------
  const bboxResults: PerImageBboxResult[] = await Promise.all(
    images.map(async (img): Promise<PerImageBboxResult> => {
      const base: PerImageBboxResult = {
        eye: img.eye as Eye,
        angle: img.angle as Angle,
        storage_path: img.storage_path,
        bbox: null,
        bufferBaked: null,
        origW: 0,
        origH: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
      }
      try {
        const { data: blob, error: dlError } = await service.storage
          .from(BUCKET)
          .download(img.storage_path)
        if (dlError || !blob) {
          throw new Error(`storage download failed: ${dlError?.message ?? 'unknown'}`)
        }
        const ab = await blob.arrayBuffer()
        const rawBuf = Buffer.from(ab)
        // Bake EXIF: garantir que coords retornadas por Sonnet batem com o frame
        // que cropToCanonical vai extrair (sharp.rotate() with no args reads EXIF
        // + strips orientation flag — same pattern as probe script line 170).
        const baked = await sharp(rawBuf).rotate().toBuffer()
        const meta = await sharp(baked).metadata()
        base.bufferBaked = baked
        base.origW = meta.width ?? 0
        base.origH = meta.height ?? 0
        if (!base.origW || !base.origH) {
          throw new Error('sharp metadata missing width/height after EXIF bake')
        }

        const { bbox, usage, cost_usd } = await fetchIrisBbox(baked)
        base.bbox = bbox
        base.input_tokens = usage.input_tokens
        base.output_tokens = usage.output_tokens
        base.cost_usd = cost_usd
        return base
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        console.error(
          `[canonicalize] bbox fetch failed eye=${img.eye} angle=${img.angle}: ${msg}`,
        )
        base.error = msg
        return base
      }
    }),
  )

  // ---------------------------------------------------------------------
  // Step 2: group bboxes per eye for cross-angle peer set (D-02)
  // ---------------------------------------------------------------------
  const bboxesByEye: Record<string, IrisBbox[]> = {}
  for (const r of bboxResults) {
    if (r.bbox) {
      if (!bboxesByEye[r.eye]) bboxesByEye[r.eye] = []
      bboxesByEye[r.eye].push(r.bbox)
    }
  }

  // ---------------------------------------------------------------------
  // Step 3: per-image trust gate + (se 'ok') crop + upload + update em paralelo
  // ---------------------------------------------------------------------
  const results: CanonicalizeResult[] = await Promise.all(
    bboxResults.map(async (r): Promise<CanonicalizeResult> => {
      // Pre-gate failures (download/bbox-fetch erro): marca fallback sem retry
      if (!r.bbox || r.error || !r.bufferBaked) {
        return {
          eye: r.eye,
          angle: r.angle,
          canonical_storage_path: null,
          canonical_status: 'fallback',
          cost_usd: r.cost_usd,
          bbox: r.bbox,
          error: r.error,
        }
      }

      // D-02 trust gate (sanity.ts isCanonicalAccepted)
      const peers = (bboxesByEye[r.eye] ?? []).filter(b => b !== r.bbox)
      const status = isCanonicalAccepted(r.bbox, peers)
      if (status !== 'ok') {
        return {
          eye: r.eye,
          angle: r.angle,
          canonical_storage_path: null,
          canonical_status: 'fallback',
          cost_usd: r.cost_usd,
          bbox: r.bbox,
        }
      }

      // 'ok' path: crop + upload + update
      try {
        const canonicalBuf = await cropToCanonical(
          r.bufferBaked,
          r.origW,
          r.origH,
          r.bbox,
        )
        const path = buildCanonicalStoragePath(therapistId, readingId, r.eye, r.angle)

        // Upload canonical blob (upsert:true torna re-canonicalize idempotente — D-05)
        const { error: upError } = await service.storage.from(BUCKET).upload(
          path,
          canonicalBuf,
          {
            contentType: 'image/jpeg',
            upsert: true,
          },
        )
        if (upError) throw new Error(`storage upload failed: ${upError.message}`)

        // Persist canonical_storage_path. Originais (storage_path) NUNCA tocados.
        // onConflict 'reading_id,eye,angle' garante idempotência em re-canonicalize
        // (composite unique constraint vem de migration 0004 reading_images).
        const { error: dbError } = await service
          .from('reading_images')
          .update({ canonical_storage_path: path })
          .eq('reading_id', readingId)
          .eq('eye', r.eye)
          .eq('angle', r.angle)
        if (dbError) throw new Error(`db update failed: ${dbError.message}`)

        return {
          eye: r.eye,
          angle: r.angle,
          canonical_storage_path: path,
          canonical_status: 'ok',
          cost_usd: r.cost_usd,
          bbox: r.bbox,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        console.error(
          `[canonicalize] crop/upload failed eye=${r.eye} angle=${r.angle}: ${msg}`,
        )
        // D-01: crop/upload erro → fallback (caller passa original ao Modal)
        return {
          eye: r.eye,
          angle: r.angle,
          canonical_storage_path: null,
          canonical_status: 'fallback',
          cost_usd: r.cost_usd,
          bbox: r.bbox,
          error: msg,
        }
      }
    }),
  )

  // ---------------------------------------------------------------------
  // Step 4: aggregate usage + costs → persist em readings.canonical_metadata
  // ---------------------------------------------------------------------
  const totalInput = bboxResults.reduce((sum, r) => sum + r.input_tokens, 0)
  const totalOutput = bboxResults.reduce((sum, r) => sum + r.output_tokens, 0)
  const totalCost = bboxResults.reduce((sum, r) => sum + r.cost_usd, 0)
  const summary: Record<CanonicalStatus, number> = { ok: 0, fallback: 0, disabled: 0 }
  for (const r of results) summary[r.canonical_status]++

  const metadata: CanonicalMetadata = {
    sonnet_input_tokens: totalInput,
    sonnet_output_tokens: totalOutput,
    cost_usd: totalCost,
    status_summary: summary,
    canonicalized_at: new Date().toISOString(),
  }

  // `canonical_metadata` é jsonb (migration 0012). Supabase typegen exporta
  // como `Json | null` — CanonicalMetadata interface é jsonb-safe estruturalmente
  // (todos campos number / string / Record<string,number>) então o cast é só
  // pra acalmar o TS variance check.
  const { error: metaError } = await service
    .from('readings')
    .update({ canonical_metadata: metadata as unknown as Json })
    .eq('id', readingId)
  if (metaError) {
    // Non-fatal: per-image results já persistidos. Caller pode log.
    // Não throw aqui — perderia os results úteis.
    console.error(
      `[canonicalize] update canonical_metadata failed: ${metaError.message}`,
    )
  }

  return { results, metadata }
}
