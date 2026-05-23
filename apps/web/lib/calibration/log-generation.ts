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
  | 'sonnet_2x_0.1.0' // v2.3.0 Caminho 1 (Etapa 1 tool use + Etapa 2 ancorada)

export interface ReportGenerationLog {
  reading_id: string
  method: ReportGenerationMethod
  latency_ms: number | null
  cost_usd: number | null
  tokens_in: number | null
  tokens_out: number | null
  model_version: string | null
  // 07.4-36 founder amendment — production analytics surface. All nullable
  // (best-effort; a missing value must never block the insert).
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
      generated_at: new Date().toISOString(),
      latency_ms: entry.latency_ms,
      cost_usd: entry.cost_usd,
      tokens_in: entry.tokens_in,
      tokens_out: entry.tokens_out,
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
      console.warn(
        `[report_generations] insert skipped (${entry.method}, ${entry.reading_id}): ${error.message} ` +
          `— harmless if migration 0017 is not applied yet`,
      )
    }
  } catch (err) {
    console.warn(
      `[report_generations] insert threw (${entry.method}, ${entry.reading_id}): ` +
        (err instanceof Error ? err.message : 'unknown'),
    )
  }
}
