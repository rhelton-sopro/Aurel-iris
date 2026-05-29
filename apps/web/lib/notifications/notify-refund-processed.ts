/**
 * Email transacional de confirmação de reembolso (arrependimento CDC 7d, D-13).
 *
 * Disparado por `refundPackageAction` (app/actions/billing.ts) no success path.
 * Best-effort — falha NUNCA quebra a action de refund. Sem RESEND_API_KEY →
 * degrade silencioso. HTTP/fetch fail → log + return. Nunca lança.
 *
 * Padrão espelhado em notify-credit-purchase-confirmed.ts.
 */
import 'server-only'

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

export interface NotifyRefundInput {
  userEmail: string
  userName?: string | null
  packageName: string
  refundValueBrl: number
  kind: 'total' | 'partial'
  leiturasRefunded: number
}

export async function notifyRefundProcessed(input: NotifyRefundInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[notify-refund] RESEND_API_KEY ausente — pulando')
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM
  const greeting = input.userName ? `Olá, ${escapeHtml(input.userName)}` : 'Olá'
  const kindLabel = input.kind === 'total' ? 'integral' : 'proporcional'
  const valueBR = input.refundValueBrl.toFixed(2).replace('.', ',')
  const subject = 'Iris Codex — reembolso processado'

  const text = `${greeting},

Seu pedido de reembolso (arrependimento 7 dias) foi processado.

Pacote: ${input.packageName}
Tipo: Reembolso ${kindLabel}
Leituras reembolsadas: ${input.leiturasRefunded}
Valor: R$ ${valueBR}

O valor será creditado na sua conta original em até 5 dias úteis (PIX em até 1 dia útil; cartão em até 5 dias úteis).

Boas reflexões,
Equipe Iris Codex`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px; line-height: 1.55;">
  <h1 style="font-size: 20px; font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; color: #1a1a1a; margin: 0 0 24px;">Iris Codex</h1>
  <p style="margin: 0 0 16px;">${greeting},</p>
  <p style="margin: 0 0 16px;">Seu pedido de reembolso foi <strong>processado com sucesso</strong>.</p>
  <table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Pacote</td><td style="padding: 6px 0;"><strong>${escapeHtml(input.packageName)}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Tipo</td><td style="padding: 6px 0;"><strong>Reembolso ${kindLabel}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Leituras</td><td style="padding: 6px 0;"><strong>${input.leiturasRefunded}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Valor</td><td style="padding: 6px 0;"><strong>R$ ${valueBR}</strong></td></tr>
  </table>
  <p style="margin: 0 0 16px;">O valor será creditado na sua conta original em até <strong>5 dias úteis</strong> (PIX em até 1 dia útil; cartão em até 5 dias úteis).</p>
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
      console.error(`[notify-refund] resend HTTP ${res.status} — ${detail.slice(0, 200)}`)
      return
    }
    console.info(`[notify-refund] sent to=${input.userEmail} kind=${input.kind}`)
  } catch (err) {
    console.error(
      '[notify-refund] fetch failed:',
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
