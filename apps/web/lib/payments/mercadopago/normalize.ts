/**
 * Traduz um objeto `payment` do Mercado Pago (já buscado via GET /v1/payments/{id})
 * num NormalizedPaymentEvent agnóstico, que a state machine (apply-event) consome.
 *
 * Mapa de status → ação (research/02 + 03):
 *   - approved + nada devolvido        → payment_confirmed (creditar)
 *   - approved + transaction_amount_refunded > 0 → payment_partially_refunded
 *   - refunded                         → payment_refunded (total)
 *   - charged_back                     → chargeback
 *   - authorized | in_process | pending | rejected | cancelled → noop
 *
 * Idempotência: a chave separa confirmação de estorno parcial do MESMO payment
 * (ambos têm status 'approved') incluindo o valor devolvido — senão o parcial
 * seria deduplicado como a confirmação.
 */
import type { MpPayment } from './client'
import type { NormalizedPaymentEvent, NormalizedEventKind } from '../types'

export function normalizeMpPayment(payment: MpPayment): NormalizedPaymentEvent {
  const refunded = payment.transaction_amount_refunded ?? 0
  const status = payment.status

  let kind: NormalizedEventKind
  let idempotencyKey: string
  if (status === 'approved' && refunded > 0) {
    kind = 'payment_partially_refunded'
    idempotencyKey = `${payment.id}:partial:${refunded}`
  } else if (status === 'approved') {
    kind = 'payment_confirmed'
    idempotencyKey = `${payment.id}:approved`
  } else if (status === 'refunded') {
    kind = 'payment_refunded'
    idempotencyKey = `${payment.id}:refunded`
  } else if (status === 'charged_back') {
    kind = 'chargeback'
    idempotencyKey = `${payment.id}:charged_back`
  } else {
    kind = 'noop'
    idempotencyKey = `${payment.id}:${status}`
  }

  return {
    idempotencyKey,
    kind,
    creditId: payment.external_reference ?? null,
    providerPaymentId: String(payment.id),
    groupId: null,
    status,
    valueBrl: payment.transaction_amount,
    refundedValueBrl: refunded > 0 ? refunded : undefined,
    rawEventType: 'payment',
  }
}
