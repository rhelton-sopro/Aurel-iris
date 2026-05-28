// Fonte ÚNICA da decisão "este terapeuta pode usar 1 leitura agora?".
// Pura, sem side-effects, sem 'use server', sem acesso a DB — unit-testável
// isolada (espelha lib/gates/profile-completeness.ts).
//
// Reusada por:
//   - UI (CreditsBalanceWidget / página de compra, planos 08-10/08-11) pra
//     decidir o que mostrar SEM duplicar a regra de precedência.
//   - server actions / route handlers que querem o veredito legível antes do
//     write atômico (reserveCreditForReading é quem garante atomicidade — esta
//     função pode estar stale por milissegundos, então NÃO substitui o reserve).
//
// Precedência (D-09 → D-06 → D-04 → D-07):
//   1. internal_use=true  → bypass total (founder/admin, não consome)
//   2. trial active       → gera de graça (cliente em trial)
//   3. créditos comprados → debita do saldo
//   4. trial ended/no_trial + 0 créditos → bloqueia, manda comprar

import type { TrialState } from '@/lib/billing/trial'

export type BillingGate =
  | {
      status: 'ok'
      source: 'internal' | 'trial' | 'credit'
      trial_state?: TrialState
      credits_remaining?: number
    }
  | {
      status: 'no_balance'
      trial_state: TrialState
      credits_remaining: number
      redirect_to: '/assinatura/comprar'
    }

export interface BillingSnapshot {
  internal_use: boolean
  trial: TrialState
  /** Soma de leituras_remaining em customer_credits status='active' não expirados. */
  total_credits_remaining: number
  /** Pra UI display ("Reservados: Y") — não entra na decisão do gate. */
  total_credits_reserved: number
}

/**
 * Pure gate: dado o snapshot, decide se o terapeuta pode usar 1 leitura.
 * Não escreve em nada. O write atômico (reserveCreditForReading) é a fonte
 * de verdade da atomicidade; este gate é a leitura otimista pra UI/UX.
 */
export function evaluateBilling(snap: BillingSnapshot): BillingGate {
  // D-09: internal_use bypass sempre — nem trial nem crédito importam.
  if (snap.internal_use) {
    return { status: 'ok', source: 'internal' }
  }

  // D-06: trial active vence (cliente em trial gera de graça mesmo com 0 créditos).
  if (snap.trial.status === 'active') {
    return { status: 'ok', source: 'trial', trial_state: snap.trial }
  }

  // D-04: créditos comprados (trial ended/no_trial mas tem saldo).
  if (snap.total_credits_remaining > 0) {
    return {
      status: 'ok',
      source: 'credit',
      credits_remaining: snap.total_credits_remaining,
    }
  }

  // D-07: trial ended/no_trial + 0 créditos = bloqueia.
  return {
    status: 'no_balance',
    trial_state: snap.trial,
    credits_remaining: snap.total_credits_remaining,
    redirect_to: '/assinatura/comprar',
  }
}
