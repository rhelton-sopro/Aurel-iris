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
import { fetchPupilCenter } from './pupil-center'
import {
  cropToCanonical,
  cropAroundPupil,
  verifyIrisComplete,
  PUPIL_HALF_WINDOW,
  PUPIL_HALF_WINDOW_WIDE,
} from './crop'
import { diagnoseCanonical, GATE_THRESHOLDS, type GateDiagnostic } from './sanity'
import { buildCanonicalStoragePath } from './storage-path'
import type {
  IrisBbox,
  CanonicalStatus,
  CanonicalMetadata,
  CanonicalGateDiagnostic,
  IrisColorPerPhoto,
  IrisColorAggregate,
  PupilCenter,
  PupilCropDiagnostic,
} from '@/lib/anthropic/types'
import type { Eye } from '@/lib/capture/iris-geometry'
import type { Angle } from '@/lib/capture/sequence'
import type { Json } from '@/types/database'

const BUCKET = 'iris-captures'

/**
 * Método de recorte (2026-07-26). 'pupil' = ±500px centrado na pupila, default.
 * Rollback: `vercel env add CROP_METHOD bbox` + redeploy volta ao caminho antigo
 * (centro+raio da íris, janela 0.4×menor_lado, saída 800px) sem mexer em código.
 * Mesmo padrão do kill-switch D-04 (CANONICAL_CAPTURE_ENABLED).
 */
function cropMethod(): 'pupil' | 'bbox' {
  return process.env.CROP_METHOD === 'bbox' ? 'bbox' : 'pupil'
}

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
  /** Iris color extraído pela mesma Sonnet call (Phase 07.1.6 UAT item 2). null em falha ou pre-prompt-update. */
  iris_color: IrisColorPerPhoto | null
  /** Buffer já com EXIF baked, reusado pro crop step. null se download falhou. */
  bufferBaked: Buffer | null
  origW: number
  origH: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  /**
   * Centro da pupila (chamada separada, Sonnet 5) — base do recorte ±500.
   * null quando CROP_METHOD=bbox ou quando a chamada falhou (aí cai no bbox).
   */
  pupil: PupilCenter | null
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
  const startedAt = Date.now() // 07.4-36: wall-clock for bbox_latency_ms
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
      bbox_latency_ms: Date.now() - startedAt,
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
        iris_color: null,
        bufferBaked: null,
        origW: 0,
        origH: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        pupil: null,
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

        // fetchIrisBbox segue sendo chamado SEMPRE: além da geometria antiga
        // (usada como diagnóstica D-02 e como fallback), é ele que extrai o
        // `iris_color` que alimenta vision_features. A chamada da pupila roda em
        // paralelo — não somam latência, só custo (~+$0.05/leitura).
        const [bboxRes, pupilRes] = await Promise.all([
          fetchIrisBbox(baked),
          cropMethod() === 'pupil'
            ? fetchPupilCenter(baked).catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : 'unknown'
                console.error(
                  `[canonicalize] pupil fetch failed eye=${img.eye} angle=${img.angle}: ${msg} — caindo pro bbox`,
                )
                return null
              })
            : Promise.resolve(null),
        ])
        base.bbox = bboxRes.bbox
        base.iris_color = bboxRes.iris_color
        base.input_tokens = bboxRes.usage.input_tokens + (pupilRes?.usage.input_tokens ?? 0)
        base.output_tokens = bboxRes.usage.output_tokens + (pupilRes?.usage.output_tokens ?? 0)
        base.cost_usd = bboxRes.cost_usd + (pupilRes?.cost_usd ?? 0)
        base.pupil = pupilRes?.pupil ?? null
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
  const gate_diagnostics: CanonicalGateDiagnostic[] = []
  const pupil_diagnostics: PupilCropDiagnostic[] = []
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

      // D-02 trust gate — diagnoseCanonical retorna estrutura completa
      // (status + fail_reasons + peer median + deltas) pra observabilidade.
      const peers = (bboxesByEye[r.eye] ?? []).filter(b => b !== r.bbox)
      const diag: GateDiagnostic = diagnoseCanonical(r.bbox, peers)
      gate_diagnostics.push({
        eye: r.eye,
        angle: r.angle,
        bbox: r.bbox,
        status: diag.status,
        fail_reasons: diag.fail_reasons,
        peer_count: diag.peer_count,
        median_x_pct: diag.median_x_pct,
        median_y_pct: diag.median_y_pct,
        delta_x_pct: diag.delta_x_pct,
        delta_y_pct: diag.delta_y_pct,
        thresholds: GATE_THRESHOLDS,
      })

      // O caminho da PUPILA não passa pelo gate do bbox: ele tem verificação
      // própria (esclera dos dois lados) e não usa a geometria da íris pra nada.
      // Bloqueá-lo por um bbox ruim herdaria exatamente a falha que ele corrige.
      const usePupil = cropMethod() === 'pupil' && r.pupil !== null && r.pupil.valid

      if (!usePupil && diag.status !== 'ok') {
        return {
          eye: r.eye,
          angle: r.angle,
          canonical_storage_path: null,
          canonical_status: 'fallback',
          cost_usd: r.cost_usd,
          bbox: r.bbox,
        }
      }

      // crop + upload + update
      try {
        let canonicalBuf: Buffer
        if (usePupil && r.pupil) {
          // ±500 da pupila; se a verificação não confirmar a íris inteira,
          // ALARGA pra ±700 e re-verifica. Nunca corta pra "caber".
          let crop = await cropAroundPupil(
            r.bufferBaked,
            r.origW,
            r.origH,
            r.pupil.center_x_pct,
            r.pupil.center_y_pct,
            PUPIL_HALF_WINDOW,
          )
          let check = await verifyIrisComplete(crop.buffer)
          let widened = false
          if (!check.complete && !crop.shrunk) {
            const wider = await cropAroundPupil(
              r.bufferBaked,
              r.origW,
              r.origH,
              r.pupil.center_x_pct,
              r.pupil.center_y_pct,
              PUPIL_HALF_WINDOW_WIDE,
            )
            const wideCheck = await verifyIrisComplete(wider.buffer)
            // Só adota a janela larga se ela de fato resolveu — senão fica com a
            // apertada (mais resolução de íris) e registra o não-confirmado.
            if (wideCheck.complete) {
              crop = wider
              check = wideCheck
              widened = true
            }
          }
          pupil_diagnostics.push({
            eye: r.eye,
            angle: r.angle,
            pupil: r.pupil,
            half_window: crop.half,
            side: crop.side,
            shrunk: crop.shrunk,
            iris_complete: check.complete,
            widened,
          })
          if (!check.complete) {
            // Sinaliza, não reprova: em contraluz mole a transição íris→esclera
            // perde contraste e a faixa não é achada mesmo com a íris inteira.
            // Fica auditável em canonical_metadata.pupil_diagnostics.
            console.warn(
              `[canonicalize] iris_complete=false eye=${r.eye} angle=${r.angle} half=${crop.half} — recorte aceito, ver pupil_diagnostics`,
            )
          }
          canonicalBuf = crop.buffer
        } else {
          canonicalBuf = await cropToCanonical(r.bufferBaked, r.origW, r.origH, r.bbox)
        }
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
  // Step 4: aggregate iris_color per eye (Phase 07.1.6 UAT item 2)
  // ---------------------------------------------------------------------
  const colorsLeft = bboxResults
    .filter(r => r.eye === 'left' && r.iris_color !== null)
    .map(r => r.iris_color as IrisColorPerPhoto)
  const colorsRight = bboxResults
    .filter(r => r.eye === 'right' && r.iris_color !== null)
    .map(r => r.iris_color as IrisColorPerPhoto)
  const iris_color_by_eye = {
    left: aggregateIrisColor(colorsLeft),
    right: aggregateIrisColor(colorsRight),
  }

  // ---------------------------------------------------------------------
  // Step 5: aggregate usage + costs → persist em readings.canonical_metadata
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
    bbox_latency_ms: Date.now() - startedAt,
    gate_diagnostics,
    iris_color_by_eye,
    crop_method: cropMethod(),
    pupil_diagnostics,
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

  // ---------------------------------------------------------------------
  // Step 6: patch vision_features.{eye}.iris_color (Phase 07.1.6 UAT item 2)
  //
  // Sonnet's iris_color is more reliable than Modal's LAB centroid analysis
  // for iridological category naming. Mirror it into the existing vision_features
  // slot so the Phase 7 report prompt (analyze.ts) sees it without changes.
  //
  // Idempotent additive UPDATE: read-modify-write, replacing ONLY left_eye.iris_color
  // and right_eye.iris_color. If Modal runs AFTER and overwrites the whole
  // vision_features row, the next canonicalize call (or admin Re-canonicalizar)
  // will re-patch. Long-term: have Modal skip iris_color extraction once we
  // trust the Sonnet path (separate phase).
  // ---------------------------------------------------------------------
  if (iris_color_by_eye.left || iris_color_by_eye.right) {
    await patchVisionFeaturesIrisColor(service, readingId, iris_color_by_eye)
  }

  return { results, metadata }
}

// ---------------------------------------------------------------------------
// Iris color aggregation + vision_features patch (Phase 07.1.6 UAT item 2)
// ---------------------------------------------------------------------------

/**
 * Aggregate 3 per-photo iris_color records (one per angle of the same eye) into
 * a single per-eye IrisColorAggregate. Strategy:
 *   - primary: confidence-weighted vote across non-null primaries; ties broken
 *     by highest single-photo confidence.
 *   - secondary: most-common non-null value across photos; null if none.
 *   - dominant_pigments: union of all per-photo pigment arrays (deduped).
 *   - central_heterochromia: true if any photo reported true (conservative —
 *     heterochromia is a stable trait; one good detection is sufficient).
 *   - confidence: average of per-photo confidences.
 * Returns null if the input array is empty (e.g. all 3 photos returned bbox
 * but no iris_color, or all 3 fell back to valid=false).
 */
function aggregateIrisColor(colors: IrisColorPerPhoto[]): IrisColorAggregate | null {
  if (colors.length === 0) return null

  // Weighted vote on primary: sum confidence by category.
  const primaryScore: Record<string, number> = {}
  let bestPrimary: string | null = null
  let bestPrimaryConfidence = -1
  for (const c of colors) {
    if (c.primary !== null) {
      primaryScore[c.primary] = (primaryScore[c.primary] ?? 0) + c.confidence
      if (c.confidence > bestPrimaryConfidence) {
        bestPrimaryConfidence = c.confidence
        bestPrimary = c.primary
      }
    }
  }
  // Pick highest-scored primary; tie-break to bestPrimary (highest single confidence).
  let primary: string | null = null
  let maxScore = -1
  for (const [cat, score] of Object.entries(primaryScore)) {
    if (score > maxScore) {
      maxScore = score
      primary = cat
    } else if (score === maxScore && cat === bestPrimary) {
      primary = cat
    }
  }

  // Secondary: most common non-null.
  const secondaryCount: Record<string, number> = {}
  for (const c of colors) {
    if (c.secondary !== null) {
      secondaryCount[c.secondary] = (secondaryCount[c.secondary] ?? 0) + 1
    }
  }
  let secondary: string | null = null
  let maxSecondaryCount = 0
  for (const [sec, count] of Object.entries(secondaryCount)) {
    if (count > maxSecondaryCount) {
      maxSecondaryCount = count
      secondary = sec
    }
  }

  // Dominant pigments: union (dedup).
  const pigmentSet = new Set<string>()
  for (const c of colors) {
    for (const p of c.dominant_pigments) pigmentSet.add(p)
  }

  // Heterochromia: any photo reporting true.
  const central_heterochromia = colors.some(c => c.central_heterochromia)

  // Average confidence.
  const confidence = colors.reduce((sum, c) => sum + c.confidence, 0) / colors.length

  return {
    primary,
    secondary,
    central_heterochromia,
    dominant_pigments: Array.from(pigmentSet),
    confidence,
  }
}

/**
 * Patch vision_features.{left_eye,right_eye}.iris_color additive UPDATE.
 * Read-modify-write on the existing vision_features jsonb so Modal's other
 * outputs (constitution, fiber_density, rings, sectors, etc.) are preserved.
 * Safe to call even when vision_features is null (creates the structure).
 *
 * Non-fatal: failure logs and returns; canonical_metadata.iris_color_by_eye
 * is the source of truth either way (analyze.ts can fall back to it).
 */
async function patchVisionFeaturesIrisColor(
  service: ReturnType<typeof createServiceClient>,
  readingId: string,
  irisColorByEye: { left: IrisColorAggregate | null; right: IrisColorAggregate | null },
): Promise<void> {
  const { data: row, error: readError } = await service
    .from('readings')
    .select('vision_features')
    .eq('id', readingId)
    .single()
  if (readError) {
    console.error(`[canonicalize] read vision_features failed: ${readError.message}`)
    return
  }

  const existing = (row?.vision_features as Record<string, unknown> | null) ?? {}
  const leftEye = (existing.left_eye as Record<string, unknown> | undefined) ?? {}
  const rightEye = (existing.right_eye as Record<string, unknown> | undefined) ?? {}

  const patched = {
    ...existing,
    left_eye: irisColorByEye.left
      ? { ...leftEye, iris_color: irisColorByEye.left }
      : leftEye,
    right_eye: irisColorByEye.right
      ? { ...rightEye, iris_color: irisColorByEye.right }
      : rightEye,
  }

  const { error: writeError } = await service
    .from('readings')
    .update({ vision_features: patched as unknown as Json })
    .eq('id', readingId)
  if (writeError) {
    console.error(`[canonicalize] patch vision_features iris_color failed: ${writeError.message}`)
  }
}
