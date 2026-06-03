import 'server-only'

import type { createServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceClient>

export type IrisPurgeReason = 'audit_complete' | 'ttl_24h'

export interface PurgeResult {
  ok: boolean
  removed: number
  error?: string
}

const BUCKET = 'iris-captures'

/**
 * Lista RECURSIVAMENTE todos os arquivos sob um prefixo do storage.
 *
 * Supabase `list(prefix)` retorna só os filhos imediatos: arquivos têm `id`
 * preenchido; subpastas vêm com `id === null`. Descemos nas subpastas
 * (originais/, canonical/, e qualquer outra) acumulando os paths completos.
 * Profundidade real é 2 (originais|canonical/arquivo), mas a recursão é geral.
 */
async function listAllFilePaths(
  service: ServiceClient,
  prefix: string,
): Promise<string[]> {
  const { data, error } = await service.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 })
  if (error) throw new Error(error.message)

  const paths: string[] = []
  for (const entry of data ?? []) {
    const full = `${prefix}/${entry.name}`
    if (entry.id === null) {
      // Subpasta → desce. (Supabase marca pasta com id null.)
      paths.push(...(await listAllFilePaths(service, full)))
    } else {
      paths.push(full)
    }
  }
  return paths
}

/**
 * Apaga PARA SEMPRE as fotos da íris de uma leitura — TUDO sob o prefixo
 * `{therapist_id}/{reading_id}/` no bucket `iris-captures` (originais +
 * canônicas + qualquer formato antigo solto) — e carimba
 * `images_purged_at`/`images_purge_reason` na readings (idempotência do cron +
 * sinal de UI + trilha LGPD).
 *
 * v2 (2026-06-03): deleta pelo PREFIXO determinístico do storage, NÃO mais por
 * `reading_images.storage_path`. A versão anterior dependia das rows de
 * reading_images — quando elas faltavam (várias leituras de convite não têm) ou
 * o path divergia, `paths` ficava vazio → o storage NÃO era tocado mas o
 * carimbo era posto mesmo assim (falso "purgado"). 98 fotos ficaram órfãs em
 * prod. O prefixo é a fonte da verdade física: pega tudo, imune a drift.
 *
 * Best-effort por design: o produto é o relatório (texto), não a foto. As rows
 * de reading_images são MANTIDAS (metadados eye/angle/quality_score p/ analytics
 * sem reter o dado biométrico). NÃO carimba se a remoção falhar — deixa o cron
 * tentar de novo.
 *
 * Idempotente: re-rodar após apagar é no-op (prefixo vazio → removed:0, ok:true).
 *
 * 0043: requer migration das colunas images_purged_at/images_purge_reason.
 */
export async function purgeIrisPhotos(
  service: ServiceClient,
  readingId: string,
  reason: IrisPurgeReason,
): Promise<PurgeResult> {
  // therapist_id compõe o prefixo do storage ({therapist_id}/{reading_id}/...).
  const { data: reading, error: readErr } = await service
    .from('readings')
    .select('therapist_id')
    .eq('id', readingId)
    .maybeSingle()
  if (readErr) {
    return { ok: false, removed: 0, error: readErr.message }
  }
  const therapistId = (reading as { therapist_id?: string | null } | null)
    ?.therapist_id
  if (!therapistId) {
    return { ok: false, removed: 0, error: 'reading sem therapist_id' }
  }

  const prefix = `${therapistId}/${readingId}`

  let paths: string[]
  try {
    paths = await listAllFilePaths(service, prefix)
  } catch (err) {
    return {
      ok: false,
      removed: 0,
      error: err instanceof Error ? err.message : 'list falhou',
    }
  }

  if (paths.length > 0) {
    const { error: removeErr } = await service.storage
      .from(BUCKET)
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
