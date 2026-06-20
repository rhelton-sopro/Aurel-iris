import 'server-only'

/**
 * Converte o erro CRU do Mercado Pago numa mensagem humana — NUNCA expõe JSON
 * ao usuário (espelha lib/asaas/humanize-error). O MP retorna
 * `{ message, error, status, cause: [{ code, description }] }`.
 */
export function humanizeMpError(raw: string | null | undefined): string {
  const fallback =
    'Não foi possível concluir a operação com o provedor de pagamento. Tente novamente em instantes ou contate o suporte.'
  if (!raw) return fallback

  type MpErrorBody = {
    message?: string
    error?: string
    cause?: Array<{ code?: string | number; description?: string }>
  }
  let parsed: MpErrorBody | null = null
  try {
    parsed = JSON.parse(raw) as MpErrorBody
  } catch {
    return fallback
  }

  // `cause[].description` é o mais específico quando presente.
  const causes = (parsed?.cause ?? [])
    .map((c) => (c?.description ?? '').trim())
    .filter(Boolean)
  if (causes.length > 0) return causes.join(' ')

  const msg = (parsed?.message ?? '').trim()
  if (msg) return msg
  return fallback
}
