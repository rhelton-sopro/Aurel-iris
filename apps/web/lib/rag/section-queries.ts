import type { ReportSection } from './types'

/**
 * Family B query templates — versioned alongside the Fase 7 super prompt (D-R2B).
 *
 * Each template receives the iris features and returns 1-2 short search queries
 * that combine the constituição primária with the section's theme. The retrieval
 * orchestrator (`search.ts`) embeds these queries via Voyage and feeds them to
 * `match_knowledge_chunks` RPC.
 *
 * **LGPD vocabulário proibido:** these strings are content WE write — they
 * MUST avoid the proibido word list (see PROJECT.md "Restrições não-negociáveis"
 * + `apps/web/scripts/audit-vocabulary.mjs`). Audited by `pnpm audit:vocabulary`;
 * the DIRS extension to scan `lib/rag/` lands in 06-12-PLAN.
 *
 * **Frozen contract for Fase 7:** changes here require coordinated update of
 * `apps/web/prompts/system.md` (Fase 7) — see CONTEXT D-R2B.
 */

interface FeaturesShape {
  constitution: { primary: string; secondary?: string }
}

export const SECTION_QUERY_TEMPLATES: Record<
  ReportSection,
  (f: FeaturesShape) => string[]
> = {
  psicoemocional: (f) => [
    `${f.constitution.primary} dimensão psicoemocional`,
    `${f.constitution.primary} padrão emocional reprimido`,
  ],
  transgeracional: (f) => [
    `${f.constitution.primary} herança familiar transgeracional`,
  ],
  simbolico: (f) => [
    `${f.constitution.primary} simbolismo iridológico`,
  ],
  mental_cognitivo: (f) => [
    `${f.constitution.primary} dimensão mental cognitiva`,
  ],
  constituicao: (f) => [
    `caracterização da constituição ${f.constitution.primary}`,
  ],
  mensagem_final: (f) => [
    `${f.constitution.primary} orientação holística geral`,
  ],
}
