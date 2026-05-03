'use client'

import * as React from 'react'

interface LocalDateTimeProps {
  /** ISO 8601 timestamp (com ou sem TZ; null/undefined → fallback). */
  iso: string | null | undefined
  /** Texto exibido quando `iso` é null/undefined. Default '—'. */
  fallback?: string
}

/**
 * Renderiza um timestamp formatado no fuso local do BROWSER (não do server).
 *
 * Necessário porque /leituras/page.tsx é server-rendered e o servidor
 * (Vercel) roda em UTC. Formatar com `date-fns` no servidor produz horário
 * UTC para o usuário brasileiro. Este componente posterga a formatação
 * pra hidratação no cliente, onde `Intl.DateTimeFormat().resolvedOptions().timeZone`
 * resolve pro fuso do dispositivo do terapeuta.
 *
 * Hidratação: render inicial usa formato UTC ISO (consistente entre server
 * e client, evita mismatch). Após mount, useEffect atualiza pro fuso local.
 * Há um flash visível de UTC → local na primeira renderização — aceitável.
 */
export function LocalDateTime({ iso, fallback = '—' }: LocalDateTimeProps) {
  const initial = React.useMemo(() => isoToUtcDisplay(iso, fallback), [iso, fallback])
  const [text, setText] = React.useState(initial)

  React.useEffect(() => {
    if (!iso) {
      setText(fallback)
      return
    }
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
      setText(fallback)
      return
    }
    setText(
      date.toLocaleString('pt-BR', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    )
  }, [iso, fallback])

  return <>{text}</>
}

/** Formato dd/MM/yyyy HH:mm derivado do ISO (UTC), determinístico para SSR. */
function isoToUtcDisplay(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return fallback
  const pad = (n: number) => String(n).padStart(2, '0')
  const dd = pad(date.getUTCDate())
  const mm = pad(date.getUTCMonth() + 1)
  const yyyy = date.getUTCFullYear()
  const hh = pad(date.getUTCHours())
  const min = pad(date.getUTCMinutes())
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}
