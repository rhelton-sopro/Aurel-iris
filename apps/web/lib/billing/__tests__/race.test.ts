import { beforeEach, describe, expect, it, vi } from 'vitest'

// =============================================================================
// RACE TEST — REAL DB INTEGRATION (skipped por default)
// =============================================================================
// Habilitar manualmente contra Supabase sandbox/linked test schema:
//
//   INTEGRATION=true RACE_TEST_USER_ID=<uuid> pnpm vitest run \
//     lib/billing/__tests__/race.test.ts
//
// Pré-requisito: o user RACE_TEST_USER_ID existe em profiles com
// internal_use=false. O teste reseta trial_status (max=3, used=0) e dispara
// 5 reserves concorrentes → exige exatamente 3 ok + 2 no_balance.
// Valida o pitfall #3 do RESEARCH (FIFO race) via fifo_reserve_credit RPC.
// NÃO bloqueia CI green normal.
const INTEGRATION = process.env.INTEGRATION === 'true'
const describeIf = INTEGRATION ? describe : describe.skip

describeIf('FIFO race condition — REAL DB INTEGRATION', () => {
  it(
    '5 concurrent reserves on trial_max=3 → exactly 3 succeed',
    async () => {
      const { createServiceClient } = await import('@/lib/supabase/service')
      const { reserveCreditForReading } = await import('../credits')
      const userId = process.env.RACE_TEST_USER_ID
      if (!userId) throw new Error('Set RACE_TEST_USER_ID env')

      const service = createServiceClient()
      // Reset trial state
      await service.from('credit_reservations').delete().eq('user_id', userId)
      await service.from('credit_transactions').delete().eq('user_id', userId)
      await service.from('trial_status').upsert({
        user_id: userId,
        trial_readings_used: 0,
        trial_readings_max: 3,
        trial_started_at: new Date().toISOString(),
        trial_expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      })

      const promises = Array.from({ length: 5 }, (_, i) =>
        reserveCreditForReading(
          userId,
          `00000000-0000-0000-0000-00000000000${i}`,
        ),
      )
      const results = await Promise.all(promises)
      const successes = results.filter((r) => r.ok).length
      const failures = results.filter(
        (r) => !r.ok && (r as { reason: string }).reason === 'no_balance',
      ).length
      expect(successes).toBe(3)
      expect(failures).toBe(2)

      // Cleanup
      await service.from('credit_reservations').delete().eq('user_id', userId)
      await service.from('credit_transactions').delete().eq('user_id', userId)
    },
    30_000,
  )
})

// =============================================================================
// UNIT — reservations service (listActiveReservations + cancelReservation)
// =============================================================================
const rpcMock = vi.fn()
const selectMock = vi.fn()
const eqMock = vi.fn()
const orderMock = vi.fn()
const maybeSingleMock = vi.fn()

// Session client (RLS) usado por listActiveReservations
const sessionFrom = {
  select: selectMock,
  eq: eqMock,
  order: orderMock,
}
// Service client (RPC + ownership SELECT) usado por cancelReservation
const serviceFrom = {
  select: selectMock,
  eq: eqMock,
  maybeSingle: maybeSingleMock,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => sessionFrom }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ rpc: rpcMock, from: () => serviceFrom }),
}))

import { cancelReservation, listActiveReservations } from '../reservations'

describe('listActiveReservations', () => {
  beforeEach(() => {
    selectMock.mockReset().mockReturnValue(sessionFrom)
    eqMock.mockReset().mockReturnValue(sessionFrom)
    orderMock.mockReset()
  })

  it('maps active reservations with source derived from credit_id', async () => {
    orderMock.mockResolvedValueOnce({
      data: [
        {
          id: 'res-1',
          reading_id: 'rd-1',
          credit_id: 'c1',
          created_at: '2026-05-20T00:00:00Z',
          expires_at: '2026-05-27T00:00:00Z',
        },
        {
          id: 'res-2',
          reading_id: 'rd-2',
          credit_id: null,
          created_at: '2026-05-21T00:00:00Z',
          expires_at: '2026-05-28T00:00:00Z',
        },
      ],
      error: null,
    })
    const r = await listActiveReservations('u1')
    expect(r).toHaveLength(2)
    expect(r[0]).toEqual({
      id: 'res-1',
      reading_id: 'rd-1',
      credit_id: 'c1',
      source: 'credit',
      reserved_at: '2026-05-20T00:00:00Z',
      expires_at: '2026-05-27T00:00:00Z',
    })
    expect(r[1].source).toBe('trial')
  })

  it('returns [] on query error', async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const r = await listActiveReservations('u1')
    expect(r).toEqual([])
  })
})

describe('cancelReservation', () => {
  beforeEach(() => {
    selectMock.mockReset().mockReturnValue(serviceFrom)
    eqMock.mockReset().mockReturnValue(serviceFrom)
    maybeSingleMock.mockReset()
    rpcMock.mockReset()
  })

  it('releases when owner + active', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { user_id: 'u1', status: 'active' },
      error: null,
    })
    rpcMock.mockResolvedValueOnce({ data: true, error: null })
    const r = await cancelReservation('rd-1', 'u1')
    expect(r).toEqual({ ok: true, cancelled: true })
    expect(rpcMock).toHaveBeenCalledWith('release_reservation', {
      p_reading_id: 'rd-1',
      p_reason: 'manual',
    })
  })

  it('returns unauthorized when reservation belongs to another user', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { user_id: 'other', status: 'active' },
      error: null,
    })
    const r = await cancelReservation('rd-1', 'u1')
    expect(r).toEqual({ ok: false, reason: 'unauthorized' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns not_found when reservation missing', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const r = await cancelReservation('rd-1', 'u1')
    expect(r).toEqual({ ok: false, reason: 'not_found' })
  })

  it('returns cancelled=false (no-op) when already non-active', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { user_id: 'u1', status: 'converted' },
      error: null,
    })
    const r = await cancelReservation('rd-1', 'u1')
    expect(r).toEqual({ ok: true, cancelled: false })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns db_error on ownership SELECT failure', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'conn refused' },
    })
    const r = await cancelReservation('rd-1', 'u1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('db_error')
  })
})
