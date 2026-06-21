'use client'

// Webmail: sidebar de pastas + lista de emails + leitura do corpo (com anexos) e
// ações (marcar não-lido, excluir) on-demand via server actions IMAP.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { cn } from '@/lib/utils'
import { fetchSupportEmailBody, markEmailSeen, deleteEmailAction } from './actions'
import type {
  SupportEmailHeader,
  SupportEmailBody,
  SupportMailbox,
} from '@/lib/email/types'

function fmtDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

interface Props {
  mailboxes: SupportMailbox[]
  emails: SupportEmailHeader[]
  currentMailbox: string
}

export function SupportInbox({ mailboxes, emails, currentMailbox }: Props) {
  const router = useRouter()
  const [openUid, setOpenUid] = useState<number | null>(null)
  const [body, setBody] = useState<SupportEmailBody | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [acting, startAction] = useTransition()

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
      const r = await fetchSupportEmailBody(currentMailbox, uid)
      if (r.ok) {
        setBody(r.body)
        router.refresh() // atualiza "lido" na lista/contadores
      } else {
        setBodyError(r.error)
      }
    })
  }

  function markUnread(uid: number) {
    startAction(async () => {
      await markEmailSeen(currentMailbox, uid, false)
      setOpenUid(null)
      setBody(null)
      router.refresh()
    })
  }

  function remove(uid: number) {
    startAction(async () => {
      await deleteEmailAction(currentMailbox, uid)
      setOpenUid(null)
      setBody(null)
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
      {/* Pastas */}
      <aside className="space-y-1">
        {mailboxes.map((m) => {
          const active = m.path === currentMailbox
          return (
            <Link
              key={m.path}
              href={`/admin/suporte?mailbox=${encodeURIComponent(m.path)}`}
              className={cn(
                'flex items-center justify-between rounded-[2px] px-3 py-1.5 text-sm',
                active ? 'bg-teal-dark/10 font-medium text-teal-dark' : 'text-foreground hover:bg-muted/50',
              )}
            >
              <span className="truncate">{m.name}</span>
              {m.unread > 0 ? (
                <span className="ml-2 shrink-0 rounded-full bg-teal-dark px-1.5 text-[10px] font-semibold text-white">
                  {m.unread}
                </span>
              ) : null}
            </Link>
          )
        })}
      </aside>

      {/* Lista de emails */}
      <div>
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum email nesta pasta.</p>
        ) : (
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
                    <span
                      className={cn('mt-1.5 size-2 shrink-0 rounded-full', !e.seen ? 'bg-teal-dark' : 'bg-transparent')}
                      aria-label={e.seen ? 'lido' : 'não lido'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm', e.seen ? 'text-foreground' : 'font-semibold text-ink')}>
                        {e.subject}
                        {e.hasAttachments ? <span className="ml-1 text-muted-foreground">📎</span> : null}
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
                        <article className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              De: {body.fromName} &lt;{body.fromAddress}&gt; · {fmtDate(body.date)}
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => markUnread(e.uid)}
                                disabled={acting}
                                className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                              >
                                Marcar não lido
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(e.uid)}
                                disabled={acting}
                                className="text-xs text-[#B23A2B] underline hover:text-[#8f2e22] disabled:opacity-50"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>

                          {body.attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {body.attachments.map((a) => (
                                <a
                                  key={a.index}
                                  href={`/admin/suporte/anexo?mailbox=${encodeURIComponent(currentMailbox)}&uid=${e.uid}&index=${a.index}`}
                                  className="inline-flex items-center gap-1 rounded-[2px] border border-border bg-card px-2 py-1 text-xs hover:bg-muted/40"
                                >
                                  📎 {a.filename}{' '}
                                  <span className="text-muted-foreground">({fmtSize(a.size)})</span>
                                </a>
                              ))}
                            </div>
                          ) : null}

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
        )}
      </div>
    </div>
  )
}
