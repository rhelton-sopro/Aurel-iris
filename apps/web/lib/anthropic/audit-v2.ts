// audit-vocabulary:allowlist — this file IMPLEMENTS runtime detection of jargão
// iridológico (constituição linfática etc.), vocabulário Sopro da Origem (centelha
// divina etc.), e LGPD-06 terms (diagnóstico/tratamento/cura). The terms themselves
// are loaded from `./forbidden-terms.json` (excluded from the audit-vocabulary.mjs
// CI scan paths) — NOT hard-coded here as literals. The allowlist marker covers
// legitimate prose mentions inside this documentation block. Runtime regex is
// compiled at module-init from the JSON contents.
//
// Phase 7.4 | Plan 07.4-03 | Decisões: D-VOC1, D-VOC3
import 'server-only'

import termsJson from './forbidden-terms.json'
import type { ReportV2 } from './report-schema'
import type { AuditV2Hit, AuditV2Result } from './types-v2'

/**
 * LGPD-correct negative-construction patterns. When a forbidden term is
 * preceded by one of these phrases in the same sentence, the usage is
 * compliant ("não um diagnóstico médico", "não substitui tratamento", etc)
 * and must NOT be counted as a hit. Mirrors `audit.ts` Phase 7 contract.
 *
 * Only LGPD set gets neg-context skip — jargão iridológico + Sopro vocab
 * have no analog "this is NOT a X" construction in pt-BR clinical prose.
 */
const NEG_CONTEXT_RE =
  /n[ãa]o\s+(um|uma|constitui|é|e|substitui|representa|significa)\s*$/iu
const NEG_LOOKBACK_CHARS = 30

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSet(termList: string[]): RegExp {
  const escaped = termList.map(escapeRegex).join('|')
  return new RegExp(`\\b(${escaped})\\b`, 'giu')
}

const IRIDOLOGICAL_JARGON_RE = buildSet(termsJson.iridological_jargon)
const SOPRO_VOCAB_RE = buildSet(termsJson.sopro_vocab)
const LGPD_RE = buildSet(termsJson.lgpd)

interface ScanContext {
  fieldPath: string
  text: string
  applyNegContextSkip: boolean
}

function scanWithRegex(ctx: ScanContext, regex: RegExp): AuditV2Hit[] {
  if (!ctx.text) return []
  // Per-call fresh regex — g-flag stateful regex leaks lastIndex across calls.
  const re = new RegExp(regex.source, regex.flags)
  const counts = new Map<string, number>()
  let m: RegExpExecArray | null
  while ((m = re.exec(ctx.text)) !== null) {
    if (ctx.applyNegContextSkip) {
      const lookbackStart = Math.max(0, m.index - NEG_LOOKBACK_CHARS)
      const preceding = ctx.text.slice(lookbackStart, m.index)
      if (NEG_CONTEXT_RE.test(preceding)) continue
    }
    const term = m[0]!.toLowerCase()
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([term, count]) => ({
    field: ctx.fieldPath,
    term,
    count,
  }))
}

/**
 * MEMORY rule: safeArray() before iterating jsonb fields — the input here is
 * `unknown` shape at runtime (post-JSON.parse from Anthropic stream); zod
 * `safeParse` already validated, but defense-in-depth against future schema
 * drift avoids `??` not catching wrong-type drift.
 */
function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

interface ScanFn {
  (ctx: ScanContext): void
}

/**
 * D-VOC3 runtime audit. Scans every string field across 3 pattern sets.
 *
 * Result is persisted in audit_metadata after generation; banner rendered when non-empty.
 * Save action treats as non-blocking; deliver action hard-gates on zero hits.
 *
 * @param report parsed ReportV2 (post-zod-validation)
 * @param meta `{ json_validation_passed, retry_count }` from analyze-v2 outer scope
 */
export function runAuditV2(
  report: ReportV2,
  meta: { json_validation_passed: boolean; retry_count: 0 | 1 | 2 },
): AuditV2Result {
  const jargon: AuditV2Hit[] = []
  const sopro: AuditV2Hit[] = []
  const lgpd: AuditV2Hit[] = []

  const scanAll: ScanFn = (ctx) => {
    jargon.push(...scanWithRegex({ ...ctx, applyNegContextSkip: false }, IRIDOLOGICAL_JARGON_RE))
    sopro.push(...scanWithRegex({ ...ctx, applyNegContextSkip: false }, SOPRO_VOCAB_RE))
    lgpd.push(...scanWithRegex({ ...ctx, applyNegContextSkip: true }, LGPD_RE))
  }

  // Top-level string fields
  const topLevel: Array<[string, string | null | undefined]> = [
    ['executive_summary', report.executive_summary],
    ['constitutional_pattern.description', report.constitutional_pattern?.description],
    ['therapeutic_synthesis', report.therapeutic_synthesis],
    ['clinical_note', report.clinical_note],
    ['bilateral_findings.description', report.bilateral_findings?.description],
  ]

  for (const [path, text] of topLevel) {
    if (!text) continue
    scanAll({ fieldPath: path, text, applyNegContextSkip: false })
  }

  // key_traits array
  for (const trait of safeArray<unknown>(report.constitutional_pattern?.key_traits)) {
    if (typeof trait !== 'string') continue
    scanAll({ fieldPath: 'constitutional_pattern.key_traits', text: trait, applyNegContextSkip: false })
  }

  // Per-system string fields
  for (const sys of safeArray<ReportV2['systems_with_tendency'][number]>(report.systems_with_tendency)) {
    const sid = sys.system_id
    const fields: Array<[string, string | undefined]> = [
      [`systems_with_tendency.${sid}.clinical_description`, sys.clinical_description],
      [`systems_with_tendency.${sid}.therapeutic_direction`, sys.therapeutic_direction],
    ]
    for (const [path, text] of fields) {
      if (!text) continue
      scanAll({ fieldPath: path, text, applyNegContextSkip: false })
    }
    for (const item of safeArray<unknown>(sys.associated_manifestations)) {
      if (typeof item !== 'string') continue
      scanAll({
        fieldPath: `systems_with_tendency.${sid}.associated_manifestations`,
        text: item,
        applyNegContextSkip: false,
      })
    }
    for (const item of safeArray<unknown>(sys.investigation_points)) {
      if (typeof item !== 'string') continue
      scanAll({
        fieldPath: `systems_with_tendency.${sid}.investigation_points`,
        text: item,
        applyNegContextSkip: false,
      })
    }
  }

  // integrative_axes
  for (const axis of safeArray<ReportV2['integrative_axes'][number]>(report.integrative_axes)) {
    if (!axis?.description) continue
    scanAll({
      fieldPath: `integrative_axes.${axis.axis_name}.description`,
      text: axis.description,
      applyNegContextSkip: false,
    })
  }

  // priority_focus array
  for (const item of safeArray<unknown>(report.priority_focus)) {
    if (typeof item !== 'string') continue
    scanAll({ fieldPath: 'priority_focus', text: item, applyNegContextSkip: false })
  }

  return {
    iridological_jargon: jargon,
    sopro_vocab: sopro,
    forbidden_vocab: lgpd,
    json_validation_passed: meta.json_validation_passed,
    retry_count: meta.retry_count,
    audited_at: new Date().toISOString(),
  }
}
