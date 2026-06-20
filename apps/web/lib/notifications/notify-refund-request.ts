/**
 * Email de SOLICITAÇÃO de reembolso PARCIAL ao suporte (suporte@iriscodex.com).
 *
 * Disparado por `refundPackageAction` quando o reembolso é parcial (cliente já
 * usou leituras): o sistema NÃO executa o estorno — calcula o demonstrativo e
 * avisa o suporte, que faz o estorno manual no painel do Mercado Pago. O webhook
 * PARTIALLY_REFUNDED reconcilia o crédito depois.
 *
 * Best-effort — falha NUNCA quebra a action. Padrão espelhado em
 * notify-refund-processed.ts.
 */
import 'server-only'

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

function supportEmail(): string {
  return process.env.SUPPORT_EMAIL ?? 'suporte@iriscodex.com'
}

export interface NotifyRefundRequestInput {
  therapistName: string | null
  therapistEmail: string
  packageName: string
  paidBrl: number
  leiturasPurchased: number
  leiturasUsed: number
  leiturasToRefund: number
  refundValueBrl: number
  unitPriceBrl: number
  paymentId: string | null // id do pagamento no MP (pra achar no painel)
  purchaseDate: string // ISO
  creditId: string
}

function brl(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

export async function notifyRefundRequest(
  input: NotifyRefundRequestInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[notify-refund-request] RESEND_API_KEY ausente — pulando')
    return
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM
  const name = input.therapistName?.trim() || input.therapistEmail
  const dataCompra = new Date(input.purchaseDate).toLocaleDateString('pt-BR')
  const subject = `Reembolso parcial — ${name}`

  const text = `Solicitação de reembolso PARCIAL (arrependimento CDC 7 dias).
Execução MANUAL no painel do Mercado Pago — o crédito é revertido automaticamente após o estorno.

Terapeuta:   ${name} · ${input.therapistEmail}
Pacote:      ${input.packageName} · pago R$ ${brl(input.paidBrl)}
Leituras:    ${input.leiturasPurchased} compradas · ${input.leiturasUsed} usadas · ${input.leiturasToRefund} a devolver
A devolver:  R$ ${brl(input.refundValueBrl)}  (${input.leiturasToRefund} × R$ ${brl(input.unitPriceBrl)}/leitura)
Compra em:   ${dataCompra}

>> Ação: estorne R$ ${brl(input.refundValueBrl)} no painel do Mercado Pago
   Pagamento: ${input.paymentId ?? '(sem id — verificar manualmente)'}
   Crédito interno: ${input.creditId}`

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 580px; margin: 0 auto; padding: 32px 24px; line-height: 1.55;">
  <h1 style="font-size: 18px; font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px;">Iris Codex — Reembolso parcial</h1>
  <p style="margin: 0 0 20px; font-size: 13px; color: #6b6b6b;">Execução manual no Mercado Pago. O crédito é revertido automaticamente após o estorno.</p>
  <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><td style="padding: 6px 0; color: #6b6b6b; width: 130px;">Terapeuta</td><td style="padding: 6px 0;"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(input.therapistEmail)}</td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Pacote</td><td style="padding: 6px 0;"><strong>${escapeHtml(input.packageName)}</strong> · pago R$ ${brl(input.paidBrl)}</td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Leituras</td><td style="padding: 6px 0;">${input.leiturasPurchased} compradas · ${input.leiturasUsed} usadas · <strong>${input.leiturasToRefund} a devolver</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">A devolver</td><td style="padding: 6px 0;"><strong style="color:#B23A2B;">R$ ${brl(input.refundValueBrl)}</strong> (${input.leiturasToRefund} × R$ ${brl(input.unitPriceBrl)}/leitura)</td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Compra em</td><td style="padding: 6px 0;">${dataCompra}</td></tr>
  </table>
  <div style="margin: 20px 0; padding: 14px 16px; background: #faf7f2; border-left: 3px solid #B23A2B;">
    <p style="margin: 0 0 6px; font-weight: bold;">▶ Estorne R$ ${brl(input.refundValueBrl)} no painel do Mercado Pago</p>
    <p style="margin: 0; font-size: 13px; color: #6b6b6b;">Pagamento: <code>${escapeHtml(input.paymentId ?? '(sem id)')}</code><br>Crédito interno: <code>${escapeHtml(input.creditId)}</code></p>
  </div>
</body></html>`

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: supportEmail(), subject, text, html }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[notify-refund-request] resend HTTP ${res.status} — ${detail.slice(0, 200)}`)
      return
    }
    console.info(`[notify-refund-request] sent credit=${input.creditId} value=${input.refundValueBrl}`)
  } catch (err) {
    console.error('[notify-refund-request] fetch failed:', err instanceof Error ? err.message : err)
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
