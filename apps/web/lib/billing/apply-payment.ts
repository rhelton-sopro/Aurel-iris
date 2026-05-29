/**
 * State machine que aplica eventos de pagamento Asaas ao saldo de créditos.
 *
 * Server-only — usa o service-role client (webhook não tem sessão; bypassa RLS).
 * É a ÚNICA forma de mutar `customer_credits.status` a partir de um evento Asaas.
 *
 * Branches:
 *   - PAYMENT_CONFIRMED (A1 = confirmed, D-01) → ativa crédito pending → active
 *   - PAYMENT_REFUNDED → full refund: status='refunded', leituras_remaining=0
 *   - PAYMENT_PARTIALLY_REFUNDED → débito proporcional (D-13), status fica 'active'
 *   - PAYMENT_CHARGEBACK_REQUESTED → zera saldo + status='refunded'
 *   - demais eventos → no-op
 *
 * Idempotência (camada secundária; a primária é o event.id PK em
 * asaas_webhook_events, plano 08-02):
 *   - status guard `.eq('status', ...)` em todas as writes absorve duplicate /
 *     out-of-order webhooks que passem da barreira do event.id.
 *
 * Segurança:
 *   - DEFENSIVE `.eq('user_id', credit.user_id)` em TODAS as writes (memory
 *     pitfall #9 — cross-tenant write protection, T-08-04-06).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { creditExpiresAt } from '@/lib/billing/config'
import { unitPriceBrl } from '@/lib/billing/refund-policy'
import { logAuditEvent } from '@/lib/audit/log'
import { notifyCreditPurchaseConfirmed } from '@/lib/notifications/notify-credit-purchase-confirmed'
import type { AsaasWebhookEnvelope } from '@/lib/asaas/types'

export type ApplyPaymentResult =
  | {
      applied: true
      action: 'activated' | 'refunded' | 'partially_refunded' | 'chargeback'
      credit_id: string
    }
  | {
      applied: false
      reason: 'not_found' | 'wrong_state' | 'no_op_event' | 'db_error'
      detail?: string
    }

// A1 = confirmed (08-01-SUMMARY): créditos liberados em PAYMENT_CONFIRMED.
// Lido em call-time (não module-load const) pra suportar override por deploy/test
// via ASAAS_CREDIT_EVENT sem rebuild (parity com lib/asaas/client.ts baseUrl()).
function creditTriggerEvent(): 'PAYMENT_CONFIRMED' | 'PAYMENT_RECEIVED' {
  return (process.env.ASAAS_CREDIT_EVENT ?? 'PAYMENT_CONFIRMED') as
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_RECEIVED'
}

export async function applyPaymentEvent(
  envelope: AsaasWebhookEnvelope,
): Promise<ApplyPaymentResult> {
  const { event, payment } = envelope
  const service = createServiceClient()

  // ---- Branch 1: CREDIT (PAYMENT_CONFIRMED per A1) ----
  if (event === creditTriggerEvent()) {
    const { data: credit, error: selErr } = await service
      .from('customer_credits')
      .select('id, user_id, package_id, leituras_purchased, status')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()
    if (selErr) {
      console.error('[apply-payment] select failed:', selErr.message)
      return { applied: false, reason: 'db_error', detail: selErr.message }
    }
    if (!credit) {
      console.warn(
        `[apply-payment] no customer_credits row for asaas_payment_id=${payment.id}`,
      )
      return { applied: false, reason: 'not_found' }
    }
    if (credit.status !== 'pending') {
      // Já ativado — idempotent skip (race ou duplicate webhook que passou do event.id PK)
      console.info(
        `[apply-payment] credit ${credit.id} already status=${credit.status}; no-op`,
      )
      return { applied: false, reason: 'wrong_state' }
    }

    const expiresAt = creditExpiresAt(new Date()).toISOString()
    const { error: updErr } = await service
      .from('customer_credits')
      .update({
        status: 'active',
        leituras_remaining: credit.leituras_purchased,
        expires_at: expiresAt,
        asaas_payment_status: payment.status,
      })
      .eq('id', credit.id)
      .eq('user_id', credit.user_id) // DEFENSIVE — pitfall #9
      .eq('status', 'pending') // status guard — race-safe
    if (updErr) {
      console.error('[apply-payment] update failed:', updErr.message)
      return { applied: false, reason: 'db_error', detail: updErr.message }
    }

    await service.from('credit_transactions').insert({
      user_id: credit.user_id,
      credit_id: credit.id,
      type: 'purchase',
      amount: credit.leituras_purchased,
      asaas_payment_id: payment.id,
      notes: `Asaas event ${envelope.id} (${event})`,
    })

    await logAuditEvent({
      event_type: 'credit.purchase_confirmed',
      actor_user_id: credit.user_id,
      target_type: 'credit',
      target_id: credit.id,
      metadata: {
        asaas_payment_id: payment.id,
        event,
        leituras: credit.leituras_purchased,
      },
    })

    console.info(
      `[asaas-webhook] CREDIT_ACTIVATED credit=${credit.id} payment=${payment.id} leituras=${credit.leituras_purchased}`,
    )

    // Email de confirmação — BEST-EFFORT, fire-and-forget. NUNCA bloquear o
    // retorno do webhook (T-08-12-04): sem await, .catch absorve qualquer erro.
    // Email vem de auth (profiles NÃO tem coluna email — pattern espelha
    // notify-therapist-capture-complete.ts que usa auth.admin.getUserById).
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
        '[apply-payment] notify purchase failed (non-fatal):',
        err instanceof Error ? err.message : err,
      ),
    )

    return { applied: true, action: 'activated', credit_id: credit.id }
  }

  // ---- Branch 2: PAYMENT_REFUNDED (full refund) ----
  if (event === 'PAYMENT_REFUNDED') {
    const { data: credit } = await service
      .from('customer_credits')
      .select('id, user_id, leituras_remaining, status')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()
    if (!credit) {
      console.warn(
        `[apply-payment] refund without customer_credits row payment=${payment.id}`,
      )
      return { applied: false, reason: 'not_found' }
    }
    if (credit.status !== 'active') {
      // Já refunded/expired/pending — duplicate ou out-of-order. No-op idempotente (WARN-6).
      console.info(
        `[apply-payment] refund skip credit=${credit.id} status=${credit.status} (already settled)`,
      )
      return { applied: false, reason: 'wrong_state', detail: 'already_refunded' }
    }
    const lostBalance = credit.leituras_remaining

    const { data: updated, error: updErr } = await service
      .from('customer_credits')
      .update({
        status: 'refunded',
        leituras_remaining: 0,
        asaas_payment_status: payment.status,
      })
      .eq('id', credit.id)
      .eq('user_id', credit.user_id) // DEFENSIVE — pitfall #9
      .eq('status', 'active') // status guard — race-safe
      .select('id')
      .maybeSingle()
    if (updErr) {
      console.error('[apply-payment] refund update failed:', updErr.message)
      return { applied: false, reason: 'db_error', detail: updErr.message }
    }
    if (!updated) {
      // Outro processo ganhou a race — no-op idempotente
      return { applied: false, reason: 'wrong_state', detail: 'already_refunded' }
    }

    await service.from('credit_transactions').insert({
      user_id: credit.user_id,
      credit_id: credit.id,
      type: 'refund',
      amount: -lostBalance,
      asaas_payment_id: payment.id,
      notes: `full refund via Asaas event ${envelope.id}`,
    })
    await logAuditEvent({
      event_type: 'credit.refunded',
      actor_user_id: credit.user_id,
      target_type: 'credit',
      target_id: credit.id,
      metadata: { asaas_payment_id: payment.id, full: true, lost_balance: lostBalance },
    })
    console.info(
      `[asaas-webhook] CREDIT_REFUNDED credit=${credit.id} payment=${payment.id}`,
    )
    return { applied: true, action: 'refunded', credit_id: credit.id }
  }

  // ---- Branch 3: PAYMENT_PARTIALLY_REFUNDED (débito proporcional D-13) ----
  if (event === 'PAYMENT_PARTIALLY_REFUNDED') {
    const { data: credit } = await service
      .from('customer_credits')
      .select(
        'id, user_id, leituras_purchased, leituras_remaining, status, credit_packages(price_brl, leituras_count)',
      )
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()
    if (!credit) {
      console.warn(
        `[apply-payment] partial refund without credit row payment=${payment.id}`,
      )
      return { applied: false, reason: 'not_found' }
    }
    if (credit.status !== 'active') {
      console.info(
        `[apply-payment] partial refund skip credit=${credit.id} status=${credit.status}`,
      )
      return { applied: false, reason: 'wrong_state', detail: 'not_active' }
    }
    // CR-03: guard contra 2º lançamento negativo num saldo já consumido/zerado.
    // O path manual (refundPackageAction parcial) zera leituras_remaining e
    // insere o débito. Se este webhook chegar depois, sem este guard ele
    // inseriria OUTRA row type='refund' negativa contra um saldo já 0 —
    // corrompendo o ledger (Σ amount por credit_id). Idempotente.
    if (credit.leituras_remaining <= 0) {
      console.info(
        `[apply-payment] partial refund no-op credit=${credit.id} — saldo já zerado (provável refund manual prévio)`,
      )
      return { applied: false, reason: 'wrong_state', detail: 'already_refunded' }
    }

    // Asaas payload: payment.refundedValue (acumulado total devolvido) OU
    // diff value-netValue. AsaasPayment .passthrough() não tipa refundedValue.
    const pAny = payment as { refundedValue?: number; netValue?: number; value: number }
    const totalRefundedBrl =
      typeof pAny.refundedValue === 'number'
        ? pAny.refundedValue
        : typeof pAny.netValue === 'number'
          ? pAny.value - pAny.netValue
          : 0

    if (totalRefundedBrl <= 0) {
      console.warn(
        `[apply-payment] partial refund without value payment=${payment.id} — payload missing refundedValue/netValue`,
      )
      return { applied: false, reason: 'db_error', detail: 'missing_refund_value' }
    }

    const pkg = (
      credit as unknown as {
        credit_packages: { price_brl: number; leituras_count: number } | null
      }
    ).credit_packages
    if (!pkg || pkg.leituras_count <= 0) {
      console.warn(
        `[apply-payment] partial refund without package data credit=${credit.id}`,
      )
      return { applied: false, reason: 'db_error', detail: 'missing_package' }
    }
    // CR-03: base ÚNICA compartilhada com refund-policy.ts (path manual).
    const unitPrice = unitPriceBrl(pkg.price_brl, pkg.leituras_count)
    const leiturasDeviasDebitar = Math.round(totalRefundedBrl / unitPrice)

    // Quanto já foi debitado em refunds prévios? Soma absoluta dos amounts type='refund'.
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
    if (debitoDelta <= 0) {
      // Webhook duplicate ou já totalmente coberto por partials sucessivos — no-op
      console.info(
        `[apply-payment] partial refund no-op credit=${credit.id} ja_debitado=${jaDebitado} alvo=${leiturasDeviasDebitar}`,
      )
      return { applied: false, reason: 'wrong_state', detail: 'already_refunded' }
    }

    const novoRemaining = Math.max(0, credit.leituras_remaining - debitoDelta)
    const { error: updErr } = await service
      .from('customer_credits')
      .update({
        leituras_remaining: novoRemaining,
        asaas_payment_status: payment.status,
        // status fica 'active' — só PAYMENT_REFUNDED full vira 'refunded'
      })
      .eq('id', credit.id)
      .eq('user_id', credit.user_id) // DEFENSIVE — pitfall #9
      .eq('status', 'active') // status guard
    if (updErr) {
      console.error('[apply-payment] partial refund update failed:', updErr.message)
      return { applied: false, reason: 'db_error', detail: updErr.message }
    }

    await service.from('credit_transactions').insert({
      user_id: credit.user_id,
      credit_id: credit.id,
      type: 'refund',
      amount: -debitoDelta,
      asaas_payment_id: payment.id,
      notes: `partial refund Asaas event ${envelope.id} — R$ ${totalRefundedBrl.toFixed(2)} total / ${debitoDelta} leituras debitadas neste delta`,
    })
    await logAuditEvent({
      event_type: 'credit.refunded',
      actor_user_id: credit.user_id,
      target_type: 'credit',
      target_id: credit.id,
      metadata: {
        asaas_payment_id: payment.id,
        partial: true,
        refunded_value_brl: totalRefundedBrl,
        leituras_debited_delta: debitoDelta,
        leituras_remaining_after: novoRemaining,
      },
    })
    console.info(
      `[asaas-webhook] CREDIT_PARTIAL_REFUNDED credit=${credit.id} payment=${payment.id} debit=${debitoDelta} remaining=${novoRemaining}`,
    )
    return { applied: true, action: 'partially_refunded', credit_id: credit.id }
  }

  // ---- Branch 4: CHARGEBACK ----
  if (event === 'PAYMENT_CHARGEBACK_REQUESTED') {
    const { data: credit } = await service
      .from('customer_credits')
      .select('id, user_id')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()
    if (credit) {
      await service
        .from('customer_credits')
        .update({ status: 'refunded', leituras_remaining: 0 })
        .eq('id', credit.id)
        .eq('user_id', credit.user_id) // DEFENSIVE — pitfall #9
      await logAuditEvent({
        event_type: 'credit.refunded',
        actor_user_id: credit.user_id,
        target_type: 'credit',
        target_id: credit.id,
        metadata: { asaas_payment_id: payment.id, chargeback: true },
      })
    }
    console.warn(
      `[asaas-webhook] CHARGEBACK credit=${credit?.id} payment=${payment.id}`,
    )
    return { applied: true, action: 'chargeback', credit_id: credit?.id ?? '' }
  }

  // ---- No-op events (PAYMENT_CREATED, PAYMENT_OVERDUE, PAYMENT_DELETED, etc.) ----
  console.info(`[asaas-webhook] NOOP event=${event} payment=${payment.id}`)
  return { applied: false, reason: 'no_op_event' }
}
