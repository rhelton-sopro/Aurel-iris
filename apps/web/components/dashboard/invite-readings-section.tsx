import Link from 'next/link'
import { Link as LinkIcon } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LocalDateTime } from '@/components/ui/local-date-time'

/**
 * Seção FIXA no /dashboard listando últimas leituras via /convite/[token].
 * SEMPRE visível enquanto houver pelo menos 1 leitura via convite — não
 * some quando terapeuta abre uma leitura. (Founder UAT 2026-05-20:
 * notification card sumindo após abertura confundia: leitura já lida
 * continuava aparecendo, então founder pediu "campo fixo".)
 *
 * Comportamento:
 *  - Lista até 8 leituras via convite (mais recentes primeiro).
 *  - Cada linha: nome do cliente + data + badge "NOVO" se ainda não
 *    foi aberta (seen_by_therapist_at IS NULL).
 *  - Click → /leituras/[id] (que marca como vista).
 *  - Se zero leituras via convite, retorna null (sem ruído).
 *  - Counter no header: "X • Y novas" se houver não-vistas.
 *
 * Permanente vs notification: notification card antigo SUMIA quando
 * todas eram abertas. Esta seção SOMPRE mostra o histórico (até zerar);
 * fica como "atalho" pra ver clientes que vieram por convite.
 */
export async function InviteReadingsSection() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  // Tokens deste terapeuta que viraram leituras.
  const { data: tokens } = await service
    .from('client_invite_tokens' as never)
    .select('used_by_reading_id')
    .eq('therapist_id', user.id)
    .not('used_by_reading_id', 'is', null)
  const readingIds = ((tokens ?? []) as Array<{ used_by_reading_id: string | null }>)
    .map((t) => t.used_by_reading_id)
    .filter((id): id is string => !!id)

  if (readingIds.length === 0) return null

  // Últimas 8 leituras via convite com nome do cliente + seen flag.
  const { data: readings } = await service
    .from('readings')
    .select('id, created_at, status, client:clients(full_name)')
    .in('id', readingIds)
    .eq('therapist_id', user.id)
    .order('created_at', { ascending: false })
    .limit(8)

  const list = readings ?? []
  if (list.length === 0) return null

  // Quantas ainda não vistas — query separada porque types não tem
  // seen_by_therapist_at ainda.
  const { data: unseenRows } = await service
    .from('readings')
    .select('id')
    .in('id', readingIds)
    .eq('therapist_id', user.id)
    .is('seen_by_therapist_at' as never, null)
  const unseenIds = new Set(((unseenRows ?? []) as Array<{ id: string }>).map((r) => r.id))
  const unseenCount = unseenIds.size

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <LinkIcon className="h-4 w-4" />
          Leituras via convite
          <span className="text-xs font-normal normal-case text-muted-foreground/70">
            ({list.length}
            {unseenCount > 0 && (
              <>
                {' • '}
                <strong className="text-amber-700">{unseenCount} nova{unseenCount > 1 ? 's' : ''}</strong>
              </>
            )}
            )
          </span>
        </h2>
        <Link
          href="/leituras"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          ver todas →
        </Link>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <ul className="divide-y divide-border">
          {list.map((r) => {
            const c = Array.isArray(r.client) ? r.client[0] : r.client
            const name = (c as { full_name?: string | null })?.full_name ?? 'Cliente'
            const isUnseen = unseenIds.has(r.id)
            return (
              <li key={r.id}>
                <Link
                  href={`/leituras/${r.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isUnseen && (
                      <span
                        aria-label="Não vista"
                        title="Você ainda não abriu esta leitura"
                        className="inline-block rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      >
                        NOVO
                      </span>
                    )}
                    <span className={`truncate text-sm ${isUnseen ? 'font-semibold' : 'font-medium'}`}>
                      {name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                    <LocalDateTime iso={r.created_at} />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
