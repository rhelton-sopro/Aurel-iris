import 'server-only'

import { logAuditEvent } from '@/lib/audit/log'
import { createServiceClient } from '@/lib/supabase/service'

export type ReserveResult =
  | {
      ok: true
      source: 'internal' | 'trial' | 'credit'
      reservation_id: string
      credit_id: string | null
    }
  | { ok: false; reason: 'no_balance' | 'db_error' | 'concurrent_race'; error?: string }

/**
 * Único entry point pra "consumir" crédito (D-10/D-11).
 *
 * Despacha pra Postgres function fifo_reserve_credit (08-01) que:
 *   - bypassa se internal_use=true → source='internal', NUNCA debita
 *   - decrementa trial_readings_used se em trial → source='trial'
 *   - SELECT FOR UPDATE do crédito ativo mais antigo + incrementa leituras_reserved → source='credit'
 *
 * Atomicidade garantida via pg_advisory_xact_lock(user_id) dentro da função —
 * 5 reserves concorrentes pra trial=3 → exatamente 3 ok, 2 'no_balance'.
 */
export async function reserveCreditForReading(
  userId: string,
  readingId: string,
): Promise<ReserveResult> {
  const service = createServiceClient()
  const { data, error } = await service.rpc('fifo_reserve_credit', {
    p_user_id: userId,
    p_reading_id: readingId,
  })

  if (error) {
    // Postgres raises 'no_balance' como errcode custom P0001
    const msg = error.message ?? ''
    if (msg.includes('no_balance') || (error as { code?: string }).code === 'P0001') {
      return { ok: false, reason: 'no_balance' }
    }
    console.error('[billing] fifo_reserve_credit RPC failed:', error)
    return { ok: false, reason: 'db_error', error: msg }
  }

  // RPC retorna SETOF → data é array de uma linha
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return { ok: false, reason: 'db_error', error: 'RPC returned no rows' }
  }

  const result: ReserveResult = {
    ok: true,
    source: row.source as 'internal' | 'trial' | 'credit',
    reservation_id: row.reservation_id,
    credit_id: row.credit_id,
  }

  await logAuditEvent({
    event_type: 'credit.reserved',
    actor_user_id: userId,
    target_type: 'reading',
    target_id: readingId,
    metadata: {
      source: result.source,
      reservation_id: result.reservation_id,
      credit_id: result.credit_id,
    },
  })

  return result
}

export type ConsumeResult =
  | { ok: true; already: boolean }
  | { ok: false; reason: 'not_found' | 'db_error'; error?: string }

/**
 * Converte uma reservation 'active' → 'converted' + debita FIRMEMENTE do saldo.
 * Chamado pelo analyze route (08-07) quando o relatório gera com sucesso.
 *
 * Idempotent: se a reservation já não está 'active', no-op { ok:true, already:true }.
 * Trial reservation (credit_id NULL) só faz flip de status + transaction —
 * trial_readings_used JÁ foi decrementado no reserve (RESEARCH pitfall #7).
 */
export async function convertReservationToConsume(
  readingId: string,
): Promise<ConsumeResult> {
  const service = createServiceClient()

  // 1. SELECT reservation
  const { data: reservation, error: selErr } = await service
    .from('credit_reservations')
    .select('id, user_id, credit_id, status, reading_id')
    .eq('reading_id', readingId)
    .maybeSingle()
  if (selErr) {
    console.error('[billing] convert SELECT failed:', selErr.message)
    return { ok: false, reason: 'db_error', error: selErr.message }
  }
  if (!reservation) {
    console.warn(`[billing] convert: no reservation for reading=${readingId}`)
    return { ok: false, reason: 'not_found' }
  }
  if (reservation.status !== 'active') {
    // Idempotent: já converted/released/expired
    console.info(
      `[billing] convert: reservation already status=${reservation.status} reading=${readingId}`,
    )
    return { ok: true, already: true }
  }

  // 2. UPDATE status='converted' COM GUARD DE ESTADO (idempotente via WHERE)
  const { data: flipped, error: flipErr } = await service
    .from('credit_reservations')
    .update({ status: 'converted' })
    .eq('id', reservation.id)
    .eq('status', 'active') // race guard — só flipa se ainda active
    .select('id')
    .maybeSingle()
  if (flipErr) {
    console.error('[billing] convert UPDATE reservation failed:', flipErr.message)
    return { ok: false, reason: 'db_error', error: flipErr.message }
  }
  if (!flipped) {
    // Outro writer ganhou a corrida; trata como idempotent
    return { ok: true, already: true }
  }

  // 3. Se backed por crédito (não trial), debita firmemente
  if (reservation.credit_id) {
    const { data: credit, error: getErr } = await service
      .from('customer_credits')
      .select('leituras_remaining, leituras_reserved')
      .eq('id', reservation.credit_id)
      .maybeSingle()
    if (getErr || !credit) {
      console.error('[billing] convert: credit row not found', reservation.credit_id)
      return { ok: false, reason: 'db_error', error: getErr?.message ?? 'credit not found' }
    }
    await service
      .from('customer_credits')
      .update({
        leituras_remaining: Math.max(credit.leituras_remaining - 1, 0),
        leituras_reserved: Math.max(credit.leituras_reserved - 1, 0),
      })
      .eq('id', reservation.credit_id)
      .eq('user_id', reservation.user_id) // defensive (pitfall #9)
  }

  await service.from('credit_transactions').insert({
    user_id: reservation.user_id,
    credit_id: reservation.credit_id,
    reading_id: readingId,
    type: 'consume',
    amount: -1,
    notes: `analyze route converted reservation ${reservation.id}`,
  })

  await logAuditEvent({
    event_type: 'credit.consumed',
    actor_user_id: reservation.user_id,
    target_type: 'reading',
    target_id: readingId,
    metadata: { reservation_id: reservation.id, credit_id: reservation.credit_id },
  })

  console.info(
    `[billing] CONSUMED reading=${readingId} reservation=${reservation.id} credit=${reservation.credit_id ?? 'TRIAL'}`,
  )
  return { ok: true, already: false }
}
