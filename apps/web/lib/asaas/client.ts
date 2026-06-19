/**
 * Typed REST client for the Asaas payments API (no community SDK — per
 * RESEARCH §Don't Hand-Roll + memory feedback_auto_block_expensive_branches).
 *
 * Server-only — reads ASAAS_API_KEY from the environment and never logs it.
 * All three public functions return an AsaasResult<T> discriminated union so
 * callers (webhook handler 08-04, server actions 08-06) branch on `ok`.
 *
 * Structured logs include only path + HTTP status (+ truncated server detail),
 * never the API key (T-08-02-02).
 */
import 'server-only'
import {
  asaasCustomerSchema,
  asaasPaymentSchema,
  type AsaasCustomer,
  type AsaasPayment,
} from './types'

export type AsaasResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

// Read at call time (not module load) so the base URL is overridable per-env
// and per-test. A top-level const would freeze whatever value existed at
// import, which silently ignores later ASAAS_API_BASE_URL changes.
function baseUrl(): string {
  return process.env.ASAAS_API_BASE_URL ?? 'https://api.asaas.com/v3'
}

async function asaasRequest(path: string, init: RequestInit): Promise<AsaasResult<unknown>> {
  const apiKey = process.env.ASAAS_API_KEY
  if (!apiKey) {
    console.error('[asaas] ASAAS_API_KEY missing')
    return { ok: false, status: 500, error: 'ASAAS_API_KEY missing' }
  }
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        access_token: apiKey,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[asaas] ${init.method ?? 'GET'} ${path} HTTP ${res.status} — ${detail.slice(0, 300)}`)
      return { ok: false, status: res.status, error: detail.slice(0, 300) }
    }
    const data = await res.json()
    return { ok: true, data }
  } catch (err) {
    console.error(`[asaas] ${path} fetch failed:`, err instanceof Error ? err.message : err)
    return { ok: false, status: 0, error: 'network' }
  }
}

// Campos de endereço do cliente Asaas (NF-e + antifraude cartão). O Asaas
// deriva cidade/UF a partir do postalCode (CEP), então não os enviamos aqui.
export interface AsaasCustomerAddress {
  postalCode?: string // CEP só dígitos
  address?: string // logradouro
  addressNumber?: string
  complement?: string
  province?: string // bairro
}

export interface CreateCustomerInput extends AsaasCustomerAddress {
  name: string
  cpfCnpj: string // só dígitos
  email: string
  mobilePhone: string
  externalReference: string // profiles.id UUID
}

export async function createAsaasCustomer(
  input: CreateCustomerInput,
): Promise<AsaasResult<AsaasCustomer>> {
  // notificationDisabled: true → desliga as notificações Asaas→cliente (e-mail/SMS
  // de cobrança), que é o que gera a taxa de mensageria (R$0,99/venda). É flag DE
  // CLIENTE (não da cobrança): nasce sem notificação → zero taxa em qualquer
  // cobrança dele. NÃO afeta o webhook Asaas→Iris Codex (que credita) — esse é
  // configurado à parte na conta e independe das notificações ao cliente.
  const r = await asaasRequest('/customers', {
    method: 'POST',
    body: JSON.stringify({ ...input, notificationDisabled: true }),
  })
  if (!r.ok) return r
  const parsed = asaasCustomerSchema.safeParse(r.data)
  if (!parsed.success) return { ok: false, status: 502, error: 'asaas response shape invalid' }
  return { ok: true, data: parsed.data }
}

/**
 * Atualiza um cliente Asaas existente (POST /customers/{id}). Usado pra
 * backfill de endereço em clientes criados antes da feature (sem o qual a
 * NF-e não emite e o cartão é recusado). Só envia os campos passados.
 */
export async function updateAsaasCustomer(
  customerId: string,
  fields: AsaasCustomerAddress,
): Promise<AsaasResult<AsaasCustomer>> {
  const r = await asaasRequest(`/customers/${customerId}`, {
    method: 'POST',
    body: JSON.stringify(fields),
  })
  if (!r.ok) return r
  const parsed = asaasCustomerSchema.safeParse(r.data)
  if (!parsed.success) return { ok: false, status: 502, error: 'asaas response shape invalid' }
  return { ok: true, data: parsed.data }
}

export interface CreatePaymentInput {
  customer: string // cus_xxxxx
  billingType: 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  // À vista: enviar SÓ `value`. Parcelado (doc Asaas criar-uma-cobranca-parcelada):
  // enviar `installmentCount` + `totalValue` e OMITIR `value`. Exatamente um dos
  // dois modos — a action (billing.ts) garante isso; nunca os dois juntos.
  value?: number // R$ decimal (não centavos) — só no modo à vista
  installmentCount?: number // nº de parcelas (>1) — só no modo parcelado
  totalValue?: number // valor total a parcelar — Asaas calcula cada parcela
  dueDate: string // ISO YYYY-MM-DD
  description: string
  externalReference: string // customer_credits.id UUID (pitfall #5 — UNIQUE app-level)
  // Pós-pagamento: Asaas redireciona o cliente de volta ao Iris Codex. Sem isto,
  // o cliente fica preso no checkout após pagar. autoRedirect=true devolve sozinho.
  callback?: { successUrl: string; autoRedirect?: boolean }
}

export async function createAsaasPayment(
  input: CreatePaymentInput,
): Promise<AsaasResult<AsaasPayment>> {
  const r = await asaasRequest('/payments', { method: 'POST', body: JSON.stringify(input) })
  if (!r.ok) return r
  const parsed = asaasPaymentSchema.safeParse(r.data)
  if (!parsed.success) return { ok: false, status: 502, error: 'asaas response shape invalid' }
  return { ok: true, data: parsed.data }
}

export interface RefundInput {
  value?: number // omit = refund total (D-13)
  description?: string
}

export async function refundAsaasPayment(
  paymentId: string,
  body?: RefundInput,
): Promise<AsaasResult<AsaasPayment>> {
  const r = await asaasRequest(`/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
  if (!r.ok) return r
  const parsed = asaasPaymentSchema.safeParse(r.data)
  if (!parsed.success) return { ok: false, status: 502, error: 'asaas response shape invalid' }
  return { ok: true, data: parsed.data }
}
