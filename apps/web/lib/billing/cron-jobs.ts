import 'server-only'

import { logAuditEvent } from '@/lib/audit/log'
import {
  notifyCreditExpiring,
  type ExpiryWindow,
} from '@/lib/notifications/notify-credit-expiring'
import { createServiceClient } from '@/lib/supabase/service'

const DAY_MS = 86_400_000
const RELEASE_BATCH_CAP = 500 // safety cap por execução

/**
 * Cron job — libera reservations expiradas (status='active' + expires_at < now).
 *
 * Chama a RPC release_reservation (08-01) pra cada uma: atomic, devolve saldo
 * (decrementa leituras_reserved + incrementa leituras_remaining) + marca
 * status='released'. Idempotente: re-rodar no mesmo dia só pega as que ainda
 * estão 'active' (as já liberadas saíram do filtro).
 */
export async function releaseExpiredReservations(): Promise<{
  released: number
  errors: number
}> {
  const service = createServiceClient()
  const { data: expired, error } = await service
    .from('credit_reservations')
    .select('reading_id')
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .limit(RELEASE_BATCH_CAP)

  if (error) {
    console.error('[cron] releaseExpiredReservations select failed:', error.message)
    return { released: 0, errors: 1 }
  }

  let released = 0
  let errors = 0
  for (const r of expired ?? []) {
    const { error: rpcErr } = await service.rpc('release_reservation', {
      p_reading_id: r.reading_id,
      p_reason: 'expired',
    })
    if (rpcErr) {
      console.error(
        `[cron] release_reservation failed reading=${r.reading_id}:`,
        rpcErr.message,
      )
      errors++
      continue
    }
    released++
  }
  return { released, errors }
}

/**
 * Cron job (backstop) — reconcilia consumes órfãos.
 *
 * O consume firme (convert_reservation_to_consume) roda no fim do /analyze. Se a
 * função for terminada pela plataforma DEPOIS de salvar o relatório mas ANTES do
 * consume (race rara em geração longa >300s com cliente desconectado), a reserva
 * fica 'active' num reading que JÁ tem relatório → crédito não debitado. Este job
 * pega essas: reserva 'active' + reading com report_generated → chama a RPC.
 *
 * Idempotente: a RPC só debita se a reserva ainda está 'active' (race-safe via
 * WHERE+RETURNING). Re-rodar é no-op (outcome 'already'). Bounded pelo cap.
 */
export async function reconcileOrphanedConsumes(): Promise<{
  consumed: number
  errors: number
}> {
  const service = createServiceClient()
  const { data: actives, error } = await service
    .from('credit_reservations')
    .select('reading_id')
    .eq('status', 'active')
    .limit(RELEASE_BATCH_CAP)
  if (error) {
    console.error('[cron] reconcileOrphanedConsumes select failed:', error.message)
    return { consumed: 0, errors: 1 }
  }
  if (!actives?.length) return { consumed: 0, errors: 0 }

  // Quais dessas readings JÁ completaram (têm relatório) → reserva órfã.
  const readingIds = actives.map((r) => r.reading_id)
  const { data: done, error: rErr } = await service
    .from('readings')
    .select('id')
    .in('id', readingIds)
    .not('report_generated', 'is', null)
    // FIX bug#1: report_generated_at só é setado no caminho de SUCESSO
    // (analyze/route.ts:490). O catch de erro grava report_generated PARCIAL
    // SEM _at. Filtrar por _at NOT NULL cobra só órfãos LEGÍTIMOS (sucesso cujo
    // consume inline morreu na race >300s), nunca o relatório falho/parcial que
    // o inline DELIBERADAMENTE não cobrou. Mesma regra do on-view (page.tsx).
    .not('report_generated_at', 'is', null)
  if (rErr) {
    console.error('[cron] reconcileOrphanedConsumes readings failed:', rErr.message)
    return { consumed: 0, errors: 1 }
  }

  let consumed = 0
  let errors = 0
  for (const rd of done ?? []) {
    const { data, error: rpcErr } = await (
      service.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )('convert_reservation_to_consume', { p_reading_id: rd.id })
    if (rpcErr) {
      console.error(
        `[cron] reconcile convert failed reading=${rd.id}:`,
        rpcErr.message,
      )
      errors++
      continue
    }
    const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string } | undefined
    if (row?.outcome === 'consumed') {
      consumed++
      console.info(`[cron] reconcile CONSUMED órfão reading=${rd.id}`)
    }
  }
  return { consumed, errors }
}

/**
 * Cron job — marca credits vencidos (12m+) como expired + zera saldo.
 *
 * Idempotente via WHERE status='active' AND expires_at < now — credits já
 * expirados saíram do filtro. Registra credit_transactions (type='expire') +
 * audit 'credit.expired' por crédito atingido.
 */
export async function expireOldCredits(): Promise<{ expired: number }> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('customer_credits')
    .update({ status: 'expired', leituras_remaining: 0 })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('id, user_id, leituras_remaining')

  if (error) {
    console.error('[cron] expireOldCredits failed:', error.message)
    return { expired: 0 }
  }

  for (const row of data ?? []) {
    // leituras_remaining aqui é o valor PÓS-update (= 0). O saldo perdido é o
    // valor pré-update, que não temos no retorno do UPDATE; registramos a
    // transação como zeragem (amount 0) + o audit marca o evento terminal.
    await service.from('credit_transactions').insert({
      user_id: row.user_id,
      credit_id: row.id,
      type: 'expire',
      amount: 0,
      notes: 'cron daily — validade 12m atingida',
    })
    await logAuditEvent({
      event_type: 'credit.expired',
      actor_user_id: null,
      actor_email: 'system',
      target_type: 'credit',
      target_id: row.id,
    })
  }
  return { expired: data?.length ?? 0 }
}

/**
 * Cron job — encerra trials vencidos por tempo (60d+) ainda não encerrados.
 *
 * Idempotente via WHERE ended_at IS NULL AND trial_expires_at < now. Reservations
 * criadas durante o trial e ainda 'active' passam por releaseExpiredReservations.
 */
export async function expireOldTrials(): Promise<{ ended: number }> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('trial_status')
    .update({ ended_at: new Date().toISOString(), ended_reason: 'days_elapsed' })
    .is('ended_at', null)
    .lt('trial_expires_at', new Date().toISOString())
    .select('user_id')

  if (error) {
    console.error('[cron] expireOldTrials failed:', error.message)
    return { ended: 0 }
  }

  for (const row of data ?? []) {
    await logAuditEvent({
      event_type: 'trial.ended',
      actor_user_id: row.user_id,
      actor_email: 'system',
      target_type: 'profile',
      target_id: row.user_id,
      metadata: { reason: 'days_elapsed' },
    })
  }
  return { ended: data?.length ?? 0 }
}

/**
 * Cron job — envia avisos de expiração em 3 janelas: 30d, 7d e no dia (0d).
 *
 * Dedup via audit_events com event_type='credit.expiring_warning' (WARN-4: NÃO
 * reusa 'credit.expired', que marca o evento TERMINAL do crédito — warnings são
 * sub-tipo separado pra não distorcer analytics). metadata.notification_days
 * distingue qual janela já foi enviada pra cada crédito.
 *
 * Best-effort: notifyCreditExpiring é fire-and-forget (void + .catch); falha de
 * email NUNCA quebra o cron. Idempotente: re-rodar pula créditos já avisados na
 * mesma janela.
 *
 * Email vem de auth.admin.getUserById — a tabela profiles NÃO tem coluna email
 * (pattern espelha apply-payment.ts / notify-credit-purchase-confirmed.ts).
 */
const WINDOWS: { days: ExpiryWindow; start: number; end: number }[] = [
  { days: 30, start: 30, end: 31 }, // expira em [30, 31) dias
  { days: 7, start: 7, end: 8 }, // expira em [7, 8) dias
  { days: 0, start: 0, end: 1 }, // expira hoje: [0, 1)
]

export async function sendExpirationWarnings(): Promise<{
  sent: number
  skipped: number
}> {
  const service = createServiceClient()
  const now = Date.now()
  let sent = 0
  let skipped = 0

  for (const win of WINDOWS) {
    const lower = new Date(now + win.start * DAY_MS).toISOString()
    const upper = new Date(now + win.end * DAY_MS).toISOString()

    const { data: credits, error } = await service
      .from('customer_credits')
      .select('id, user_id, expires_at, leituras_remaining, credit_packages(name)')
      .eq('status', 'active')
      .gte('expires_at', lower)
      .lt('expires_at', upper)
      .gt('leituras_remaining', 0)

    if (error) {
      console.error(
        `[cron] sendExpirationWarnings select failed window=${win.days}:`,
        error.message,
      )
      continue
    }

    for (const c of credits ?? []) {
      // Dedup: warning prévio pro mesmo credit_id + mesma janela?
      // event_type='credit.expiring_warning' garante que NÃO colide com a row
      // terminal 'credit.expired'.
      const { data: existing } = await service
        .from('audit_events')
        .select('id')
        .eq('event_type', 'credit.expiring_warning')
        .eq('target_id', c.id)
        .contains('metadata', { notification_days: win.days })
        .maybeSingle()
      if (existing) {
        skipped++
        continue
      }

      const pkg = (
        c as unknown as { credit_packages: { name: string } | null }
      ).credit_packages
      if (!pkg) {
        skipped++
        continue
      }

      // Email via auth (profiles não tem coluna email); full_name via profiles.
      const [authResult, { data: prof }] = await Promise.all([
        service.auth.admin.getUserById(c.user_id),
        service
          .from('profiles')
          .select('full_name')
          .eq('id', c.user_id)
          .maybeSingle(),
      ])
      const userEmail = authResult.data.user?.email
      if (!userEmail) {
        skipped++
        continue
      }

      void notifyCreditExpiring({
        userEmail,
        userName: prof?.full_name ?? null,
        packageName: pkg.name,
        leiturasRemaining: c.leituras_remaining,
        expiresAt: c.expires_at,
        daysOut: win.days,
      }).catch((err) =>
        console.warn(
          '[cron] notifyCreditExpiring failed (non-fatal):',
          err instanceof Error ? err.message : err,
        ),
      )

      await logAuditEvent({
        event_type: 'credit.expiring_warning', // ← distinto de 'credit.expired'
        actor_user_id: c.user_id,
        actor_email: 'system',
        target_type: 'credit',
        target_id: c.id,
        metadata: { notification_days: win.days, expires_at: c.expires_at },
      })
      sent++
    }
  }
  return { sent, skipped }
}
