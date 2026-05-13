/**
 * Barrel export for tendency-engine.
 *
 * Phase 7.4: import target = './placeholder' (hand-crafted heuristics)
 * Phase 7.5: import target = './engine' (rules-based + RAG multi-school)
 *
 * Callers MUST import from '@/lib/tendency-engine' only — never './placeholder'
 * or './engine' directly. The 7.5 swap = single-line change in this file.
 *
 * Phase 7.4 | Plan 07.4-04 | Decisões: D-PR3
 */
export { mapVisionFeaturesToTendencies } from './placeholder'
//                                              ^^^^^^^^^^^ Phase 7.5 changes to './engine'
export type { Tendency, TendencyEngine } from './types'
