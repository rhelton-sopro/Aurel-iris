import 'server-only'

/**
 * Converte o erro CRU do Asaas numa mensagem humana — NUNCA expõe JSON ao
 * usuário (GA). O Asaas retorna `{"errors":[{"code","description"}]}`; o
 * `description` já é PT legível, mas alguns casos merecem texto mais amigável.
 *
 * Aplicado em TODO retorno de erro Asaas pro usuário (createChargeAction,
 * createAsaasCustomer, refundPackageAction) — sem isso o `{"errors"...}` cru
 * vazava pra tela (founder 2026-05-31).
 */
export function humanizeAsaasError(raw: string | null | undefined): string {
  const fallback =
    'Não foi possível concluir a operação com o provedor de pagamento. Tente novamente em instantes ou contate o suporte.'
  if (!raw) return fallback

  type AsaasErrorBody = {
    errors?: Array<{ code?: string; description?: string }>
  }
  let parsed: AsaasErrorBody | null = null
  try {
    parsed = JSON.parse(raw) as AsaasErrorBody
  } catch {
    // raw não-JSON (texto de plataforma, 'network', etc.) → fallback genérico.
    return fallback
  }

  const errs = parsed?.errors
  if (!Array.isArray(errs) || errs.length === 0) return fallback

  const first = errs[0]
  const code = first?.code ?? ''
  const desc = (first?.description ?? '').trim()

  // Mapeamentos específicos (texto mais amigável que o do Asaas):
  if (code === 'invalid_action' && /parcial.*pr[oó]ximo dia/i.test(desc)) {
    return 'Reembolsos parciais só podem ser processados a partir do dia seguinte ao pagamento. Tente novamente amanhã.'
  }
  if (/saldo/i.test(desc)) {
    return 'O provedor de pagamento ainda não tem saldo liberado deste pagamento para processar o estorno. Tente novamente mais tarde (o PIX precisa liquidar primeiro).'
  }

  // Demais erros: usa o `description` do Asaas (já é PT humano) — sem o JSON.
  // Se vier mais de um, junta. Sem description → fallback.
  const descriptions = errs
    .map((e) => (e?.description ?? '').trim())
    .filter(Boolean)
  if (descriptions.length > 0) return descriptions.join(' ')
  return fallback
}
