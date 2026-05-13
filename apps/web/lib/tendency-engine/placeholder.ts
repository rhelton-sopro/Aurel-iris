/**
 * Phase 7.4 tendency-engine PLACEHOLDER.
 *
 * Hand-crafted heuristic rules — 1-2 per system, ~6-8 systems. Each rule
 * preceded by `// TODO Phase 7.5 — replace with real engine` so Phase 7.5
 * can grep + replace.
 *
 * Goal: SENSIBLE tendencies for founder dogfooding. SC-10 UAT acceptance is
 * "report reads as functional/clinical, not as iridological article" — the
 * placeholder feeds the prompt enough structured data; Sonnet does the rest.
 *
 * Swap pattern: Phase 7.5 creates `./engine.ts` with the EXACT same signature;
 * the barrel `./index.ts` switches the import target. NO caller imports
 * `./placeholder` or `./engine` directly.
 *
 * Phase 7.4 | Plan 07.4-04 | Decisões: D-PR3
 */
import 'server-only'

import type { SystemId } from '@/lib/anthropic/report-schema'
import type { IrisFeaturesForRag } from '@/lib/rag/build-queries'

import type { Tendency } from './types'

const SYSTEM_NAMES: Record<SystemId, string> = {
  linfatico: 'Sistema linfático',
  hepatico_biliar: 'Sistema hepático-biliar',
  renal: 'Sistema renal',
  digestivo: 'Sistema digestivo',
  nervoso_autonomo: 'Sistema nervoso autônomo',
  cardiovascular: 'Sistema cardiovascular',
  endocrino: 'Sistema endócrino',
  imune: 'Sistema imune',
  respiratorio: 'Sistema respiratório',
  musculoesqueletico: 'Sistema musculoesquelético',
  pele_tegumento: 'Pele e tegumento',
  reprodutor: 'Sistema reprodutor',
}

/**
 * Coerce an unknown value to an array before iterating.
 * Mirrors MEMORY rule `feedback_safearray_jsonb_drift` — `vision_features`
 * arrives as parsed jsonb and may drift to object/null in real data.
 */
function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function ring(features: IrisFeaturesForRag, name: string): boolean {
  const r = features.rings?.[name]
  return r != null && r.present === true
}

function sectorHasFinding(
  features: IrisFeaturesForRag,
  hour: number,
  types: string[],
): boolean {
  const sectors = safeArray<{ hour: number; findings?: Array<{ type: string }> }>(
    features.sectors,
  )
  return sectors.some(
    (s) =>
      s.hour === hour &&
      safeArray<{ type: string }>(s.findings).some((f) => types.includes(f.type)),
  )
}

function constitutionMatches(features: IrisFeaturesForRag, term: string): boolean {
  const c = features.constitution
  if (!c) return false
  const primary = (c.primary ?? '').toLowerCase()
  const secondary = (c.secondary ?? '').toLowerCase()
  const needle = term.toLowerCase()
  return primary.includes(needle) || secondary.includes(needle)
}

function pushTendency(
  out: Tendency[],
  system_id: SystemId,
  grade: 1 | 2 | 3 | 4 | 5,
  rationale: string,
  evidence: Tendency['evidence'],
): void {
  const existing = out.find((t) => t.system_id === system_id)
  if (existing) {
    if (grade > existing.tendency_grade) existing.tendency_grade = grade
    existing.evidence.push(...evidence)
    existing.rationale = `${existing.rationale}; ${rationale}`
    return
  }
  out.push({
    system_id,
    system_name: SYSTEM_NAMES[system_id],
    tendency_grade: grade,
    rationale,
    evidence,
  })
}

/**
 * Pure function — translates Modal vision-pipeline output into a `Tendency[]`
 * that `analyze-v2.ts` feeds into the `<tendencies>` block of the Sonnet
 * prompt (D-PR2). Phase 7.5 will replace this with a rules-based engine that
 * consumes a multi-school RAG corpus; signature must remain identical so the
 * barrel swap stays a one-line change.
 *
 * D-PR3 contract: no I/O, no DB calls, no network. Every rule body contains
 * the literal marker `TODO Phase 7.5` for grep-based discovery by 7.5.
 */
export function mapVisionFeaturesToTendencies(
  features: IrisFeaturesForRag,
): Tendency[] {
  const out: Tendency[] = []

  // === linfatico ===
  // TODO Phase 7.5 — replace with real engine
  if (ring(features, 'lymph_rosary') || ring(features, 'linfatica_rosary')) {
    pushTendency(out, 'linfatico', 4, 'Rosary linfático presente', [
      { feature_path: 'rings.lymph_rosary', contribution: 0.8 },
    ])
  }
  // TODO Phase 7.5 — replace with real engine
  if (
    constitutionMatches(features, 'linfática') ||
    constitutionMatches(features, 'linfatica')
  ) {
    pushTendency(out, 'linfatico', 3, 'Padrão constitucional linfático', [
      { feature_path: 'constitution.primary', contribution: 0.6 },
    ])
  }

  // === hepatico_biliar ===
  // TODO Phase 7.5 — replace with real engine
  if (sectorHasFinding(features, 8, ['lacuna', 'cripta', 'tofus'])) {
    pushTendency(out, 'hepatico_biliar', 3, 'Sinais no setor hepático', [
      { feature_path: 'sectors.8.findings', contribution: 0.7 },
    ])
  }
  // TODO Phase 7.5 — replace with real engine
  if (constitutionMatches(features, 'hematog')) {
    pushTendency(out, 'hepatico_biliar', 3, 'Padrão metabólico circulatório', [
      { feature_path: 'constitution.primary', contribution: 0.5 },
    ])
  }

  // === digestivo ===
  // TODO Phase 7.5 — replace with real engine
  if (
    sectorHasFinding(features, 6, ['lacuna', 'cripta']) ||
    sectorHasFinding(features, 7, ['lacuna', 'cripta'])
  ) {
    pushTendency(out, 'digestivo', 3, 'Sinais no setor digestivo', [
      { feature_path: 'sectors.6-7.findings', contribution: 0.6 },
    ])
  }

  // === nervoso_autonomo ===
  // TODO Phase 7.5 — replace with real engine
  if (ring(features, 'nerve_ring') || ring(features, 'anel_nervoso')) {
    pushTendency(out, 'nervoso_autonomo', 3, 'Anel pupilar de tensão funcional', [
      { feature_path: 'rings.nerve_ring', contribution: 0.7 },
    ])
  }
  // TODO Phase 7.5 — replace with real engine
  if (ring(features, 'stress_rings')) {
    pushTendency(
      out,
      'nervoso_autonomo',
      4,
      'Múltiplos anéis funcionais de tensão',
      [{ feature_path: 'rings.stress_rings', contribution: 0.8 }],
    )
  }

  // === renal ===
  // TODO Phase 7.5 — replace with real engine
  if (
    sectorHasFinding(features, 5, ['lacuna']) ||
    sectorHasFinding(features, 4, ['lacuna'])
  ) {
    pushTendency(out, 'renal', 2, 'Sinais no setor renal', [
      { feature_path: 'sectors.4-5.findings', contribution: 0.5 },
    ])
  }

  // === imune ===
  // TODO Phase 7.5 — replace with real engine
  // Heuristic: linfatico high + linfática constitution → immune co-flagged.
  const hasLymph = out.some(
    (t) => t.system_id === 'linfatico' && t.tendency_grade >= 3,
  )
  if (hasLymph) {
    pushTendency(
      out,
      'imune',
      2,
      'Resposta imune correlacionada com sobrecarga linfática',
      [{ feature_path: 'derived.linfatico_grade', contribution: 0.4 }],
    )
  }

  // === musculoesqueletico ===
  // TODO Phase 7.5 — replace with real engine
  if (
    sectorHasFinding(features, 1, ['lacuna', 'cripta']) ||
    sectorHasFinding(features, 2, ['lacuna', 'cripta'])
  ) {
    pushTendency(
      out,
      'musculoesqueletico',
      2,
      'Sinais no setor cervicocraniano',
      [{ feature_path: 'sectors.1-2.findings', contribution: 0.5 }],
    )
  }

  out.sort((a, b) => b.tendency_grade - a.tendency_grade)
  return out
}
