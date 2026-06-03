import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { purgeIrisPhotos } from '@/lib/capture/delete-iris-photos'

const TTL_MS = 24 * 60 * 60 * 1000

export interface TtlSweepResult {
  ttl_purged: number
  catchup_purged: number
  errors: number
}

/**
 * Varredura horária do ciclo de vida da foto da íris (cron /api/cron/photo-ttl).
 *
 * Dois passes, ambos idempotentes (purgeIrisPhotos só carimba quem realmente
 * apagou; re-rodar é no-op):
 *
 *  A) TTL 24h (a promessa pública): apaga toda foto com upload > 24h que ainda
 *     não foi purgada — independente do estado do relatório. Cumpre o "no
 *     máximo 24h" da LP/FAQ.
 *  B) Catch-up: relatório completo cuja deleção síncrona na geração falhou
 *     (storage hiccup) — apaga já, sem esperar 24h, pra honrar "apagada na
 *     geração". Bounded ao conjunto não-purgado (índice 0043).
 *
 * Bounded por design (volume beta pequeno). Cada falha é contada e não aborta
 * as demais.
 */
export async function purgeExpiredIrisPhotos(): Promise<TtlSweepResult> {
  const service = createServiceClient()
  const result: TtlSweepResult = { ttl_purged: 0, catchup_purged: 0, errors: 0 }

  // ── Pass A: TTL 24h ────────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - TTL_MS).toISOString()
  const { data: oldImgs, error: oldErr } = await service
    .from('reading_images')
    .select('reading_id, created_at')
    .lt('created_at', cutoff)

  if (oldErr) {
    console.error('[photo-ttl] pass A list falhou:', oldErr.message)
    result.errors += 1
  } else {
    const candidateIds = [...new Set((oldImgs ?? []).map((i) => i.reading_id))]
    if (candidateIds.length > 0) {
      // images_purged_at é da migration 0043 — ainda fora dos types gerados
      // (founder regenera após db push). Cast isola o type-check.
      const { data: rowsRaw } = await service
        .from('readings')
        .select('id, images_purged_at' as never)
        .in('id', candidateIds)
      const rows = (rowsRaw ?? []) as unknown as Array<{
        id: string
        images_purged_at: string | null
      }>
      const toPurge = rows
        .filter((r) => r.images_purged_at == null)
        .map((r) => r.id)
      for (const id of toPurge) {
        const r = await purgeIrisPhotos(service, id, 'ttl_24h')
        if (r.ok) result.ttl_purged += 1
        else result.errors += 1
      }
    }
  }

  // ── Pass B: catch-up de completos não-purgados ─────────────────────────
  const { data: pendingRaw, error: pendErr } = await service
    .from('readings')
    .select('id, audit_metadata')
    .is('images_purged_at' as never, null)
    .not('report_generated', 'is', null)
    .limit(500)

  if (pendErr) {
    console.error('[photo-ttl] pass B list falhou:', pendErr.message)
    result.errors += 1
  } else {
    const pending = (pendingRaw ?? []) as unknown as Array<{
      id: string
      audit_metadata: { section_completeness?: { complete?: boolean } } | null
    }>
    for (const row of pending) {
      const complete = row.audit_metadata?.section_completeness?.complete
      if (complete === true) {
        const r = await purgeIrisPhotos(service, row.id, 'audit_complete')
        if (r.ok) result.catchup_purged += 1
        else result.errors += 1
      }
    }
  }

  return result
}
