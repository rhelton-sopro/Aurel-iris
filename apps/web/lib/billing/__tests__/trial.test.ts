import { describe, expect, it, vi } from 'vitest'

import { evaluateTrial } from '../trial'

const now = new Date('2026-05-27T00:00:00Z')

describe('evaluateTrial', () => {
  it('returns no_trial when row is null', () => {
    expect(evaluateTrial(null, now)).toEqual({ status: 'no_trial' })
  })
  it('returns ended when ended_at is set (manual)', () => {
    expect(
      evaluateTrial(
        {
          trial_started_at: '2026-03-01',
          trial_expires_at: '2026-05-30',
          trial_readings_used: 0,
          trial_readings_max: 3,
          ended_at: '2026-05-26',
          ended_reason: 'manual',
        },
        now,
      ),
    ).toEqual({ status: 'ended', reason: 'manual' })
  })
  it('returns ended when ended_at is set (readings_exhausted reason)', () => {
    expect(
      evaluateTrial(
        {
          trial_started_at: '2026-03-01',
          trial_expires_at: '2026-05-30',
          trial_readings_used: 3,
          trial_readings_max: 3,
          ended_at: '2026-05-26',
          ended_reason: 'readings_exhausted',
        },
        now,
      ),
    ).toEqual({ status: 'ended', reason: 'readings_exhausted' })
  })
  it('returns ended/days_elapsed when expired', () => {
    expect(
      evaluateTrial(
        {
          trial_started_at: '2026-03-01',
          trial_expires_at: '2026-05-26',
          trial_readings_used: 0,
          trial_readings_max: 3,
          ended_at: null,
          ended_reason: null,
        },
        now,
      ),
    ).toEqual({ status: 'ended', reason: 'days_elapsed' })
  })
  it('returns ended/readings_exhausted when used = max', () => {
    expect(
      evaluateTrial(
        {
          trial_started_at: '2026-05-01',
          trial_expires_at: '2026-07-01',
          trial_readings_used: 3,
          trial_readings_max: 3,
          ended_at: null,
          ended_reason: null,
        },
        now,
      ),
    ).toEqual({ status: 'ended', reason: 'readings_exhausted' })
  })
  it('returns active with correct remaining', () => {
    const result = evaluateTrial(
      {
        trial_started_at: '2026-05-01',
        trial_expires_at: '2026-06-30',
        trial_readings_used: 1,
        trial_readings_max: 3,
        ended_at: null,
        ended_reason: null,
      },
      now,
    )
    expect(result.status).toBe('active')
    if (result.status === 'active') {
      expect(result.readings_remaining).toBe(2)
      expect(result.days_remaining).toBeGreaterThan(33)
      expect(result.days_remaining).toBeLessThan(36)
    }
  })
})

// startTrial integration via mocked service client
const insertMock = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ maybeSingle: insertMock }) }),
    }),
  }),
}))
vi.mock('@/lib/audit/log', () => ({ logAuditEvent: vi.fn() }))

import { startTrial } from '../trial'

describe('startTrial', () => {
  it('creates row when first time', async () => {
    insertMock.mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null })
    const r = await startTrial('u1')
    expect(r).toEqual({ ok: true, created: true })
  })
  it('returns idempotent on duplicate (23505)', async () => {
    insertMock.mockResolvedValueOnce({ data: null, error: { code: '23505' } })
    const r = await startTrial('u1')
    expect(r).toEqual({ ok: true, created: false })
  })
  it('returns ok:false on other error', async () => {
    insertMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX000', message: 'boom' },
    })
    const r = await startTrial('u1')
    expect(r).toEqual({ ok: false, created: false })
  })
})
