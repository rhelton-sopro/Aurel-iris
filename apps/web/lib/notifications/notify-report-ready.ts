/**
 * Notifica o terapeuta por email quando o pipeline Sonnet 2x termina de
 * gerar o relatório (report_generated populado pela 1ª vez).
 *
 * Disparado pelo /api/readings/[id]/analyze/route.ts pós-stream, DENTRO
 * do guard `notification_sent_at IS NULL`. Idempotência via flag (D-04):
 * regen NÃO re-dispara. Falha Resend é best-effort — não bloqueia pipeline,
 * retorna { sent: false } e route.ts NÃO seta notification_sent_at, então
 * tentativa futura (próxima regen ou retry manual) pode mandar.
 *
 * Tom: "Seu relatório está pronto — abrir leitura". Link pra /leituras/[id]
 * (session-based — terapeuta loga via magic-link se sessão expirou).
 *
 * Resend via fetch direto (sem SDK). Sem RESEND_API_KEY → degrade silencioso.
 * Sender: noreply@iriscodex.com (RESEND_FROM_EMAIL override respeitado).
 *
 * NÃO filtra por origem (capture-complete filtra por used_by_reading_id pra
 * só disparar em invite). Aqui qualquer reading que gere report — invite OU
 * autoexame OU upload desktop — dispara, porque o sinal é útil em todos.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

const RESEND_API_URL = 'https://api.resend.com/emails'
// Domínio iriscodex.com verificado no Resend desde 2026-05-22 (founder).
// Override via RESEND_FROM_EMAIL no env se quiser outro endereço.
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

export async function notifyTherapistReportReady(
  readingId: string,
  therapistId: string,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[notify-report] RESEND_API_KEY ausente — pulando email')
    return { sent: false, reason: 'no_api_key' }
  }

  const svc = createServiceClient()

  // Fetch reading + therapist email + therapist name em paralelo.
  const [{ data: reading }, { data: profile }, authResult] = await Promise.all([
    svc.from('readings').select('client:clients(full_name)').eq('id', readingId).maybeSingle(),
    svc.from('profiles').select('full_name').eq('id', therapistId).maybeSingle(),
    svc.auth.admin.getUserById(therapistId),
  ])

  if (!reading) return { sent: false, reason: 'reading_not_found' }

  const therapistEmail = authResult.data.user?.email
  if (!therapistEmail) {
    console.warn(`[notify-report] sem email pro terapeuta ${therapistId}`)
    return { sent: false, reason: 'no_therapist_email' }
  }

  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'seu cliente'
  const therapistName = (profile as { full_name?: string } | null)?.full_name ?? ''
  const greeting = therapistName ? `Olá, ${escapeHtml(therapistName)}` : 'Olá'

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://iriscodex.com'
  const readingUrl = `${baseUrl}/leituras/${readingId}`
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM
  const subject = `Leitura pronta — ${clientName}`

  const textBody = `${greeting},

A leitura iridológica de ${clientName} está pronta para você revisar.

Acessar leitura: ${readingUrl}

Você pode editar o texto antes de entregar ao cliente.

Boas reflexões,
Equipe Iris Codex`

  const htmlBody = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px; line-height: 1.6;">
  <h1 style="font-size: 20px; font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; color: #1a1a1a; margin: 0 0 24px;">Iris Codex</h1>
  <p style="margin: 0 0 16px;">${greeting},</p>
  <p style="margin: 0 0 16px;">A leitura iridológica de <strong>${escapeHtml(clientName)}</strong> está pronta para você revisar.</p>
  <p style="margin: 24px 0;">
    <a href="${readingUrl}" style="display: inline-block; background-color: #1e6b65; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">Abrir leitura</a>
  </p>
  <p style="margin: 16px 0; color: #6b6b6b; font-size: 13px;">Você pode editar o texto antes de entregar ao cliente.</p>
  <p style="margin: 24px 0 0; color: #6b6b6b; font-size: 13px;">Boas reflexões,<br>Equipe Iris Codex</p>
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
        to: therapistEmail,
        subject,
        text: textBody,
        html: htmlBody,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(
        `[notify-report] resend HTTP ${res.status} — ${detail.slice(0, 200)}`,
      )
      return { sent: false, reason: `resend_http_${res.status}` }
    }
    console.log(
      `[notify-report] email enviado pra ${therapistEmail} (reading ${readingId})`,
    )
    return { sent: true }
  } catch (err) {
    console.error(
      '[notify-report] resend fetch falhou:',
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
