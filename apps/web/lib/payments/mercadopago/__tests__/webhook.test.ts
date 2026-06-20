import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'

import { verifyMpSignature } from '../webhook-auth'
import { normalizeMpPayment } from '../normalize'
import type { MpPayment } from '../client'

const SECRET = 'whsec_test_123'

function signedHeader(dataId: string, requestId: string | null, ts: string): string {
  const manifest =
    `id:${dataId.toLowerCase()};` +
    (requestId ? `request-id:${requestId};` : '') +
    `ts:${ts};`
  const v1 = createHmac('sha256', SECRET).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

describe('verifyMpSignature', () => {
  it('aceita assinatura válida (com request-id)', () => {
    const header = signedHeader('PAY123', 'req-1', '1700000000')
    const r = verifyMpSignature({
      signatureHeader: header,
      requestId: 'req-1',
      dataId: 'PAY123',
      secret: SECRET,
    })
    expect(r.valid).toBe(true)
  })

  it('aceita assinatura válida (sem request-id no manifest)', () => {
    const header = signedHeader('pay123', null, '1700000000')
    const r = verifyMpSignature({
      signatureHeader: header,
      requestId: null,
      dataId: 'pay123',
      secret: SECRET,
    })
    expect(r.valid).toBe(true)
  })

  it('rejeita v1 adulterado', () => {
    const r = verifyMpSignature({
      signatureHeader: 'ts=1700000000,v1=deadbeef',
      requestId: 'req-1',
      dataId: 'PAY123',
      secret: SECRET,
    })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('invalid_signature')
  })

  it('rejeita secret ausente (misconfigured)', () => {
    const r = verifyMpSignature({
      signatureHeader: 'ts=1,v1=x',
      requestId: 'r',
      dataId: 'd',
      secret: undefined,
    })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('misconfigured')
  })

  it('rejeita header ausente (missing_signature)', () => {
    const r = verifyMpSignature({
      signatureHeader: null,
      requestId: 'r',
      dataId: 'd',
      secret: SECRET,
    })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('missing_signature')
  })
})

function payment(over: Partial<MpPayment>): MpPayment {
  return {
    id: 99,
    status: 'approved',
    transaction_amount: 1191,
    external_reference: 'credit-uuid',
    ...over,
  }
}

describe('normalizeMpPayment', () => {
  it('approved → payment_confirmed', () => {
    const e = normalizeMpPayment(payment({ status: 'approved' }))
    expect(e.kind).toBe('payment_confirmed')
    expect(e.creditId).toBe('credit-uuid')
    expect(e.providerPaymentId).toBe('99')
    expect(e.idempotencyKey).toBe('99:approved')
  })

  it('approved + refunded>0 → partial (chave separada da confirmação)', () => {
    const e = normalizeMpPayment(
      payment({ status: 'approved', transaction_amount_refunded: 400 }),
    )
    expect(e.kind).toBe('payment_partially_refunded')
    expect(e.refundedValueBrl).toBe(400)
    expect(e.idempotencyKey).toBe('99:partial:400')
  })

  it('refunded → payment_refunded (total)', () => {
    const e = normalizeMpPayment(payment({ status: 'refunded' }))
    expect(e.kind).toBe('payment_refunded')
    expect(e.idempotencyKey).toBe('99:refunded')
  })

  it('charged_back → chargeback', () => {
    const e = normalizeMpPayment(payment({ status: 'charged_back' }))
    expect(e.kind).toBe('chargeback')
  })

  it('in_process / rejected → noop', () => {
    expect(normalizeMpPayment(payment({ status: 'in_process' })).kind).toBe('noop')
    expect(normalizeMpPayment(payment({ status: 'rejected' })).kind).toBe('noop')
  })
})
