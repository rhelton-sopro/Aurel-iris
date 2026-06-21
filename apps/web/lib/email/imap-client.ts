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

/** Lista os últimos `limit` emails de uma pasta (mais recentes primeiro). */
export async function listSupportEmails(
  mailbox = 'INBOX',
  limit = 30,
): Promise<SupportEmailHeader[]> {
  if (!imapConfigured()) return []
  const client = newClient()
  await client.connect()
  try {
    const lock = await client.getMailboxLock(mailbox)
    try {
      const box = client.mailbox
      const total = box && typeof box === 'object' ? box.exists : 0
      if (!total) return []
      const start = Math.max(1, total - limit + 1)
      const out: SupportEmailHeader[] = []
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        envelope: true,
        flags: true,
        bodyStructure: true,
      })) {
        const from = msg.envelope?.from?.[0]
        out.push({
          uid: msg.uid,
          fromName: from?.name || from?.address || '(desconhecido)',
          fromAddress: from?.address || '',
          subject: msg.envelope?.subject || '(sem assunto)',
          date: msg.envelope?.date?.toISOString() ?? '',
          seen: msg.flags?.has('\\Seen') ?? false,
          hasAttachments: hasAttachment(msg.bodyStructure),
        })
      }
      return out.reverse()
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
