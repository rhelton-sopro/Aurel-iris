/**
 * Tendency engine interface contract (D-PR3, RESEARCH.md §Tendency mapping placeholder).
 *
 * Phase 7.4 ships with hand-crafted placeholder at `./placeholder.ts`.
 * Phase 7.5 replaces with rules-based engine at `./engine.ts`.
 *
 * Both files MUST export `mapVisionFeaturesToTendencies(features): Tendency[]`
 * with the EXACT same signature. The barrel `./index.ts` re-exports — only the
 * import target inside index.ts changes between 7.4 and 7.5.
 *
 * NO `'server-only'` here — types-only module is consumable by client code that
 * needs Tendency shape (e.g., test fixtures).
 *
 * Phase 7.4 | Plan 07.4-00 | Decisions: D-PR3
 */
import type { SystemId } from '@/lib/anthropic/report-schema'

export interface Tendency {
  system_id: SystemId
  system_name: string
  tendency_grade: 1 | 2 | 3 | 4 | 5
  rationale: string
  evidence: Array<{
    feature_path: string
    contribution: number
  }>
}

export interface TendencyEngine {
  mapVisionFeaturesToTendencies(
    features: unknown, // IrisFeaturesForRag — imported by consumers, not here, to keep types module dep-free
  ): Tendency[]
}
