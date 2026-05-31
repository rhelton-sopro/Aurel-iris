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
 * Regra do Asaas (confirmada empiricamente 2026-05-31): estorno PARCIAL de PIX
 * só é aceito A PARTIR DO DIA SEGUINTE ao pagamento ('invalid_action: só pode
 * ser estornada parcialmente no próximo dia'). Estorno TOTAL é aceito no mesmo
 * dia. Esta função diz se o parcial está BLOQUEADO hoje (mesmo dia-calendário
 * BRT da compra). Usada no UI (mostra "disponível amanhã") E na action
 * (bloqueia antes de chamar o Asaas, evitando o erro). Comparação por
 * dia-calendário em America/Sao_Paulo (Asaas opera em BRT).
 */
export function isPartialRefundBlockedToday(
  purchaseDateISO: string,
  now: Date = new Date(),
): boolean {
  const dayBRT = (d: Date) =>
    d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return dayBRT(new Date(purchaseDateISO)) === dayBRT(now)
}

/**
 * CR-03: base ÚNICA de preço unitário compartilhada pelos DOIS reconciliadores
 * de refund (manual em billing.ts e webhook em apply-payment.ts). Antes cada
 * path computava `price_brl / leituras` com nomes de coluna diferentes
 * (leituras_purchased vs leituras_count) — usualmente iguais, mas não garantido.
 * Centralizar aqui garante que ambos debitam sobre a MESMA base.
 *
 * Retorna 0 se leituras <= 0 (proteção contra divisão por zero).
 */
export function unitPriceBrl(priceBrl: number, leituras: number): number {
  if (leituras <= 0) return 0
  return priceBrl / leituras
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

  // partial — proporcional ao saldo ainda não consumido.
  // CR-03: base ÚNICA compartilhada com apply-payment.ts (webhook).
  const unitPrice = unitPriceBrl(credit.price_brl, credit.leituras_purchased)
  return {
    eligible: true,
    kind: 'partial',
    value_brl: round2(unitPrice * refundable),
    leituras_to_refund: refundable,
    unit_price_brl: round2(unitPrice),
  }
}
