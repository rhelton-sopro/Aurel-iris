/**
 * Shared types for Phase 7.4 V2 analyze/audit/diff pipeline.
 *
 * Separate from server-only files because:
 * - `'use server'` files may only export async functions (MEMORY rule);
 * - Client components need AuditV2Result type to render VocabularyAuditBanner;
 * - ReportV2EditDiff type is consumed by both server action and (eventually) Phase 10 telemetry.
 *
 * Phase 7.4 | Plan 07.4-03 | Decisões: D-SCH3, D-VOC3, D-TEL2
 */

export interface AuditV2Hit {
  /** Dot-path identifier (e.g., 'executive_summary' or 'systems_with_tendency.linfatico.clinical_description'). */
  field: string
  term: string
  count: number
}

export interface AuditV2Result {
  iridological_jargon: AuditV2Hit[]
  sopro_vocab: AuditV2Hit[]
  forbidden_vocab: AuditV2Hit[]
  json_validation_passed: boolean
  retry_count: number
  audited_at: string // ISO timestamp
}

export type EditDiffType = 'none' | 'adicionado' | 'removido' | 'corrigido' | 'reescrito'

export interface ClassifiedEditV2 {
  type: EditDiffType
  diff_summary: string
  char_delta: number
  changed_pct: number
}

/**
 * D-SCH3: edit_diff keyed by system_id + 4 top-level keys.
 * Phase 10 reuses or redesigns; 7.4 starts here.
 */
export type ReportV2EditDiffKey = string // either system_id ('linfatico' etc.) or top-level key ('executive_summary' etc.)
export type ReportV2EditDiff = Record<ReportV2EditDiffKey, ClassifiedEditV2>

/**
 * D-TEL2 — structured telemetry event (NO PII).
 */
export interface IrisCodexTelemetryEvent {
  event: 'iris_codex_report_generate'
  reading_id: string
  therapist_id: string
  model_version: string
  report_version: '2.0'
  n_chunks_rag: number
  latency_ms: number
  tokens_in: number
  tokens_out: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  cost_estimate_usd: number
  systems_detected: number
  grade_distribution: Record<1 | 2 | 3 | 4 | 5, number>
  json_validation_passed: boolean
  retry_count: 0 | 1 | 2
  iridological_jargon_hits: number
  sopro_vocab_hits: number
  forbidden_vocab_hits: number
}
