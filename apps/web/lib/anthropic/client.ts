/**
 * Anthropic SDK client — server-only factory.
 *
 * - Module-scope singleton (fresh request reuses connection pool).
 * - MODEL via env var (D-T2) — allows opus override in test/staging.
 * - DEFAULT_SYSTEM_CACHE_CONTROL inclui `cache_control: { type: 'ephemeral' }`
 *   para habilitar Anthropic prompt caching (5-min TTL, ~90% read discount).
 *   Pitfall 4 (07-RESEARCH.md): silently no-cache se system prompt < 2048
 *   tokens — `lib/anthropic/prompts.ts` token-counts at module init e
 *   loga WARN se abaixo do threshold.
 *
 * Phase 7 | Plan 07-03 | Decisions: D-T2, RESEARCH Pitfall 4
 */
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  throw new Error(
    '[lib/anthropic/client] ANTHROPIC_API_KEY env var is required. ' +
      'Set in apps/web/.env.local for dev or Vercel Environment Variables for prod.',
  )
}

/** Module-scope client — reuses HTTP connection pool. */
export const anthropicClient = new Anthropic({ apiKey })

/**
 * Model snapshot ID. Default `claude-sonnet-4-6` (dateless alias = literal ID).
 * Override via `ANTHROPIC_MODEL` env var para test/staging (D-T2).
 */
export const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

/**
 * Default args para o system block em `messages.stream({...})`.
 * `cache_control: { type: 'ephemeral' }` habilita Anthropic-side prompt caching.
 *
 * Sonnet 4.6 cache threshold: 2048 input tokens. `lib/anthropic/prompts.ts`
 * carrega system.md no init e avisa se abaixo do threshold.
 */
export const DEFAULT_SYSTEM_CACHE_CONTROL = { type: 'ephemeral' as const }

/** Hard ceiling em output tokens por análise (D-S3 timeout aligned). */
export const MAX_OUTPUT_TOKENS = 16000

/**
 * Anthropic Sonnet 4.6 pricing (USD per 1M tokens) — bucket de 5min ephemeral.
 *
 * Valores verificados em 2026-05-08 contra https://www.anthropic.com/pricing
 * (público) e refletem prompts ≤ 200K tokens; usar estes valores assume que
 * `MAX_OUTPUT_TOKENS = 16000` e o system prompt ~1.5K tokens nunca empurram
 * o request total acima do tier de 200K. `cache_write_per_mtok` é o de
 * `cache_control: { type: 'ephemeral' }` (5min TTL — o que usamos via
 * DEFAULT_SYSTEM_CACHE_CONTROL acima); o tier 1h ('extended') custa $6/MTok
 * mas não é usado neste codebase.
 *
 * **Audit**: re-verifique anualmente ou ao trocar `MODEL`. Fonte autoritativa
 * é a tabela pública da Anthropic; se mudar, atualize aqui + os 2 testes em
 * `__tests__/client.test.ts` que ancoram os 4 valores.
 */
export const PRICING_SONNET_4_6 = {
  input_per_mtok: 3.0,
  output_per_mtok: 15.0,
  cache_write_per_mtok: 3.75,
  cache_read_per_mtok: 0.3,
} as const

/**
 * Anthropic Haiku 4.5 pricing (USD per 1M tokens) — bucket de 5min ephemeral.
 *
 * Valores verificados em 2026-05-08 contra https://www.anthropic.com/pricing
 * (público). Aurel não usa Haiku no path principal de análise (D-T2 fixa
 * Sonnet 4.6), mas o gate de validação de imagem em
 * `app/api/capture/validate/route.ts` (Phase 3) e qualquer triagem futura
 * podem se beneficiar do tier mais barato. Mesma estrutura de 4 buckets +
 * mesmo padrão multiplicativo da Anthropic (cache_write 5min = 1.25× input,
 * cache_read = 0.10× input).
 *
 * **Audit**: re-verifique junto com `PRICING_SONNET_4_6` (mesma fonte).
 */
export const PRICING_HAIKU_4_5 = {
  input_per_mtok: 1.0,
  output_per_mtok: 5.0,
  cache_write_per_mtok: 1.25,
  cache_read_per_mtok: 0.1,
} as const

type Pricing = typeof PRICING_SONNET_4_6

/**
 * Compute cost em USD given Anthropic usage object (Pitfall 4 — track all 4
 * buckets). Default pricing = Sonnet 4.6 (D-T2). Para chamadas Haiku
 * (validate-image gate) passe `PRICING_HAIKU_4_5` no segundo argumento.
 */
export function estimateCostUsd(
  usage: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  },
  pricing: Pricing = PRICING_SONNET_4_6,
): number {
  const i = (usage.input_tokens ?? 0) / 1_000_000
  const o = (usage.output_tokens ?? 0) / 1_000_000
  const cw = (usage.cache_creation_input_tokens ?? 0) / 1_000_000
  const cr = (usage.cache_read_input_tokens ?? 0) / 1_000_000
  return (
    i * pricing.input_per_mtok +
    o * pricing.output_per_mtok +
    cw * pricing.cache_write_per_mtok +
    cr * pricing.cache_read_per_mtok
  )
}
