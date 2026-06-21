import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import type { SocialPost } from '@/lib/admin/social-posts'

/**
 * Fase 12 (Publicação Instagram) — helper de claim atômico do cron sweep.
 *
 * Reivindica em LOTE os posts agendados vencidos chamando a RPC
 * `claim_due_social_posts` (migration 0049): flipa `agendado → publicando` com
 * `for update skip locked`, então dois cron runs sobrepostos NUNCA pegam a mesma
 * row (IGPUB-02, T-12-01). A RPC já garante idempotência no banco — este helper
 * só expõe o contrato consumido por `publishDuePosts` (Plan 03, Wave 2).
 *
 * Retorna o array de rows reivindicadas (já em status `publicando`). Em concorrência,
 * a 2ª passada recebe `[]` porque as rows já saíram do filtro `status='agendado'`.
 *
 * NOTA (Wave 0 contract): esta é a assinatura estável. O Plan 03 estende este
 * arquivo com o pipeline completo (container → poll → media_publish → grava
 * resultado), reusando este `claimDue` como o portão de idempotência.
 */
export async function claimDue(
  service: SupabaseClient<Database>,
  pLimit: number,
): Promise<SocialPost[]> {
  const { data, error } = await (
    service.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )('claim_due_social_posts', { p_limit: pLimit })

  if (error) {
    throw new Error(`claimDue(${pLimit}): ${error.message}`)
  }
  return (data ?? []) as SocialPost[]
}
