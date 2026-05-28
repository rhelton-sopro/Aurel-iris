/**
 * Substituição de placeholders {{...}} no termo de consentimento + hash SHA256.
 *
 * Puro (sem 'server-only') — usável em script de seed (node), route handler
 * (server) e testes (vitest). Sem dependência de Supabase nem de Next.
 *
 * O termo bruto (apps/web/lib/consent/term-v1.md) tem placeholders no formato
 * {{NOME_MAIUSCULO}}. Esta função substitui pelos valores das partes (titular,
 * terapeuta, operador, datas) e recalcula o sha256 do texto JÁ hidratado — esse
 * hash vai pro footer do PDF e prova o conteúdo exato exibido àquele titular
 * (T-08-08-01). Placeholders sem valor viram `[NOME]` (marcador visível, nunca
 * deixa `{{...}}` cru no documento).
 */
import { createHash } from 'node:crypto'

export interface HydrateVars {
  TERAPEUTA_RESPONSAVEL?: string
  TERAPEUTA_CNPJ_CPF?: string
  TITULAR_NOME?: string
  TITULAR_CPF?: string
  MODALIDADE_ATIVA?: string
  DATA_ACEITE_BR?: string // "27/05/2026 14:35 BRT"
  IP_ACEITE?: string
  OPERADOR_RAZAO_SOCIAL?: string
  OPERADOR_CNPJ?: string
  OPERADOR_ENDERECO?: string
  OPERADOR_EMAIL?: string
  DPO_NOME?: string
  DPO_EMAIL?: string
  CONTENT_SHA256?: string
}

const PLACEHOLDER_REGEX = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g

export function hydrateTerm(
  template: string,
  vars: HydrateVars,
): { hydrated: string; sha256: string } {
  const hydrated = template.replace(PLACEHOLDER_REGEX, (_match, key: string) => {
    const value = vars[key as keyof HydrateVars]
    return value != null && value !== '' ? String(value) : `[${key}]`
  })
  const hash = createHash('sha256').update(hydrated).digest('hex')
  return { hydrated, sha256: hash }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
