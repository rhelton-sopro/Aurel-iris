/**
 * Family A + B query generators (D-R2). Pure functions, no I/O.
 *
 * Family A — derived from IrisFeatures (visual findings):
 *   - 1 query per constituição primária + secundária (when present)
 *   - 1 query per sector with findings.length > 0 (templated)
 *   - 1 query per active global ring/sign
 *
 * Family B — derived from reportSections × constituição (template-based, D-R2B):
 *   - section-queries.ts owns the templates (frozen v1, versioned with Fase 7)
 *
 * Phase: 06-rag-ingestao | Plan: 06-10 | Decisions: D-R2A, D-R2B
 *
 * LGPD: query strings are content WE write — must avoid the proibido vocabulary
 * listed in PROJECT.md "Restrições não-negociáveis". Audited by
 * `pnpm audit:vocabulary` (DIRS extension to scan `lib/rag/` lands in 06-12).
 */
import type { ReportSection } from './types'
import { SECTION_QUERY_TEMPLATES } from './section-queries'

/**
 * Subset of IrisFeatures fields consumed by Family A. Defined locally so
 * build-queries does not need to depend on the full vision-service schema.
 *
 * Mirrors the shape produced by `vision-service/pipeline/features.py` (Phase 5)
 * but only declares the fields used at retrieval time. The full IrisFeatures
 * object can be passed in directly — TS structural typing accepts the superset.
 */
export interface IrisFeaturesForRag {
  constitution: { primary: string; secondary?: string }
  sectors: Array<{
    hour: number
    findings: Array<{ type: string }>
  }>
  rings: Record<string, { present: boolean }>
}

/** D-R2 Family A — derived from features. */
export function buildFamilyA(features: IrisFeaturesForRag): string[] {
  const queries: string[] = []
  // 1 per constitution (skip empty primary — guards against partial features)
  if (features.constitution.primary) {
    queries.push(`constituição ${features.constitution.primary}`)
  }
  if (features.constitution.secondary) {
    queries.push(`constituição ${features.constitution.secondary}`)
  }
  // 1 per sector with findings
  for (const sec of features.sectors) {
    if (sec.findings.length > 0) {
      const types = sec.findings.map((f) => f.type).join(', ')
      queries.push(`${types} no setor ${sec.hour}`)
    }
  }
  // 1 per active global ring/sign
  for (const [name, ring] of Object.entries(features.rings)) {
    if (ring.present) {
      queries.push(`${name} presente`)
    }
  }
  return queries
}

/** D-R2 Family B — derived from reportSections × constitution. */
export function buildFamilyB(
  features: IrisFeaturesForRag,
  sections: ReportSection[],
): string[] {
  return sections.flatMap((section) => {
    const tmpl = SECTION_QUERY_TEMPLATES[section]
    return tmpl ? tmpl(features) : []
  })
}
