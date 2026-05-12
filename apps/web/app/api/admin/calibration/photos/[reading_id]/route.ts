/**
 * GET /api/admin/calibration/photos/[reading_id]
 *
 * Returns 6 signed URLs (TTL=24h) for download by the founder via the
 * /admin/calibration/[id] page. The browser downloads each separately
 * (no server-side zipping — avoids Vercel function memory issues with
 * 6×2-3MB photos).
 *
 * Defense-in-depth founder gate: middleware already protects /admin/* but
 * /api/admin/* is a separate matcher. We re-check here.
 *
 * Response shape:
 *   { signedUrls: [{ eye, angle, url, filename, canonical_url }] }
 *
 * canonical_url (Phase 07.1.6): signed URL para canonical_storage_path se
 * non-NULL, senão null. Mesmo TTL=24h dos originais. Permite UI futura
 * mostrar canonical vs original side-by-side (deferred — Plan 06 só adiciona
 * o field ao JSON; consumer apenas o RecanonicalizeButton via /admin page).
 *
 * Phase 7.1 | Plan 07.1-03 Task 6 (original) + Phase 07.1.6 | Plan 06 Task 3 (canonical_url extension).
 */
import { NextResponse } from 'next/server'

import { isFounderEmail } from '@/lib/auth/founder'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 // 24h — for download flow.

interface SignedPhotoEntry {
  eye: string
  angle: string
  url: string
  filename: string
  /** Phase 07.1.6 — signed URL para canonical_storage_path. null se canonical_storage_path IS NULL. */
  canonical_url: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reading_id: string }> },
): Promise<NextResponse> {
  const { reading_id: readingId } = await params

  // 1. Defense-in-depth founder gate.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return new NextResponse(null, { status: 404 })
  }

  // 2. Service-role fetch reading_images (admin sees cross-therapist).
  //    Phase 07.1.6: canonical_storage_path adicionado ao select para alimentar
  //    o canonical_url no payload (signed URL paralelo ao original).
  const service = createServiceClient()
  const { data: images, error: imagesError } = await service
    .from('reading_images')
    .select('eye, angle, storage_path, canonical_storage_path')
    .eq('reading_id', readingId)

  if (imagesError) {
    return NextResponse.json(
      { error: `Failed to fetch images: ${imagesError.message}` },
      { status: 500 },
    )
  }
  if (!images || images.length === 0) {
    return NextResponse.json({ signedUrls: [] })
  }

  // 3. Generate signed URLs (TTL=24h).
  const paths = images.map(img => img.storage_path)
  const { data: signed, error: signedError } = await service.storage
    .from('iris-captures')
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

  if (signedError || !signed) {
    return NextResponse.json(
      { error: `Failed to sign URLs: ${signedError?.message ?? 'unknown'}` },
      { status: 500 },
    )
  }

  // Phase 07.1.6: separate signed URL batch para canonical paths.
  // canonical_storage_path is nullable per row; build a parallel array of
  // index-matched pairs (filter NULLs — Supabase createSignedUrls rejects empty
  // strings) and remap by original index post-sign para preservar alinhamento
  // com images[].
  const canonicalPathPairs = images
    .map((img, idx) => ({
      idx,
      path: img.canonical_storage_path,
    }))
    .filter(
      (p): p is { idx: number; path: string } =>
        typeof p.path === 'string' && p.path.length > 0,
    )

  const canonicalUrlByIndex = new Map<number, string>()
  if (canonicalPathPairs.length > 0) {
    const { data: signedCanonical, error: canSignError } = await service.storage
      .from('iris-captures')
      .createSignedUrls(
        canonicalPathPairs.map(p => p.path),
        SIGNED_URL_TTL_SECONDS,
      )
    if (canSignError) {
      // Non-fatal: originais já signed; canonical_url cai para null per-image.
      console.error(
        `[photos] canonical sign error reading=${readingId}: ${canSignError.message}`,
      )
    } else if (signedCanonical) {
      canonicalPathPairs.forEach((pair, k) => {
        const signedUrl = signedCanonical[k]?.signedUrl
        if (signedUrl) canonicalUrlByIndex.set(pair.idx, signedUrl)
      })
    }
  }

  const signedUrls: SignedPhotoEntry[] = images
    .map((img, idx) => {
      const url = signed[idx]?.signedUrl
      if (!url) return null
      return {
        eye: img.eye,
        angle: img.angle,
        url,
        filename: `${readingId}_${img.eye}_${img.angle}.jpg`,
        canonical_url: canonicalUrlByIndex.get(idx) ?? null,
      }
    })
    .filter((entry): entry is SignedPhotoEntry => entry !== null)

  return NextResponse.json({ signedUrls })
}
