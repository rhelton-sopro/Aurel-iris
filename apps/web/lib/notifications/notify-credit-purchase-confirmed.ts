/**
 * Email transacional de confirmação de compra de pacote de créditos.
 *
 * Disparado por `applyPaymentEvent` (lib/billing/apply-payment.ts) quando o
 * webhook Asaas confirma o pagamento (PAYMENT_CONFIRMED, A1) e o crédito
 * transita pending → active.
 *
 * Best-effort: webhook está no caminho crítico de creditar saldo, então uma
 * falha de email NUNCA pode quebrar o fluxo. Sem RESEND_API_KEY → degrade
 * silencioso. HTTP/fetch fail → log + return. Nunca lança.
 *
 * Padrão espelhado em notify-therapist-capture-complete.ts (Resend via fetch
 * direto, from=noreply@iriscodex.com, escapeHtml em campos user-controlled).
 */
import 'server-only'

const RESEND_API_URL = 'https://api.resend.com/emails'
// Domínio iriscodex.com verificado no Resend (memory
// project_resend_domain_unverified_launch_gate RESOLVED).
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

export interface NotifyPurchaseInput {
  userEmail: string
  userName?: string | null
  packageName: string
  leituras: number
  valueBrl: number
  expiresAt: string // ISO
}

export async function notifyCreditPurchaseConfirmed(
  input: NotifyPurchaseInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[notify-purchase] RESEND_API_KEY ausente — pulando')
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM
  const greeting = input.userName ? `Olá, ${escapeHtml(input.userName)}` : 'Olá'
  const expiresAtBR = new Date(input.expiresAt).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
  const valueBR = input.valueBrl.toFixed(2).replace('.', ',')

  const subject = 'Iris Codex — sua compra foi confirmada'
  const text = `${greeting},

Sua compra foi confirmada com sucesso!

Pacote: ${input.packageName}
Leituras: ${input.leituras}
Valor: R$ ${valueBR}
Validade: ${expiresAtBR}

Acesse seu painel em https://iriscodex.com/assinatura para começar a usar.

Boas reflexões,
Equipe Iris Codex`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 32px 24px; line-height: 1.55;">
  <h1 style="font-size: 20px; font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; color: #1a1a1a; margin: 0 0 24px;">Iris Codex</h1>
  <p style="margin: 0 0 16px;">${greeting},</p>
  <p style="margin: 0 0 16px;">Sua compra foi <strong>confirmada com sucesso</strong>.</p>
  <table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Pacote</td><td style="padding: 6px 0;"><strong>${escapeHtml(input.packageName)}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Leituras</td><td style="padding: 6px 0;"><strong>${input.leituras}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Valor</td><td style="padding: 6px 0;"><strong>R$ ${valueBR}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Validade</td><td style="padding: 6px 0;"><strong>${expiresAtBR}</strong></td></tr>
  </table>
  <p style="margin: 24px 0;">
    <a href="https://iriscodex.com/assinatura" style="display: inline-block; background-color: #1e6b65; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">Ir pro painel</a>
  </p>
  <p style="margin-top: 24px; font-size: 12px; color: #6b6b6b;">Iris Codex é ferramenta de apoio à anamnese terapêutica integrativa. Não substitui avaliação médica.</p>
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
      console.error(`[notify-purchase] resend HTTP ${res.status} — ${detail.slice(0, 200)}`)
      return
    }
    console.info(
      `[notify-purchase] sent to=${input.userEmail} pkg=${input.packageName}`,
    )
  } catch (err) {
    console.error(
      '[notify-purchase] fetch failed:',
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
