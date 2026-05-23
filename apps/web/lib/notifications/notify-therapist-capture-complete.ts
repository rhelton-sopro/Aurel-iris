/**
 * Notifica o terapeuta por email quando o cliente termina a captura via
 * convite (6 fotos uploaded). Disparado pelo /api/convite/[token]/upload
 * no auto-finalize (count=6) E pelo /api/convite/[token]/finalize manual,
 * sempre DENTRO do guard `if (status === 'pending')` que precede o
 * `markReadingReady` — CAS interno garante que apenas UM dos dois caminhos
 * efetivamente dispara em qualquer cenário (race entre upload-6 e
 * finalize manual: só quem ganhar o CAS vê pending, o outro vê ready).
 *
 * Tom: avisa que a captura chegou e a análise está em andamento. Founder
 * decision (2026-05-23): durante UAT a notificação "relatório pronto"
 * vira ruído (founder fica refrescando antes da hora). O que importa é
 * "cliente terminou as fotos" — daí pra frente o terapeuta acompanha
 * direto no app.
 *
 * Filtro: SÓ notifica leituras de origem invite (used_by_reading_id ===
 * readingId no client_invite_tokens). Capturas diretas do terapeuta não
 * disparam — ele já sabe que terminou.
 *
 * Resend via fetch direto (sem SDK). Sem RESEND_API_KEY → degrade
 * silencioso (não bloqueia pipeline).
 *
 * 2026-05-23 — renomeado de notify-therapist-reading-ready.ts pra
 * notify-therapist-capture-complete.ts. Antes era disparado em
 * analyze/route.ts (após Stage 2 markdown pronto); agora dispara muito
 * antes, no momento da captura completa.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

const RESEND_API_URL = 'https://api.resend.com/emails'
// Domínio iriscodex.com verificado no Resend desde 2026-05-22 (founder).
// Override via RESEND_FROM_EMAIL no env se quiser outro endereço.
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

export async function notifyTherapistCaptureComplete(readingId: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[notify] RESEND_API_KEY ausente — pulando email')
    return
  }

  const svc = createServiceClient()

  // 1. Filtro de origem: leitura veio de invite?
  // types/database.ts ainda não tem client_invite_tokens — cast 'as never'.
  const { data: token } = await svc
    .from('client_invite_tokens' as never)
    .select('therapist_id')
    .eq('used_by_reading_id' as never, readingId)
    .maybeSingle<{ therapist_id: string }>()

  if (!token?.therapist_id) {
    // Não é leitura via convite — terapeuta capturou ele mesmo, já sabe.
    return
  }

  // 2. Dados pro email: nome do cliente + nome do terapeuta + email do terapeuta
  const [{ data: reading }, { data: profile }, authResult] = await Promise.all([
    svc
      .from('readings')
      .select('client:clients(full_name)')
      .eq('id', readingId)
      .maybeSingle(),
    svc
      .from('profiles')
      .select('full_name')
      .eq('id', token.therapist_id)
      .maybeSingle(),
    svc.auth.admin.getUserById(token.therapist_id),
  ])

  const therapistEmail = authResult.data.user?.email
  if (!therapistEmail) {
    console.warn(`[notify] sem email pro terapeuta ${token.therapist_id}`)
    return
  }

  const clientName =
    (reading?.client as { full_name?: string } | null)?.full_name ?? 'O cliente'
  const therapistName = profile?.full_name ?? ''
  const greeting = therapistName ? `Olá, ${therapistName}` : 'Olá'

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://iriscodex.com'
  const readingUrl = `${baseUrl}/leituras/${readingId}`

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM
  const subject = `Captura recebida — análise em andamento — ${clientName}`

  const textBody = `${greeting},

${clientName} completou a captura das 6 fotografias da íris. A leitura iridológica entrou em processamento e ficará pronta em poucos minutos.

Você pode acompanhar aqui: ${readingUrl}

Boas reflexões,
Equipe Iris Codex`

  const htmlBody = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px; line-height: 1.6;">
  <h1 style="font-size: 20px; font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; color: #1a1a1a; margin: 0 0 24px;">Iris Codex</h1>
  <p style="margin: 0 0 16px;">${greeting},</p>
  <p style="margin: 0 0 16px;"><strong>${escapeHtml(clientName)}</strong> completou a captura das 6 fotografias da íris. A leitura iridológica entrou em processamento e ficará pronta em poucos minutos.</p>
  <p style="margin: 24px 0;">
    <a href="${readingUrl}" style="display: inline-block; background-color: #1e6b65; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">Acompanhar leitura</a>
  </p>
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
        `[notify] resend HTTP ${res.status} — ${detail.slice(0, 200)}`,
      )
      return
    }
    console.log(`[notify] email enviado pra ${therapistEmail} (reading ${readingId})`)
  } catch (err) {
    // Non-fatal — não quebra a pipeline da análise.
    console.error(
      '[notify] resend fetch falhou:',
      err instanceof Error ? err.message : err,
    )
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
