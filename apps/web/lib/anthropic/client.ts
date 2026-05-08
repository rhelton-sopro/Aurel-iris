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

/** Anthropic Sonnet 4.6 pricing (USD per 1M tokens) para cost telemetry. */
export const PRICING_SONNET_4_6 = {
  input_per_mtok: 3.0,
  output_per_mtok: 15.0,
  cache_write_per_mtok: 3.75,
  cache_read_per_mtok: 0.3,
} as const

/** Compute cost em USD given Anthropic usage object (Pitfall 4 — track all 4 buckets). */
export function estimateCostUsd(usage: {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}): number {
  const i = (usage.input_tokens ?? 0) / 1_000_000
  const o = (usage.output_tokens ?? 0) / 1_000_000
  const cw = (usage.cache_creation_input_tokens ?? 0) / 1_000_000
  const cr = (usage.cache_read_input_tokens ?? 0) / 1_000_000
  return (
    i * PRICING_SONNET_4_6.input_per_mtok +
    o * PRICING_SONNET_4_6.output_per_mtok +
    cw * PRICING_SONNET_4_6.cache_write_per_mtok +
    cr * PRICING_SONNET_4_6.cache_read_per_mtok
  )
}
