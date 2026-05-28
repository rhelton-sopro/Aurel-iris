import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export interface ActiveReservation {
  id: string
  reading_id: string
  credit_id: string | null
  source: 'trial' | 'credit'
  reserved_at: string
  expires_at: string
}

/**
 * Lista reservations 'active' do próprio terapeuta para o painel
 * "Processos em andamento" (D-11).
 *
 * Usa session client (RLS habilitado) — NUNCA service-role — pra garantir que
 * o terapeuta só vê as próprias reservas (T-08-05-05). O `source` é derivado de
 * credit_id (NULL = trial); 'internal' é indistinguível de 'trial' nesta camada
 * e a UI distingue via flag internal_use do profile.
 *
 * Nota: o schema (0035) usa `created_at` como timestamp de reserva — exposto
 * como `reserved_at` na API pública pra alinhar com a linguagem do domínio.
 */
export async function listActiveReservations(
  userId: string,
): Promise<ActiveReservation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('credit_reservations')
    .select('id, reading_id, credit_id, created_at, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: true })
  if (error) {
    console.error('[billing] listActiveReservations:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    reading_id: r.reading_id,
    credit_id: r.credit_id,
    source: r.credit_id ? 'credit' : 'trial',
    reserved_at: r.created_at,
    expires_at: r.expires_at,
  }))
}

export type CancelResult =
  | { ok: true; cancelled: boolean }
  | { ok: false; reason: 'unauthorized' | 'not_found' | 'db_error'; error?: string }

/**
 * Terapeuta cancela uma reservation manualmente — saldo volta (D-11).
 * Ownership verificado via SELECT.user_id ANTES do RPC (T-08-05-03).
 */
export async function cancelReservation(
  readingId: string,
  userId: string,
): Promise<CancelResult> {
  const service = createServiceClient()
  const { data: existing, error: selErr } = await service
    .from('credit_reservations')
    .select('user_id, status')
    .eq('reading_id', readingId)
    .maybeSingle()
  if (selErr) return { ok: false, reason: 'db_error', error: selErr.message }
  if (!existing) return { ok: false, reason: 'not_found' }
  if (existing.user_id !== userId) return { ok: false, reason: 'unauthorized' }
  if (existing.status !== 'active') return { ok: true, cancelled: false }

  const { data, error } = await service.rpc('release_reservation', {
    p_reading_id: readingId,
    p_reason: 'manual',
  })
  if (error) return { ok: false, reason: 'db_error', error: error.message }
  return { ok: true, cancelled: !!data }
}
