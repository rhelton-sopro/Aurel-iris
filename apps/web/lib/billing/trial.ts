import 'server-only'

import { logAuditEvent } from '@/lib/audit/log'
import { createServiceClient } from '@/lib/supabase/service'

import { TRIAL_READINGS_MAX, trialExpiresAt } from './config'

export type TrialState =
  | { status: 'active'; readings_remaining: number; days_remaining: number }
  | { status: 'ended'; reason: 'readings_exhausted' | 'days_elapsed' | 'manual' }
  | { status: 'no_trial' }

export interface TrialRow {
  trial_started_at: string
  trial_expires_at: string
  trial_readings_used: number
  trial_readings_max: number
  ended_at: string | null
  ended_reason: string | null
}

/**
 * Pure: avalia uma trial_status row → TrialState. Sem side effects, sem DB read.
 *
 * Precedência das condições de término:
 *   1. ended_at explícito (terminal manual ou via cron) — preserva o reason gravado
 *   2. expirou por dias (trial_expires_at <= now)
 *   3. esgotou leituras (used >= max)
 * Caso contrário → active com remaining computado.
 */
export function evaluateTrial(
  trial: TrialRow | null,
  now: Date = new Date(),
): TrialState {
  if (!trial) return { status: 'no_trial' }

  if (trial.ended_at) {
    const reason =
      trial.ended_reason === 'readings_exhausted'
        ? 'readings_exhausted'
        : trial.ended_reason === 'days_elapsed'
          ? 'days_elapsed'
          : 'manual'
    return { status: 'ended', reason }
  }

  const expiresAt = new Date(trial.trial_expires_at)
  if (expiresAt <= now) return { status: 'ended', reason: 'days_elapsed' }

  if (trial.trial_readings_used >= trial.trial_readings_max) {
    return { status: 'ended', reason: 'readings_exhausted' }
  }

  const readings_remaining = trial.trial_readings_max - trial.trial_readings_used
  const days_remaining = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000),
  )
  return { status: 'active', readings_remaining, days_remaining }
}

/**
 * Idempotent: cria a trial_status row se ainda não existir. Chamado no signup.
 * No-op silencioso (created:false) quando já existe (unique violation 23505).
 */
export async function startTrial(
  userId: string,
): Promise<{ ok: boolean; created: boolean }> {
  const service = createServiceClient()
  const now = new Date()
  const expiresAt = trialExpiresAt(now)

  const { data, error } = await service
    .from('trial_status')
    .insert({
      user_id: userId,
      trial_started_at: now.toISOString(),
      trial_expires_at: expiresAt.toISOString(),
      trial_readings_used: 0,
      trial_readings_max: TRIAL_READINGS_MAX,
    })
    .select('user_id')
    .maybeSingle()

  if (error) {
    // 23505 = unique violation = trial já existe = idempotent skip
    if ((error as { code?: string }).code === '23505') {
      return { ok: true, created: false }
    }
    console.error('[trial] startTrial failed:', error.message)
    return { ok: false, created: false }
  }

  await logAuditEvent({
    event_type: 'trial.started',
    actor_user_id: userId,
    target_type: 'profile',
    target_id: userId,
    metadata: {
      max_readings: TRIAL_READINGS_MAX,
      expires_at: expiresAt.toISOString(),
    },
  })

  return { ok: true, created: !!data }
}

/** Lê a trial_status row do usuário e retorna o TrialState avaliado. */
export async function getTrialState(userId: string): Promise<TrialState> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('trial_status')
    .select(
      'trial_started_at, trial_expires_at, trial_readings_used, trial_readings_max, ended_at, ended_reason',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[trial] getTrialState query failed:', error.message)
    return { status: 'no_trial' }
  }

  return evaluateTrial(data as TrialRow | null)
}
