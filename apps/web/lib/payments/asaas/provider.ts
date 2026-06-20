/**
 * Adaptador Asaas do contrato PaymentProvider.
 *
 * Envolve o client REST existente (lib/asaas/client) SEM mudar o comportamento
 * em produção — replica exatamente o que billing.ts fazia inline (customer
 * persistente + endereço, à vista vs parcelado, callback gated). Fica DORMENTE
 * atrás da flag PAYMENT_PROVIDER (default 'asaas' = rollback); o caminho ativo
 * pós-migração é o Mercado Pago.
 *
 * Server-only — depende de 'server-only' do client Asaas.
 */
import 'server-only'

import {
  createAsaasCustomer,
  createAsaasPayment,
  updateAsaasCustomer,
  refundAsaasPayment,
  refundAsaasInstallment,
} from '@/lib/asaas/client'
import { humanizeAsaasError } from '@/lib/asaas/humanize-error'

import type {
  PaymentProvider,
  CreateChargeParams,
  CreateChargeResult,
  RefundChargeParams,
  PaymentResult,
} from '../types'

export const asaasProvider: PaymentProvider = {
  name: 'asaas',

  async createCharge(
    params: CreateChargeParams,
  ): Promise<PaymentResult<CreateChargeResult>> {
    // 1. Customer persistente — criar se ausente, senão sincronizar endereço
    //    (NF-e + antifraude cartão). billing.ts insere a row pending ANTES de
    //    chamar createCharge, então a compensação (delete) cobre falha aqui.
    let customerId = params.providerCustomerId
    let createdCustomerId: string | null = null
    const addr = params.payer.address
    if (!customerId) {
      const cust = await createAsaasCustomer({
        name: params.payer.name,
        cpfCnpj: params.payer.cpf,
        email: params.payer.email,
        mobilePhone: params.payer.phone,
        externalReference: params.payer.profileId,
        postalCode: addr?.cep,
        address: addr?.street,
        addressNumber: addr?.number,
        complement: addr?.complement,
        province: addr?.district,
      })
      if (!cust.ok) {
        return { ok: false, error: humanizeAsaasError(cust.error), status: cust.status }
      }
      customerId = cust.data.id
      createdCustomerId = cust.data.id
    } else if (addr?.cep) {
      // Best-effort: cliente já existe, ressincroniza endereço antes de cobrar.
      const upd = await updateAsaasCustomer(customerId, {
        postalCode: addr.cep,
        address: addr.street,
        addressNumber: addr.number,
        complement: addr.complement,
        province: addr.district,
      })
      if (!upd.ok) console.error('[payments:asaas] address sync failed:', upd.error)
    }

    // 2. Payment — à vista (value) ou parcelado (installmentCount + totalValue).
    const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const base = {
      customer: customerId,
      billingType: params.billingType,
      dueDate,
      description: params.description,
      externalReference: params.creditId,
    } as const

    // Callback de auto-retorno gated por ASAAS_CALLBACK_ENABLED (só envia se o
    // domínio estiver cadastrado na conta Asaas; senão a cobrança é rejeitada).
    const callbackEnabled = process.env.ASAAS_CALLBACK_ENABLED === 'true'
    const withCallback = callbackEnabled
      ? { callback: { successUrl: params.successUrl, autoRedirect: true } }
      : {}

    const paymentInput =
      params.installments > 1
        ? {
            ...base,
            installmentCount: params.installments,
            totalValue: params.totalBrl,
            ...withCallback,
          }
        : { ...base, value: params.chargeBrl, ...withCallback }

    const payment = await createAsaasPayment(paymentInput)
    if (!payment.ok) {
      return { ok: false, error: humanizeAsaasError(payment.error), status: payment.status }
    }

    return {
      ok: true,
      data: {
        providerPaymentId: payment.data.id,
        groupId: payment.data.installment ?? null,
        redirectUrl: payment.data.invoiceUrl ?? '',
        status: payment.data.status ?? null,
        providerCustomerId: createdCustomerId,
      },
    }
  },

  async refundCharge(params: RefundChargeParams): Promise<PaymentResult<void>> {
    // Parcelado (cartão grande até 3x) estorna o GRUPO inteiro; à vista/parcial
    // usa /payments/{id}/refund (body com value = parcial; undefined = total).
    const r =
      params.isInstallment && params.groupId
        ? await refundAsaasInstallment(params.groupId)
        : await refundAsaasPayment(
            params.providerPaymentId,
            params.amountBrl != null
              ? { value: params.amountBrl, description: params.description }
              : undefined,
          )
    if (!r.ok) return { ok: false, error: humanizeAsaasError(r.error), status: r.status }
    return { ok: true, data: undefined }
  },
}
