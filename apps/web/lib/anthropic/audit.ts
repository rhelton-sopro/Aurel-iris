// audit-vocabulary:allowlist — este arquivo IMPLEMENTA o detector LGPD
// (FORBIDDEN_VOCAB_RE + NEG_CONTEXT_RE) e cita os 3 termos restritos em
// COMENTÁRIOS DE DOCUMENTAÇÃO ao explicar a heurística de skip negativo
// ("não um diagnóstico médico", "não substitui tratamento", etc — exemplos
// de construções LGPD-corretas que o regex deliberadamente ignora). O CÓDIGO
// em si permanece limpo: os termos só aparecem montados via array-join em
// _F1/_F2/_F3 (Pitfall 7 + W6). Meta-invariante runtime em audit.test.ts
// (linhas 386-409) faz o gate strip-comments e prova absence-in-code. Marker
// file-level honra a mesma escapatória usada por types.ts (07-03) e
// /app/admin/ (07.1-03 calibration tooling — commit 18592c4).
/**
 * Audit module — anchor rate (D-A1) + LGPD forbidden vocab (D-A2).
 *
 * - `runAudit(report)` produces D-A3 AuditMetadata jsonb.
 * - `extractForbiddenHits(text, section)` is reused by Server Action
 *   `saveReportDelivered` for defense-in-depth on save (D-A2 hard block).
 *
 * SOURCE-CLEANLINESS CONSTRAINT (Pitfall 7 + audit-vocabulary self-match
 * avoidance): the three forbidden vocabulary terms NEVER appear as literal
 * substrings in this source file's CODE. They are assembled via array-join
 * into the RegExp constructor. A meta-invariant test in audit.test.ts asserts
 * this cleanliness by reading the source and checking absence outside comments.
 * The allowlist marker above covers legitimate comment mentions in the LGPD
 * negative-skip documentation (added 2026-05-09 dogfooding C2 fix).
 *
 * Word-boundary parity (Pitfall 7 / W6): word-boundary regex `\b...\b` mirrors
 * the file-scan audit (`audit-vocabulary.mjs` is intentionally substring per
 * Fase 6 scope; the new code converges on word-boundary). Innocuous Portuguese
 * compound words that contain a forbidden term as substring MUST NOT match;
 * the standalone forbidden terms MUST match — Unicode flag `u` enables proper
 * word-boundary at accented characters. See audit.test.ts for runtime fixtures
 * proving both directions of this contract.
 *
 * Phase 7 | Plan 07-05 | Decisions: D-A1, D-A2, D-A3, RESEARCH Pitfall 7
 */
import 'server-only'
import {
  type ReportJsonb,
  type AuditMetadata,
  SECTIONS_REQUIRING_ANCHORS,
} from './types'

// Anchor marker — accepts TWO forms Sonnet 4.6 emits in production:
//
// 1. FORMAL: `[ancorado em: features.X.Y]` or `[Ancorado em: \`feature.path\`]`.
//    First broadening (1e58a88, 2026-05-09 morning) handled the C1 dogfooding
//    case (capital A + backtick-wrapped path + optional `features.` prefix).
//
// 2. COMPACT: `[\`feature.path\`]` or `[\`x\`, \`y\`]` or `[\`rings\` — descrição]`.
//    Second broadening (this commit, 2026-05-09 night) handles the Wave A v2
//    dogfooding case where Sonnet drifted from the verbose "ancorado em:"
//    preamble to a compact backticked-path notation across §2-7. Without this,
//    anchor_rate_pct=0 in reports that ARE well-anchored (just in compact form).
//
// Detection heuristic for compact form: a `[...]` block containing at least
// one backticked identifier with feature-path shape (`identifier` or
// `identifier.sub` or `identifier.sub[N].sub`). This avoids false positives
// on `[Markdown link](url)` (no backticks) and `[outro conteúdo]` (no backticks).
// Trade-off: rare inline-code references like `[\`bash\`]` would false-positive,
// but iridological prose is unlikely to contain stray inline-code brackets.
//
// Flags:
//   - `i` flag: case-insensitive ('Ancorado', 'ANCORADO', 'ancorado')
//   - `u` flag: Unicode-correct (matches SENTENCE_SPLIT_RE flag set)
//   - `g` flag: global (multi-occurrence per sentence)
const ANCHOR_RE =
  /(?:\[\s*ancorado em\s*:[^\]]+\])|(?:\[[^\]]*`[a-z_]\w*(?:\.[a-z_]\w*|\[\d+\])*`[^\]]*\])/giu

// Forbidden vocab terms — assembled via concat from character arrays so
// the literal substrings never appear in this source file. See banner above
// for the full rationale.
const _F1 = ['d', 'i', 'a', 'g', 'n', 'ó', 's', 't', 'i', 'c', 'o'].join('')
const _F2 = ['t', 'r', 'a', 't', 'a', 'm', 'e', 'n', 't', 'o'].join('')
const _F3 = ['c', 'u', 'r', 'a'].join('')

/**
 * Runtime-built regex for the 3 forbidden vocabulary terms.
 * Flags: `g` (global, multi-occurrence), `i` (case-insensitive),
 * `u` (Unicode for accented word-boundary correctness).
 */
export const FORBIDDEN_VOCAB_RE = new RegExp(`\\b(${_F1}|${_F2}|${_F3})\\b`, 'giu')

/**
 * LGPD-correct negative-construction patterns. When a forbidden term is
 * preceded by one of these phrases in the same sentence, the usage is
 * compliant ("não um diagnóstico médico", "não substitui tratamento", etc)
 * and must NOT be counted as a hit. Added 2026-05-09 after Nailli dogfooding
 * surfaced false positives on Sonnet's correct LGPD phrasing.
 *
 * Anchored at end-of-string (`$`) so we can slice the preceding window of
 * each match and test whether it ends in a negative construction. The
 * accent-tolerant `[ãa]` covers stripped-accent variants Sonnet sometimes
 * emits ("nao é"). 'é' and 'e' both included for the same reason.
 */
const NEG_CONTEXT_RE =
  /(?:n[ãa]o|nem)\s+(um|uma|constitui|constituem|é|e|substitui|representa|significa|pretende|caracteriza)\s*$/iu

const NEG_LOOKBACK_CHARS = 48

const SENTENCE_SPLIT_RE = /[.!?]+(?=\s|$)/u
const ANCHOR_THRESHOLD_PCT = 95

export interface ForbiddenHit {
  section: string
  term: string
  occurrences: number
}

/**
 * Scan a single text for forbidden vocab hits, grouped by term with
 * occurrence count. Used by `runAudit` and re-used by save-action defense
 * in depth.
 */
export function extractForbiddenHits(text: string, section: string): ForbiddenHit[] {
  if (!text) return []
  // Per-call regex instance — `g`-flag stateful regexes leak `lastIndex`
  // across calls if reused.
  const regex = new RegExp(FORBIDDEN_VOCAB_RE.source, FORBIDDEN_VOCAB_RE.flags)
  const counts = new Map<string, number>()
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    // Skip matches that follow an LGPD-correct negative construction in the
    // same phrase (e.g., "não um diagnóstico médico", "não substitui
    // tratamento"). Window of NEG_LOOKBACK_CHARS covers the longest
    // recognized phrase ("não substitui ") plus comfortable buffer.
    const lookbackStart = Math.max(0, m.index - NEG_LOOKBACK_CHARS)
    const preceding = text.slice(lookbackStart, m.index)
    if (NEG_CONTEXT_RE.test(preceding)) continue
    const term = m[0]!.toLowerCase()
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([term, occurrences]) => ({
    section,
    term,
    occurrences,
  }))
}

function countAnchoredSentences(text: string): { total: number; anchored: number } {
  if (!text) return { total: 0, anchored: 0 }
  const sentences = text
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length === 0) return { total: 0, anchored: 0 }
  const anchored = sentences.filter((s) => {
    const r = new RegExp(ANCHOR_RE.source, ANCHOR_RE.flags)
    return r.test(s)
  }).length
  return { total: sentences.length, anchored }
}

/**
 * Run anchor-rate + forbidden-vocab audit on a complete or partial
 * `report_generated` jsonb. Re-runnable on the same input (deterministic
 * except for `audited_at` timestamp).
 *
 * Phase 7.4 Plan 11 (Direction Correction DC-4) — the new 14-section Iris
 * Codex V1 prompt bans inline `[ancorado em features.x]` markers from the
 * primary surface. With nothing to scan for, anchor-rate becomes deterministic
 * across the new keys (no markers present == 0 of 0 sentences anchored == 100%
 * by the empty-section convention). However, LEGACY 1.0 markdown reports
 * generated under the Phase 7 D-A1 contract DO contain inline anchor markers,
 * so the legacy scan path is preserved when the report jsonb contains any old
 * 13-section key. For new 14-section keys, anchor-rate is deterministically
 * passing (low_anchor_rate=false, anchor_rate_pct=100, per-section=100).
 *
 * Forbidden-vocab scan continues full force in both directions.
 */
export function runAudit(report: ReportJsonb): AuditMetadata {
  // Detect whether this is a legacy 1.0 markdown report (has any of the old
  // 13-section keys) or a new 14-section report (DC-1). Mixed reports default
  // to legacy treatment for safety (anchor-rate scan applies).
  const LEGACY_KEYS = [
    '1_constituicao',
    '2_estrutural_fisica',
    '3_indicacoes_sistemicas',
    '4_toxemia',
    '5_psicoemocional',
    '6_cargas_temporais',
    '7_carencias_nutricionais',
    '8_simbolico_espiritual',
    '9_cuidados_integrativos',
    '10_potenciais_forcas',
    '11_afirmacoes_integracao',
    '12_sintese_integrativa',
    '13_mensagem_final',
  ]
  const reportKeys = Object.keys(report)
  const isLegacyShape = reportKeys.some((k) => LEGACY_KEYS.includes(k))

  const anchorPerSection: Record<string, number> = {}
  let overallPct = 100

  if (isLegacyShape) {
    // Legacy 1.0 path — preserved for already-generated reports that contain
    // inline `[ancorado em features.x]` markers per the original D-A1 contract.
    let totalSentences = 0
    let totalAnchored = 0
    const LEGACY_ANCHOR_SECTIONS = [
      '2_estrutural_fisica',
      '3_indicacoes_sistemicas',
      '4_toxemia',
      '5_psicoemocional',
      '6_cargas_temporais',
    ] as const
    for (const key of LEGACY_ANCHOR_SECTIONS) {
      const text = ((report as Record<string, unknown>)[key] ?? '') as string
      const { total, anchored } = countAnchoredSentences(text)
      const sectionNumber = key.split('_')[0]!
      anchorPerSection[sectionNumber] =
        total === 0 ? 100 : Math.round((anchored / total) * 100)
      totalSentences += total
      totalAnchored += anchored
    }
    overallPct =
      totalSentences === 0 ? 100 : Math.round((totalAnchored / totalSentences) * 100)
  } else {
    // New 14-section path (Plan 11) — no inline anchor markers required by the
    // prompt; the audit gate becomes a no-op for anchor-rate. Per-section
    // values map to the new numbering (sections 2..6) for shape compatibility
    // with the AuditBanner UI which iterates over the keys.
    for (const key of SECTIONS_REQUIRING_ANCHORS) {
      const sectionNumber = key.split('_')[0]!
      anchorPerSection[sectionNumber] = 100
    }
  }

  // Forbidden vocab scan over LLM-authored sections only.
  // `encerramento_disclaimer` is server-appended literal text (D-P3) mandated
  // by SPEC §6 lines 624-627, and the literal contains the word "diagnóstico"
  // by design ("Não constitui diagnóstico médico…"). Scanning it would always
  // trip the audit even on a perfect report. Bug surfaced 2026-05-08 dogfooding.
  const forbiddenHits: ForbiddenHit[] = []
  for (const [key, text] of Object.entries(report)) {
    if (typeof text !== 'string') continue
    if (key === 'encerramento_disclaimer') continue
    forbiddenHits.push(...extractForbiddenHits(text, key))
  }

  return {
    low_anchor_rate: overallPct < ANCHOR_THRESHOLD_PCT,
    anchor_rate_pct: overallPct,
    anchor_rate_per_section: anchorPerSection,
    forbidden_vocab: forbiddenHits,
    audited_at: new Date().toISOString(),
    auditor_version: 'v1',
  }
}
