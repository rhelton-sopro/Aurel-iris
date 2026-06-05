// Fonte única dos números de billing/trial. Usado em gates, server actions,
// cron daily, UI labels. NÃO duplicar valores em outros arquivos.
//
// Decisões:
//   - D-03: validade créditos = 12 meses (365 days)
//   - D-06: trial = 1 leitura OU 15 dias first-wins (1 leitura: founder 2026-06-05; 15d: 2026-05-31)
//   - D-11: reserva temporária = 7 dias
//   - D-13: arrependimento CDC = 7 dias após compra
//
// Histórico:
//   - 2026-05-27: criação inicial Fase 8.

export const TRIAL_READINGS_MAX = 1 as const
export const TRIAL_DAYS = 15 as const
export const CREDIT_VALIDITY_DAYS = 365 as const // 12 meses ≈ 365 dias (D-03)
export const RESERVATION_DAYS = 7 as const // D-11
export const REFUND_WINDOW_DAYS = 7 as const // D-13 — arrependimento CDC

// Helpers pra computação inline (não inventar Date math em call sites)
export function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function trialExpiresAt(startedAt: Date): Date {
  return addDays(startedAt, TRIAL_DAYS)
}

export function creditExpiresAt(confirmedAt: Date): Date {
  return addDays(confirmedAt, CREDIT_VALIDITY_DAYS)
}

export function reservationExpiresAt(reservedAt: Date): Date {
  return addDays(reservedAt, RESERVATION_DAYS)
}

export function refundWindowEndsAt(purchasedAt: Date): Date {
  return addDays(purchasedAt, REFUND_WINDOW_DAYS)
}
