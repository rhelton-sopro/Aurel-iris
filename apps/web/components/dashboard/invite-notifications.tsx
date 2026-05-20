import Link from 'next/link'
import { Bell } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Card de notificação no /dashboard: avisa o terapeuta quando clientes
 * concluíram leituras via /convite/[token] e ainda não foram abertas.
 *
 * Query: readings owned by user, criadas via convite (EXISTS em
 * client_invite_tokens.used_by_reading_id), com seen_by_therapist_at
 * IS NULL. Quando terapeuta abre /leituras/[id], o flag é setado e
 * a leitura sai dessa contagem.
 *
 * RLS: usa session client (não service); RLS de readings garante
 * isolation. Cross-table check em client_invite_tokens precisa ser
 * via service-role (RLS de tokens limita ao therapist_id mas precisamos
 * de garantia EXISTS sem custo de planner).
 */
export async function InviteNotifications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Service-role pq queremos counting eficiente sem RLS overhead em duas
  // tabelas. Filtro therapist_id=user.id é aplicado explicitamente.
  const service = createServiceClient()
  const { data: tokens } = await service
    .from('client_invite_tokens' as never)
    .select('used_by_reading_id')
    .eq('therapist_id', user.id)
    .not('used_by_reading_id', 'is', null)
  const readingIds = ((tokens ?? []) as Array<{ used_by_reading_id: string | null }>)
    .map((t) => t.used_by_reading_id)
    .filter((id): id is string => !!id)

  if (readingIds.length === 0) return null

  const { data: unseen } = await service
    .from('readings')
    .select('id, client:clients(full_name)')
    .in('id', readingIds)
    .eq('therapist_id', user.id)
    .is('seen_by_therapist_at', null)
    .order('created_at', { ascending: false })

  const list = unseen ?? []
  if (list.length === 0) return null

  const names = list
    .map((r) => {
      const c = Array.isArray(r.client) ? r.client[0] : r.client
      return (c as { full_name?: string | null })?.full_name ?? 'Cliente'
    })
    .slice(0, 3)
  const remaining = list.length - names.length

  return (
    <Link
      href="/leituras"
      className="block rounded-md border-2 border-amber-500 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100"
    >
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 flex-shrink-0 text-amber-700 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            {list.length === 1
              ? '1 nova leitura de cliente via convite'
              : `${list.length} novas leituras de clientes via convite`}
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80">
            {names.join(', ')}
            {remaining > 0 && ` e mais ${remaining}`}
            {' — toque para ver.'}
          </p>
        </div>
      </div>
    </Link>
  )
}
