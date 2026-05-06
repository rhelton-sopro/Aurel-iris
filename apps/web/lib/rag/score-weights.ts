/**
 * D-R4 score multipliers. Pure function, no I/O.
 *
 * Applied AFTER reranking (D-N2, see search.ts in 06-11). Multipliers compound:
 * a clinical_data chunk in an alta_prioridade book whose dimensoes intersect
 * the section theme → 1.5 × 1.1 × 1.2 = 1.98× the original score.
 *
 * Phase: 06-rag-ingestao | Plan: 06-10 | Decisions: D-R4
 */
import type { KnowledgeChunkRow, ReportSection } from './types'

export const WEIGHTS = {
  CLINICAL_DATA: 1.5,        // D-R4: source_type='clinical_data' (Phase 10 forward-compat)
  ALTA_PRIORIDADE: 1.1,      // D-R4: book marked alta_prioridade in manifest
  DIMENSAO_INTERSECT: 1.2,   // D-R4: metadata.dimensoes intersects section theme
} as const

/**
 * Per-section "themes" — used to test intersection with chunk metadata.dimensoes.
 *
 * Each section's theme array is a subset of the canonical `dimensoes` vocabulary
 * (vision-service/scripts/data/vocabularies.json — D-T5):
 *   ['fisica', 'psicossomatica', 'transgeracional',
 *    'constitucional', 'energetica', 'comportamental']
 *
 * `Record<ReportSection, ...>` enforces compile-time exhaustiveness — adding a
 * new ReportSection without a theme entry breaks tsc (mirrors the same pattern
 * in section-queries.ts, plan 06-02).
 *
 * NOTE on `nutricao_carencias`: added in 06-02 founder edits as the 7th
 * ReportSection (super prompt scope expansion for Fase 7). Mapped to ['fisica',
 * 'constitucional'] because (a) nutritional deficiencies present as physical
 * findings in the iris (escleras, anel anêmico, manchas) — `fisica` dimension,
 * (b) Jensen's constitutional typology directly correlates with mineral/vitamin
 * deficiency patterns (linfática → cálcio, biliar → ferro, etc.) — `constitucional`.
 */
const SECTION_THEMES: Record<ReportSection, string[]> = {
  psicoemocional: ['psicossomatica', 'comportamental'],
  transgeracional: ['transgeracional'],
  simbolico: ['energetica'],
  mental_cognitivo: ['comportamental'],
  constituicao: ['constitucional', 'fisica'],
  mensagem_final: ['constitucional'],
  nutricao_carencias: ['fisica', 'constitucional'],
}

/**
 * Apply D-R4 multipliers. Returns a new array; never mutates input.
 *
 * @param chunks                 input chunks with raw cosine scores (1 - distance)
 * @param section                the active reportSection (or null when only Family A queries)
 * @param altaPrioridadeBooks    set of source_book names marked alta_prioridade in manifest
 */
export function applyWeights(
  chunks: KnowledgeChunkRow[],
  section: ReportSection | null,
  altaPrioridadeBooks: Set<string>,
): KnowledgeChunkRow[] {
  return chunks.map((chunk) => {
    let score = chunk.score
    if (chunk.source_type === 'clinical_data') {
      score *= WEIGHTS.CLINICAL_DATA
    }
    if (altaPrioridadeBooks.has(chunk.source_book)) {
      score *= WEIGHTS.ALTA_PRIORIDADE
    }
    if (section) {
      const themes = SECTION_THEMES[section]
      const intersects = chunk.metadata.dimensoes.some((d) => themes.includes(d))
      if (intersects) {
        score *= WEIGHTS.DIMENSAO_INTERSECT
      }
    }
    return { ...chunk, score }
  })
}
