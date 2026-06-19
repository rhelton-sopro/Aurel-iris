import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock service-role Supabase client ---------------------------------------
// The query builder is chainable (select/update/eq return `this`) AND awaitable
// at the end of a chain. Two terminal shapes need explicit control:
//   - `.maybeSingle()` (Branch 1/2/3 SELECT + Branch 2 UPDATE...select)
//   - the bare-awaited UPDATE (Branch 1/3) and the bare-awaited prevRefunds
//     SELECT (`.eq('type','refund')`) — both resolve via the builder's thenable.
//
// `nextAwait` is a FIFO queue of resolution values consumed by `then()`.
const updateMock = vi.fn()
const selectMock = vi.fn()
const insertMock = vi.fn()
const eqMock = vi.fn()
const maybeSingleMock = vi.fn()

let nextAwait: Array<{ data: unknown; error: unknown }> = []

const builder = {
  select: selectMock,
  update: updateMock,
  insert: insertMock,
  eq: eqMock,
  maybeSingle: maybeSingleMock,
  // Make the builder thenable so `await service.from(..).update(..).eq(..)...`
  // (no maybeSingle) resolves. Pulls the next queued result.
  then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
    const v = nextAwait.shift() ?? { data: null, error: null }
    return Promise.resolve(v).then(onFulfilled)
  },
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => builder }),
}))

vi.mock('@/lib/audit/log', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

import { applyPaymentEvent } from '../apply-payment'

const baseEnvelope = {
  id: 'evt_x',
  dateCreated: '2026-05-27',
  payment: {
    id: 'pay_x',
    customer: 'cus_x',
    value: 99.7,
    billingType: 'PIX' as const,
    status: 'CONFIRMED',
  },
}

type Envelope = Parameters<typeof applyPaymentEvent>[0]

describe('applyPaymentEvent', () => {
  beforeEach(() => {
    selectMock.mockReset().mockReturnValue(builder)
    updateMock.mockReset().mockReturnValue(builder)
    eqMock.mockReset().mockReturnValue(builder)
    insertMock.mockReset().mockResolvedValue({ error: null })
    maybeSingleMock.mockReset()
    nextAwait = []
    process.env.ASAAS_CREDIT_EVENT = 'PAYMENT_CONFIRMED'
  })

  it('activates pending credit on PAYMENT_CONFIRMED', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        package_id: 'pkg-1',
        leituras_purchased: 5,
        status: 'pending',
      },
      error: null,
    })
    // UPDATE...select('id') resolve via thenable. data com 1 linha = flipou
    // (fix 2026-05-30: o branch agora checa rowCount do flip).
    nextAwait.push({ data: [{ id: 'cred-1' }], error: null })

    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_CONFIRMED',
    } as Envelope)
    expect(r).toEqual({ applied: true, action: 'activated', credit_id: 'cred-1' })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', leituras_remaining: 5 }),
    )
    // credit_transactions purchase row inserted
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'purchase', amount: 5, credit_id: 'cred-1' }),
    )
  })

  it('activates pending credit on PAYMENT_RECEIVED (PIX/boleto — fix 2026-05-30)', async () => {
    // PIX dispara PAYMENT_RECEIVED, não CONFIRMED. Antes do fix era no-op
    // silencioso (dinheiro entrava, crédito ficava pending). Agora ativa.
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        package_id: 'pkg-1',
        leituras_purchased: 5,
        status: 'pending',
      },
      error: null,
    })
    nextAwait.push({ data: [{ id: 'cred-1' }], error: null })

    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_RECEIVED',
    } as Envelope)
    expect(r).toEqual({ applied: true, action: 'activated', credit_id: 'cred-1' })
  })

  it('idempotente em race: UPDATE flipa 0 linhas → no-op sem ledger dup', async () => {
    // SELECT lê pending, mas entre SELECT e UPDATE outro evento (CONFIRMED +
    // RECEIVED do mesmo cartão) já ativou → UPDATE com status-guard afeta 0
    // linhas. Sem o rowCount check, gravaria transação/email duplicados.
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        package_id: 'pkg-1',
        leituras_purchased: 5,
        status: 'pending',
      },
      error: null,
    })
    nextAwait.push({ data: [], error: null }) // 0 linhas flipadas

    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_RECEIVED',
    } as Envelope)
    expect(r.applied).toBe(false)
    expect(insertMock).not.toHaveBeenCalled() // sem ledger duplicado
  })

  it('no-op when credit already active (race / duplicate)', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        package_id: 'pkg-1',
        leituras_purchased: 5,
        status: 'active',
      },
      error: null,
    })
    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_CONFIRMED',
    } as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) expect(r.reason).toBe('wrong_state')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('returns not_found when no customer_credits row', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_CONFIRMED',
    } as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) expect(r.reason).toBe('not_found')
  })

  it('refunds on PAYMENT_REFUNDED when status=active', async () => {
    // SELECT credit, then UPDATE...select().maybeSingle()
    maybeSingleMock
      .mockResolvedValueOnce({
        data: { id: 'cred-1', user_id: 'u-1', leituras_remaining: 3, status: 'active' },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: 'cred-1' }, error: null })
    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_REFUNDED',
    } as Envelope)
    expect(r).toEqual({ applied: true, action: 'refunded', credit_id: 'cred-1' })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'refunded', leituras_remaining: 0 }),
    )
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'refund', amount: -3 }),
    )
  })

  it('PAYMENT_REFUNDED no-op when already refunded (WARN-6 idempotency)', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: 'cred-1', user_id: 'u-1', leituras_remaining: 0, status: 'refunded' },
      error: null,
    })
    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_REFUNDED',
    } as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) {
      expect(r.reason).toBe('wrong_state')
      expect(r.detail).toBe('already_refunded')
    }
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('PAYMENT_PARTIALLY_REFUNDED computes proportional debit (BLOCKER-3)', async () => {
    // Pacote Pequeno R$298,50 / 5 leituras = unit R$59,70.
    // refundedValue R$179,10 → round(179.10/59.70) = 3 leituras a debitar.
    // Sem refunds prévios → delta=3 → remaining = 5 - 3 = 2.
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        leituras_purchased: 5,
        leituras_remaining: 5,
        status: 'active',
        credit_packages: { price_brl: 298.5, leituras_count: 5 },
      },
      error: null,
    })
    // prevRefunds query (await .eq('type','refund')) → [] ; then bare-awaited UPDATE → ok
    nextAwait.push({ data: [], error: null })
    nextAwait.push({ data: null, error: null })

    const partialEnvelope = {
      ...baseEnvelope,
      event: 'PAYMENT_PARTIALLY_REFUNDED',
      payment: { ...baseEnvelope.payment, value: 298.5, refundedValue: 179.1 },
    }
    const r = await applyPaymentEvent(partialEnvelope as Envelope)
    expect(r.applied).toBe(true)
    if (r.applied) {
      expect(r.action).toBe('partially_refunded')
      expect(r.credit_id).toBe('cred-1')
    }
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ leituras_remaining: 2 }),
    )
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'refund', amount: -3 }),
    )
  })

  it('PAYMENT_PARTIALLY_REFUNDED idempotent when delta <= 0 (duplicate webhook)', async () => {
    // alvo=3, jaDebitado=3 (refund prévio -3) → delta=0 → no-op.
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        leituras_purchased: 5,
        leituras_remaining: 2,
        status: 'active',
        credit_packages: { price_brl: 298.5, leituras_count: 5 },
      },
      error: null,
    })
    // prevRefunds query → [{amount:-3}]
    nextAwait.push({ data: [{ amount: -3 }], error: null })

    const partialEnvelope = {
      ...baseEnvelope,
      event: 'PAYMENT_PARTIALLY_REFUNDED',
      payment: { ...baseEnvelope.payment, value: 298.5, refundedValue: 179.1 },
    }
    const r = await applyPaymentEvent(partialEnvelope as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) {
      expect(r.reason).toBe('wrong_state')
      expect(r.detail).toBe('already_refunded')
    }
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('CR-03: PAYMENT_PARTIALLY_REFUNDED no-op quando saldo já zerado (refund manual prévio)', async () => {
    // O path manual (refundPackageAction parcial) já zerou leituras_remaining e
    // inseriu o débito. Sem o guard, este webhook inseriria 2ª row negativa.
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        leituras_purchased: 5,
        leituras_remaining: 0, // já zerado pelo refund manual
        status: 'active',
        credit_packages: { price_brl: 298.5, leituras_count: 5 },
      },
      error: null,
    })

    const partialEnvelope = {
      ...baseEnvelope,
      event: 'PAYMENT_PARTIALLY_REFUNDED',
      payment: { ...baseEnvelope.payment, value: 298.5, refundedValue: 179.1 },
    }
    const r = await applyPaymentEvent(partialEnvelope as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) {
      expect(r.reason).toBe('wrong_state')
      expect(r.detail).toBe('already_refunded')
    }
    // NENHUMA 2ª row negativa no ledger.
    expect(updateMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('PAYMENT_PARTIALLY_REFUNDED no-op when payload missing refund value', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        leituras_purchased: 5,
        leituras_remaining: 5,
        status: 'active',
        credit_packages: { price_brl: 298.5, leituras_count: 5 },
      },
      error: null,
    })
    const partialEnvelope = {
      ...baseEnvelope,
      event: 'PAYMENT_PARTIALLY_REFUNDED',
      payment: { ...baseEnvelope.payment, value: 298.5 }, // sem refundedValue nem netValue
    }
    const r = await applyPaymentEvent(partialEnvelope as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) expect(r.detail).toBe('missing_refund_value')
  })

  // --- Parcelamento: casar por grupo installment (auditoria 2026-06-19) -------
  it('parcelado: parcela 2 (id próprio, mesmo grupo) casa por installment e NÃO credita 2×', async () => {
    // payment.id da parcela 2 NÃO é o asaas_payment_id guardado (1ª parcela) →
    // primary lookup retorna null → fallback por asaas_installment_id acha a row
    // já ativa → status guard → no-op (sem 2º crédito).
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null }) // por payment.id
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'cred-1',
        user_id: 'u-1',
        package_id: 'pkg-1',
        leituras_purchased: 30,
        status: 'active',
      },
      error: null,
    }) // por asaas_installment_id

    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_RECEIVED',
      payment: { ...baseEnvelope.payment, id: 'pay_parcela2', installment: 'inst_grp' },
    } as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) expect(r.reason).toBe('wrong_state')
    expect(updateMock).not.toHaveBeenCalled() // sem 2º crédito
    expect(maybeSingleMock).toHaveBeenCalledTimes(2) // primary + fallback
  })

  it('parcelado: chargeback de parcela posterior casa por installment e zera o saldo', async () => {
    // SEM o fix, chargeback da parcela 2 (id próprio) não casava → crédito de
    // fraude permanecia. Agora casa pelo grupo e zera.
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null }) // por payment.id
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: 'cred-1', user_id: 'u-1', status: 'active' },
      error: null,
    }) // por asaas_installment_id
    nextAwait.push({ data: null, error: null }) // UPDATE bare-awaited

    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_CHARGEBACK_REQUESTED',
      payment: { ...baseEnvelope.payment, id: 'pay_parcela2', installment: 'inst_grp' },
    } as Envelope)
    expect(r.applied).toBe(true)
    if (r.applied) expect(r.action).toBe('chargeback')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'refunded', leituras_remaining: 0 }),
    )
  })

  it('parcelado: chargeback de 2ª/3ª parcela é no-op se já refunded (sem update/audit dup)', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null }) // por payment.id
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: 'cred-1', user_id: 'u-1', status: 'refunded' },
      error: null,
    }) // por asaas_installment_id — já estornado pela 1ª parcela

    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_CHARGEBACK_REQUESTED',
      payment: { ...baseEnvelope.payment, id: 'pay_parcela3', installment: 'inst_grp' },
    } as Envelope)
    expect(r.applied).toBe(true) // ação registrada
    expect(updateMock).not.toHaveBeenCalled() // status guard — idempotente
  })

  it('à vista (sem installment): payment.id não casa → not_found, SEM fallback', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_CONFIRMED',
    } as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) expect(r.reason).toBe('not_found')
    expect(maybeSingleMock).toHaveBeenCalledTimes(1) // sem grupo → 1 lookup só
  })

  it('no-op on PAYMENT_CREATED', async () => {
    const r = await applyPaymentEvent({
      ...baseEnvelope,
      event: 'PAYMENT_CREATED',
    } as Envelope)
    expect(r.applied).toBe(false)
    if (!r.applied) expect(r.reason).toBe('no_op_event')
  })
})
