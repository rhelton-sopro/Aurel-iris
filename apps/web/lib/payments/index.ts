/**
 * Factory do provedor de pagamento ativo, selecionado por `PAYMENT_PROVIDER`.
 *
 * Default = 'asaas' (rollback seguro). Vira 'mercadopago' quando o founder
 * setar a flag na Vercel (runtime, sem prefixo NEXT_PUBLIC — lê em call-time,
 * liga sem rebuild). Asaas fica DORMENTE, não deletado.
 *
 * Server-only — os adaptadores dependem dos clients server-only.
 */
import 'server-only'

import type { PaymentProvider, PaymentProviderName } from './types'
import { asaasProvider } from './asaas/provider'
import { mercadoPagoProvider } from './mercadopago/provider'

export function activeProviderName(): PaymentProviderName {
  return process.env.PAYMENT_PROVIDER === 'mercadopago' ? 'mercadopago' : 'asaas'
}

export function getPaymentProvider(): PaymentProvider {
  return activeProviderName() === 'mercadopago' ? mercadoPagoProvider : asaasProvider
}

export type {
  PaymentProvider,
  PaymentProviderName,
  CreateChargeParams,
  CreateChargeResult,
  RefundChargeParams,
  NormalizedPaymentEvent,
  NormalizedEventKind,
  PaymentResult,
} from './types'
