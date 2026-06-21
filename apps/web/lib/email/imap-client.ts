/**
 * Cliente IMAP da caixa de suporte (suporte@iriscodex.com — Hostinger). Usado
 * pelo webmail do painel admin (/admin/suporte): pastas, listar, ler, anexos,
 * marcar lido/não-lido e excluir. Founder-only (rota gated no admin/layout).
 *
 * Server-only — abre conexão TCP/TLS (imapflow). Cada chamada conecta e
 * desconecta (stateless, compatível com serverless). NUNCA loga a senha.
 *
 * Env: IMAP_HOST (default imap.hostinger.com), IMAP_PORT (993), IMAP_USER, IMAP_PASSWORD.
 */
import 'server-only'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

import type {
  SupportEmailHeader,
  SupportEmailBody,
  SupportMailbox,
  SupportAttachment,
  SupportListResult,
} from './types'

function imapConfigured(): boolean {
  return !!process.env.IMAP_USER && !!process.env.IMAP_PASSWORD
}

function newClient(): ImapFlow {
  return new ImapFlow({
    host: process.env.IMAP_HOST ?? 'imap.hostinger.com',
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: {
      user: process.env.IMAP_USER as string,
      pass: process.env.IMAP_PASSWORD as string,
    },
    logger: false,
  })
}

/** Conta emails NÃO-LIDOS no INBOX (leve — usa STATUS). 0 se não configurado/erro. */
export async function getUnreadCount(): Promise<number> {
  if (!imapConfigured()) return 0
  const client = newClient()
  try {
    await client.connect()
    const status = await client.status('INBOX', { unseen: true })
    return status?.unseen ?? 0
  } catch {
    return 0
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Salva uma cópia (mensagem raw) na pasta Enviados. Best-effort. */
export async function appendToSent(raw: Buffer): Promise<boolean> {
  if (!imapConfigured()) return false
  const client = newClient()
  try {
    await client.connect()
    let sentPath: string | null = null
    for (const b of await client.list()) {
      if ((b.specialUse as string) === '\\Sent') {
        sentPath = b.path
        break
      }
    }
    if (!sentPath) return false
    await client.append(sentPath, raw, ['\\Seen'])
    return true
  } catch {
    return false
  } finally {
    await client.logout().catch(() => {})
  }
}

// Rótulos amigáveis por specialUse / nome.
function mailboxLabel(path: string, specialUse: string | null): string {
  switch (specialUse) {
    case '\\Sent':
      return 'Enviados'
    case '\\Trash':
      return 'Lixeira'
    case '\\Drafts':
      return 'Rascunhos'
    case '\\Junk':
      return 'Spam'
    case '\\Archive':
      return 'Arquivados'
    default:
      return path === 'INBOX' ? 'Caixa de entrada' : path.split(/[./]/).pop() || path
  }
}

/** Lista as pastas da conta (com contagem de não-lidos). */
export async function listMailboxes(): Promise<SupportMailbox[]> {
  if (!imapConfigured()) return []
  const client = newClient()
  try {
    await client.connect()
    const boxes = await client.list()
    const out: SupportMailbox[] = []
    for (const b of boxes) {
      if (b.flags?.has('\\Noselect')) continue
      let unread = 0
      try {
        const st = await client.status(b.path, { unseen: true })
        unread = st?.unseen ?? 0
      } catch {
        // ignora pastas que não suportam STATUS
      }
      const specialUse = (b.specialUse as string) ?? null
      out.push({ path: b.path, name: mailboxLabel(b.path, specialUse), specialUse, unread })
    }
    // Ordem: Entrada, Enviados, Rascunhos, Arquivados, Spam, Lixeira, resto.
    const rank = (m: SupportMailbox) =>
      m.path === 'INBOX' ? 0
      : m.specialUse === '\\Sent' ? 1
      : m.specialUse === '\\Drafts' ? 2
      : m.specialUse === '\\Archive' ? 3
      : m.specialUse === '\\Junk' ? 4
      : m.specialUse === '\\Trash' ? 5
      : 6
    return out.sort((a, b) => rank(a) - rank(b))
  } catch {
    return []
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Lista emails de uma pasta com paginação e busca opcional (mais recentes primeiro). */
export async function listSupportEmails(
  mailbox = 'INBOX',
  opts: { page?: number; pageSize?: number; search?: string } = {},
): Promise<SupportListResult> {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = opts.pageSize ?? 30
  if (!imapConfigured()) return { emails: [], total: 0, page, pageSize }
  const client = newClient()
  await client.connect()
  try {
    const lock = await client.getMailboxLock(mailbox)
    try {
      const search = opts.search?.trim()
      const query = search
        ? { or: [{ subject: search }, { from: search }, { body: search }] }
        : { all: true }
      let uids = ((await client.search(query, { uid: true })) || []) as number[]
      uids = uids.sort((a, b) => b - a) // desc: uid maior = mais recente
      const total = uids.length
      const slice = uids.slice((page - 1) * pageSize, page * pageSize)

      const byUid = new Map<number, SupportEmailHeader>()
      if (slice.length > 0) {
        for await (const msg of client.fetch(
          slice.join(','),
          { uid: true, envelope: true, flags: true, bodyStructure: true },
          { uid: true },
        )) {
          const from = msg.envelope?.from?.[0]
          byUid.set(msg.uid, {
            uid: msg.uid,
            fromName: from?.name || from?.address || '(desconhecido)',
            fromAddress: from?.address || '',
            subject: msg.envelope?.subject || '(sem assunto)',
            date: msg.envelope?.date?.toISOString() ?? '',
            seen: msg.flags?.has('\\Seen') ?? false,
            hasAttachments: hasAttachment(msg.bodyStructure),
          })
        }
      }
      // preserva a ordem desc do slice (o fetch pode devolver fora de ordem)
      const emails = slice.map((u) => byUid.get(u)).filter((h): h is SupportEmailHeader => !!h)
      return { emails, total, page, pageSize }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

// Detecta anexo varrendo a bodyStructure (disposition=attachment ou parte não-texto nomeada).
function hasAttachment(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const n = node as { disposition?: string; childNodes?: unknown[]; dispositionParameters?: { filename?: string }; parameters?: { name?: string } }
  if (n.disposition === 'attachment') return true
  if (Array.isArray(n.childNodes)) return n.childNodes.some(hasAttachment)
  return false
}

/** Busca o corpo + lista de anexos de um email por UID. */
export async function getSupportEmailBody(
  mailbox: string,
  uid: number,
): Promise<SupportEmailBody | null> {
  if (!imapConfigured()) return null
  const client = newClient()
  await client.connect()
  try {
    const lock = await client.getMailboxLock(mailbox)
    try {
      const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true })
      if (!msg || !msg.source) return null
      const parsed = await simpleParser(msg.source)
      const from = parsed.from?.value?.[0]
      const attachments: SupportAttachment[] = (parsed.attachments ?? []).map((a, i) => ({
        index: i,
        filename: a.filename || `anexo-${i + 1}`,
        contentType: a.contentType || 'application/octet-stream',
        size: a.size ?? 0,
      }))
      return {
        uid,
        fromName: from?.name || from?.address || '(desconhecido)',
        fromAddress: from?.address || '',
        subject: parsed.subject || '(sem assunto)',
        date: parsed.date?.toISOString() ?? '',
        messageId: parsed.messageId ?? null,
        text: parsed.text ?? '',
        html: typeof parsed.html === 'string' ? parsed.html : null,
        attachments,
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Marca um email como lido / não-lido. */
export async function setSeen(mailbox: string, uid: number, seen: boolean): Promise<boolean> {
  if (!imapConfigured()) return false
  const client = newClient()
  await client.connect()
  try {
    const lock = await client.getMailboxLock(mailbox)
    try {
      if (seen) await client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen'], { uid: true })
      else await client.messageFlagsRemove({ uid: String(uid) }, ['\\Seen'], { uid: true })
      return true
    } finally {
      lock.release()
    }
  } catch {
    return false
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Exclui um email: move pra Lixeira (ou apaga de vez se já estiver nela). */
export async function deleteEmail(mailbox: string, uid: number): Promise<boolean> {
  if (!imapConfigured()) return false
  const client = newClient()
  await client.connect()
  try {
    // Acha a pasta Lixeira
    let trashPath: string | null = null
    for (const b of await client.list()) {
      if ((b.specialUse as string) === '\\Trash') {
        trashPath = b.path
        break
      }
    }
    const lock = await client.getMailboxLock(mailbox)
    try {
      if (!trashPath || mailbox === trashPath) {
        await client.messageDelete({ uid: String(uid) }, { uid: true })
      } else {
        await client.messageMove({ uid: String(uid) }, trashPath, { uid: true })
      }
      return true
    } finally {
      lock.release()
    }
  } catch {
    return false
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Marca VÁRIOS emails como lido/não-lido numa só conexão. */
export async function setSeenMany(
  mailbox: string,
  uids: number[],
  seen: boolean,
): Promise<boolean> {
  if (!imapConfigured() || uids.length === 0) return false
  const client = newClient()
  await client.connect()
  try {
    const lock = await client.getMailboxLock(mailbox)
    try {
      const range = uids.join(',')
      if (seen) await client.messageFlagsAdd({ uid: range }, ['\\Seen'], { uid: true })
      else await client.messageFlagsRemove({ uid: range }, ['\\Seen'], { uid: true })
      return true
    } finally {
      lock.release()
    }
  } catch {
    return false
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Exclui VÁRIOS emails (move pra Lixeira, ou apaga se já nela) numa só conexão. */
export async function deleteMany(mailbox: string, uids: number[]): Promise<boolean> {
  if (!imapConfigured() || uids.length === 0) return false
  const client = newClient()
  await client.connect()
  try {
    let trashPath: string | null = null
    for (const b of await client.list()) {
      if ((b.specialUse as string) === '\\Trash') {
        trashPath = b.path
        break
      }
    }
    const lock = await client.getMailboxLock(mailbox)
    try {
      const range = uids.join(',')
      if (!trashPath || mailbox === trashPath) {
        await client.messageDelete({ uid: range }, { uid: true })
      } else {
        await client.messageMove({ uid: range }, trashPath, { uid: true })
      }
      return true
    } finally {
      lock.release()
    }
  } catch {
    return false
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Baixa o conteúdo de um anexo (por índice na lista de attachments). */
export async function getAttachment(
  mailbox: string,
  uid: number,
  index: number,
): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  if (!imapConfigured()) return null
  const client = newClient()
  await client.connect()
  try {
    const lock = await client.getMailboxLock(mailbox)
    try {
      const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true })
      if (!msg || !msg.source) return null
      const parsed = await simpleParser(msg.source)
      const att = (parsed.attachments ?? [])[index]
      if (!att) return null
      return {
        filename: att.filename || `anexo-${index + 1}`,
        contentType: att.contentType || 'application/octet-stream',
        content: att.content as Buffer,
      }
    } finally {
      lock.release()
    }
  } catch {
    return null
  } finally {
    await client.logout().catch(() => {})
  }
}
