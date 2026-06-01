import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock service-role Supabase client ---------------------------------------
// Tanto reserveCreditForReading quanto convertReservationToConsume (WR-07)
// despacham via RPC SECURITY DEFINER — não há mais query-builders chaináveis
// a mockar, apenas o rpc().
const rpcMock = vi.fn()
// readingHasReservation usa query-builder (.from().select().eq().in().limit()
// .maybeSingle()), não rpc — builder chainável dedicado.
const maybeSingleMock = vi.fn()
const reservationBuilder = {
  select: vi.fn(() => reservationBuilder),
  eq: vi.fn(() => reservationBuilder),
  in: vi.fn(() => reservationBuilder),
  limit: vi.fn(() => reservationBuilder),
  maybeSingle: maybeSingleMock,
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ rpc: rpcMock, from: () => reservationBuilder }),
}))
vi.mock('@/lib/audit/log', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}))
// Backstop #6: reserveCreditForReading chama startTrial idempotente no no_balance.
const startTrialMock = vi.fn()
vi.mock('../trial', () => ({
  startTrial: (...args: unknown[]) => startTrialMock(...args),
}))

import {
  convertReservationToConsume,
  reserveCreditForReading,
  readingHasReservation,
} from '../credits'

describe('reserveCreditForReading', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    startTrialMock.mockReset()
    // Default: trial já existe → backstop não retenta (não polui happy path nem no_balance real).
    startTrialMock.mockResolvedValue({ ok: true, created: false })
  })

  it('returns ok with credit source on RPC success', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ reservation_id: 'r1', credit_id: 'c1', source: 'credit' }],
      error: null,
    })
    const r = await reserveCreditForReading('u1', 'reading-1')
    expect(r).toEqual({
      ok: true,
      source: 'credit',
      reservation_id: 'r1',
      credit_id: 'c1',
    })
  })

  it('returns ok with internal source (credit_id null) on bypass', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ reservation_id: 'r2', credit_id: null, source: 'internal' }],
      error: null,
    })
    const r = await reserveCreditForReading('u1', 'reading-2')
    expect(r).toEqual({
      ok: true,
      source: 'internal',
      reservation_id: 'r2',
      credit_id: null,
    })
  })

  it('returns no_balance on RPC raise P0001', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'no_balance' },
    })
    const r = await reserveCreditForReading('u1', 'reading-1')
    expect(r).toEqual({ ok: false, reason: 'no_balance' })
  })

  it('returns db_error on generic RPC failure', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX000', message: 'connection refused' },
    })
    const r = await reserveCreditForReading('u1', 'reading-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('db_error')
  })

  // Backstop #6: trial frágil. no_balance + trial genuinamente ausente →
  // startTrial cria a row → retry reserva → terapeuta destrava na 1ª leitura.
  it('backstop: no_balance → startTrial cria trial → retry reserva com sucesso (trial)', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'no_balance' } })
      .mockResolvedValueOnce({
        data: [{ reservation_id: 'r-trial', credit_id: null, source: 'trial' }],
        error: null,
      })
    startTrialMock.mockResolvedValueOnce({ ok: true, created: true })

    const r = await reserveCreditForReading('u-novo', 'reading-1')
    expect(r).toEqual({
      ok: true,
      source: 'trial',
      reservation_id: 'r-trial',
      credit_id: null,
    })
    expect(startTrialMock).toHaveBeenCalledWith('u-novo')
    expect(rpcMock).toHaveBeenCalledTimes(2) // reserva inicial + retry
  })

  // Backstop NÃO re-concede: trial esgotado/encerrado (row já existe) →
  // startTrial created=false → sem retry → no_balance REAL preservado.
  it('backstop: no_balance + trial já existia (created=false) → não retenta, no_balance real', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'no_balance' },
    })
    startTrialMock.mockResolvedValueOnce({ ok: true, created: false })

    const r = await reserveCreditForReading('u-esgotado', 'reading-1')
    expect(r).toEqual({ ok: false, reason: 'no_balance' })
    expect(startTrialMock).toHaveBeenCalledWith('u-esgotado')
    expect(rpcMock).toHaveBeenCalledTimes(1) // sem retry
  })
})

// WR-07: convertReservationToConsume agora despacha pra RPC SECURITY DEFINER
// convert_reservation_to_consume (flip + debit + ledger atômicos). Os testes
// passam a mockar o RPC, não os query-builders.
describe('convertReservationToConsume (WR-07 atomic via RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('consumed → ok:false:already=false on outcome=consumed', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          outcome: 'consumed',
          reservation_id: 'res-1',
          user_id: 'u1',
          credit_id: 'c1',
        },
      ],
      error: null,
    })
    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: true, already: false })
    expect(rpcMock).toHaveBeenCalledWith('convert_reservation_to_consume', {
      p_reading_id: 'r1',
    })
  })

  it('trial/internal reservation (credit_id null) consumed atomically', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          outcome: 'consumed',
          reservation_id: 'res-1',
          user_id: 'u1',
          credit_id: null,
        },
      ],
      error: null,
    })
    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: true, already: false })
  })

  it('returns already=true when outcome=already (idempotent / race lost)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ outcome: 'already', reservation_id: null, user_id: null, credit_id: null }],
      error: null,
    })
    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: true, already: true })
  })

  it('returns not_found when outcome=not_found', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ outcome: 'not_found', reservation_id: null, user_id: null, credit_id: null }],
      error: null,
    })
    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: false, reason: 'not_found' })
  })

  it('returns db_error on RPC failure', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection refused' },
    })
    const r = await convertReservationToConsume('r1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('db_error')
  })
})

// Guard money-critical do redesign consume-na-geração: a 1ª geração reserva
// (gate), a regen reusa a reserva existente e NÃO cobra de novo. Sem ele,
// fifo_reserve_credit (não-idempotente por reading) cobraria 2× na regen.
describe('readingHasReservation (guard anti-double-charge)', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset()
  })

  it('true quando existe reserva active/converted (regen reusa, não cobra)', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'res-1' }, error: null })
    expect(await readingHasReservation('reading-1')).toBe(true)
  })

  it('false quando NÃO há reserva (1ª geração → reserve/gate roda)', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    expect(await readingHasReservation('reading-1')).toBe(false)
  })

  it('fail-safe: erro de query → true (nunca arrisca cobrança dupla)', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection refused' },
    })
    expect(await readingHasReservation('reading-1')).toBe(true)
  })
})
