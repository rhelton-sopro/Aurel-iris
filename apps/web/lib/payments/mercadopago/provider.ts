/**
 * Adaptador Mercado Pago (Checkout Pro) do contrato PaymentProvider.
 *
 * createCharge → cria uma preference e devolve o init_point (redirect, 1:1 com
 * o invoiceUrl do Asaas). O `external_reference = creditId` é a chave que o
 * webhook usa pra reencontrar a row. Parcelado no MP é UM payment com
 * installments=N (sem grupo) → groupId sempre null.
 *
 * refundCharge → POST /v1/payments/{id}/refunds (o id é o payment REAL, gravado
 * pelo webhook ao confirmar — não a preference).
 *
 * Server-only.
 */
import 'server-only'

import type {
  PaymentProvider,
  CreateChargeParams,
  CreateChargeResult,
  RefundChargeParams,
  PaymentResult,
} from '../types'
import { createMpPreference, refundMpPayment, type MpPreferenceInput } from './client'
import { humanizeMpError } from './humanize-error'

function siteUrl(): string {
  // `||` (não `??`): env vazio ('') também cai no apex (espelha billing.ts).
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://iriscodex.com').replace(/\/$/, '')
}

// IDs de payment_type confirmados na conta via GET /v1/payment_methods (2026-06-20):
// bank_transfer (pix), credit_card, debit_card, prepaid_card, ticket (boleto),
// account_money (saldo MP). PIX → tira todo cartão + boleto; cartão → tira pix +
// boleto. account_money (saldo, instantâneo como pix) fica liberado nos dois.
const EXCLUDE_FOR_PIX = [
  { id: 'credit_card' },
  { id: 'debit_card' },
  { id: 'prepaid_card' },
  { id: 'ticket' },
]
const EXCLUDE_FOR_CARD = [{ id: 'bank_transfer' }, { id: 'ticket' }]

export const mercadoPagoProvider: PaymentProvider = {
  name: 'mercadopago',

  async createCharge(
    params: CreateChargeParams,
  ): Promise<PaymentResult<CreateChargeResult>> {
    const isPix = params.billingType === 'PIX'
    // À vista usa o valor cobrado (PIX já com desconto); parcelado usa o cheio.
    const unitPrice = params.installments > 1 ? params.totalBrl : params.chargeBrl
    const notificationUrl = `${siteUrl()}/api/mercadopago/webhook`

    const input: MpPreferenceInput = {
      items: [
        {
          title: params.description,
          quantity: 1,
          unit_price: unitPrice,
          currency_id: 'BRL',
          description: `${params.packageName} (${params.leiturasCount} leituras)`,
        },
      ],
      external_reference: params.creditId,
      payer: {
        name: params.payer.name,
        email: params.payer.email,
        identification: { type: 'CPF', number: params.payer.cpf },
      },
      back_urls: {
        success: params.successUrl,
        pending: params.successUrl,
        failure: params.successUrl,
      },
      auto_return: 'approved',
      notification_url: notificationUrl,
      statement_descriptor: 'IRISCODEX',
      payment_methods: {
        // installments = TETO de parcelas (1/2/3 por SKU, clampado por billing.ts).
        // "sem juros" mora na config da CONTA (não na API). default 1 = à vista.
        installments: params.installments,
        default_installments: 1,
        excluded_payment_types: isPix ? EXCLUDE_FOR_PIX : EXCLUDE_FOR_CARD,
      },
      metadata: { credit_id: params.creditId, sku: params.sku },
    }

    const pref = await createMpPreference(input, params.creditId)
    if (!pref.ok) {
      return { ok: false, error: humanizeMpError(pref.error), status: pref.status }
    }

    return {
      ok: true,
      data: {
        // Guardamos a preference.id como rastreio inicial; o payment.id REAL
        // (necessário pro refund) é gravado pelo webhook quando confirma.
        providerPaymentId: pref.data.id,
        groupId: null,
        redirectUrl: pref.data.init_point,
        status: null,
        providerCustomerId: null, // MP não usa customer persistente
      },
    }
  },

  async refundCharge(params: RefundChargeParams): Promise<PaymentResult<void>> {
    const r = await refundMpPayment(
      params.providerPaymentId,
      params.amountBrl,
      // Idempotente por (payment, valor): retry não duplica estorno.
      `refund-${params.providerPaymentId}-${params.amountBrl ?? 'total'}`,
    )
    if (!r.ok) return { ok: false, error: humanizeMpError(r.error), status: r.status }
    return { ok: true, data: undefined }
  },
}
