/**
 * `logReportGeneration` — best-effort instrumentation insert into
 * `report_generations` (migration 0017).
 *
 * One row per report generation across the 3 comparison methods so the
 * founder can compare both the CLINICAL value and the $ economics of
 * vigente vs. sam vs. sonnet_direct.
 *
 * Contract: NEVER throws, NEVER blocks a generation. If the table does not
 * exist yet (migration 0017 not applied) or the insert fails for any reason,
 * it logs a warning and returns — the report is already persisted by the
 * caller; instrumentation is strictly secondary.
 *
 * Phase 7.4 | Column C | calibration instrumentation
 */
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditMetadata } from '@/lib/anthropic/types'

export type ReportGenerationMethod =
  | 'vigente'
  | 'sam'
  | 'sonnet_direct'
  | 'sonnet_2x' // v2.3.0+ Caminho 1 (Etapa 1 tool use + Etapa 2 ancorada). Semver vai em method_version.

export interface ReportGenerationLog {
  reading_id: string
  method: ReportGenerationMethod
  /** Semver da iteração do method (ex: '0.1.0' pra sonnet_2x v2.3.0). NULL pra rows pré-v2.3.0. */
  method_version?: string | null
  latency_ms: number | null
  cost_usd: number | null
  tokens_in: number | null
  tokens_out: number | null
  /** Anthropic cache writes (pesa ~1.25x input). Migration 0031. */
  cache_creation_input_tokens?: number | null
  /** Anthropic cache reads — cache hit (paga ~0.1x input). Migration 0031. */
  cache_read_input_tokens?: number | null
  model_version: string | null
  /** Short sha256 of the effective system.md at generation time. */
  prompt_version?: string | null
  /** # of the 6 photos that fell back to raw frame for THIS generation. */
  canonical_fallback_count?: number | null
  /** AuditMetadata snapshot for this generation (anchor rate, forbidden vocab). */
  audit_summary?: AuditMetadata | null
  /** readings.regeneration_count AFTER this generation (1 = first). */
  regeneration_count?: number | null
  /** Denormalized readings.client_id (no FK — mirrors reading_id decoupling). */
  client_id?: string | null
  /** Cost of the separate canonicalization (Sonnet-bbox) call for this reading. */
  bbox_cost_usd?: number | null
  /** Wall-clock latency of the canonicalization batch (ms). */
  bbox_latency_ms?: number | null
}

export async function logReportGeneration(
  service: SupabaseClient,
  entry: ReportGenerationLog,
): Promise<void> {
  try {
    const { error } = await service.from('report_generations').insert({
      reading_id: entry.reading_id,
      method: entry.method,
      method_version: entry.method_version ?? null,
      generated_at: new Date().toISOString(),
      latency_ms: entry.latency_ms,
      cost_usd: entry.cost_usd,
      tokens_in: entry.tokens_in,
      tokens_out: entry.tokens_out,
      cache_creation_input_tokens: entry.cache_creation_input_tokens ?? null,
      cache_read_input_tokens: entry.cache_read_input_tokens ?? null,
      model_version: entry.model_version,
      prompt_version: entry.prompt_version ?? null,
      canonical_fallback_count: entry.canonical_fallback_count ?? null,
      audit_summary: entry.audit_summary ?? null,
      regeneration_count: entry.regeneration_count ?? null,
      client_id: entry.client_id ?? null,
      bbox_cost_usd: entry.bbox_cost_usd ?? null,
      bbox_latency_ms: entry.bbox_latency_ms ?? null,
    } as never)
    if (error) {
      const code = (error as { code?: string }).code ?? ''
      const tag = `[report_generations] (${entry.method}, ${entry.reading_id})`
      // 42P01 = undefined_table → tabela ausente, migration realmente pendente.
      // 23514 = check_violation → constraint rejeitou o valor; bug de schema
      //   ou code drift, NÃO é harmless. Promove a error com escala visível.
      // 42703 = undefined_column → migration parcial / coluna nova faltando.
      if (code === '42P01') {
        console.warn(`${tag} insert skipped: tabela ausente (migration 0017 pendente): ${error.message}`)
      } else if (code === '23514') {
        console.error(
          `${tag} insert REJECTED por CHECK constraint — schema desatualizado pro novo method (atualizar migration 0031 ou bumpar o valor enviado): ${error.message}`,
        )
      } else if (code === '42703') {
        console.error(
          `${tag} insert REJECTED por coluna ausente — migration 0031 pendente ou parcial: ${error.message}`,
        )
      } else {
        console.warn(`${tag} insert failed (code=${code || 'unknown'}): ${error.message}`)
      }
    }
  } catch (err) {
    console.warn(
      `[report_generations] insert threw (${entry.method}, ${entry.reading_id}): ` +
        (err instanceof Error ? err.message : 'unknown'),
    )
  }
}
