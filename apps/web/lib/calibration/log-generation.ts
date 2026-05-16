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

export type ReportGenerationMethod = 'vigente' | 'sam' | 'sonnet_direct'

export interface ReportGenerationLog {
  reading_id: string
  method: ReportGenerationMethod
  latency_ms: number | null
  cost_usd: number | null
  tokens_in: number | null
  tokens_out: number | null
  model_version: string | null
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
