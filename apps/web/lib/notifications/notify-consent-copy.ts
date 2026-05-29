/**
 * Envia ao CLIENTE (titular) uma cópia do termo de consentimento biométrico
 * que ele assinou. Reforça a robustez do consentimento LGPD no fluxo de
 * consultório (office_handoff): como o cliente assina no aparelho do TERAPEUTA
 * (IP/dispositivo do terapeuta), entregar a cópia ao titular materializa a
 * transparência (art. 9 LGPD) e dá ao titular evidência do que aceitou —
 * compensando a ausência do device dele no registro.
 *
 * Disparado pela signTermAction após o INSERT em client_consents. Best-effort:
 * falha de email NÃO invalida o consentimento (a trilha legal é client_consents
 * append-only + o PDF no bucket). Sem RESEND_API_KEY → degrade silencioso.
 *
 * Espelha o padrão de notify-report-ready.ts (Resend via fetch direto,
 * sender noreply@iriscodex.com / RESEND_FROM_EMAIL).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

export async function notifyClientConsentCopy(
  clientId: string,
  pdfUrl: string | null,
  termVersion: string,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notify-consent] RESEND_API_KEY ausente — pulando cópia ao cliente')
    return { sent: false, reason: 'no_api_key' }
  }
  if (!pdfUrl) {
    return { sent: false, reason: 'no_pdf_url' }
  }

  const svc = createServiceClient()
  const { data: client } = await svc
    .from('clients')
    .select('full_name, email')
    .eq('id', clientId)
    .maybeSingle()

  const email = (client as { email?: string } | null)?.email
  if (!email) {
    console.warn(`[notify-consent] cliente ${clientId} sem email — pulando cópia`)
    return { sent: false, reason: 'no_client_email' }
  }

  const name = (client as { full_name?: string } | null)?.full_name ?? ''
  const greeting = name ? `Olá, ${escapeHtml(name)}` : 'Olá'
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM
  const subject = 'Sua cópia do termo de consentimento — Iris Codex'

  const textBody = `${greeting},

Você assinou o Termo de Consentimento para tratamento de dados biométricos
(versão ${termVersion}). Esta é a sua cópia.

Acessar o documento assinado: ${pdfUrl}

Você pode revogar o consentimento ou solicitar a exclusão dos seus dados a
qualquer momento, conforme descrito no próprio termo.

Iris Codex`

  const htmlBody = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px; line-height: 1.6;">
  <h1 style="font-size: 20px; font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; color: #1a1a1a; margin: 0 0 24px;">Iris Codex</h1>
  <p style="margin: 0 0 16px;">${greeting},</p>
  <p style="margin: 0 0 16px;">Você assinou o <strong>Termo de Consentimento para tratamento de dados biométricos</strong> (versão ${escapeHtml(termVersion)}). Esta é a sua cópia.</p>
  <p style="margin: 24px 0;">
    <a href="${pdfUrl}" style="display: inline-block; background-color: #1e6b65; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">Abrir documento assinado</a>
  </p>
  <p style="margin: 16px 0; color: #6b6b6b; font-size: 13px;">Você pode revogar o consentimento ou solicitar a exclusão dos seus dados a qualquer momento, conforme descrito no termo.</p>
  <p style="margin: 24px 0 0; color: #6b6b6b; font-size: 13px;">Iris Codex</p>
</body>
</html>`

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[notify-consent] resend HTTP ${res.status} — ${detail.slice(0, 200)}`)
      return { sent: false, reason: `resend_http_${res.status}` }
    }
    console.log(`[notify-consent] cópia enviada pra ${email} (cliente ${clientId})`)
    return { sent: true }
  } catch (err) {
    console.error(
      '[notify-consent] resend fetch falhou:',
      err instanceof Error ? err.message : err,
    )
    return { sent: false, reason: 'fetch_error' }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
