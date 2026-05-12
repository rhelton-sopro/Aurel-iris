// audit-vocabulary:allowlist — este arquivo carrega ENCERRAMENTO_LITERAL,
// cópia byte-exact da LGPD copy obrigatória SPEC §6 linhas 624-627 (negação
// explícita de status diagnóstico). É a ÚNICA superfície em código TS onde a
// presença das 3 palavras restritas é justificada e auditada por humano.
// Marker honrado por apps/web/scripts/audit-vocabulary.mjs (file-level skip).
/**
 * Shared types for Phase 7 — Análise LLM.
 *
 * Canonical shapes:
 *   - ReportSectionKey: 14-key union (13 numbered + encerramento_disclaimer)
 *   - ReportJsonb: Partial<Record<ReportSectionKey, string>> — incremental persistence (D-S2)
 *   - AuditMetadata: D-A3 shape (anchor rate + forbidden vocab + timestamps)
 *   - EditTipo: D-U2 classifier output
 *   - RegenerationLogEntry: D-S4 telemetry per regeneration
 *   - ENCERRAMENTO_LITERAL: SPEC §6 disclaimer literal — server-appended (D-P3)
 *   - REPORT_SECTIONS: D-PR2 frozen contract — 7 RAG slugs analyze.ts passes
 *
 * LGPD: este arquivo declara apenas estrutura. Sem vocabulário proibido em
 * código — `pnpm audit:vocabulary` cobre `lib/anthropic/` desde 07-02 (D-A4).
 *
 * Phase 7 | Plan 07-03
 */
import type { Database } from '@/types/database'
import type { ReportSection } from '@/lib/rag/types'

export type ReportSectionKey =
  | '1_constituicao'
  | '2_estrutural_fisica'
  | '3_indicacoes_sistemicas'
  | '4_toxemia'
  | '5_psicoemocional'
  | '6_cargas_temporais'
  | '7_carencias_nutricionais'
  | '8_simbolico_espiritual'
  | '9_cuidados_integrativos'
  | '10_potenciais_forcas'
  | '11_afirmacoes_integracao'
  | '12_sintese_integrativa'
  | '13_mensagem_final'
  | 'encerramento_disclaimer'

/** Numeric-prefixed keys only (1..13). Used by section-boundary parser. */
export type NumberedSectionKey = Exclude<ReportSectionKey, 'encerramento_disclaimer'>

/** Map number 1..13 to canonical section key (boundary parser uses this). */
export const SECTION_KEY_BY_NUMBER: Record<number, NumberedSectionKey> = {
  1: '1_constituicao',
  2: '2_estrutural_fisica',
  3: '3_indicacoes_sistemicas',
  4: '4_toxemia',
  5: '5_psicoemocional',
  6: '6_cargas_temporais',
  7: '7_carencias_nutricionais',
  8: '8_simbolico_espiritual',
  9: '9_cuidados_integrativos',
  10: '10_potenciais_forcas',
  11: '11_afirmacoes_integracao',
  12: '12_sintese_integrativa',
  13: '13_mensagem_final',
}

export type ReportJsonb = Partial<Record<ReportSectionKey, string>>

export type EditTipo = 'adicionado' | 'removido' | 'corrigido' | 'reescrito' | 'none'

export interface AuditMetadata {
  low_anchor_rate: boolean
  anchor_rate_pct: number
  anchor_rate_per_section: Record<string, number>
  forbidden_vocab: Array<{ section: string; term: string; occurrences: number }>
  audited_at: string
  auditor_version: 'v1'
}

export interface RegenerationLogEntry {
  timestamp: string
  therapist_id: string
  reading_id: string
  model_version: string
  latency_ms: number
  tokens_in: number
  tokens_out: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  cost_estimate_usd: number
}

/**
 * Sections requiring [ancorado em: features.X] citations (D-A1).
 * Anchor rate audit runs over these 5 keys only.
 */
export const SECTIONS_REQUIRING_ANCHORS: ReportSectionKey[] = [
  '2_estrutural_fisica',
  '3_indicacoes_sistemicas',
  '4_toxemia',
  '5_psicoemocional',
  '6_cargas_temporais',
]

/**
 * D-PR2 frozen contract — analyze.ts passes EXACTLY this array to
 * retrieveRelevantKnowledge. Mudanças aqui forçam edit coordenado em
 * `lib/rag/section-queries.ts` (CI gate test em 07-07 garante sincronia).
 */
export const REPORT_SECTIONS: ReportSection[] = [
  'constituicao',
  'psicoemocional',
  'transgeracional',
  'simbolico',
  'mental_cognitivo',
  'nutricao_carencias',
  'mensagem_final',
]

/**
 * Encerramento literal — SPEC §6 linhas 624-627.
 * **Server-appended** após stream completar (D-P3). Garante SC4 — disclaimer
 * literal sempre presente, imune a prompt drift.
 *
 * Byte-exact com SPEC.md §6. Test em `__tests__/prompts.test.ts` valida.
 */
export const ENCERRAMENTO_LITERAL = `> Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica.
> Não constitui diagnóstico médico nem substitui avaliação clínica profissional.
> Os achados aqui descritos são hipóteses a serem investigadas pelo terapeuta
> em conjunto com o cliente, à luz de sua história de vida e contexto integral.`

export class AnthropicError extends Error {
  public readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'AnthropicError'
    this.cause = cause
  }
}

/** Iris bounding box returned by Sonnet 4.6 for canonical capture (Phase 07.1.6). */
export interface IrisBbox {
  /** 0.0-1.0 fraction of image width (post-EXIF-rotation) */
  center_x_pct: number
  /** 0.0-1.0 fraction of image height (post-EXIF-rotation) */
  center_y_pct: number
  /** fraction of min(W,H); typical valid range [0.05, 0.30] */
  radius_pct: number
  /** 0.0-1.0 Sonnet self-reported (informational only — D-02 cross-angle gate does the real work) */
  confidence: number
  /** false = Sonnet could not locate an iris in this image */
  valid: boolean
}

/**
 * Per-image canonical pipeline status.
 * - 'ok'       → canonical_storage_path populated, Modal receives canonical URL
 * - 'fallback' → bbox failed sanity gate (D-02), Modal receives original URL
 * - 'disabled' → CANONICAL_CAPTURE_ENABLED=false at finalize time (D-04 kill-switch)
 */
export type CanonicalStatus = 'ok' | 'fallback' | 'disabled'

/** Aggregate canonical metadata stored in readings.canonical_metadata (jsonb). */
export interface CanonicalMetadata {
  sonnet_input_tokens: number
  sonnet_output_tokens: number
  cost_usd: number
  /** Counts per status — sum should equal 6 for full readings */
  status_summary: Record<CanonicalStatus, number>
  /** ISO timestamp when canonicalize finished */
  canonicalized_at: string
}

/** Re-export keeps Database type alive — cross-reference for `readings` Row shape. */
export type _DatabaseImported = Database
