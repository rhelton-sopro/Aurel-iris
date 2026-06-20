/**
 * Cliente IMAP read-only da caixa de suporte (suporte@iriscodex.com — Hostinger).
 * Usado pelo painel admin (/admin/suporte) pra listar e ler emails sem sair do
 * Iris Codex. Founder-only (a rota é gated no layout + a action revalida).
 *
 * Server-only — abre conexão TCP/TLS (imapflow). Cada chamada conecta e desconecta
 * (stateless, compatível com serverless). NUNCA loga a senha.
 *
 * Env: IMAP_HOST (default imap.hostinger.com), IMAP_PORT (993), IMAP_USER, IMAP_PASSWORD.
 */
import 'server-only'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

import type { SupportEmailHeader, SupportEmailBody } from './types'

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

/** Lista os últimos `limit` emails do INBOX (mais recentes primeiro). [] se não configurado. */
export async function listSupportEmails(limit = 30): Promise<SupportEmailHeader[]> {
  if (!imapConfigured()) return []
  const client = newClient()
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
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
      })) {
        const from = msg.envelope?.from?.[0]
        out.push({
          uid: msg.uid,
          fromName: from?.name || from?.address || '(desconhecido)',
          fromAddress: from?.address || '',
          subject: msg.envelope?.subject || '(sem assunto)',
          date: msg.envelope?.date?.toISOString() ?? '',
          seen: msg.flags?.has('\\Seen') ?? false,
        })
      }
      return out.reverse() // mais recentes no topo
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Busca o corpo de um email por UID. null se não configurado / não encontrado. */
export async function getSupportEmailBody(uid: number): Promise<SupportEmailBody | null> {
  if (!imapConfigured()) return null
  const client = newClient()
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const msg = await client.fetchOne(
        String(uid),
        { uid: true, source: true },
        { uid: true },
      )
      if (!msg || !msg.source) return null
      const parsed = await simpleParser(msg.source)
      const from = parsed.from?.value?.[0]
      return {
        uid,
        fromName: from?.name || from?.address || '(desconhecido)',
        fromAddress: from?.address || '',
        subject: parsed.subject || '(sem assunto)',
        date: parsed.date?.toISOString() ?? '',
        text: parsed.text ?? '',
        html: typeof parsed.html === 'string' ? parsed.html : null,
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}
