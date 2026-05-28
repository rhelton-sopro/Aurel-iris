/**
 * POST /api/asaas/webhook
 *
 * Recebe eventos Asaas (PAYMENT_*) com shared-secret no header `asaas-access-token`.
 * É a ÚNICA forma de adicionar créditos ao saldo do terapeuta — sem este endpoint,
 * o terapeuta paga no Asaas mas Iris Codex nunca sabe.
 *
 * Contract:
 *   - 401: token missing / mismatch / env misconfigured
 *   - 400: body shape invalid (Zod envelope fail)
 *   - 500: persistência do event.id falhou (não-23505) → Asaas reenviar
 *   - 200 (success): customer_credits state transition aplicada; revalidatePath('/assinatura')
 *   - 200 (no-op):   event.id duplicate → idempotent skip
 *
 * Idempotência:
 *   - PRIMÁRIA: asaas_webhook_events.event_id PK → INSERT 23505 = duplicate → 200 no-op
 *   - SECUNDÁRIA: customer_credits.status guard absorve eventos out-of-order
 *
 * Segurança:
 *   - asaas-access-token via timing-safe compare (lib/asaas/webhook-auth)
 *   - request.text() lido FIRST pra raw body
 *   - service-role client em todas as writes (sem sessão)
 *   - DEFENSIVE .eq('user_id', credit.user_id) nas writes (apply-payment, pitfall #9)
 *
 * SLA:
 *   - Completar em < 1s (Asaas timeout receptor = 10s; fila pausa após 15 falhas)
 *   - applyPaymentEvent é I/O leve (3-4 queries, sem network out exceto audit_events)
 */
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { asaasWebhookEnvelopeSchema } from '@/lib/asaas/types'
import { verifyAsaasToken } from '@/lib/asaas/webhook-auth'
import { recordWebhookEvent, markEventProcessed } from '@/lib/asaas/idempotency'
import { applyPaymentEvent } from '@/lib/billing/apply-payment'

export const runtime = 'nodejs' // timingSafeEqual (node:crypto)
export const maxDuration = 10 // Asaas timeout receptor = 10s; abortar bem antes

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Auth FIRST (rejeição barata antes de parsear body)
  const token = request.headers.get('asaas-access-token')
  const auth = verifyAsaasToken(token, process.env.ASAAS_WEBHOOK_TOKEN)
  if (!auth.valid) {
    console.warn(`[asaas-webhook] AUTH_REJECTED reason=${auth.reason}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Body parse + Zod validation
  let envelope
  try {
    const rawBody = await request.text()
    const json = JSON.parse(rawBody) as unknown
    const parsed = asaasWebhookEnvelopeSchema.safeParse(json)
    if (!parsed.success) {
      console.warn('[asaas-webhook] BODY_INVALID', parsed.error.flatten())
      return NextResponse.json({ error: 'invalid body' }, { status: 400 })
    }
    envelope = parsed.data
  } catch (err) {
    console.warn(
      '[asaas-webhook] BODY_PARSE_FAIL:',
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  // 3. Idempotency dedupe (barreira primária — event.id PK)
  const rec = await recordWebhookEvent(envelope)
  if (!rec.ok) {
    // INSERT falhou por outra razão (não-23505) — 5xx pra Asaas reenviar
    console.error(
      `[asaas-webhook] RECORD_FAILED event=${envelope.id}:`,
      rec.error,
    )
    return NextResponse.json({ error: 'persistence failed' }, { status: 500 })
  }
  if (!rec.first_seen) {
    console.info(
      `[asaas-webhook] IDEMPOTENT_SKIP event=${envelope.id} type=${envelope.event}`,
    )
    return NextResponse.json({ ok: true, noop: 'idempotent' })
  }

  // 4. State machine dispatch
  const result = await applyPaymentEvent(envelope)

  // 5. Mark processed (best-effort; falha aqui só deixa processed_at NULL)
  await markEventProcessed(envelope.id)

  // 6. Cache invalidation
  revalidatePath('/assinatura')

  console.info(
    `[asaas-webhook] APPLIED event=${envelope.id} type=${envelope.event} result=${JSON.stringify(result)}`,
  )
  return NextResponse.json({ ok: true, ...result })
}
