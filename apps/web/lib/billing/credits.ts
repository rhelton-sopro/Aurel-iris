import 'server-only'

import { logAuditEvent } from '@/lib/audit/log'
import { createServiceClient } from '@/lib/supabase/service'

import { startTrial } from './trial'

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
  let result = await reserveOnce(userId, readingId)

  // Backstop #6 (trial frágil): a trial_status só nasce client-side pós-verifyOtp
  // (best-effort, .ok ignorado) e o trigger handle_new_user NÃO a cria. Se aquela
  // janela falhou (aba fecha / rede cai / action lança), o terapeuta chega aqui
  // SEM trial row e leva no_balance ANTES da 1ª leitura grátis — matando o
  // onboarding. startTrial é idempotente: se CRIOU a row (trial genuinamente
  // ausente = o bug), reservamos de novo e ele destrava; se a row já existia
  // (trial esgotado/encerrado manual), created=false → não retenta, devolve o
  // no_balance REAL. Custo (INSERT extra) só no caminho de falha; happy path
  // intocado. Ver [[project_pente_fino_backlog_2026_05_31]] #6.
  if (!result.ok && result.reason === 'no_balance') {
    const trial = await startTrial(userId)
    if (trial.created) {
      console.info(
        `[billing] trial backstop criou trial p/ user=${userId} — retry reserve`,
      )
      result = await reserveOnce(userId, readingId)
    }
  }

  return result
}

/** Uma tentativa de reserva via RPC + mapeamento de erro + audit no sucesso. */
async function reserveOnce(
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

/**
 * Já existe reserva (ativa OU convertida) pra esta leitura?
 *
 * Usado pelo GATE de geração (Fase 8 redesign — consume-na-geração): a 1ª
 * geração reserva (gate de saldo); a REGEN reusa a reserva existente e NÃO
 * cobra de novo. Crítico porque `fifo_reserve_credit` NÃO é idempotente por
 * reading_id (sempre faz INSERT de nova reserva) — sem este guard, regenerar
 * criaria uma 2ª reserva = COBRANÇA DUPLA. 1 leitura = 1 crédito, regen grátis.
 *
 * status 'released'/'expired' não contam (a reserva foi devolvida ao pool, a
 * leitura pode reservar de novo).
 *
 * Fail-safe: em erro de query, retorna TRUE (assume que já tem reserva → NÃO
 * re-reserva). Prefere perder uma cobrança rara a cobrar em dobro do cliente.
 */
export async function readingHasReservation(readingId: string): Promise<boolean> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('credit_reservations')
    .select('id')
    .eq('reading_id', readingId)
    .in('status', ['active', 'converted'])
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[billing] readingHasReservation query failed:', error.message)
    return true // fail-safe: nunca arrisca double-charge
  }
  return Boolean(data)
}

/**
 * Existe reserva **ATIVA** (ainda não convertida) pra esta leitura?
 *
 * Criada em 2026-07-30, quando o DOSSIÊ passou a ser um segundo documento cobrável
 * da mesma leitura (1 crédito próprio). O guard acima (`readingHasReservation`) não
 * serve aí: ele conta a reserva já CONVERTIDA do Mapa do Ser e concluiria "já tem",
 * entregando o Dossiê de graça.
 *
 * ⚠️ O que este guard protege: `convert_reservation_to_consume` (migration 0042)
 * converte **por reading_id** — se houvesse DUAS reservas ativas na mesma leitura, o
 * UPDATE marcaria as duas como 'converted' e debitaria UM crédito só, deixando
 * `leituras_reserved` com drift permanente. Reusando a ativa órfã (em vez de criar
 * outra), nunca existe mais de uma ativa por leitura e o débito fecha 1-para-1.
 *
 * Fail-safe idêntico ao do irmão: erro de query → TRUE (não re-reserva, não arrisca
 * cobrar em dobro).
 */
export async function readingHasActiveReservation(readingId: string): Promise<boolean> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('credit_reservations')
    .select('id')
    .eq('reading_id', readingId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[billing] readingHasActiveReservation query failed:', error.message)
    return true // fail-safe: nunca arrisca double-charge
  }
  return Boolean(data)
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

  // RPC cast: types do DB ainda não regeneradas pós-migration 0040 (founder
  // aplica db push). Mesmo padrão de cast usado pra tabelas novas no repo.
  const { data, error } = await (
    service.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )('convert_reservation_to_consume', { p_reading_id: readingId })
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
