// Webmail da caixa de suporte (suporte@iriscodex.com) no painel admin. Pastas,
// busca, paginação, leitura (com anexos), marcar lido/não-lido, excluir e
// compor/responder via SMTP. Founder-only (gated no admin/layout). runtime nodejs.

import { listMailboxes, listSupportEmails } from '@/lib/email/imap-client'
import type { SupportMailbox, SupportListResult } from '@/lib/email/types'
import { SupportInbox } from './SupportInbox'

export const runtime = 'nodejs'
export const maxDuration = 30
export const metadata = { title: 'Suporte — Iris Codex' }

const PAGE_SIZE = 30

export default async function SuportePage({
  searchParams,
}: {
  searchParams: Promise<{ mailbox?: string; page?: string; q?: string }>
}) {
  const sp = await searchParams
  const current = sp.mailbox || 'INBOX'
  const page = Math.max(1, Number(sp.page) || 1)
  const q = (sp.q || '').trim()
  const configured = !!process.env.IMAP_USER && !!process.env.IMAP_PASSWORD

  let mailboxes: SupportMailbox[] = []
  let result: SupportListResult = { emails: [], total: 0, page, pageSize: PAGE_SIZE }
  let error: string | null = null
  if (configured) {
    try {
      const [mb, res] = await Promise.all([
        listMailboxes(),
        listSupportEmails(current, { page, pageSize: PAGE_SIZE, search: q || undefined }),
      ])
      mailboxes = mb
      result = res
    } catch (err) {
      error = err instanceof Error ? err.message : 'erro ao conectar'
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Caixa de suporte</h1>
        <p className="text-sm text-muted-foreground">suporte@iriscodex.com</p>
      </div>

      {!configured ? (
        <div className="rounded-[2px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Credenciais IMAP não configuradas.</p>
          <p className="mt-1">
            Defina <code>IMAP_USER</code>, <code>IMAP_PASSWORD</code> (e opcionalmente{' '}
            <code>IMAP_HOST</code> / <code>IMAP_PORT</code>) no ambiente.
          </p>
        </div>
      ) : error ? (
        <div className="rounded-[2px] border border-[#B23A2B]/40 bg-[#B23A2B]/5 p-4 text-sm">
          <p className="font-medium text-[#B23A2B]">Não foi possível conectar à caixa.</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      ) : (
        <SupportInbox
          mailboxes={mailboxes}
          result={result}
          currentMailbox={current}
          search={q}
        />
      )}
    </div>
  )
}
