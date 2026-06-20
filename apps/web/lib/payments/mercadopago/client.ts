/**
 * Client REST tipado da API do Mercado Pago (sem SDK — REST cru via fetch, igual
 * ao client Asaas; ver research/05-credentials-sandbox-testing.md §SDK vs REST).
 *
 * Server-only — lê MERCADOPAGO_ACCESS_TOKEN do ambiente e NUNCA o loga.
 * Cobre o que o Checkout Pro precisa: criar preference, buscar payment (pra
 * hidratar o webhook que só traz {type, data.id}), e estornar.
 *
 * Logs estruturados: só path + status HTTP (+ detalhe truncado), nunca o token.
 */
import 'server-only'

const MP_BASE = 'https://api.mercadopago.com'

export type MpResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

// Lido em call-time (não no load do módulo) pra ser overridável por-env/teste.
function accessToken(): string | undefined {
  return process.env.MERCADOPAGO_ACCESS_TOKEN
}

async function mpRequest<T>(
  path: string,
  init: RequestInit,
  idempotencyKey?: string,
): Promise<MpResult<T>> {
  const token = accessToken()
  if (!token) {
    console.error('[mp] MERCADOPAGO_ACCESS_TOKEN missing')
    return { ok: false, status: 500, error: 'MERCADOPAGO_ACCESS_TOKEN missing' }
  }
  try {
    const res = await fetch(`${MP_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // X-Idempotency-Key é obrigatório em payments/refunds (e barato em
        // preferences) — retry pós-timeout não duplica cobrança/estorno.
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
    })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      console.error(
        `[mp] ${init.method ?? 'GET'} ${path} HTTP ${res.status} — ${text.slice(0, 300)}`,
      )
      return { ok: false, status: res.status, error: text.slice(0, 300) }
    }
    return { ok: true, data: (text ? JSON.parse(text) : {}) as T }
  } catch (err) {
    console.error(`[mp] ${path} fetch failed:`, err instanceof Error ? err.message : err)
    return { ok: false, status: 0, error: 'network' }
  }
}

// ───────────────────────── Preferences (Checkout Pro) ─────────────────────────

export interface MpPreferenceItem {
  title: string
  quantity: number
  unit_price: number
  currency_id: 'BRL'
  description?: string
}

export interface MpPreferenceInput {
  items: MpPreferenceItem[]
  external_reference: string
  payer?: {
    name?: string
    email?: string
    identification?: { type: 'CPF'; number: string }
  }
  back_urls?: { success?: string; pending?: string; failure?: string }
  auto_return?: 'approved' | 'all'
  notification_url?: string
  statement_descriptor?: string
  payment_methods?: {
    installments?: number
    default_installments?: number
    excluded_payment_types?: Array<{ id: string }>
    excluded_payment_methods?: Array<{ id: string }>
  }
  metadata?: Record<string, unknown>
  expires?: boolean
  expiration_date_from?: string
  expiration_date_to?: string
}

export interface MpPreference {
  id: string
  init_point: string
  sandbox_init_point?: string
}

export async function createMpPreference(
  input: MpPreferenceInput,
  idempotencyKey?: string,
): Promise<MpResult<MpPreference>> {
  return mpRequest<MpPreference>(
    '/checkout/preferences',
    { method: 'POST', body: JSON.stringify(input) },
    idempotencyKey,
  )
}

// ───────────────────────── Payments ─────────────────────────

export interface MpPayment {
  id: number
  status: string // approved | authorized | in_process | rejected | refunded | charged_back | cancelled | pending
  status_detail?: string
  external_reference?: string | null
  transaction_amount: number
  transaction_amount_refunded?: number
  installments?: number
  payment_method_id?: string
  payment_type_id?: string
  date_approved?: string | null
  date_created?: string | null
}

export async function getMpPayment(paymentId: string): Promise<MpResult<MpPayment>> {
  return mpRequest<MpPayment>(`/v1/payments/${paymentId}`, { method: 'GET' })
}

// ───────────────────────── Refunds ─────────────────────────

export interface MpRefund {
  id: number
  payment_id: number
  amount: number
  status: string // approved | in_process
}

export async function refundMpPayment(
  paymentId: string,
  amountBrl: number | undefined,
  idempotencyKey: string,
): Promise<MpResult<MpRefund>> {
  // Total = body vazio; parcial = { amount }. X-Render-In-Process-Refunds:true
  // faz o refund de PIX em contingência voltar 201 + status in_process (assíncrono)
  // em vez de 400 (research/03 §gotchas).
  return mpRequest<MpRefund>(
    `/v1/payments/${paymentId}/refunds`,
    {
      method: 'POST',
      body: amountBrl != null ? JSON.stringify({ amount: amountBrl }) : '{}',
      headers: { 'X-Render-In-Process-Refunds': 'true' },
    },
    idempotencyKey,
  )
}
