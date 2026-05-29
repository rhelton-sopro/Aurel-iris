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
 * WR-07: o flip de status + decrement de saldo + ledger agora rodam numa ÚNICA
 * TX via a função SECURITY DEFINER `convert_reservation_to_consume` (0040). Antes
 * eram 2-3 round-trips não-atômicos: um crash entre o flip e o decrement deixava
 * a reservation 'converted' mas leituras_reserved nunca decrementado — travando
 * 1 slot pra sempre. Espelha a atomicidade de fifo_reserve_credit.
 *
 * Idempotent: se a reservation já não está 'active', no-op { ok:true, already:true }.
 * Trial/internal reservation (credit_id NULL) só faz flip + ledger — o saldo de
 * trial JÁ foi decrementado no reserve (RESEARCH pitfall #7).
 */
export async function convertReservationToConsume(
  readingId: string,
): Promise<ConsumeResult> {
  const service = createServiceClient()

  const { data, error } = await service.rpc('convert_reservation_to_consume', {
    p_reading_id: readingId,
  })
  if (error) {
    console.error('[billing] convert RPC failed:', error.message)
    return { ok: false, reason: 'db_error', error: error.message }
  }

  // RPC retorna SETOF → array de uma linha { outcome, reservation_id, user_id, credit_id }
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        outcome: 'consumed' | 'already' | 'not_found'
        reservation_id: string | null
        user_id: string | null
        credit_id: string | null
      }
    | undefined
  if (!row) {
    return { ok: false, reason: 'db_error', error: 'RPC returned no rows' }
  }

  if (row.outcome === 'not_found') {
    console.warn(`[billing] convert: no reservation for reading=${readingId}`)
    return { ok: false, reason: 'not_found' }
  }
  if (row.outcome === 'already') {
    console.info(`[billing] convert: reservation already settled reading=${readingId}`)
    return { ok: true, already: true }
  }

  // outcome === 'consumed' — flip + débito firme + ledger aplicados atomicamente
  // na função (WR-07). Audit é best-effort, OFF da TX crítica (já commitada).
  await logAuditEvent({
    event_type: 'credit.consumed',
    actor_user_id: row.user_id ?? '',
    target_type: 'reading',
    target_id: readingId,
    metadata: { reservation_id: row.reservation_id, credit_id: row.credit_id },
  }).catch((err) =>
    console.warn(
      '[billing] convert audit failed (non-fatal):',
      err instanceof Error ? err.message : err,
    ),
  )

  console.info(
    `[billing] CONSUMED reading=${readingId} reservation=${row.reservation_id} credit=${row.credit_id ?? 'TRIAL'}`,
  )
  return { ok: true, already: false }
}
