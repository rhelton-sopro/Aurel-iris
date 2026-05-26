'use server'

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// 'use server' rule: SÓ async functions exportadas (memory feedback_use_server_export_hygiene).
export async function markTherapistInviteUsedAction(
  tokenId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!tokenId) return { ok: false, error: 'Token ausente.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthenticated' }

  // Service client porque therapist_invites tem RLS bloqueando authenticated.
  // Idempotência: UPDATE só roda se used_at IS NULL (cláusula extra).
  const service = createServiceClient()
  const { data, error } = await service
    .from('therapist_invites')
    .update({ used_at: new Date().toISOString(), used_by_user_id: user.id })
    .eq('token', tokenId)
    .is('used_at', null)
    .select('token')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) {
    return { ok: false, error: 'Convite não encontrado ou já usado.' }
  }
  return { ok: true }
}
