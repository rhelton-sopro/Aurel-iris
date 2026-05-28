import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAsaasCustomer, createAsaasPayment, refundAsaasPayment } from '../client'

const fetchMock = vi.fn()
global.fetch = fetchMock as unknown as typeof fetch

describe('asaas client', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    process.env.ASAAS_API_KEY = '$aact_test_key'
    process.env.ASAAS_API_BASE_URL = 'https://api-sandbox.asaas.com/v3'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createAsaasCustomer success', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'cus_123',
          name: 'X',
          cpfCnpj: '12345678901',
          email: 'x@y.com',
          dateCreated: '2026-05-27',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const r = await createAsaasCustomer({
      name: 'X',
      cpfCnpj: '12345678901',
      email: 'x@y.com',
      mobilePhone: '47999999999',
      externalReference: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.id).toBe('cus_123')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/customers',
      expect.objectContaining({
        headers: expect.objectContaining({ access_token: '$aact_test_key' }),
      }),
    )
  })

  it('returns ok:false when API key missing', async () => {
    delete process.env.ASAAS_API_KEY
    const r = await createAsaasCustomer({
      name: 'X',
      cpfCnpj: '1',
      email: 'x@y.com',
      mobilePhone: '1',
      externalReference: 'aaaa',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('ASAAS_API_KEY missing')
  })

  it('returns ok:false on HTTP 4xx', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Request', { status: 400 }))
    const r = await createAsaasPayment({
      customer: 'cus_x',
      billingType: 'PIX',
      value: 99.7,
      dueDate: '2026-06-01',
      description: 'test',
      externalReference: 'aaaa',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(400)
  })

  it('returns ok:false on network error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const r = await createAsaasPayment({
      customer: 'cus_x',
      billingType: 'PIX',
      value: 99.7,
      dueDate: '2026-06-01',
      description: 'test',
      externalReference: 'aaaa',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(0)
      expect(r.error).toBe('network')
    }
  })

  it('refundAsaasPayment without value = full refund body {}', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'pay_x',
          customer: 'cus_x',
          value: 99.7,
          billingType: 'PIX',
          status: 'REFUNDED',
        }),
        { status: 200 },
      ),
    )
    await refundAsaasPayment('pay_x')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe('{}')
  })

  it('refundAsaasPayment with value = partial', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'pay_x',
          customer: 'cus_x',
          value: 99.7,
          billingType: 'PIX',
          status: 'REFUNDED',
        }),
        { status: 200 },
      ),
    )
    await refundAsaasPayment('pay_x', { value: 59.7, description: 'partial' })
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({ value: 59.7, description: 'partial' })
  })
})
