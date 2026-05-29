import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock service-role Supabase client ---------------------------------------
// Tanto reserveCreditForReading quanto convertReservationToConsume (WR-07)
// despacham via RPC SECURITY DEFINER — não há mais query-builders chaináveis
// a mockar, apenas o rpc().
const rpcMock = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ rpc: rpcMock }),
}))
vi.mock('@/lib/audit/log', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

import { convertReservationToConsume, reserveCreditForReading } from '../credits'

describe('reserveCreditForReading', () => {
  beforeEach(() => {
    rpcMock.mockReset()
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
