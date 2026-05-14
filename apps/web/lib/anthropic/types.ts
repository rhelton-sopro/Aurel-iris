// audit-vocabulary:allowlist — este arquivo carrega ENCERRAMENTO_LITERAL,
// cópia byte-exact da LGPD copy obrigatória SPEC §6 linhas 624-627 (negação
// explícita de status diagnóstico). É a ÚNICA superfície em código TS onde a
// presença das 3 palavras restritas é justificada e auditada por humano.
// Marker honrado por apps/web/scripts/audit-vocabulary.mjs (file-level skip).
/**
 * Shared types for Phase 7 — Análise LLM.
 *
 * Canonical shapes (Phase 7.4 Plan 17 — UAT-3 restructure §2.5 + 15 sections):
 *   - ReportSectionKey: 16-key union (15 numbered including '2_5_...' + encerramento_disclaimer)
 *   - ReportJsonb: Partial<Record<ReportSectionKey, string>> — incremental persistence (D-S2)
 *   - AuditMetadata: D-A3 shape (anchor rate + forbidden vocab + timestamps)
 *   - EditTipo: D-U2 classifier output
 *   - RegenerationLogEntry: D-S4 telemetry per regeneration
 *   - ENCERRAMENTO_LITERAL: SPEC §6 disclaimer literal — server-appended (D-P3)
 *   - REPORT_SECTIONS: D-PR2 RAG-slug array — remapped for the 15-section structure
 *   - NUMBERED_SECTION_HEADINGS: ordered string heading numbers for parser monotonicity
 *
 * Plan 11 (Direction Correction) remapped 13→14 sections; Plan 17 (UAT-3
 * restructure) extended to 15 by inserting §2.5 — Sistemas em Bom Funcionamento
 * between §2 — Mapa Orgânico and §3 — Linha do Tempo Emocional. Decimal
 * heading numbers (only '2.5' currently) require string-keyed lookup + ordered
 * array monotonicity instead of numeric `lastNumber + 1`.
 *
 * LGPD: este arquivo declara apenas estrutura. Sem vocabulário proibido em
 * código — `pnpm audit:vocabulary` cobre `lib/anthropic/` desde 07-02 (D-A4).
 *
 * Phase 7 | Plan 07.4-17 | Decisions: DC-1, DC-3 + UAT-3 §2.5 insertion
 */
import type { Database } from '@/types/database'
import type { ReportSection } from '@/lib/rag/types'

export type ReportSectionKey =
  | '1_constituicao_temperamento'
  | '2_mapa_organico'
  | '2_5_sistemas_funcionando_bem'
  | '3_linha_tempo_emocional'
  | '4_padroes_emocionais_ativos'
  | '5_eixo_psicossomatico'
  | '6_herancas_transgeracionais'
  | '7_carencias_funcionais'
  | '8_estado_mental_nervoso'
  | '9_recursos_forcas'
  | '10_dimensao_arquetipica'
  | '11_sugestoes_integrativas'
  | '12_roteiro_anamnese'
  | '13_sintese_integrativa'
  | '14_mensagem_cliente'
  | 'encerramento_disclaimer'

/** Numeric-prefixed keys only (1..14 plus '2.5'). Used by section-boundary parser. */
export type NumberedSectionKey = Exclude<ReportSectionKey, 'encerramento_disclaimer'>

/**
 * Ordered heading-number strings for the 15 numbered sections, in canonical
 * emission order. Source of truth for parser monotonicity (`indexOf(headingStr)`
 * must equal `lastIndex + 1`) and for UI counters (length = 15).
 *
 * Plan 17 (UAT-3): inserted '2.5' between '2' and '3' for §2.5 — Sistemas em
 * Bom Funcionamento.
 */
export const NUMBERED_SECTION_HEADINGS = [
  '1',
  '2',
  '2.5',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
] as const

export type NumberedSectionHeading = (typeof NUMBERED_SECTION_HEADINGS)[number]

/**
 * Map heading-number string ('1', '2', '2.5', '3', ..., '14') to canonical
 * section key. Plan 17 (UAT-3): re-keyed from numeric to string so '2.5'
 * round-trips through the parser without lossy numeric conversion.
 */
export const SECTION_KEY_BY_NUMBER: Record<NumberedSectionHeading, NumberedSectionKey> = {
  '1': '1_constituicao_temperamento',
  '2': '2_mapa_organico',
  '2.5': '2_5_sistemas_funcionando_bem',
  '3': '3_linha_tempo_emocional',
  '4': '4_padroes_emocionais_ativos',
  '5': '5_eixo_psicossomatico',
  '6': '6_herancas_transgeracionais',
  '7': '7_carencias_funcionais',
  '8': '8_estado_mental_nervoso',
  '9': '9_recursos_forcas',
  '10': '10_dimensao_arquetipica',
  '11': '11_sugestoes_integrativas',
  '12': '12_roteiro_anamnese',
  '13': '13_sintese_integrativa',
  '14': '14_mensagem_cliente',
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
 * Sections that originally required `[ancorado em: features.X]` citations (D-A1
 * from Phase 7 original). Plan 11 (Direction Correction DC-4) removes the
 * inline-anchor requirement from the new prompt — the new 14-section direction
 * banned `[ancorado em features.x]` markers from the primary surface. This
 * constant is retained as a structural placeholder so downstream consumers
 * (audit.ts) keep their iteration shape, but `runAudit` now hard-codes
 * `low_anchor_rate=false` + `anchor_rate_pct=100` deterministically for the
 * new keys (no markers to count). Forbidden-vocab scan continues full force.
 *
 * Mapping rationale: sections 2-6 in the new numbering are the "physical body
 * + emotional axes" group that originally carried anchored clinical findings.
 */
export const SECTIONS_REQUIRING_ANCHORS: ReportSectionKey[] = [
  '2_mapa_organico',
  '3_linha_tempo_emocional',
  '4_padroes_emocionais_ativos',
  '5_eixo_psicossomatico',
  '6_herancas_transgeracionais',
]

/**
 * D-PR2 RAG-slug contract — analyze.ts passes this array to
 * retrieveRelevantKnowledge. Plan 11 remaps the 13→14 section structure to the
 * canonical RAG slugs in `lib/rag/types.ts`. Slugs that no longer correspond
 * to a numbered section (anamnese, síntese, mensagem ao cliente) are omitted
 * from the RAG fetch — those sections derive from sections 1-10 and the
 * brand voice rules, not from external chunks.
 *
 * Mudanças aqui forçam edit coordenado em `lib/rag/section-queries.ts` (CI
 * gate test em 07-07 garante sincronia).
 */
export const REPORT_SECTIONS: ReportSection[] = [
  'constituicao',
  'psicoemocional',
  'transgeracional',
  'simbolico',
  'mental_cognitivo',
  'nutricao_carencias',
  'mensagem_final',
  // Plan 07.4-14 (UAT-2): adds Cronorichio + biographical iris-map retrieval
  // for §3 Linha do Tempo Emocional. Founder UAT-2 reported §3 producing
  // Forer/Barnum-style generic age-range narratives; this concern injects
  // biographical-mapping chunks (Lo Rito Cronorichio, Jensen biographical,
  // Brazilian biographical map) so the LLM has scaffolding to anchor age
  // markers per sector. See lib/rag/section-queries.ts SECTION_QUERY_TEMPLATES
  // for the 4 queries; deferred-items D-DEF-14-01 tracks the corpus gap risk.
  'biografia_temporal',
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
 * Per-photo iris color extracted by Sonnet 4.6 in the same canonical bbox call
 * (zero extra Anthropic cost — same image upload, ~50 additional output tokens).
 * Phase 07.1.6 UAT item 2 — Sonnet is already looking at the iris for bbox,
 * so we get color naming at no marginal cost. Aggregated per-eye in the
 * orchestrator (see `IrisColorBlock` in vision_features schema).
 */
export interface IrisColorPerPhoto {
  /** Iridological category: 'castanho' | 'azul' | 'verde' | 'misto' | 'cinza' | 'avela'. Null = Sonnet couldn't determine. */
  primary: string | null
  /** Optional secondary color when iris shows clear two-tone (e.g. brown center + green edge). */
  secondary: string | null
  /** Iridological pigment names (e.g. 'pigmento_amarelo', 'pigmento_marrom', 'pigmento_psicológico'). */
  dominant_pigments: string[]
  /** True when central iris (around pupil) is distinctly different color from periphery. */
  central_heterochromia: boolean
  /** 0.0-1.0 Sonnet self-reported certainty in the color naming. */
  confidence: number
}

/**
 * Per-image canonical pipeline status.
 * - 'ok'       → canonical_storage_path populated, Modal receives canonical URL
 * - 'fallback' → bbox failed sanity gate (D-02), Modal receives original URL
 * - 'disabled' → CANONICAL_CAPTURE_ENABLED=false at finalize time (D-04 kill-switch)
 */
export type CanonicalStatus = 'ok' | 'fallback' | 'disabled'

/**
 * Per-photo gate diagnostic stored em canonical_metadata.gate_diagnostics[].
 * Surfaced for empirical threshold tuning (founder queries Supabase Studio
 * para entender por que cada foto caiu pra fallback). Structural-only shape;
 * `GateFailReason` enum vive em lib/canonicalize/sanity (não importado aqui
 * pra evitar circular dep — typed as string[] no jsonb).
 */
export interface CanonicalGateDiagnostic {
  eye: string
  angle: string
  bbox: IrisBbox
  status: CanonicalStatus
  /** Empty when status='ok'. Subset of 'invalid' | 'geom_center_x' | 'geom_center_y' | 'geom_radius' | 'cross_angle_x' | 'cross_angle_y'. */
  fail_reasons: string[]
  /** Peer set size for cross-angle median (other angles of same eye). */
  peer_count: number
  median_x_pct: number | null
  median_y_pct: number | null
  delta_x_pct: number | null
  delta_y_pct: number | null
  /** Snapshot of thresholds at evaluation time (so post-hoc analysis is grounded). */
  thresholds: {
    geom_center_min: number
    geom_center_max: number
    geom_radius_min: number
    geom_radius_max: number
    cross_angle_outlier: number
  }
}

/**
 * Per-eye aggregated iris color (matches vision_features.{eye}.iris_color
 * shape consumed by FeaturesDisplay.tsx + analyze.ts report prompt).
 * `dominant_pigments` is additive vs the legacy Modal shape — readers that
 * don't know about it just ignore it.
 */
export interface IrisColorAggregate {
  primary: string | null
  secondary: string | null
  central_heterochromia: boolean | null
  dominant_pigments: string[]
  /** Average Sonnet confidence across the 3 angles aggregated. */
  confidence: number
}

/** Aggregate canonical metadata stored in readings.canonical_metadata (jsonb). */
export interface CanonicalMetadata {
  sonnet_input_tokens: number
  sonnet_output_tokens: number
  cost_usd: number
  /** Counts per status — sum should equal 6 for full readings */
  status_summary: Record<CanonicalStatus, number>
  /** ISO timestamp when canonicalize finished */
  canonicalized_at: string
  /**
   * Per-photo diagnostic trail (Phase 07.1.6 UAT — surfaced after item 1
   * showed 5/6 fallback for the first real reading). Optional para preservar
   * backward-compat com readings canonicalizadas antes do diagnostic patch.
   */
  gate_diagnostics?: CanonicalGateDiagnostic[]
  /**
   * Per-eye iris color extracted by Sonnet in the bbox call (zero extra cost).
   * Source of truth for iris color (Modal's color analysis is unreliable for
   * iridological categories). Also mirrored into vision_features.{eye}.iris_color
   * via an additive UPDATE so the report prompt (analyze.ts) reads it from
   * the existing slot. Phase 07.1.6 UAT item 2.
   */
  iris_color_by_eye?: {
    left: IrisColorAggregate | null
    right: IrisColorAggregate | null
  }
}

/** Re-export keeps Database type alive — cross-reference for `readings` Row shape. */
export type _DatabaseImported = Database
