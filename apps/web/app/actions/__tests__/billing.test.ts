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
// Spy no update do service-role pra capturar o payload (assert do status no refund).
const serviceUpdateMock = vi.fn(() => updateChain)

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
      update: serviceUpdateMock,
      delete: () => deleteChain,
    }),
  }),
}))
// billing.ts agora fala com a camada gateway-agnóstica (lib/payments), não com o
// client Asaas direto — mockamos o provedor ativo.
const createChargeMock = vi.fn()
const refundChargeMock = vi.fn()
const notifyRefundRequestMock = vi.fn((..._args: unknown[]) => Promise.resolve())
vi.mock('@/lib/payments', () => ({
  getPaymentProvider: () => ({
    name: 'mercadopago',
    createCharge: createChargeMock,
    refundCharge: refundChargeMock,
  }),
}))
vi.mock('@/lib/notifications/notify-refund-request', () => ({
  // wrapper lazy: acessa o mock só quando chamado (evita TDZ no hoisting do vi.mock)
  notifyRefundRequest: (...args: unknown[]) => notifyRefundRequestMock(...args),
}))
vi.mock('@/lib/audit/log', () => ({ logAuditEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createChargeAction, refundPackageAction } from '../billing'

describe('createChargeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.com' } } })
    updateChain.eq.mockReturnThis()
    deleteChain.eq.mockReturnThis()
  })

  it('rejects when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const r = await createChargeAction({ sku: 'medio', billingType: 'PIX' })
    expect(r).toEqual({ ok: false, error: 'Não autenticado.' })
  })

  it('rejects invalid SKU at zod', async () => {
    const r = await createChargeAction({ sku: 'garbage' as 'medio', billingType: 'PIX' })
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
    const r = await createChargeAction({ sku: 'medio', billingType: 'PIX' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Complete CPF')
  })

  it('happy path: inserts pending credit + creates charge via provider', async () => {
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
    insertChain.single.mockResolvedValueOnce({ data: { id: 'credit-1' }, error: null })
    createChargeMock.mockResolvedValueOnce({
      ok: true,
      data: {
        providerPaymentId: 'pay_1',
        groupId: null,
        redirectUrl: 'https://mp/i/x',
        status: null,
        providerCustomerId: null,
      },
    })

    const r = await createChargeAction({ sku: 'medio', billingType: 'PIX' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.invoice_url).toBe('https://mp/i/x')
      expect(r.credit_id).toBe('credit-1')
      expect(r.asaas_payment_id).toBe('pay_1')
    }
    // external_reference da cobrança = id da row pending
    expect(createChargeMock).toHaveBeenCalledWith(
      expect.objectContaining({ creditId: 'credit-1', billingType: 'PIX' }),
    )
  })

  it('clamps installments por SKU (médio teto 2) e passa preço cheio no cartão', async () => {
    selectChain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'pkg1', sku: 'medio', name: 'Médio', leituras_count: 15, price_brl: 745.5 },
      })
      .mockResolvedValueOnce({
        data: { id: 'u1', cpf: '12345678909', phone: '47999999999', asaas_customer_id: 'cus_1' },
      })
    insertChain.single.mockResolvedValueOnce({ data: { id: 'credit-2' }, error: null })
    createChargeMock.mockResolvedValueOnce({
      ok: true,
      data: {
        providerPaymentId: 'pref_1',
        groupId: null,
        redirectUrl: 'https://mp/i/y',
        status: null,
        providerCustomerId: null,
      },
    })

    // cliente pede 3x no médio (zod permite até 3) — deve clampar pra 2 (teto do médio).
    // Cartão não tem desconto PIX → chargeBrl = totalBrl = preço cheio.
    const r = await createChargeAction({
      sku: 'medio',
      billingType: 'CREDIT_CARD',
      installments: 3,
    })
    expect(r.ok).toBe(true)
    expect(createChargeMock).toHaveBeenCalledWith(
      expect.objectContaining({ installments: 2, totalBrl: 745.5, chargeBrl: 745.5 }),
    )
  })

  it('rolls back pending credit if provider charge fails', async () => {
    selectChain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'pkg1', sku: 'medio', leituras_count: 15, price_brl: 745.5 },
      })
      .mockResolvedValueOnce({
        data: { id: 'u1', cpf: '12345678909', phone: '47999999999', asaas_customer_id: 'cus_1' },
      })
    insertChain.single.mockResolvedValueOnce({ data: { id: 'credit-x' }, error: null })
    createChargeMock.mockResolvedValueOnce({ ok: false, error: 'provedor recusou' })

    const r = await createChargeAction({ sku: 'medio', billingType: 'PIX' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('provedor recusou')
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'credit-x')
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
        asaas_installment_id: null,
        purchase_date: recent,
        leituras_purchased: 5,
        leituras_remaining: 5,
        leituras_reserved: 0,
        status: 'active',
        credit_packages: { price_brl: 298.5 },
      },
      error: null,
    })
    refundChargeMock.mockResolvedValueOnce({ ok: true, data: undefined })
    const r = await refundPackageAction({
      credit_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(r.ok).toBe(true)
    if (r.ok && r.mode === 'refunded') {
      expect(r.kind).toBe('total')
      // refund total → amountBrl undefined
      expect(refundChargeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          providerPaymentId: 'pay_1',
          isInstallment: false,
          amountBrl: undefined,
        }),
      )
    } else {
      throw new Error('esperava mode=refunded')
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

  it('partial refund → solicitação ao suporte (não executa estorno)', async () => {
    const recent = new Date(Date.now() - 86400000).toISOString()
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'c1',
        user_id: 'u1',
        asaas_payment_id: 'pay_1',
        asaas_installment_id: null,
        purchase_date: recent,
        leituras_purchased: 5,
        leituras_remaining: 3,
        leituras_reserved: 0,
        status: 'active',
        credit_packages: { name: 'Médio', price_brl: 298.5 },
      },
      error: null,
    })
    // 2º maybeSingle: profiles.full_name (service client) p/ o email ao suporte
    selectChain.maybeSingle.mockResolvedValueOnce({ data: { full_name: 'Maria Silva' } })
    const r = await refundPackageAction({
      credit_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(r.ok).toBe(true)
    if (r.ok && r.mode === 'requested') {
      expect(r.value_brl).toBe(179.1)
      expect(r.leituras_to_refund).toBe(3)
    } else {
      throw new Error('esperava mode=requested')
    }
    // não executa estorno no provedor (é manual via suporte)
    expect(refundChargeMock).not.toHaveBeenCalled()
    // envia o demonstrativo ao suporte (2 usadas, 3 a devolver, R$59,70/leitura)
    expect(notifyRefundRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        refundValueBrl: 179.1,
        leiturasToRefund: 3,
        leiturasUsed: 2,
        unitPriceBrl: 59.7,
      }),
    )
  })
})
