'use client'

// Webmail: sidebar de pastas + lista de emails + leitura do corpo (com anexos) e
// ações (marcar não-lido, excluir) on-demand via server actions IMAP.

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  fetchSupportEmailBody,
  markEmailSeen,
  deleteEmailAction,
  markSeenBatchAction,
  deleteBatchAction,
} from './actions'
import { ComposeForm, type ComposeInitial } from './ComposeForm'
import type {
  SupportEmailBody,
  SupportMailbox,
  SupportListResult,
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

function quote(body: SupportEmailBody): string {
  const lines = (body.text || '').split('\n').map((l) => `> ${l}`).join('\n')
  return `\n\n\n----- Em ${fmtDate(body.date)}, ${body.fromName} escreveu: -----\n${lines}`
}
function replyInitial(body: SupportEmailBody): ComposeInitial {
  const s = body.subject || ''
  return {
    title: 'Responder',
    to: body.fromAddress,
    subject: /^re:/i.test(s) ? s : `Re: ${s}`,
    text: quote(body),
    inReplyTo: body.messageId,
    references: body.messageId,
  }
}
function forwardInitial(body: SupportEmailBody): ComposeInitial {
  const s = body.subject || ''
  return {
    title: 'Encaminhar',
    to: '',
    subject: /^fwd:/i.test(s) ? s : `Fwd: ${s}`,
    text: `\n\n----- Mensagem encaminhada -----\nDe: ${body.fromName} <${body.fromAddress}>\nData: ${fmtDate(body.date)}\nAssunto: ${body.subject}\n\n${body.text || ''}`,
  }
}

interface Props {
  mailboxes: SupportMailbox[]
  result: SupportListResult
  currentMailbox: string
  search: string
}

function pageHref(mailbox: string, page: number, q: string): string {
  const p = new URLSearchParams({ mailbox })
  if (page > 1) p.set('page', String(page))
  if (q) p.set('q', q)
  return `/admin/suporte?${p.toString()}`
}

export function SupportInbox({ mailboxes, result, currentMailbox, search }: Props) {
  const router = useRouter()
  const emails = result.emails
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const [openUid, setOpenUid] = useState<number | null>(null)
  const [body, setBody] = useState<SupportEmailBody | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [acting, startAction] = useTransition()
  const [compose, setCompose] = useState<ComposeInitial | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Auto-atualização: re-busca a lista a cada 60s sem F5.
  //
  // ⛔ PAUSA ENQUANTO SE ESCREVE (24/08). O comentário anterior dizia que o
  // estado do cliente "é preservado pelo React" — e foi essa suposição que
  // escondeu o bug do rascunho que sumia. O rascunho NÃO é estado do React:
  // mora no DOM do contenteditable. A causa raiz já está corrigida no
  // ComposeForm, mas mandar a inbox inteira re-renderizar por baixo de um
  // formulário aberto não traz nenhum ganho e só cria risco. Quem está
  // escrevendo não está lendo a lista; ela volta a atualizar ao fechar.
  useEffect(() => {
    if (compose) return
    const id = setInterval(() => router.refresh(), 60000)
    return () => clearInterval(id)
  }, [router, compose])

  function toggleSelect(uid: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }
  function batchMark(seen: boolean) {
    const uids = [...selected]
    startAction(async () => {
      await markSeenBatchAction(currentMailbox, uids, seen)
      setSelected(new Set())
      router.refresh()
    })
  }
  function batchDelete() {
    const uids = [...selected]
    startAction(async () => {
      await deleteBatchAction(currentMailbox, uids)
      setSelected(new Set())
      setOpenUid(null)
      setBody(null)
      router.refresh()
    })
  }

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
            ↻ Atualizar
          </Button>
          {selected.size > 0 ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">{selected.size} selecionado(s)</span>
              <button
                type="button"
                onClick={() => batchMark(true)}
                disabled={acting}
                className="underline disabled:opacity-50"
              >
                Marcar lido
              </button>
              <button
                type="button"
                onClick={() => batchMark(false)}
                disabled={acting}
                className="underline disabled:opacity-50"
              >
                Não lido
              </button>
              <button
                type="button"
                onClick={batchDelete}
                disabled={acting}
                className="text-[#B23A2B] underline disabled:opacity-50"
              >
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground underline"
              >
                limpar
              </button>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setCompose({ title: 'Escrever', to: '', subject: '', text: '' })}
          className="bg-teal-dark text-white hover:bg-teal-dark/90"
        >
          ✎ Escrever
        </Button>
      </div>
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
      <div className="space-y-3">
        <form method="get" className="flex gap-2">
          <input type="hidden" name="mailbox" value={currentMailbox} />
          <input
            name="q"
            defaultValue={search}
            placeholder="Buscar assunto, remetente, conteúdo…"
            className="flex-1 rounded-[2px] border border-border bg-card px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-[2px] border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
          >
            Buscar
          </button>
          {search ? (
            <a
              href={pageHref(currentMailbox, 1, '')}
              className="self-center text-xs text-muted-foreground underline"
            >
              limpar
            </a>
          ) : null}
        </form>
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? 'Nenhum resultado para a busca.' : 'Nenhum email nesta pasta.'}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-[2px] border border-border bg-card">
            {emails.map((e) => {
              const open = openUid === e.uid
              return (
                <li key={e.uid}>
                  <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selected.has(e.uid)}
                    onChange={() => toggleSelect(e.uid)}
                    className="ml-3 size-4 shrink-0 accent-teal-dark"
                    aria-label="selecionar email"
                  />
                  <button
                    type="button"
                    onClick={() => toggle(e.uid)}
                    className="flex flex-1 items-baseline gap-3 px-4 py-3 text-left hover:bg-muted/40"
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
                  </div>

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
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setCompose(replyInitial(body))}
                                className="text-xs text-teal-dark underline hover:text-teal-dark/80"
                              >
                                Responder
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompose(forwardInitial(body))}
                                className="text-xs text-muted-foreground underline hover:text-foreground"
                              >
                                Encaminhar
                              </button>
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
        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm">
            <a
              href={pageHref(currentMailbox, result.page - 1, search)}
              className={cn('underline', result.page <= 1 && 'pointer-events-none opacity-40')}
            >
              ← Anterior
            </a>
            <span className="text-muted-foreground">
              Página {result.page} de {totalPages} · {result.total} emails
            </span>
            <a
              href={pageHref(currentMailbox, result.page + 1, search)}
              className={cn('underline', result.page >= totalPages && 'pointer-events-none opacity-40')}
            >
              Próxima →
            </a>
          </div>
        ) : null}
      </div>
      </div>

      {compose ? (
        <ComposeForm initial={compose} onClose={() => setCompose(null)} />
      ) : null}
    </div>
  )
}
