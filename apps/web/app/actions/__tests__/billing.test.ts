import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock chains — espelham os builders thenable do Supabase usados em billing.ts.
const getUserMock = vi.fn()
const selectChain = {
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
}
const insertChain = { select: vi.fn().mockReturnThis(), single: vi.fn() }
const updateChain = { eq: vi.fn().mockReturnThis() }
const deleteChain = { eq: vi.fn().mockReturnThis() }

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => selectChain,
      insert: () => insertChain,
      update: () => updateChain,
      delete: () => deleteChain,
    }),
  }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => selectChain,
      insert: () => insertChain,
      update: () => updateChain,
      delete: () => deleteChain,
    }),
  }),
}))
vi.mock('@/lib/asaas/client', () => ({
  createAsaasCustomer: vi.fn(),
  createAsaasPayment: vi.fn(),
  refundAsaasPayment: vi.fn(),
}))
vi.mock('@/lib/audit/log', () => ({ logAuditEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createChargeAction, refundPackageAction } from '../billing'
import {
  createAsaasCustomer,
  createAsaasPayment,
  refundAsaasPayment,
} from '@/lib/asaas/client'

describe('createChargeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.com' } } })
    updateChain.eq.mockReturnThis()
    deleteChain.eq.mockReturnThis()
  })

  it('rejects when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const r = await createChargeAction({ sku: 'medio' })
    expect(r).toEqual({ ok: false, error: 'Não autenticado.' })
  })

  it('rejects invalid SKU at zod', async () => {
    const r = await createChargeAction({ sku: 'garbage' as 'medio' })
    expect(r.ok).toBe(false)
  })

  it('returns error when CPF missing in profile', async () => {
    selectChain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'pkg1', sku: 'medio', name: 'Médio', leituras_count: 15, price_brl: 745.5 },
      })
      .mockResolvedValueOnce({
        data: { id: 'u1', cpf: null, phone: null, full_name: 'X', asaas_customer_id: null },
      })
    const r = await createChargeAction({ sku: 'medio' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Complete CPF')
  })

  it('happy path: creates Asaas customer + payment + credit row', async () => {
    selectChain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'pkg1', sku: 'medio', name: 'Médio', leituras_count: 15, price_brl: 745.5 },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'u1',
          cpf: '12345678909',
          phone: '47999999999',
          asaas_customer_id: null,
          full_name: 'X',
        },
      })
    vi.mocked(createAsaasCustomer).mockResolvedValueOnce({
      ok: true,
      data: { id: 'cus_1' } as never,
    })
    insertChain.single.mockResolvedValueOnce({ data: { id: 'credit-1' }, error: null })
    vi.mocked(createAsaasPayment).mockResolvedValueOnce({
      ok: true,
      data: { id: 'pay_1', invoiceUrl: 'https://asaas/i/x', status: 'PENDING' } as never,
    })

    const r = await createChargeAction({ sku: 'medio' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.invoice_url).toBe('https://asaas/i/x')
      expect(r.credit_id).toBe('credit-1')
      expect(r.asaas_payment_id).toBe('pay_1')
    }
  })

  it('rolls back credit insert if Asaas payment fails', async () => {
    selectChain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'pkg1', sku: 'medio', leituras_count: 15, price_brl: 745.5 },
      })
      .mockResolvedValueOnce({
        data: { id: 'u1', cpf: '12345678909', phone: '47999999999', asaas_customer_id: 'cus_1' },
      })
    insertChain.single.mockResolvedValueOnce({ data: { id: 'credit-x' }, error: null })
    vi.mocked(createAsaasPayment).mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: 'invalid customer',
    })

    const r = await createChargeAction({ sku: 'medio' })
    expect(r.ok).toBe(false)
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'credit-x')
  })

  it('errors (no row inserted) when Asaas customer creation fails', async () => {
    selectChain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'pkg1', sku: 'medio', leituras_count: 15, price_brl: 745.5 },
      })
      .mockResolvedValueOnce({
        data: { id: 'u1', cpf: '12345678909', phone: '47999999999', asaas_customer_id: null },
      })
    vi.mocked(createAsaasCustomer).mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: 'cpfCnpj inválido',
    })

    const r = await createChargeAction({ sku: 'medio' })
    expect(r.ok).toBe(false)
    expect(insertChain.single).not.toHaveBeenCalled()
  })
})

describe('refundPackageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.com' } } })
    updateChain.eq.mockReturnThis()
  })

  it('rejects out-of-window', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'c1',
        user_id: 'u1',
        asaas_payment_id: 'pay_1',
        purchase_date: '2026-01-01T00:00:00Z', // muito > 7d
        leituras_purchased: 5,
        leituras_remaining: 5,
        leituras_reserved: 0,
        status: 'active',
        credit_packages: { price_brl: 298.5 },
      },
      error: null,
    })
    const r = await refundPackageAction({
      credit_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('arrependimento')
  })

  it('happy total refund within window', async () => {
    const recent = new Date(Date.now() - 86400000).toISOString() // 1d ago
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'c1',
        user_id: 'u1',
        asaas_payment_id: 'pay_1',
        purchase_date: recent,
        leituras_purchased: 5,
        leituras_remaining: 5,
        leituras_reserved: 0,
        status: 'active',
        credit_packages: { price_brl: 298.5 },
      },
      error: null,
    })
    vi.mocked(refundAsaasPayment).mockResolvedValueOnce({
      ok: true,
      data: { status: 'REFUNDED' } as never,
    })
    const r = await refundPackageAction({
      credit_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.kind).toBe('total')
      // refund total → body undefined (sem value)
      expect(vi.mocked(refundAsaasPayment)).toHaveBeenCalledWith('pay_1', undefined)
    }
  })

  it('credit not found → human error', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const r = await refundPackageAction({
      credit_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('não encontrado')
  })

  it('partial refund sends value in Asaas body', async () => {
    const recent = new Date(Date.now() - 86400000).toISOString()
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'c1',
        user_id: 'u1',
        asaas_payment_id: 'pay_1',
        purchase_date: recent,
        leituras_purchased: 5,
        leituras_remaining: 3,
        leituras_reserved: 0,
        status: 'active',
        credit_packages: { price_brl: 298.5 },
      },
      error: null,
    })
    vi.mocked(refundAsaasPayment).mockResolvedValueOnce({
      ok: true,
      data: { status: 'REFUNDED' } as never,
    })
    const r = await refundPackageAction({
      credit_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.kind).toBe('partial')
      expect(r.refunded_value_brl).toBe(179.1)
      const call = vi.mocked(refundAsaasPayment).mock.calls[0]
      expect(call?.[0]).toBe('pay_1')
      expect((call?.[1] as { value: number }).value).toBe(179.1)
    }
  })
})
