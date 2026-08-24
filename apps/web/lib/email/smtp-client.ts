/**
 * Envio de email da caixa de suporte (suporte@iriscodex.com) via SMTP (Hostinger).
 * Usa as MESMAS credenciais do IMAP (mesma conta). Após enviar, salva uma cópia
 * na pasta Enviados (IMAP append). Server-only. NUNCA loga a senha.
 *
 * Env: SMTP_HOST (default smtp.hostinger.com), SMTP_PORT (465), reusa IMAP_USER/IMAP_PASSWORD.
 */
import 'server-only'
import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'

import { appendToSent } from './imap-client'

export interface SendEmailInput {
  to: string
  subject: string
  text: string
  html?: string
  inReplyTo?: string | null
  references?: string | null
}

function configured(): boolean {
  return !!process.env.IMAP_USER && !!process.env.IMAP_PASSWORD
}

export async function sendSupportEmail(
  input: SendEmailInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!configured()) return { ok: false, error: 'Email não configurado.' }
  const fromAddr = process.env.IMAP_USER as string

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true, // 465 = SSL
    auth: { user: fromAddr, pass: process.env.IMAP_PASSWORD as string },
  })

  const mail = {
    from: `Suporte Iris Codex <${fromAddr}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html || undefined,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined,
  }

  try {
    await transporter.sendMail(mail)
  } catch (err) {
    console.error('[smtp] send failed:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Falha ao enviar o email.' }
  }

  // Salva cópia em Enviados — best-effort (não falha o envio se der erro).
  try {
    const raw = await new Promise<Buffer>((resolve, reject) => {
      new MailComposer(mail).compile().build((e, msg) => (e ? reject(e) : resolve(msg)))
    })
    await appendToSent(raw)
  } catch (err) {
    console.warn('[smtp] append to Sent failed:', err instanceof Error ? err.message : err)
  }

  return { ok: true }
}

// ============================================================================
// ENVIO EM MASSA (24/08) — UM e-mail separado por pessoa.
//
// ⭐ DECISÃO DO FOUNDER: nunca juntar todo mundo no mesmo "Para". Ninguém pode
// ver o endereço de ninguém — e, mandando um por um, dá pra chamar cada pessoa
// pelo primeiro nome. Se um dia alguém trocar isto por um envio único, o
// vazamento de endereços volta junto.
//
// Uma conexão SMTP só (pool) para as N mensagens: abrir uma conexão por pessoa
// derruba o envio nos limites do Hostinger bem antes dos 39 terapeutas.
// ============================================================================

export interface BulkRecipient {
  email: string
  /** Nome completo; só o primeiro nome entra no lugar de {nome}. */
  name?: string | null
}

export interface BulkSendResult {
  ok: boolean
  sent: number
  failed: { email: string; error: string }[]
  error?: string
}

/** Primeiro nome, para o {nome}. Vazio se a pessoa não tiver nome cadastrado. */
export function firstName(name?: string | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * Troca {nome} (e {{nome}}) pelo primeiro nome do destinatário.
 *
 * ⚠️ Sem nome cadastrado a marca vira string vazia — por isso a tela avisa ANTES
 * de enviar quando alguém selecionado está sem nome. Um "Olá, ." indo para 39
 * pessoas não tem desfazer.
 */
export function personalize(body: string, name?: string | null): string {
  return body.replace(/\{\{?\s*nome\s*\}?\}/gi, firstName(name))
}

export interface SendBulkInput {
  recipients: BulkRecipient[]
  subject: string
  text: string
  html?: string
}

export async function sendBulkSupportEmail(input: SendBulkInput): Promise<BulkSendResult> {
  if (!configured()) return { ok: false, sent: 0, failed: [], error: 'Email não configurado.' }
  if (!input.recipients.length) {
    return { ok: false, sent: 0, failed: [], error: 'Nenhum destinatário.' }
  }
  const fromAddr = process.env.IMAP_USER as string

  // pool: uma conexão reaproveitada, no máximo 3 mensagens por segundo.
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user: fromAddr, pass: process.env.IMAP_PASSWORD as string },
    pool: true,
    maxConnections: 1,
    maxMessages: 200,
    rateDelta: 1000,
    rateLimit: 3,
  })

  const failed: { email: string; error: string }[] = []
  const enviados: string[] = []

  try {
    for (const r of input.recipients) {
      try {
        await transporter.sendMail({
          from: `Suporte Iris Codex <${fromAddr}>`,
          to: r.email,
          subject: personalize(input.subject, r.name),
          text: personalize(input.text, r.name),
          html: input.html ? personalize(input.html, r.name) : undefined,
        })
        enviados.push(r.email)
      } catch (err) {
        // Uma falha NÃO derruba o envio inteiro: quem já recebeu, recebeu, e a
        // tela mostra exatamente quem ficou de fora para reenviar só a esses.
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[smtp/massa] falhou para um destinatário:', msg)
        failed.push({ email: r.email, error: msg })
      }
    }
  } finally {
    transporter.close()
  }

  // UMA cópia em Enviados como registro do disparo (não 39) — com a lista de
  // quem recebeu no "Para" e o texto como foi escrito, com o {nome} intacto.
  if (enviados.length) {
    try {
      const mail = {
        from: `Suporte Iris Codex <${fromAddr}>`,
        to: enviados.join(', '),
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
      }
      const raw = await new Promise<Buffer>((resolve, reject) => {
        new MailComposer(mail).compile().build((e, msg) => (e ? reject(e) : resolve(msg)))
      })
      await appendToSent(raw)
    } catch (err) {
      console.warn('[smtp/massa] append to Sent falhou:', err instanceof Error ? err.message : err)
    }
  }

  return { ok: enviados.length > 0, sent: enviados.length, failed }
}
