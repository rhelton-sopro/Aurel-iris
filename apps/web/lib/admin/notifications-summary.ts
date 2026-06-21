/**
 * Central de notificações do painel admin: "o que chegou de importante".
 * Agrega sinais de várias fontes pro founder bater o olho e saber se precisa agir.
 *
 * Fontes:
 *   - unreadEmails: caixa suporte@ (IMAP) não-lidos
 *   - pendingRefunds: reembolsos parciais solicitados cujo crédito AINDA está ativo
 *     (= founder ainda não estornou no MP)
 *   - purchasesToday: compras confirmadas hoje (crédito creditado)
 *   - failures: (fase futura) webhooks falhos / cobranças recusadas
 *
 * Server-only. Best-effort: qualquer fonte que falhe vira 0 (nunca quebra o /admin).
 */
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceClient } from '@/lib/supabase/service'
import { getUnreadCount } from '@/lib/email/imap-client'

export interface AdminNotifications {
  unreadEmails: number
  pendingRefunds: number
  purchasesToday: number
  stuckPending: number // compras 'pending' há +2h (pagou e não creditou, ou abandono)
  publishErrors: number // posts em 'erro' (IGPUB-06, D-04)
  instagramAuthError: boolean // falha de health-check/refresh do token IG (D-07)
}

export async function getAdminNotifications(): Promise<AdminNotifications> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString()

  const [unreadEmails, pendingRefunds, purchasesToday, stuckPending, publishErrors, instagramAuthError] =
    await Promise.all([
      getUnreadCount().catch(() => 0),
      countPendingRefunds().catch(() => 0),
      countPurchasesToday(startOfDay.toISOString()).catch(() => 0),
      countStuckPending(twoHoursAgo).catch(() => 0),
      countPublishErrors().catch(() => 0),
      checkInstagramAuthError().catch(() => false),
    ])

  return {
    unreadEmails,
    pendingRefunds,
    purchasesToday,
    stuckPending,
    publishErrors,
    instagramAuthError,
  }
}

/** Posts de marketing que falharam ao publicar (status 'erro' — IGPUB-06, D-04). */
async function countPublishErrors(): Promise<number> {
  const service = createServiceClient()
  const { count } = await service
    .from('social_posts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'erro')
  return count ?? 0
}

/**
 * Falha de health-check/refresh do token do Instagram (D-07).
 * Lê a flag `instagram_health` de `app_settings`, escrita pelo cron daily (Plan 05).
 * Best-effort: enquanto a flag não existir (Plan 05 ainda não rodou), default false
 * — ausência NÃO é regressão, é o estado esperado até o cron escrever a 1ª vez.
 */
async function checkInstagramAuthError(): Promise<boolean> {
  // `app_settings` não está no Database type gerado (tabela auxiliar — ver
  // lib/instagram/token.ts e lib/admin/client-report-config.ts). Acesso por um
  // cliente untyped de propósito, restrito a este módulo server-only.
  const service = createServiceClient() as unknown as SupabaseClient
  const { data } = await service
    .from('app_settings')
    .select('value')
    .eq('key', 'instagram_health')
    .maybeSingle()
  const v = (data as { value?: { ok?: boolean } } | null)?.value
  return v?.ok === false
}

/** Compras 'pending' antigas (>2h) — webhook que não creditou OU checkout abandonado. */
async function countStuckPending(beforeISO: string): Promise<number> {
  const service = createServiceClient()
  const { count } = await service
    .from('customer_credits')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('created_at', beforeISO)
  return count ?? 0
}

async function countPurchasesToday(sinceISO: string): Promise<number> {
  const service = createServiceClient()
  const { count } = await service
    .from('credit_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'purchase')
    .gte('created_at', sinceISO)
  return count ?? 0
}

/** Reembolsos parciais solicitados cujo crédito ainda está 'active' (não estornado). */
async function countPendingRefunds(): Promise<number> {
  const service = createServiceClient()
  const { data: events } = await service
    .from('audit_events')
    .select('target_id')
    .eq('event_type', 'credit.refund_requested')
    .order('created_at', { ascending: false })
    .limit(200)
  const ids = [
    ...new Set(
      (events ?? []).map((e) => e.target_id).filter((x): x is string => !!x),
    ),
  ]
  if (ids.length === 0) return 0
  const { count } = await service
    .from('customer_credits')
    .select('id', { count: 'exact', head: true })
    .in('id', ids)
    .eq('status', 'active')
  return count ?? 0
}
