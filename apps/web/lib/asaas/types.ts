/**
 * Zod schemas + inferred TS types for the Asaas integration.
 *
 * Pure types/schemas — NO 'use server' directive. Importable from both client
 * and server code (consumed by lib/asaas/client.ts, the webhook handler in
 * plano 08-04, and server actions in plano 08-06).
 *
 * `.passthrough()` on the payment + customer schemas so we never reject Asaas
 * payloads that grow new fields (forward-compat with their REST API).
 */
import { z } from 'zod'

export const asaasPaymentSchema = z
  .object({
    id: z.string().min(1),
    customer: z.string().min(1),
    value: z.number().positive(),
    netValue: z.number().optional(),
    billingType: z.enum(['UNDEFINED', 'PIX', 'BOLETO', 'CREDIT_CARD']),
    status: z.string().min(1),
    externalReference: z.string().nullable().optional(),
    paymentDate: z.string().nullable().optional(),
    clientPaymentDate: z.string().nullable().optional(),
    invoiceUrl: z.string().url().nullable().optional(),
    bankSlipUrl: z.string().url().nullable().optional(),
  })
  .passthrough()

export const asaasWebhookEnvelopeSchema = z.object({
  // event.id — idempotency key (RESEARCH §Idempotency)
  id: z.string().min(1),
  event: z.enum([
    'PAYMENT_CREATED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED',
    'PAYMENT_OVERDUE',
    'PAYMENT_DELETED',
    'PAYMENT_REFUNDED',
    'PAYMENT_PARTIALLY_REFUNDED',
    'PAYMENT_CHARGEBACK_REQUESTED',
  ]),
  dateCreated: z.string().min(1),
  payment: asaasPaymentSchema,
})

export type AsaasPayment = z.infer<typeof asaasPaymentSchema>
export type AsaasWebhookEnvelope = z.infer<typeof asaasWebhookEnvelopeSchema>

// Customer create response (POST /v3/customers)
export const asaasCustomerSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    cpfCnpj: z.string(),
    email: z.string(),
    dateCreated: z.string(),
  })
  .passthrough()
export type AsaasCustomer = z.infer<typeof asaasCustomerSchema>
