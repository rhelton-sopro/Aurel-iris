import { describe, expect, it } from 'vitest'

import { evaluateBilling } from '../billing-gate'
import type { TrialState } from '@/lib/billing/trial'

describe('evaluateBilling', () => {
  // TrialState real (lib/billing/trial.ts): active carrega readings_remaining +
  // days_remaining; ended carrega reason; no_trial é só status.
  const trialActive: TrialState = {
    status: 'active',
    readings_remaining: 2,
    days_remaining: 30,
  }
  const trialEnded: TrialState = {
    status: 'ended',
    reason: 'readings_exhausted',
  }
  const noTrial: TrialState = { status: 'no_trial' }

  it('internal_use always passes regardless of trial/credits', () => {
    expect(
      evaluateBilling({
        internal_use: true,
        trial: trialEnded,
        total_credits_remaining: 0,
        total_credits_reserved: 0,
      }),
    ).toEqual({ status: 'ok', source: 'internal' })
  })

  it('trial active is source even with 0 credits', () => {
    const r = evaluateBilling({
      internal_use: false,
      trial: trialActive,
      total_credits_remaining: 0,
      total_credits_reserved: 0,
    })
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.source).toBe('trial')
  })

  it('credit balance is source after trial ended', () => {
    const r = evaluateBilling({
      internal_use: false,
      trial: trialEnded,
      total_credits_remaining: 5,
      total_credits_reserved: 0,
    })
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.source).toBe('credit')
  })

  it('no_balance when trial ended + 0 credits', () => {
    const r = evaluateBilling({
      internal_use: false,
      trial: trialEnded,
      total_credits_remaining: 0,
      total_credits_reserved: 0,
    })
    expect(r).toEqual({
      status: 'no_balance',
      trial_state: trialEnded,
      credits_remaining: 0,
      redirect_to: '/assinatura/comprar',
    })
  })

  it('no_balance when no_trial + 0 credits (edge case — usuario antigo sem trial row)', () => {
    const r = evaluateBilling({
      internal_use: false,
      trial: noTrial,
      total_credits_remaining: 0,
      total_credits_reserved: 0,
    })
    expect(r.status).toBe('no_balance')
  })
})
