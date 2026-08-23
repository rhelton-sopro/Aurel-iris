/**
 * Aviso ao founder sobre o Mapa do Ser — dois motivos, um canal.
 *
 * Decisão do founder (2026-08-23), no fim do dia em que um relatório saiu com 3 blocos
 * de 7 e a terapeuta foi cobrada por ele:
 *
 *   *"Põe 40 mil de limite. Mas se passar de 30, me manda um e-mail, porque aí tem
 *   alguma coisa errada — antes não estava passando, não estava ficando tão caro,
 *   agora está ficando caro."*
 *
 * A troca de teto por sentinela: o teto de 40k existe para o documento NÃO CORTAR, e o
 * aviso em 30k existe porque **consumo alto é o sintoma, não o corte**. O corte era só a
 * forma como o sintoma aparecia quando o teto era baixo demais para escondê-lo.
 *
 * ⛔ O founder recusou a retentativa automática de propósito: quem regera é ele, à mão.
 *
 * Dois motivos:
 *   · `incompleto` — o documento saiu com menos de 7 blocos e FOI DESCARTADO. A terapeuta
 *     não foi cobrada e o crédito segue reservado. Com teto de 40k isto virou raro: se
 *     acontecer, é sinal forte.
 *   · `caro` — o documento saiu INTEIRO e foi entregue, mas passou do limiar de alerta.
 *     Nada quebrou; o que o e-mail diz é "olha o custo".
 *
 * ⚠️ Best-effort: falhar ao enviar NUNCA derruba a geração nem muda o que a terapeuta vê.
 * ⚠️ Vai para FOUNDER_EMAILS (os dois founders), não para o suporte: é decisão de dono.
 */
import 'server-only'
import { FOUNDER_EMAILS } from '@/lib/auth/founder'

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

export type MotivoAlerta = 'incompleto' | 'caro'

export interface NotifyMapaAlertaInput {
  motivo: MotivoAlerta
  readingId: string
  therapistName: string | null
  clientName: string | null
  /** quantos blocos vieram, de 7 */
  blocos: number
  /** 'max_tokens' = a API cortou no meio da frase */
  stopReason: string | null
  tokensOut: number
  /** teto vigente e limiar de alerta — no e-mail, para ninguém precisar abrir o código */
  maxTokens: number
  alertaTokens: number
}

export async function notifyMapaAlerta(input: NotifyMapaAlertaInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[notify-mapa-alerta] RESEND_API_KEY ausente — pulando')
    return
  }
  const to = FOUNDER_EMAILS.filter(Boolean)
  if (!to.length) {
    console.warn('[notify-mapa-alerta] FOUNDER_EMAIL vazio — ninguém foi avisado')
    return
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM
  const terapeuta = input.therapistName?.trim() || '(terapeuta sem nome)'
  const cliente = input.clientName?.trim() || '(cliente sem nome)'
  const inc = input.motivo === 'incompleto'
  const url = `https://iriscodex.com/admin/regenerar?reading=${input.readingId}`
  // saída em dólar: Sonnet 5 a US$10/1M (intro, até 31/08 — depois US$15)
  const custo = ((input.tokensOut / 1e6) * 10).toFixed(2)

  const subject = inc
    ? `🔴 URGENTE — relatório incompleto: ${terapeuta} / ${cliente}`
    : `🟡 Relatório caro (${input.tokensOut.toLocaleString('pt-BR')} tokens): ${terapeuta} / ${cliente}`

  const linhaMotivo = inc
    ? `Saiu com ${input.blocos} de 7 blocos · ${input.tokensOut} tokens de ${input.maxTokens}${
        input.stopReason === 'max_tokens'
          ? ' (BATEU O TETO — a API cortou no meio da frase)'
          : ` (parou sozinho: ${input.stopReason ?? 'motivo desconhecido'})`
      }`
    : `Saiu INTEIRO (7 de 7) e foi entregue, mas gastou ${input.tokensOut} tokens — acima do limiar de ${input.alertaTokens}. O normal medido é 16.000 a 25.000.`

  const text = inc
    ? `Um Mapa do Ser saiu INCOMPLETO e NÃO foi entregue.

A terapeuta viu na tela que o relatório foi descartado e que NÃO foi cobrada.
O crédito dela continua reservado — gerar de novo não cobra duas vezes.
A foto da íris foi RETIDA, então dá para regerar.

Terapeuta:  ${terapeuta}
Cliente:    ${cliente}
Leitura:    ${input.readingId}

${linhaMotivo}

>> Ação: gerar de novo por ${url}`
    : `Um Mapa do Ser passou do limiar de custo. NADA quebrou — ele foi entregue inteiro.

Terapeuta:  ${terapeuta}
Cliente:    ${cliente}
Leitura:    ${input.readingId}

${linhaMotivo}
Custo desta geração: ~US$ ${custo} (só a saída)

>> Nenhuma ação necessária. Se isto virar rotina, o gasto subiu e vale investigar.`

  const cor = inc ? '#B23A2B' : '#9a6a12'
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 580px; margin: 0 auto; padding: 32px 24px; line-height: 1.55;">
  <h1 style="font-size: 18px; font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px;">Iris Codex — ${inc ? 'Relatório incompleto' : 'Relatório caro'}</h1>
  <p style="margin: 0 0 20px; font-size: 13px; color: #6b6b6b;">${
    inc
      ? 'O documento foi descartado e <strong>não</strong> foi entregue. A terapeuta <strong>não</strong> foi cobrada e o crédito dela segue reservado.'
      : 'O documento foi entregue inteiro. Este aviso é sobre <strong>custo</strong>, não sobre defeito.'
  }</p>
  <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><td style="padding: 6px 0; color: #6b6b6b; width: 110px;">Terapeuta</td><td style="padding: 6px 0;"><strong>${escapeHtml(terapeuta)}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Cliente</td><td style="padding: 6px 0;"><strong>${escapeHtml(cliente)}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Blocos</td><td style="padding: 6px 0;"><strong style="color:${cor};">${input.blocos} de 7</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Tokens</td><td style="padding: 6px 0;"><strong style="color:${cor};">${input.tokensOut.toLocaleString('pt-BR')}</strong> de ${input.maxTokens.toLocaleString('pt-BR')} · alerta em ${input.alertaTokens.toLocaleString('pt-BR')} · normal 16.000–25.000</td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Custo</td><td style="padding: 6px 0;">~US$ ${custo} (saída)</td></tr>
    <tr><td style="padding: 6px 0; color: #6b6b6b;">Leitura</td><td style="padding: 6px 0;"><code>${escapeHtml(input.readingId)}</code></td></tr>
  </table>
  ${
    inc
      ? `<div style="margin: 20px 0; padding: 14px 16px; background: #faf7f2; border-left: 3px solid ${cor};">
    <p style="margin: 0 0 6px; font-weight: bold;">▶ Gerar de novo para a terapeuta</p>
    <p style="margin: 0; font-size: 13px;"><a href="${escapeHtml(url)}" style="color:#1a1a1a;">${escapeHtml(url)}</a></p>
    <p style="margin: 8px 0 0; font-size: 12px; color: #6b6b6b;">A foto da íris foi retida para isto. O texto pago da tentativa que cortou ficou guardado na leitura.</p>
  </div>`
      : `<p style="margin: 20px 0 0; font-size: 13px; color: #6b6b6b;">Nenhuma ação necessária. Se isto virar rotina, o gasto subiu — vale olhar o que mudou no prompt.</p>`
  }
</body></html>`

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to, subject, text, html }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[notify-mapa-alerta] resend HTTP ${res.status} — ${detail.slice(0, 200)}`)
      return
    }
    console.info(`[notify-mapa-alerta] ${input.motivo} reading=${input.readingId} tokens=${input.tokensOut}`)
  } catch (err) {
    console.error('[notify-mapa-alerta] fetch failed:', err instanceof Error ? err.message : err)
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
