/**
 * Lookup de preço Anthropic por modelo + data — fonte única.
 *
 * Resolve "manter o custo atualizado" (founder 2026-05-20): cada chamada
 * persiste o preço VIGENTE NA HORA. Histórico fica congelado correto;
 * mudança de preço futura não distorce números antigos.
 *
 * Tabela ai_model_pricing (migration 0024) é a fonte autorizada. Founder
 * edita via Supabase dashboard quando Anthropic mexer (não há API
 * pública de preços). Fallback hardcoded cobre o caso "migration ainda
 * não aplicada" / "modelo novo sem linha" — best-effort.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export interface ModelPricing {
  input_usd_per_mtok: number
  output_usd_per_mtok: number
}

// Fallback hardcoded — usado SE migration 0024 não aplicada OU modelo
// não tem linha. Ref. platform.claude.com/docs/en/about-claude/pricing
// (verificado 2026-07-20).
const FALLBACK_PRICING: Array<{
  match: (modelVersion: string) => boolean
  pricing: ModelPricing
}> = [
  {
    // Haiku 4.5 = $1/$5 (NÃO $0.80/$4 — esse era o preço do Haiku 3.5).
    match: (m) => /^claude-haiku-4-5/.test(m),
    pricing: { input_usd_per_mtok: 1.0, output_usd_per_mtok: 5.0 },
  },
  {
    // Sonnet 4.5 / 4.6 / 5 — todos $3/$15 base (Sonnet 5 tem preço
    // introdutório $2/$10 até 31/08/2026; fallback usa o padrão pós-intro).
    match: (m) => /^claude-sonnet-(4-(5|6)|5)/.test(m),
    pricing: { input_usd_per_mtok: 3.0, output_usd_per_mtok: 15.0 },
  },
  {
    // Opus 4.5 / 4.6 / 4.7 / 4.8 — todos $5/$25 (Opus 4.1 e anteriores
    // eram $15/$75; NÃO aplicar aqui).
    match: (m) => /^claude-opus-4-(5|6|7|8)/.test(m),
    pricing: { input_usd_per_mtok: 5.0, output_usd_per_mtok: 25.0 },
  },
  {
    // Fable 5 / Mythos 5 — tier frontier acima do Opus.
    match: (m) => /^claude-(fable|mythos)-5/.test(m),
    pricing: { input_usd_per_mtok: 10.0, output_usd_per_mtok: 50.0 },
  },
]

const ULTIMATE_FALLBACK: ModelPricing = {
  input_usd_per_mtok: 1.0,
  output_usd_per_mtok: 5.0,
}

/**
 * Busca preço de um modelo numa data específica.
 *
 * Algoritmo:
 *   1. Query ai_model_pricing: model_version LIKE model_pattern AND
 *      atIso entre valid_from e COALESCE(valid_to, ∞).
 *   2. Ordena por length(model_pattern) DESC (mais específico vence) +
 *      valid_from DESC (em empate, mais recente).
 *   3. Pega primeiro. Se vazio → fallback regex hardcoded. Se ainda
 *      vazio → ULTIMATE_FALLBACK ($1/$5 — estimativa conservadora p/
 *      não zerar custo).
 *
 * NUNCA throw. Best-effort — custo zerado é pior que custo aproximado.
 */
export async function getPricingFor(
  modelVersion: string,
  at: Date = new Date(),
): Promise<ModelPricing> {
  const atIso = at.toISOString()
  try {
    const service = createServiceClient()
    const { data, error } = await service
      .from('ai_model_pricing' as never)
      .select('model_pattern, input_usd_per_mtok, output_usd_per_mtok, valid_from')
      .lte('valid_from', atIso)
      .or(`valid_to.is.null,valid_to.gt.${atIso}`)
    if (error) {
      console.error('[pricing] db lookup error:', error.message)
    } else if (data && data.length > 0) {
      // Filtra LIKE no client (Postgres não tem reverse-LIKE built-in).
      const matches = (data as Array<{
        model_pattern: string
        input_usd_per_mtok: number | string
        output_usd_per_mtok: number | string
        valid_from: string
      }>)
        .filter((row) => likeMatch(modelVersion, row.model_pattern))
        .sort((a, b) => {
          if (b.model_pattern.length !== a.model_pattern.length) {
            return b.model_pattern.length - a.model_pattern.length
          }
          return b.valid_from.localeCompare(a.valid_from)
        })
      if (matches.length > 0) {
        return {
          input_usd_per_mtok: Number(matches[0].input_usd_per_mtok),
          output_usd_per_mtok: Number(matches[0].output_usd_per_mtok),
        }
      }
    }
  } catch (err) {
    console.error(
      '[pricing] lookup falhou (migration 0024 pendente?):',
      err instanceof Error ? err.message : err,
    )
  }
  // Fallback regex hardcoded.
  for (const f of FALLBACK_PRICING) {
    if (f.match(modelVersion)) return f.pricing
  }
  return ULTIMATE_FALLBACK
}

/** Calcula custo USD dado tokens e pricing. */
export function computeCostUsd(
  tokensIn: number | null,
  tokensOut: number | null,
  pricing: ModelPricing,
): number | null {
  if (tokensIn == null || tokensOut == null) return null
  return (
    (tokensIn * pricing.input_usd_per_mtok +
      tokensOut * pricing.output_usd_per_mtok) /
    1_000_000
  )
}

/**
 * SQL LIKE matcher (% = qualquer, _ = um char). Case-sensitive, igual
 * Postgres LIKE default. Escape simplificado (sem \ escape — patterns
 * vêm do founder via dashboard, confiáveis).
 */
function likeMatch(value: string, pattern: string): boolean {
  const re =
    '^' +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex
      .replace(/%/g, '.*')
      .replace(/_/g, '.') +
    '$'
  return new RegExp(re).test(value)
}
