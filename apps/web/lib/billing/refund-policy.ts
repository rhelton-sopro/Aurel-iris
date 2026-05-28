// Cálculo puro do direito de arrependimento CDC 7 dias (D-13).
// Sem 'use server', sem I/O — testável isoladamente. Consumido por
// refundPackageAction (08-06) que então decide o body do refund Asaas.
//
// Regras (D-13):
//   - status != 'active'                 → wrong_status (pending/refunded/expired)
//   - now > purchase_date + 7d           → window_expired
//   - 0 consumidas                       → refund TOTAL (price_brl cheio)
//   - 1..N-1 consumidas                  → PROPORCIONAL: unit_price × (remaining + reserved)
//   - todas consumidas                   → no_balance
//
// "consumidas" = purchased − remaining − reserved. Reserved conta como
// refundável (terapeuta ainda não converteu em débito firme).

import { refundWindowEndsAt } from './config'

export type RefundPolicy =
  | { eligible: true; kind: 'total'; value_brl: number; leituras_to_refund: number }
  | {
      eligible: true
      kind: 'partial'
      value_brl: number
      leituras_to_refund: number
      unit_price_brl: number
    }
  | { eligible: false; reason: 'window_expired' | 'no_balance' | 'wrong_status'; value_brl: 0 }

export interface CreditForRefund {
  purchase_date: string // ISO timestamp
  price_brl: number // valor total pago (do package)
  leituras_purchased: number
  leituras_remaining: number
  leituras_reserved: number
  status: string // 'active' | 'expired' | 'refunded' | 'pending'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Calcula refund value per D-13. Pura: só depende de input + `now`.
 */
export function computeRefundValue(
  credit: CreditForRefund,
  now: Date = new Date(),
): RefundPolicy {
  if (credit.status !== 'active') {
    return { eligible: false, reason: 'wrong_status', value_brl: 0 }
  }

  const purchasedAt = new Date(credit.purchase_date)
  const windowEnd = refundWindowEndsAt(purchasedAt)
  if (now > windowEnd) {
    return { eligible: false, reason: 'window_expired', value_brl: 0 }
  }

  const refundable = credit.leituras_remaining + credit.leituras_reserved
  const consumed = credit.leituras_purchased - refundable

  if (refundable <= 0) {
    return { eligible: false, reason: 'no_balance', value_brl: 0 }
  }

  if (consumed <= 0) {
    return {
      eligible: true,
      kind: 'total',
      value_brl: round2(credit.price_brl),
      leituras_to_refund: credit.leituras_purchased,
    }
  }

  // partial — proporcional ao saldo ainda não consumido
  const unitPrice = credit.price_brl / credit.leituras_purchased
  return {
    eligible: true,
    kind: 'partial',
    value_brl: round2(unitPrice * refundable),
    leituras_to_refund: refundable,
    unit_price_brl: round2(unitPrice),
  }
}
