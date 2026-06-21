// audit-vocabulary:allowlist — este arquivo carrega ENCERRAMENTO_LITERAL,
// cópia byte-exact da LGPD copy obrigatória SPEC §6 linhas 624-627 (negação
// explícita de status diagnóstico). É a ÚNICA superfície em código TS onde a
// presença das 3 palavras restritas é justificada e auditada por humano.
// Marker honrado por apps/web/scripts/audit-vocabulary.mjs (file-level skip).
/**
 * Shared types for Phase 7 — Análise LLM.
 *
 * Canonical shapes (Phase 7.4 Plan 27 — 15 sequential sections, no fractions):
 *   - ReportSectionKey: 16-key union (15 numbered '1'..'15' + encerramento_disclaimer)
 *   - ReportJsonb: Partial<Record<ReportSectionKey, string>> — incremental persistence (D-S2)
 *   - AuditMetadata: D-A3 shape (anchor rate + forbidden vocab + timestamps)
 *   - EditTipo: D-U2 classifier output
 *   - RegenerationLogEntry: D-S4 telemetry per regeneration
 *   - ENCERRAMENTO_LITERAL: SPEC §6 disclaimer literal — server-appended (D-P3)
 *   - REPORT_SECTIONS: D-PR2 RAG-slug array (slug-keyed — unaffected by renumber)
 *   - NUMBERED_SECTION_HEADINGS: ordered string heading numbers for parser monotonicity
 *
 * Plan 11 remapped 13→14; Plan 17 (UAT-3) inserted §2.5 for a 16-numbered
 * structure with a §15 gap. Plan 27 (UAT-iter-3) COLLAPSES §2.5 into §2 as
 * its second subsection (same conceptual organ-map category) and renumbers to
 * 15 strictly sequential sections — Síntese Rápida moves §16 → §15. No
 * decimal/gap headings remain; monotonicity is still ordered-array-index based.
 *
 * LGPD: este arquivo declara apenas estrutura. Sem vocabulário proibido em
 * código — `pnpm audit:vocabulary` cobre `lib/anthropic/` desde 07-02 (D-A4).
 *
 * Phase 7 | Plan 07.4-17 | Decisions: DC-1, DC-3 + UAT-3 §2.5 insertion
 */
import type { Database } from '@/types/database'
import type { ReportSection } from '@/lib/rag/types'

export type ReportSectionKey =
  | '0_em_poucas_palavras'
  | '1_constituicao_temperamento'
  | '2_mapa_organico'
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
  | '15_sintese_rapida'
  | 'essence_phrase'
  | 'encerramento_disclaimer'

/** Numeric-prefixed keys only ('1'..'15'). Used by section-boundary parser. */
export type NumberedSectionKey = Exclude<
  ReportSectionKey,
  'encerramento_disclaimer' | 'essence_phrase' | '0_em_poucas_palavras'
>

/**
 * §0 — "Em poucas palavras" microfilme (Marca 7 v2 — added in v2.5.5, made
 * a proper numbered section in v2.7.0). 6-9 linhas + Marca 7.1 maieutic
 * question. PRECEDES §1 in emission order. Parser extracts it via
 * `extractZeroSection(buffer)` — it's a numbered boundary (`## 0. ...`) but
 * kept OUT of NUMBERED_SECTION_HEADINGS to preserve §1..§15 monotonicity.
 */
export const ZERO_SECTION_KEY = '0_em_poucas_palavras' as const
export const ZERO_SECTION_TITLE = 'Em poucas palavras' as const

/**
 * Marker heading the LLM emits ONCE, AFTER §15 (07.4-35 contract), carrying
 * the "essence phrase" — a SHORT 15-30 word phrase. Plan 28 naming
 * "Em uma palavra" restored in v2.7.0 (Plan 35 "Em poucas palavras" naming
 * collided with §0 Marca 7 microfilme — split resolved by giving §0 its own
 * numbered heading + reverting essence to original name).
 * NOT a numbered boundary, so `findAllBoundaries` ignores it; only
 * `extractEssencePhrase` pulls it (post-§15 region).
 */
export const ESSENCE_PHRASE_HEADING = 'Em uma palavra'

/**
 * Ordered heading-number strings for the 15 numbered sections, in canonical
 * emission order. Source of truth for parser monotonicity (`indexOf(headingStr)`
 * must equal `lastIndex + 1`) and for UI counters (length = 15).
 *
 * Plan 27 (UAT-iter-3): §2.5 collapsed into §2 (subsection B); Síntese Rápida
 * renumbered §16 → §15. Strictly sequential 1..15 — no fractions, no gaps.
 * Counter shows {n}/15.
 */
export const NUMBERED_SECTION_HEADINGS = [
  '1',
  '2',
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
  '15',
] as const

export type NumberedSectionHeading = (typeof NUMBERED_SECTION_HEADINGS)[number]

/**
 * Ordem de EXIBIÇÃO das seções no documento entregue (web + PDF), 2026-06-09.
 * Segue o arco narrativo da devolutiva (construção de confiança: espelho →
 * história → padrão → o que pesa + perguntas → força → fecho), em vez da ordem
 * de emissão 1..15.
 *
 * IMPORTANTE: NÃO afeta o Sonnet nem o parser. O relatório continua sendo
 * GERADO e PARSEADO em NUMBERED_SECTION_HEADINGS (monotônica 1..15) — esta
 * constante só reordena a APRESENTAÇÃO. O número exibido ao leitor é a POSIÇÃO
 * neste array (renumerado 1..15), não o heading-number original. A §0 "Em
 * poucas palavras" permanece como bloco de abertura especial (sem número).
 */
export const DISPLAY_SECTION_ORDER = [
  '1',  // Constituição e Temperamento — o espelho (quem é)
  '3',  // Linha do Tempo Emocional    — a história (por idades)
  '6',  // Heranças Transgeracionais   — a história (linhagem)
  '4',  // Padrões Emocionais Ativos   — o padrão
  '5',  // Eixo Psicossomático         — o padrão no corpo
  '2',  // Mapa Orgânico               — o que pesa (clímax)
  '7',  // Carências Funcionais        — o que pesa
  '8',  // Estado Mental e Nervoso     — o que pesa
  '12', // Roteiro de Anamnese         — as perguntas (clímax, já aberto)
  '9',  // Recursos e Forças           — a força
  '10', // Dimensão Arquetípica        — o sentido
  '11', // Sugestões Integrativas      — os caminhos
  '13', // Síntese Integrativa         — o fecho
  '14', // Mensagem para o Cliente     — o fecho caloroso
  '15', // Síntese Rápida              — o cartão pra levar
] as const satisfies readonly NumberedSectionHeading[]

/**
 * Flag (chave NÃO-seção) persistida no jsonb do relatório marcando que a leitura
 * deve ser EXIBIDA na ordem narrativa da devolutiva (DISPLAY_SECTION_ORDER),
 * renumerada por posição. Gerações a partir de 2026-06-09 setam 'narrative';
 * leituras anteriores não têm a chave → exibidas na ordem clássica de emissão
 * 1..15 (NUMBERED_SECTION_HEADINGS). NÃO-RETROATIVO por design (só as próximas).
 * É metadado — ignorado pelos loops de seção, pelo parser e pelo Sonnet.
 */
export const REPORT_DISPLAY_ORDER_KEY = '_display_order' as const
export const NARRATIVE_DISPLAY_ORDER = 'narrative' as const

/**
 * Resolve a ordem de exibição + numeração de um relatório, conforme a flag
 * REPORT_DISPLAY_ORDER_KEY: 'narrative' → arco da devolutiva, renumerado por
 * posição; ausente/legacy → ordem de emissão 1..15 com o número original.
 * Usado pelo render web (ReportReadView) e pelo PDF para ficarem idênticos.
 */
export function resolveDisplayOrder(
  sections: Record<string, string | undefined>,
): { headings: readonly NumberedSectionHeading[]; renumber: boolean } {
  const narrative = sections[REPORT_DISPLAY_ORDER_KEY] === NARRATIVE_DISPLAY_ORDER
  return narrative
    ? { headings: DISPLAY_SECTION_ORDER, renumber: true }
    : { headings: NUMBERED_SECTION_HEADINGS, renumber: false }
}

/**
 * Display title for each numbered section, keyed by heading-number string.
 * Single source of truth — consumed by AnalysisStream (streaming progress UI),
 * EditorAccordion (editor surface), and ReportReadView (reading-mode flowing
 * document). Plan 18 extracted this from the previous 3-place duplication.
 */
export const SECTION_TITLE_BY_NUMBER: Record<NumberedSectionHeading, string> = {
  '1': 'Constituição e Temperamento',
  '2': 'Mapa Orgânico',
  '3': 'Linha do Tempo Emocional',
  '4': 'Padrões Emocionais Ativos',
  '5': 'Eixo Psicossomático',
  '6': 'Heranças Transgeracionais',
  '7': 'Repertório de Suporte',
  '8': 'Estado Mental e Nervoso',
  '9': 'Recursos e Forças',
  '10': 'Dimensão Arquetípica',
  '11': 'Sugestões Integrativas',
  '12': 'Roteiro de Anamnese',
  '13': 'Síntese Integrativa',
  '14': 'Mensagem para o Cliente',
  '15': 'Síntese Rápida',
}

/**
 * Display title for a section, with the §14 personalization (Plan 7.4-28
 * iter-5 FIX 1): the "Mensagem para o Cliente" letter is rendered as
 * "Para {first name}" so it reads as addressed to this specific person.
 * The internal key + the LLM-emitted `## 14. Mensagem para o Cliente`
 * heading are UNCHANGED (the parser maps by number, not title) — this is a
 * render-time override only. Empty/blank clientName → canonical title.
 *
 * Used by every surface that shows a §14 heading or TOC entry (PDF heading +
 * Índice, web ReportReadView heading + Índice) so they stay consistent.
 */
export function sectionDisplayTitle(
  headingStr: NumberedSectionHeading,
  clientName?: string | null,
): string {
  if (headingStr === '14') {
    const first = (clientName ?? '').trim().split(/\s+/)[0] ?? ''
    if (first.length > 0) return `Para ${first}`
  }
  return SECTION_TITLE_BY_NUMBER[headingStr]
}

/**
 * Map heading-number string ('1'..'15') to canonical section key.
 * Plan 27: strictly sequential; §15 = Síntese Rápida (was §16).
 */
export const SECTION_KEY_BY_NUMBER: Record<NumberedSectionHeading, NumberedSectionKey> = {
  '1': '1_constituicao_temperamento',
  '2': '2_mapa_organico',
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
  '15': '15_sintese_rapida',
}

/** Chave do bloco de abertura §0 ("Em poucas palavras") — não está em NUMBERED_SECTION_HEADINGS. */
export const SECTION_ZERO_KEY = '0_em_poucas_palavras' as const

/**
 * "Versão do cliente" (2026-06-21): reduz o jsonb do relatório ao subconjunto de
 * seções escolhido globalmente pelo founder (app_settings → client_report_sections).
 * `allowedHeadings` são heading-numbers internos ('0' + '1'..'15').
 *
 * Mantém SEMPRE o disclaimer LGPD (`encerramento_disclaimer`) e a flag
 * `_display_order`, para que renderBodyHtml/ReportReadView reordenem no arco
 * narrativo e RENUMEREM por posição (1..N, sem buracos). As seções não
 * escolhidas simplesmente não entram no dicionário — o render já filtra por
 * presença, então a numeração do cliente sai contínua. `essence_phrase` (peça
 * legada, hoje não emitida) só passa se presente E selecionável — como não está
 * em ALL_CLIENT_SELECTABLE_HEADINGS, fica naturalmente de fora.
 */
export function filterSectionsForClient(
  sections: Record<string, string>,
  allowedHeadings: readonly string[],
): Record<string, string> {
  const allowed = new Set(allowedHeadings)
  const out: Record<string, string> = {}
  const flag = sections[REPORT_DISPLAY_ORDER_KEY]
  if (flag) out[REPORT_DISPLAY_ORDER_KEY] = flag
  const disclaimer = sections['encerramento_disclaimer']
  if (disclaimer) out['encerramento_disclaimer'] = disclaimer
  if (allowed.has('0') && sections[SECTION_ZERO_KEY]) {
    out[SECTION_ZERO_KEY] = sections[SECTION_ZERO_KEY]
  }
  for (const h of NUMBERED_SECTION_HEADINGS) {
    if (!allowed.has(h)) continue
    const key = SECTION_KEY_BY_NUMBER[h]
    const v = sections[key]
    if (v) out[key] = v
  }
  return out
}

export type ReportJsonb = Partial<Record<ReportSectionKey, string>>

export type EditTipo = 'adicionado' | 'removido' | 'corrigido' | 'reescrito' | 'none'

/**
 * Completude do relatório (gate de ciclo de vida da foto — 2026-06-03).
 * Confere a presença das seções OBRIGATÓRIAS antes de o sistema apagar a
 * foto da íris para sempre. Como o "regenerar" do terapeuta foi removido,
 * não há segunda chance: a foto só é deletada na geração quando complete=true.
 * Incompleto → foto retida + leitura aparece em /admin/regenerar com `missing`
 * listado (é o "audit relata o que faltou" pedido pelo founder).
 */
export interface SectionCompleteness {
  /** true só quando TODAS as chaves obrigatórias estão presentes e não-vazias. */
  complete: boolean
  /** chaves obrigatórias presentes (não-vazias). */
  present: string[]
  /** chaves obrigatórias ausentes ou vazias — o que faltou. */
  missing: string[]
  required_count: number
  present_count: number
}

export interface AuditMetadata {
  low_anchor_rate: boolean
  anchor_rate_pct: number
  anchor_rate_per_section: Record<string, number>
  forbidden_vocab: Array<{ section: string; term: string; occurrences: number }>
  /**
   * Dosagem detectada em §7 (Carências Funcionais) — adição v2.4.4 (CFM).
   * Prescrição com dose é ato privativo de médico no Brasil. Bullets como
   * "magnésio glicinato (300-400 mg/dia)" violam o prompt §7 e viram peça
   * de prova em ação judicial. Cada match traz a substring exata pra
   * facilitar reescrita manual.
   */
  dosage_hits: Array<{ section: string; match: string }>
  /**
   * Completude das seções (auditor v2). Presente em relatórios gerados a
   * partir de 2026-06-03. Relatórios anteriores não têm este campo.
   */
  section_completeness: SectionCompleteness
  audited_at: string
  auditor_version: 'v1' | 'v2'
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
   * Wall-clock latency of the canonicalization batch (the 6 parallel
   * Sonnet-bbox calls + crop/upload), milliseconds. 07.4-36: surfaced into
   * `report_generations.bbox_latency_ms` so total per-reading generation time
   * = report latency + this. Optional — readings canonicalized before this
   * patch won't carry it.
   */
  bbox_latency_ms?: number
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
