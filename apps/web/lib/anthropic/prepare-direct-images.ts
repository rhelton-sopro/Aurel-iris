/**
 * `prepareDirectImages` — load + normalize a reading's 6 photos for the
 * Sonnet-direct path (Column C, now the single production pipeline).
 *
 * Resolves `canonical_storage_path ?? storage_path` per image (the canonical
 * 800×800 iris-centered crop from Phase 07.1.6 when present, else the raw
 * original), signs URLs, fetches, and sharp-normalizes to ≤800×800 JPEG.
 *
 * Returns the per-image canonical/fallback tier + `fallbackCount` — under the
 * C-only architecture a canonicalization `fallback` (canonical NULL → raw
 * uncentered frame) feeds the report-writing Sonnet directly, so this count
 * is the load-bearing quality signal (drives the report notice + the >30% /
 * 2-week instrumentation alert).
 *
 * Shared by the production analyze route AND the calibration harness
 * orchestrator (single source of truth — no duplication).
 *
 * Phase 7.4 | Sonnet-direct pipeline
 */
import 'server-only'

import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { DirectImage } from '@/lib/anthropic/analyze-direct'

const SIGNED_URL_TTL_SECONDS = 600
/**
 * Teto de resolução enviado ao Stage 1.
 *
 * 800 → 1000 em 2026-07-26, junto com o recorte por pupila (±500 → 1000×1000).
 * Sem isso o `.resize()` abaixo reduziria a canônica de 1000 pra 800 e devolveria
 * o ganho de resolução (medido: íris de ⌀632px cairia pra ⌀506px).
 *
 * 1000×1000 = 1,0 MP cabe no orçamento de imagem do Sonnet 4.6 (~1,15 MP) SEM
 * redução server-side, e folgado no Sonnet 5 / Opus 4.8+ (3,75 MP). Custo de
 * imagem por leitura: ~5.120 → ~8.000 tokens (≈ +2 centavos de dólar).
 *
 * `withoutEnlargement: true` garante que imagem menor que isto NÃO é ampliada
 * (ampliar não adiciona informação e só custa token).
 */
const IMAGE_PX = 1000

export type ImageTier = 'canonical' | 'fallback'

export interface PreparedDirectImages {
  images: DirectImage[]
  imageCount: number
  /** # images where canonical_storage_path was NULL → raw original used. */
  fallbackCount: number
  perImage: { eye: string; angle: string; tier: ImageTier }[]
}

export type PrepareImagesError =
  | { ok: false; reason: 'no_images'; message?: string }
  | { ok: false; reason: 'sign_failed'; message: string }
  | { ok: false; reason: 'fetch_failed'; message: string }

export type PrepareImagesResult =
  | ({ ok: true } & PreparedDirectImages)
  | PrepareImagesError

export async function prepareDirectImages(
  service: SupabaseClient,
  readingId: string,
): Promise<PrepareImagesResult> {
  const { data: images, error: imgErr } = await service
    .from('reading_images')
    .select('eye, angle, storage_path, canonical_storage_path')
    .eq('reading_id', readingId)
  if (imgErr || !images || images.length === 0) {
    return { ok: false, reason: 'no_images', message: imgErr?.message }
  }

  const perImage: { eye: string; angle: string; tier: ImageTier }[] = images.map(
    (i) => ({
      eye: i.eye as string,
      angle: i.angle as string,
      tier: (i.canonical_storage_path ? 'canonical' : 'fallback') as ImageTier,
    }),
  )
  const fallbackCount = perImage.filter((p) => p.tier === 'fallback').length

  const paths = images.map(
    (i) => (i.canonical_storage_path as string | null) ?? (i.storage_path as string),
  )
  const { data: signed, error: signErr } = await service.storage
    .from('iris-captures')
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signed) {
    return {
      ok: false,
      reason: 'sign_failed',
      message: signErr?.message ?? 'unknown',
    }
  }

  let prepared: DirectImage[]
  try {
    prepared = await Promise.all(
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
      reason: 'fetch_failed',
      message: err instanceof Error ? err.message : 'unknown',
    }
  }

  // Queryable structured signal — drives (e) the >30%/2-week alert query and
  // (f) the in-report notice. One line per generation in the platform logs.
  console.log(
    '[canonical-fallback]',
    JSON.stringify({
      reading_id: readingId,
      fallback_count: fallbackCount,
      image_count: prepared.length,
      tiers: perImage,
    }),
  )

  return {
    ok: true,
    images: prepared,
    imageCount: prepared.length,
    fallbackCount,
    perImage,
  }
}
