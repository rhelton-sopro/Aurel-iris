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
  // Dirigido pela readings (não por reading_images): leituras de convite às
  // vezes NÃO têm rows em reading_images, então buscar por lá as deixava
  // invisíveis ao cron — fotos eternas no storage. purgeIrisPhotos deleta pelo
  // prefixo do storage, então leitura sem foto vira no-op (removed:0, ok).
  //
  // ⭐ O RELÓGIO CONTA DA ÚLTIMA FOTO (founder, 2026-08-10). Antes contava de
  // `readings.created_at` — o momento em que o cliente ABRE o link e começa. Quem
  // começava e demorava a terminar perdia janela sem saber: abrir hoje, tirar 3
  // fotos e voltar depois de amanhã significava encontrar as 3 primeiras já
  // apagadas — captura incompleta e irrecuperável. Contar do fim da captura é
  // também o que o termo assinado promete, literalmente: "no máximo 24 horas
  // após o ENVIO".
  //
  // `created_at` segue como PENEIRA barata (a última foto nunca é anterior à
  // criação, então nada expirado escapa) e como regra para leitura SEM foto
  // registrada — que continua sendo purgada, senão volta o problema das fotos
  // eternas no storage.
  const cutoff = new Date(Date.now() - TTL_MS).toISOString()
  const { data: oldRaw, error: oldErr } = await service
    .from('readings')
    // images_purged_at é da migration 0043 — fora dos types gerados; cast isola.
    .select('id, images_purged_at' as never)
    .lt('created_at', cutoff)
    .is('images_purged_at' as never, null)
    .limit(1000)

  if (oldErr) {
    console.error('[photo-ttl] pass A list falhou:', oldErr.message)
    result.errors += 1
  } else {
    const rows = (oldRaw ?? []) as unknown as Array<{ id: string }>
    for (const row of rows) {
      const { data: ultima } = await service
        .from('reading_images')
        .select('created_at')
        .eq('reading_id', row.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ created_at: string }>()

      // Ainda dentro das 24h contadas do fim da captura — deixa viver.
      if (ultima?.created_at && ultima.created_at >= cutoff) continue

      const r = await purgeIrisPhotos(service, row.id, 'ttl_24h')
      if (r.skipped) continue // founder isento — não conta como purga
      if (r.ok) result.ttl_purged += 1
      else result.errors += 1
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
        if (r.skipped) continue // founder isento — não conta como purga
        if (r.ok) result.catchup_purged += 1
        else result.errors += 1
      }
    }
  }

  return result
}
