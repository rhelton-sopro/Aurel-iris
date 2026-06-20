'use client'

// Lista de emails da caixa de suporte + leitura do corpo on-demand (server action
// IMAP). Clicar num email expande e busca o corpo; clicar de novo recolhe.

import { useState, useTransition } from 'react'

import { fetchSupportEmailBody } from './actions'
import type { SupportEmailHeader, SupportEmailBody } from '@/lib/email/types'

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function SupportInbox({ emails }: { emails: SupportEmailHeader[] }) {
  const [openUid, setOpenUid] = useState<number | null>(null)
  const [body, setBody] = useState<SupportEmailBody | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(uid: number) {
    if (openUid === uid) {
      setOpenUid(null)
      setBody(null)
      setBodyError(null)
      return
    }
    setOpenUid(uid)
    setBody(null)
    setBodyError(null)
    startTransition(async () => {
      const r = await fetchSupportEmailBody(uid)
      if (r.ok) setBody(r.body)
      else setBodyError(r.error)
    })
  }

  return (
    <ul className="divide-y divide-border rounded-[2px] border border-border bg-card">
      {emails.map((e) => {
        const open = openUid === e.uid
        return (
          <li key={e.uid}>
            <button
              type="button"
              onClick={() => toggle(e.uid)}
              className="flex w-full items-baseline gap-3 px-4 py-3 text-left hover:bg-muted/40"
            >
              {!e.seen ? (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal-dark" aria-label="não lido" />
              ) : (
                <span className="mt-1.5 size-2 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${e.seen ? 'text-foreground' : 'font-semibold text-ink'}`}>
                  {e.subject}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {e.fromName}
                  {e.fromAddress && e.fromName !== e.fromAddress ? ` · ${e.fromAddress}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(e.date)}</span>
            </button>

            {open ? (
              <div className="border-t border-border bg-muted/20 px-4 py-3">
                {isPending && !body && !bodyError ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : bodyError ? (
                  <p className="text-sm text-[#B23A2B]">{bodyError}</p>
                ) : body ? (
                  <article className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      De: {body.fromName} &lt;{body.fromAddress}&gt; · {fmtDate(body.date)}
                    </p>
                    {body.html ? (
                      <iframe
                        title={`email-${body.uid}`}
                        sandbox=""
                        srcDoc={body.html}
                        className="h-96 w-full rounded-[2px] border border-border bg-white"
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                        {body.text || '(sem conteúdo)'}
                      </pre>
                    )}
                  </article>
                ) : (
                  <p className="text-sm text-muted-foreground">(sem conteúdo)</p>
                )}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
