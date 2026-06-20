/**
 * POST /api/mercadopago/webhook
 *
 * Recebe notificações do Mercado Pago (Webhooks v2). O corpo só traz
 * `{ type, data.id }` — buscamos o payment via API, normalizamos e aplicamos ao
 * saldo correlacionando por `external_reference` (= creditId). É a ÚNICA forma
 * de creditar o terapeuta quando PAYMENT_PROVIDER=mercadopago.
 *
 * Contract:
 *   - 401: x-signature ausente/inválida ou secret não configurado
 *   - 200 (no-op): evento duplicado (idempotente) | tipo não-payment | status não-acionável
 *   - 503: falha TRANSIENTE de DB (crédito NÃO aplicado) → MP reenvia
 *   - 200 (success): transição aplicada
 *
 * Segurança: x-signature (HMAC) timing-safe; service-role nas writes; runtime
 * nodejs (node:crypto). SLA: responder rápido (<~22s) senão o MP re-enfileira.
 */
import { NextResponse } from 'next/server'

import { verifyMpSignature } from '@/lib/payments/mercadopago/webhook-auth'
import { getMpPayment } from '@/lib/payments/mercadopago/client'
import { normalizeMpPayment } from '@/lib/payments/mercadopago/normalize'
import {
  recordMpEvent,
  markMpEventProcessed,
  unrecordMpEvent,
} from '@/lib/payments/mercadopago/idempotency'
import { applyNormalizedEvent } from '@/lib/payments/apply-event'

export const runtime = 'nodejs' // HMAC (node:crypto)
export const maxDuration = 25 // MP re-enfileira após ~22s; abortar bem antes

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  // data.id vem da QUERY (é o valor que entra no manifest da assinatura);
  // fallback pro corpo. `type`/`topic` idem.
  let body: { type?: string; data?: { id?: string }; action?: string } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // corpo pode vir vazio em alguns pings — segue com query
  }
  const dataId =
    url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? body.data?.id ?? null
  const type =
    url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type ?? null

  // 1. Auth — x-signature (rejeição barata antes de bater na API do MP)
  const auth = verifyMpSignature({
    signatureHeader: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId,
    secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  })
  if (!auth.valid) {
    console.warn(`[mp-webhook] AUTH_REJECTED reason=${auth.reason}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Só tratamos notificações de payment; demais (merchant_order, etc.) = no-op.
  //    Chargeback chega como status charged_back no PRÓPRIO payment.
  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ ok: true, noop: 'ignored_type' })
  }

  // 3. Hidrata o payment (o corpo não traz o objeto)
  const payment = await getMpPayment(dataId)
  if (!payment.ok) {
    // Falha ao buscar (rede/5xx do MP) → 503 pro MP reenviar. 404 = payment
    // inexistente (poison-pill improvável) também volta 503; o retry do MP cessa.
    console.error(`[mp-webhook] GET payment ${dataId} failed status=${payment.status}`)
    return NextResponse.json({ ok: false, retry: true }, { status: 503 })
  }

  const event = normalizeMpPayment(payment.data)
  if (event.kind === 'noop') {
    return NextResponse.json({ ok: true, noop: `status_${event.status}` })
  }

  // 4. Idempotência (barreira primária)
  const rec = await recordMpEvent(event)
  if (!rec.ok) {
    return NextResponse.json({ ok: false, retry: true }, { status: 503 })
  }
  if (!rec.first_seen) {
    console.info(`[mp-webhook] IDEMPOTENT_SKIP key=${event.idempotencyKey}`)
    return NextResponse.json({ ok: true, noop: 'idempotent' })
  }

  // 5. State machine
  const result = await applyNormalizedEvent(event)

  // 6. Falha TRANSIENTE de DB → remove a row de idempotência e devolve 503 pro
  //    MP reentregar (senão a re-entrega cairia em no-op idempotente e o crédito
  //    ficaria perdido). not_found/wrong_state/invalid → 200 (retry não resolve).
  if (!result.applied && result.reason === 'db_error') {
    await unrecordMpEvent(event.idempotencyKey)
    console.error(
      `[mp-webhook] DB_ERROR key=${event.idempotencyKey} detail=${result.detail ?? ''} → 503`,
    )
    return NextResponse.json({ ok: false, retry: true }, { status: 503 })
  }

  await markMpEventProcessed(event.idempotencyKey)
  console.info(
    `[mp-webhook] APPLIED key=${event.idempotencyKey} result=${JSON.stringify(result)}`,
  )
  return NextResponse.json({ ok: true, ...result })
}
