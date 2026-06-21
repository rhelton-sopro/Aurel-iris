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
