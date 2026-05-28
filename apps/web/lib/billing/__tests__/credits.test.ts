import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock service-role Supabase client ---------------------------------------
// O query builder é chainável (select/update/eq retornam `this`) E awaitável no
// fim de uma chain. Dois shapes terminais precisam de controle explícito:
//   - `.maybeSingle()` (SELECT reservation, UPDATE...select, SELECT credit)
//   - o UPDATE bare-awaited de customer_credits (sem maybeSingle) resolve via
//     thenable do builder, consumindo `nextAwait`.
const rpcMock = vi.fn()
const selectMock = vi.fn()
const updateMock = vi.fn()
const insertMock = vi.fn()
const eqMock = vi.fn()
const maybeSingleMock = vi.fn()

let nextAwait: Array<{ data: unknown; error: unknown }> = []

const builder = {
  select: selectMock,
  update: updateMock,
  insert: insertMock,
  eq: eqMock,
  maybeSingle: maybeSingleMock,
  then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
    const v = nextAwait.shift() ?? { data: null, error: null }
    return Promise.resolve(v).then(onFulfilled)
  },
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ rpc: rpcMock, from: () => builder }),
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

describe('convertReservationToConsume', () => {
  beforeEach(() => {
    selectMock.mockReset().mockReturnValue(builder)
    updateMock.mockReset().mockReturnValue(builder)
    eqMock.mockReset().mockReturnValue(builder)
    insertMock.mockReset().mockResolvedValue({ error: null })
    maybeSingleMock.mockReset()
    nextAwait = []
  })

  it('flips active reservation + decrements credit + inserts transaction', async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: {
          id: 'res-1',
          user_id: 'u1',
          credit_id: 'c1',
          status: 'active',
          reading_id: 'r1',
        },
        error: null,
      }) // SELECT reservation
      .mockResolvedValueOnce({ data: { id: 'res-1' }, error: null }) // UPDATE...select
      .mockResolvedValueOnce({
        data: { leituras_remaining: 5, leituras_reserved: 1 },
        error: null,
      }) // SELECT credit
    // bare-awaited customer_credits UPDATE resolve via thenable
    nextAwait.push({ data: null, error: null })

    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: true, already: false })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'consume', amount: -1, reading_id: 'r1' }),
    )
  })

  it('returns already=true when reservation status != active', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'res-1',
        user_id: 'u1',
        credit_id: 'c1',
        status: 'converted',
        reading_id: 'r1',
      },
      error: null,
    })
    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: true, already: true })
  })

  it('returns already=true when concurrent writer won the flip', async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: {
          id: 'res-1',
          user_id: 'u1',
          credit_id: 'c1',
          status: 'active',
          reading_id: 'r1',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null }) // UPDATE returned nothing (race lost)
    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: true, already: true })
  })

  it('returns not_found when reservation missing', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: false, reason: 'not_found' })
  })

  it('handles trial reservation (credit_id=null) without credit update', async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: {
          id: 'res-1',
          user_id: 'u1',
          credit_id: null,
          status: 'active',
          reading_id: 'r1',
        },
        error: null,
      }) // SELECT reservation
      .mockResolvedValueOnce({ data: { id: 'res-1' }, error: null }) // UPDATE...select
    const r = await convertReservationToConsume('r1')
    expect(r).toEqual({ ok: true, already: false })
    // Não deve consultar o crédito (só 2 maybeSingle, não 3)
    expect(maybeSingleMock).toHaveBeenCalledTimes(2)
  })
})
