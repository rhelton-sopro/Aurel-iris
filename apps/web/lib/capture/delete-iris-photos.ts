import 'server-only'

import type { createServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceClient>

export type IrisPurgeReason = 'audit_complete' | 'ttl_24h'

export interface PurgeResult {
  ok: boolean
  removed: number
  error?: string
}

/**
 * Apaga PARA SEMPRE as fotos da íris de uma leitura — originais + canônicas —
 * do bucket `iris-captures`, e carimba `images_purged_at`/`images_purge_reason`
 * na readings (idempotência do cron + sinal de UI + trilha LGPD).
 *
 * Best-effort por design: o produto é o relatório (texto), não a foto. Falha de
 * storage NUNCA deve bloquear a entrega. As rows de reading_images são MANTIDAS
 * (os paths apontam pra blobs que deixaram de existir) — preserva metadados
 * (eye/angle/quality_score) pra analytics sem reter o dado biométrico.
 *
 * Idempotente: chamar de novo após apagar é no-op (storage.remove em path
 * inexistente não erra; o carimbo só sobrescreve com o mesmo sentido).
 *
 * 0043: requer migration das colunas images_purged_at/images_purge_reason.
 */
export async function purgeIrisPhotos(
  service: ServiceClient,
  readingId: string,
  reason: IrisPurgeReason,
): Promise<PurgeResult> {
  const { data: images, error: listErr } = await service
    .from('reading_images')
    .select('storage_path, canonical_storage_path')
    .eq('reading_id', readingId)

  if (listErr) {
    return { ok: false, removed: 0, error: listErr.message }
  }

  const paths = (images ?? []).flatMap((i) =>
    [i.storage_path, i.canonical_storage_path].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    ),
  )

  if (paths.length > 0) {
    const { error: removeErr } = await service.storage
      .from('iris-captures')
      .remove(paths)
    if (removeErr) {
      // Não carimba purged se a remoção falhou — deixa o cron tentar de novo.
      return { ok: false, removed: 0, error: removeErr.message }
    }
  }

  await service
    .from('readings')
    .update({
      images_purged_at: new Date().toISOString(),
      images_purge_reason: reason,
    } as never)
    .eq('id', readingId)

  return { ok: true, removed: paths.length }
}
