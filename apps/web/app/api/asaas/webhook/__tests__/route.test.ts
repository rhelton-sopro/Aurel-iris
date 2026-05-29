import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { verifyMock, recordMock, markMock, applyMock, unrecordMock } =
  vi.hoisted(() => ({
    verifyMock: vi.fn(),
    recordMock: vi.fn(),
    markMock: vi.fn(),
    applyMock: vi.fn(),
    unrecordMock: vi.fn(),
  }))

vi.mock('@/lib/asaas/webhook-auth', () => ({ verifyAsaasToken: verifyMock }))
vi.mock('@/lib/asaas/idempotency', () => ({
  recordWebhookEvent: recordMock,
  markEventProcessed: markMock,
  unrecordWebhookEvent: unrecordMock,
}))
vi.mock('@/lib/billing/apply-payment', () => ({ applyPaymentEvent: applyMock }))

import { POST } from '../route'

function makeReq(body: unknown, token?: string): Request {
  return new Request('https://test/api/asaas/webhook', {
    method: 'POST',
    headers: token
      ? { 'asaas-access-token': token, 'content-type': 'application/json' }
      : { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  id: 'evt_1',
  event: 'PAYMENT_CONFIRMED',
  dateCreated: '2026-05-27',
  payment: {
    id: 'pay_1',
    customer: 'cus_1',
    value: 99.7,
    billingType: 'PIX',
    status: 'CONFIRMED',
  },
}

describe('POST /api/asaas/webhook', () => {
  beforeEach(() => {
    verifyMock.mockReset()
    recordMock.mockReset()
    markMock.mockReset().mockResolvedValue(undefined)
    applyMock.mockReset()
    unrecordMock.mockReset().mockResolvedValue(undefined)
  })

  it('401 when token missing', async () => {
    verifyMock.mockReturnValue({ valid: false, reason: 'missing_token' })
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(401)
    expect(recordMock).not.toHaveBeenCalled()
  })

  it('401 when token invalid', async () => {
    verifyMock.mockReturnValue({ valid: false, reason: 'invalid_token' })
    const res = await POST(makeReq(validBody, 'wrong'))
    expect(res.status).toBe(401)
  })

  it('400 when body invalid', async () => {
    verifyMock.mockReturnValue({ valid: true })
    const res = await POST(makeReq({ garbage: true }, 'good'))
    expect(res.status).toBe(400)
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('200 noop when duplicate event_id', async () => {
    verifyMock.mockReturnValue({ valid: true })
    recordMock.mockResolvedValue({ ok: true, first_seen: false })
    const res = await POST(makeReq(validBody, 'good'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, noop: 'idempotent' })
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('200 ok when applied successfully', async () => {
    verifyMock.mockReturnValue({ valid: true })
    recordMock.mockResolvedValue({ ok: true, first_seen: true })
    applyMock.mockResolvedValue({ applied: true, action: 'activated', credit_id: 'c-1' })
    const res = await POST(makeReq(validBody, 'good'))
    expect(res.status).toBe(200)
    expect(applyMock).toHaveBeenCalledOnce()
    expect(markMock).toHaveBeenCalledWith('evt_1')
    expect(await res.json()).toEqual({
      ok: true,
      applied: true,
      action: 'activated',
      credit_id: 'c-1',
    })
  })

  it('500 when recordWebhookEvent fails non-23505', async () => {
    verifyMock.mockReturnValue({ valid: true })
    recordMock.mockResolvedValue({ ok: false, error: 'connection refused' })
    const res = await POST(makeReq(validBody, 'good'))
    expect(res.status).toBe(500)
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('WR-05: non-2xx + unrecord quando applyPaymentEvent retorna db_error (Asaas reenvia)', async () => {
    verifyMock.mockReturnValue({ valid: true })
    recordMock.mockResolvedValue({ ok: true, first_seen: true })
    applyMock.mockResolvedValue({
      applied: false,
      reason: 'db_error',
      detail: 'update failed',
    })
    const res = await POST(makeReq(validBody, 'good'))
    // non-2xx → Asaas faz retry
    expect(res.status).toBeGreaterThanOrEqual(500)
    // remove a row de idempotência pra que o retry reprocesse (first_seen:true)
    expect(unrecordMock).toHaveBeenCalledWith('evt_1')
    // NÃO marca como processed (senão o crédito ficaria perdido)
    expect(markMock).not.toHaveBeenCalled()
  })

  it('WR-05: 200 idempotente preservado p/ evento já processado (wrong_state)', async () => {
    verifyMock.mockReturnValue({ valid: true })
    recordMock.mockResolvedValue({ ok: true, first_seen: true })
    applyMock.mockResolvedValue({
      applied: false,
      reason: 'wrong_state',
      detail: 'already_refunded',
    })
    const res = await POST(makeReq(validBody, 'good'))
    expect(res.status).toBe(200)
    expect(unrecordMock).not.toHaveBeenCalled()
    expect(markMock).toHaveBeenCalledWith('evt_1')
  })

  it('WR-05: 200 (NÃO retry) para invalid_payload (poison-pill)', async () => {
    verifyMock.mockReturnValue({ valid: true })
    recordMock.mockResolvedValue({ ok: true, first_seen: true })
    applyMock.mockResolvedValue({
      applied: false,
      reason: 'invalid_payload',
      detail: 'missing_refund_value',
    })
    const res = await POST(makeReq(validBody, 'good'))
    expect(res.status).toBe(200)
    expect(unrecordMock).not.toHaveBeenCalled()
  })
})
