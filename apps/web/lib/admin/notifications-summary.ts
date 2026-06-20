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

import { createServiceClient } from '@/lib/supabase/service'
import { getUnreadCount } from '@/lib/email/imap-client'

export interface AdminNotifications {
  unreadEmails: number
  pendingRefunds: number
  purchasesToday: number
  failures: number
}

export async function getAdminNotifications(): Promise<AdminNotifications> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [unreadEmails, pendingRefunds, purchasesToday] = await Promise.all([
    getUnreadCount().catch(() => 0),
    countPendingRefunds().catch(() => 0),
    countPurchasesToday(startOfDay.toISOString()).catch(() => 0),
  ])

  return {
    unreadEmails,
    pendingRefunds,
    purchasesToday,
    failures: 0, // fase futura: detector de webhooks falhos / cobranças recusadas
  }
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
