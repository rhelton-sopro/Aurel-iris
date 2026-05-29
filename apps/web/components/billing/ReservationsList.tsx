'use client'

// Lista "Processos em andamento" (D-11): reservas active com TTL relativo +
// botão Cancelar. Client component porque dispara cancelReservationAction num
// useTransition + toast. A action (08-11) reafirma a sessão e cancelReservation
// (08-05) faz o ownership check (T-08-11-01) — aqui é só UX.
//
// Design: tokens semânticos NEUTROS + teal explícito; rounded-[2px]; <Button>
// do projeto pro idioma da marca. Sem prose-* (Tailwind v4).

import { useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cancelReservationAction } from '@/app/actions/billing-extras'
import type { ActiveReservation } from '@/lib/billing/reservations'

export function ReservationsList({
  reservations,
}: {
  reservations: ActiveReservation[]
}) {
  const [isPending, startTransition] = useTransition()

  function handleCancel(readingId: string) {
    if (
      !confirm(
        'Cancelar este processo libera o crédito reservado de volta. Confirmar?',
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await cancelReservationAction(readingId)
      if (!r.ok) {
        toast.error(r.error ?? 'Erro.')
        return
      }
      toast.success('Reserva cancelada. Crédito liberado.')
    })
  }

  if (reservations.length === 0) {
    return (
      <section className="rounded-[2px] border border-border bg-muted/20 p-5">
        <h2 className="text-base font-semibold text-ink">
          Processos em andamento
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhum processo ativo no momento.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3 rounded-[2px] border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-ink">
        Processos em andamento
      </h2>
      <p className="text-xs text-muted-foreground">
        Cada processo reserva 1 crédito por até 7 dias. Sem geração nesse prazo →
        crédito volta automaticamente.
      </p>
      <ul className="divide-y divide-border">
        {reservations.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                Leitura <code className="text-xs">{r.reading_id.slice(0, 8)}…</code>
              </p>
              <p className="text-xs text-muted-foreground">
                Reservado em {formatDateBR(r.reserved_at)} · expira em{' '}
                {formatRelativeBR(r.expires_at)}
              </p>
              <p className="text-xs capitalize text-muted-foreground">
                Fonte: {r.source === 'trial' ? 'trial' : 'crédito'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCancel(r.reading_id)}
              disabled={isPending}
              className="self-start sm:self-auto"
            >
              Cancelar
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })
}

function formatRelativeBR(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'expirando…'
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days} ${days === 1 ? 'dia' : 'dias'}`
  const hours = Math.floor(ms / 3_600_000)
  return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
}
