/**
 * Email transacional de aviso de expiração de pacote de créditos.
 *
 * Disparado pelo cron daily (plano 08-13) em 3 janelas: 30 dias, 7 dias e no
 * próprio dia do vencimento (D-03). Best-effort — falha NUNCA quebra o cron.
 *
 * Padrão espelhado em notify-credit-purchase-confirmed.ts.
 */
import 'server-only'

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

export type ExpiryWindow = 30 | 7 | 0 // 30 dias, 7 dias, hoje

export interface NotifyExpiringInput {
  userEmail: string
  userName?: string | null
  packageName: string
  leiturasRemaining: number
  expiresAt: string // ISO
  daysOut: ExpiryWindow
}

const SUBJECT_MAP: Record<ExpiryWindow, string> = {
  30: 'Iris Codex — seu pacote expira em 30 dias',
  7: 'Iris Codex — seu pacote expira em 7 dias',
  0: 'Iris Codex — seu pacote expira HOJE',
}

const URGENCY_MAP: Record<ExpiryWindow, string> = {
  30: 'em 30 dias',
  7: 'em apenas 7 dias',
  0: 'HOJE',
}

export async function notifyCreditExpiring(input: NotifyExpiringInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[notify-expiring] RESEND_API_KEY ausente — pulando')
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM
  const greeting = input.userName ? `Olá, ${escapeHtml(input.userName)}` : 'Olá'
  const expiresAtBR = new Date(input.expiresAt).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
  const urgency = URGENCY_MAP[input.daysOut]
  const subject = SUBJECT_MAP[input.daysOut]
  const leiturasLabel =
    input.leiturasRemaining === 1 ? 'leitura restante' : 'leituras restantes'

  const text = `${greeting},

Seu pacote "${input.packageName}" tem ${input.leiturasRemaining} ${leiturasLabel} e expira ${urgency} (${expiresAtBR}).

Após o vencimento, créditos não usados não são reembolsáveis (exceto avaliação caso-a-caso via suporte).

Acesse https://iriscodex.com/assinatura ou comece uma nova leitura agora.

Boas reflexões,
Equipe Iris Codex`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px; line-height: 1.55;">
  <h1 style="font-size: 20px; font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; color: #1a1a1a; margin: 0 0 24px;">Iris Codex</h1>
  <p style="margin: 0 0 16px;">${greeting},</p>
  <p style="margin: 0 0 16px;">Seu pacote <strong>${escapeHtml(input.packageName)}</strong> tem <strong>${input.leiturasRemaining} ${leiturasLabel}</strong> e expira <strong>${urgency}</strong> (${expiresAtBR}).</p>
  <p style="margin: 0 0 16px; color: #b45309; font-weight: 500;">Após o vencimento, créditos não usados não são reembolsáveis (exceto avaliação caso-a-caso via suporte).</p>
  <p style="margin: 24px 0;">
    <a href="https://iriscodex.com/leituras/nova" style="display: inline-block; background-color: #1e6b65; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">Começar uma leitura</a>
  </p>
  <p style="margin-top: 24px; font-size: 12px; color: #6b6b6b;">Iris Codex — ferramenta de apoio à anamnese terapêutica integrativa.</p>
</body>
</html>`

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: input.userEmail, subject, text, html }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[notify-expiring] resend HTTP ${res.status} — ${detail.slice(0, 200)}`)
      return
    }
    console.info(
      `[notify-expiring] sent to=${input.userEmail} days=${input.daysOut}`,
    )
  } catch (err) {
    console.error(
      '[notify-expiring] fetch failed:',
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
