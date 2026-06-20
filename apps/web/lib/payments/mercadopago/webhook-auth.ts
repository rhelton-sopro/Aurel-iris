/**
 * Validação da assinatura x-signature do webhook do Mercado Pago.
 *
 * O MP assina cada notificação com HMAC-SHA256 sobre um "manifest" montado a
 * partir do `data.id` (da QUERY, não do corpo), do `x-request-id` e do `ts` do
 * próprio header. A chave é a "assinatura secreta" do painel (Webhooks →
 * Configurar notificação) — DISTINTA do Access Token e DISTINTA por ambiente.
 * Ver research/02-webhooks-signature.md.
 *
 * Server-only — depende de node:crypto (route handler precisa runtime nodejs).
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

export type MpWebhookAuthResult =
  | { valid: true }
  | { valid: false; reason: 'misconfigured' | 'missing_signature' | 'invalid_signature' }

/** Extrai `ts` e `v1` do header `x-signature: ts=...,v1=...`. */
function parseSignature(header: string): { ts?: string; v1?: string } {
  const out: { ts?: string; v1?: string } = {}
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2)
    const key = k?.trim()
    const val = v?.trim()
    if (key === 'ts') out.ts = val
    else if (key === 'v1') out.v1 = val
  }
  return out
}

export function verifyMpSignature(params: {
  signatureHeader: string | null | undefined
  requestId: string | null | undefined
  dataId: string | null | undefined
  secret: string | undefined
}): MpWebhookAuthResult {
  const { signatureHeader, requestId, dataId, secret } = params
  if (!secret) return { valid: false, reason: 'misconfigured' }
  if (!signatureHeader || !dataId) return { valid: false, reason: 'missing_signature' }

  const { ts, v1 } = parseSignature(signatureHeader)
  if (!ts || !v1) return { valid: false, reason: 'missing_signature' }

  // Manifest: segmentos na ordem id;request-id;ts; — request-id é omitido se
  // ausente; data.id alfanumérico vai em lowercase (research/02 §gotcha 3).
  const manifest =
    `id:${dataId.toLowerCase()};` +
    (requestId ? `request-id:${requestId};` : '') +
    `ts:${ts};`

  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(v1)
  if (a.length !== b.length) return { valid: false, reason: 'invalid_signature' }
  if (!timingSafeEqual(a, b)) return { valid: false, reason: 'invalid_signature' }
  return { valid: true }
}
