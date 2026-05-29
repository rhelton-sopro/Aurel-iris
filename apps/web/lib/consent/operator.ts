/**
 * Identificação do operador (Iris Codex / Instituto Sopro da Origem) injetada
 * na hidratação do termo de consentimento — preenche os placeholders dos itens
 * 2, 5 e 8 do term-v1.md (razão social, CNPJ, endereço, e-mail de direitos, DPO,
 * modalidade ativa).
 *
 * Valores vêm de env vars SERVER-ONLY (sem prefixo NEXT_PUBLIC_): o termo só é
 * hidratado no PDF gerado server-side em /api/consent/generate-pdf; o browser
 * nunca renderiza o body (a UI mostra só resumo + checkbox). Expor no bundle do
 * cliente seria superfície desnecessária.
 *
 * MODALIDADE_ATIVA é FIXO em Modalidade A (B2B: o terapeuta sempre intermedia —
 * controlador = terapeuta, operador = Iris Codex). Não vem de env; hardcoded.
 *
 * Placeholders sem valor (env ausente) caem no fallback [NOME] do hydrateTerm —
 * marcador visível, nunca {{...}} cru.
 */
import 'server-only'

import type { HydrateVars } from './hydrate-term'

const MODALIDADE_A = 'Modalidade A — Atendimento com terapeuta cadastrado'

/**
 * Subconjunto de HydrateVars com a identificação do operador. Mesclar com os
 * dados por-titular (terapeuta, titular, data, IP) na chamada de hydrateTerm.
 */
export function operatorIdentity(): Pick<
  HydrateVars,
  | 'MODALIDADE_ATIVA'
  | 'OPERADOR_RAZAO_SOCIAL'
  | 'OPERADOR_CNPJ'
  | 'OPERADOR_ENDERECO'
  | 'OPERADOR_EMAIL'
  | 'DPO_NOME'
  | 'DPO_EMAIL'
> {
  return {
    MODALIDADE_ATIVA: MODALIDADE_A,
    OPERADOR_RAZAO_SOCIAL: process.env.OPERATOR_RAZAO_SOCIAL ?? '',
    OPERADOR_CNPJ: process.env.OPERATOR_CNPJ ?? '',
    OPERADOR_ENDERECO: process.env.OPERATOR_ENDERECO ?? '',
    OPERADOR_EMAIL: process.env.OPERATOR_EMAIL ?? '',
    DPO_NOME: process.env.OPERATOR_DPO_NOME ?? '',
    DPO_EMAIL: process.env.OPERATOR_DPO_EMAIL ?? '',
  }
}
