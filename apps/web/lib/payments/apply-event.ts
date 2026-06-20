/**
 * State machine que aplica um NormalizedPaymentEvent ao saldo de créditos,
 * correlacionando por `creditId` (= external_reference = PK da row). É o caminho
 * de entrada do Mercado Pago.
 *
 * NÃO substitui lib/billing/apply-payment.ts (Asaas) — esse correlaciona por
 * asaas_payment_id/grupo e segue intocado (caminho dormente/rollback). As duas
 * máquinas compartilham a MESMA lógica de transição; ficam separadas porque a
 * LOOKUP difere (Asaas: payment/grupo; MP: PK via external_reference). Unificar
 * é dívida registrada — risco de divergência mitigado por testes nos dois.
 *
 * Server-only — service-role client (webhook não tem sessão; bypassa RLS).
 * DEFENSIVE `.eq('user_id', credit.user_id)` em todas as writes (pitfall #9).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { creditExpiresAt } from '@/lib/billing/config'
import { unitPriceBrl } from '@/lib/billing/refund-policy'
import { logAuditEvent } from '@/lib/audit/log'
import { notifyCreditPurchaseConfirmed } from '@/lib/notifications/notify-credit-purchase-confirmed'

import type { NormalizedPaymentEvent } from './types'

export type ApplyEventResult =
  | {
      applied: true
      action: 'activated' | 'refunded' | 'partially_refunded' | 'chargeback'
      credit_id: string
    }
  | {
      applied: false
      reason: 'not_found' | 'wrong_state' | 'no_op_event' | 'db_error' | 'invalid_payload'
      detail?: string
    }

export async function applyNormalizedEvent(
  event: NormalizedPaymentEvent,
): Promise<ApplyEventResult> {
  if (event.kind === 'noop') return { applied: false, reason: 'no_op_event' }
  if (!event.creditId) {
    return { applied: false, reason: 'invalid_payload', detail: 'missing_credit_id' }
  }
  const service = createServiceClient()
  const creditId = event.creditId

  // ---- CONFIRM → ativa pending e grava o payment.id REAL (refund depende dele) ----
  if (event.kind === 'payment_confirmed') {
    const { data: credit, error: selErr } = await service
      .from('customer_credits')
      .select('id, user_id, package_id, leituras_purchased, status')
      .eq('id', creditId)
      .maybeSingle()
    if (selErr) return { applied: false, reason: 'db_error', detail: selErr.message }
    if (!credit) return { applied: false, reason: 'not_found' }
    if (credit.status !== 'pending') return { applied: false, reason: 'wrong_state' }

    const expiresAt = creditExpiresAt(new Date()).toISOString()
    const { data: flipped, error: updErr } = await service
      .from('customer_credits')
      .update({
        status: 'active',
        leituras_remaining: credit.leituras_purchased,
        expires_at: expiresAt,
        // createCharge gravou a preference.id aqui; troca pelo payment.id real.
        asaas_payment_id: event.providerPaymentId,
        asaas_payment_status: event.status,
      })
      .eq('id', credit.id)
      .eq('user_id', credit.user_id) // DEFENSIVE
      .eq('status', 'pending') // status guard — race-safe
      .select('id')
    if (updErr) return { applied: false, reason: 'db_error', detail: updErr.message }
    if (!flipped || flipped.length === 0) {
      // Outro evento concorrente já ativou — no-op idempotente (sem ledger dup).
      return { applied: false, reason: 'wrong_state' }
    }

    await service.from('credit_transactions').insert({
      user_id: credit.user_id,
      credit_id: credit.id,
      type: 'purchase',
      amount: credit.leituras_purchased,
      asaas_payment_id: event.providerPaymentId,
      notes: `MP event ${event.idempotencyKey}`,
    })
    await logAuditEvent({
      event_type: 'credit.purchase_confirmed',
      actor_user_id: credit.user_id,
      target_type: 'credit',
      target_id: credit.id,
      metadata: {
        provider: 'mercadopago',
        payment_id: event.providerPaymentId,
        leituras: credit.leituras_purchased,
      },
    })
    console.info(
      `[mp-webhook] CREDIT_ACTIVATED credit=${credit.id} payment=${event.providerPaymentId} leituras=${credit.leituras_purchased}`,
    )

    // Email confirmação — BEST-EFFORT, fire-and-forget (nunca bloqueia o webhook).
    void (async () => {
      const [{ data: enriched }, authResult] = await Promise.all([
        service
          .from('customer_credits')
          .select('expires_at, credit_packages(name, price_brl)')
          .eq('id', credit.id)
          .maybeSingle(),
        service.auth.admin.getUserById(credit.user_id),
      ])
      const userEmail = authResult.data.user?.email
      const pkg = (
        enriched as unknown as {
          credit_packages: { name: string; price_brl: number } | null
        } | null
      )?.credit_packages
      if (!userEmail || !enriched || !pkg) return
      const { data: prof } = await service
        .from('profiles')
        .select('full_name')
        .eq('id', credit.user_id)
        .maybeSingle()
      await notifyCreditPurchaseConfirmed({
        userEmail,
        userName: prof?.full_name ?? null,
        packageName: pkg.name,
        leituras: credit.leituras_purchased,
        valueBrl: pkg.price_brl,
        expiresAt: enriched.expires_at,
      })
    })().catch((err) =>
      console.warn(
        '[mp-webhook] notify purchase failed (non-fatal):',
        err instanceof Error ? err.message : err,
      ),
    )

    return { applied: true, action: 'activated', credit_id: credit.id }
  }

  // ---- REFUND total ----
  if (event.kind === 'payment_refunded') {
    const { data: credit } = await service
      .from('customer_credits')
      .select('id, user_id, leituras_remaining, status')
      .eq('id', creditId)
      .maybeSingle()
    if (!credit) return { applied: false, reason: 'not_found' }
    if (credit.status !== 'active') {
      return { applied: false, reason: 'wrong_state', detail: 'already_settled' }
    }
    const lostBalance = credit.leituras_remaining
    const { data: updated, error: updErr } = await service
      .from('customer_credits')
      .update({
        status: 'refunded',
        leituras_remaining: 0,
        asaas_payment_status: event.status,
      })
      .eq('id', credit.id)
      .eq('user_id', credit.user_id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle()
    if (updErr) return { applied: false, reason: 'db_error', detail: updErr.message }
    if (!updated) return { applied: false, reason: 'wrong_state', detail: 'already_refunded' }

    await service.from('credit_transactions').insert({
      user_id: credit.user_id,
      credit_id: credit.id,
      type: 'refund',
      amount: -lostBalance,
      asaas_payment_id: event.providerPaymentId,
      notes: `full refund via MP event ${event.idempotencyKey}`,
    })
    await logAuditEvent({
      event_type: 'credit.refunded',
      actor_user_id: credit.user_id,
      target_type: 'credit',
      target_id: credit.id,
      metadata: { provider: 'mercadopago', payment_id: event.providerPaymentId, full: true, lost_balance: lostBalance },
    })
    console.info(`[mp-webhook] CREDIT_REFUNDED credit=${credit.id} payment=${event.providerPaymentId}`)
    return { applied: true, action: 'refunded', credit_id: credit.id }
  }

  // ---- PARTIAL refund (débito proporcional, D-13) ----
  if (event.kind === 'payment_partially_refunded') {
    const { data: credit } = await service
      .from('customer_credits')
      .select(
        'id, user_id, paid_brl, leituras_purchased, leituras_remaining, status, credit_packages(price_brl, leituras_count)',
      )
      .eq('id', creditId)
      .maybeSingle()
    if (!credit) return { applied: false, reason: 'not_found' }
    if (credit.status !== 'active') {
      return { applied: false, reason: 'wrong_state', detail: 'not_active' }
    }
    if (credit.leituras_remaining <= 0) {
      // Saldo já zerado (provável refund manual prévio) — no-op idempotente (CR-03).
      return { applied: false, reason: 'wrong_state', detail: 'already_refunded' }
    }
    const totalRefundedBrl = event.refundedValueBrl ?? 0
    if (totalRefundedBrl <= 0) {
      return { applied: false, reason: 'invalid_payload', detail: 'missing_refund_value' }
    }
    const pkg = (
      credit as unknown as {
        credit_packages: { price_brl: number; leituras_count: number } | null
      }
    ).credit_packages
    if (!pkg || pkg.leituras_count <= 0) {
      return { applied: false, reason: 'invalid_payload', detail: 'missing_package' }
    }
    const paidBaseBrl =
      (credit as unknown as { paid_brl: number | null }).paid_brl ?? pkg.price_brl
    const unitPrice = unitPriceBrl(paidBaseBrl, pkg.leituras_count)
    const leiturasDeviasDebitar = Math.round(totalRefundedBrl / unitPrice)

    const { data: prevRefunds } = await service
      .from('credit_transactions')
      .select('amount')
      .eq('credit_id', credit.id)
      .eq('type', 'refund')
    const jaDebitado = (prevRefunds ?? []).reduce(
      (sum: number, r: { amount: number }) => sum + Math.abs(r.amount),
      0,
    )
    const debitoDelta = leiturasDeviasDebitar - jaDebitado
    if (debitoDelta <= 0) return { applied: false, reason: 'wrong_state', detail: 'already_refunded' }

    const novoRemaining = Math.max(0, credit.leituras_remaining - debitoDelta)
    const { error: updErr } = await service
      .from('customer_credits')
      .update({ leituras_remaining: novoRemaining, asaas_payment_status: event.status })
      .eq('id', credit.id)
      .eq('user_id', credit.user_id)
      .eq('status', 'active')
    if (updErr) return { applied: false, reason: 'db_error', detail: updErr.message }

    await service.from('credit_transactions').insert({
      user_id: credit.user_id,
      credit_id: credit.id,
      type: 'refund',
      amount: -debitoDelta,
      asaas_payment_id: event.providerPaymentId,
      notes: `partial refund MP event ${event.idempotencyKey} — R$ ${totalRefundedBrl.toFixed(2)} total / ${debitoDelta} leituras neste delta`,
    })
    await logAuditEvent({
      event_type: 'credit.refunded',
      actor_user_id: credit.user_id,
      target_type: 'credit',
      target_id: credit.id,
      metadata: {
        provider: 'mercadopago',
        payment_id: event.providerPaymentId,
        partial: true,
        refunded_value_brl: totalRefundedBrl,
        leituras_debited_delta: debitoDelta,
        leituras_remaining_after: novoRemaining,
      },
    })
    console.info(
      `[mp-webhook] CREDIT_PARTIAL_REFUNDED credit=${credit.id} debit=${debitoDelta} remaining=${novoRemaining}`,
    )
    return { applied: true, action: 'partially_refunded', credit_id: credit.id }
  }

  // ---- CHARGEBACK → zera saldo ----
  if (event.kind === 'chargeback') {
    const { data: credit } = await service
      .from('customer_credits')
      .select('id, user_id, status')
      .eq('id', creditId)
      .maybeSingle()
    if (credit && credit.status !== 'refunded') {
      await service
        .from('customer_credits')
        .update({ status: 'refunded', leituras_remaining: 0 })
        .eq('id', credit.id)
        .eq('user_id', credit.user_id)
        .eq('status', credit.status)
      await logAuditEvent({
        event_type: 'credit.refunded',
        actor_user_id: credit.user_id,
        target_type: 'credit',
        target_id: credit.id,
        metadata: { provider: 'mercadopago', payment_id: event.providerPaymentId, chargeback: true },
      })
    }
    console.warn(`[mp-webhook] CHARGEBACK credit=${credit?.id} payment=${event.providerPaymentId}`)
    return { applied: true, action: 'chargeback', credit_id: credit?.id ?? '' }
  }

  return { applied: false, reason: 'no_op_event' }
}
