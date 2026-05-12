/**
 * Phase 07.1.6 UAT item 2 — make canonical iris_color authoritative at
 * report-generation time.
 *
 * Pipeline order (without this merge):
 *   1. canonicalize  → writes canonical_metadata.iris_color_by_eye (truth)
 *                      patches vision_features.{eye}.iris_color (transient)
 *   2. Modal callback → overwrites vision_features.{eye}.iris_color (stale LAB-centroid)
 *   3. analyze.ts    → reads vision_features (sees Modal's stale value)
 *
 * Fix: at analyze entry, overlay canonical_metadata.iris_color_by_eye onto the
 * visionFeatures arg. canonical wins; Modal's value is discarded. Also injects
 * an `iridological_hint` field so the LLM picks up Phase 07.1.6 vocabulary
 * (verde_acinzentado → biliar-linfática mista, etc.) without prompt edits.
 *
 * Pure: no I/O, no async. Caller (analyze route) loads both fields from DB and
 * passes them in. Testable in <1ms.
 */
import type { CanonicalMetadata, IrisColorAggregate } from '@/lib/anthropic/types'

/**
 * Iridological mapping for the gray-tinted vocabulary added in Phase 07.1.6 UAT
 * item 2. Returns a short Portuguese hint string to inject into iris_color JSON
 * so the LLM picks up the constitutional implication. Only categories with
 * explicit founder-confirmed mappings are returned; the rest produce null so
 * the LLM relies on RAG + existing prompt knowledge.
 *
 * Founder-confirmed mappings (2026-05-12 UAT item 2):
 *   - verde_acinzentado → biliar-linfática mista (NOT hematogênica pura)
 *
 * Adjacent gray-tinted categories left to LLM/RAG (no founder mapping yet):
 *   - acinzentado, azul_acinzentado, castanho_acinzentado
 */
export function iridologicalHintForPrimary(primary: string | null): string | null {
  if (primary === 'verde_acinzentado') {
    return 'Categoria iridológica: biliar-linfática mista (NÃO hematogênica pura — a presença de gray no estroma exclui hematogênica)'
  }
  return null
}

/**
 * Constitution block override for the gray-tinted vocabulary. When canonical
 * iris_color triggers a known iridological mapping, replace the Modal-written
 * vision_features.{eye}.constitution block — Modal's LAB-centroid analysis
 * produced "hematogênica" for verde_acinzentado readings, which is iridologically
 * incompatible with gray-tinted iris (UAT item 1 follow-up, 2026-05-12).
 *
 * Returned shape matches the existing constitution block consumed by
 * analyze.ts (featuresForRag.constitution.primary → RAG section-query).
 *
 * Same founder-confirmed mapping table as iridologicalHintForPrimary; expand
 * as more iridological mappings get clinically confirmed.
 */
export function iridologicalConstitutionForPrimary(primary: string | null):
  | { primary: string; secondary: string | null; source: 'canonical_metadata' }
  | null {
  if (primary === 'verde_acinzentado') {
    return { primary: 'biliar', secondary: 'linfática', source: 'canonical_metadata' }
  }
  return null
}

/**
 * Overlay canonical_metadata.iris_color_by_eye onto vision_features.{left_eye,right_eye}.iris_color.
 * Returns a NEW object — input visionFeatures is not mutated. If canonicalMetadata
 * is null/missing or has no iris_color_by_eye, returns visionFeatures unchanged.
 *
 * When an eye has a canonical IrisColorAggregate, the resulting vision_features.{eye}.iris_color
 * is set to a denormalized shape consumable by both:
 *   - FeaturesDisplay.tsx (IrisColorBlock: primary, secondary, central_heterochromia)
 *   - report prompt (sees iris_color in vision_features_json with iridological_hint when applicable)
 */
export function mergeCanonicalIrisColor(
  visionFeatures: Record<string, unknown> | null | undefined,
  canonicalMetadata: CanonicalMetadata | null | undefined,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(visionFeatures ?? {}) }
  const byEye = canonicalMetadata?.iris_color_by_eye
  if (!byEye) return base

  if (byEye.left) {
    const leftEye = (base.left_eye as Record<string, unknown> | undefined) ?? {}
    const constitutionOverride = iridologicalConstitutionForPrimary(byEye.left.primary)
    base.left_eye = {
      ...leftEye,
      iris_color: buildIrisColorBlock(byEye.left),
      // Override constitution when canonical color maps to a confirmed iridological
      // category. Modal's vision_features.constitution is unreliable for gray-tinted
      // iris (UAT item 1 follow-up: verde_acinzentado wrote 'hematogênica').
      ...(constitutionOverride ? { constitution: constitutionOverride } : {}),
    }
  }
  if (byEye.right) {
    const rightEye = (base.right_eye as Record<string, unknown> | undefined) ?? {}
    const constitutionOverride = iridologicalConstitutionForPrimary(byEye.right.primary)
    base.right_eye = {
      ...rightEye,
      iris_color: buildIrisColorBlock(byEye.right),
      ...(constitutionOverride ? { constitution: constitutionOverride } : {}),
    }
  }
  return base
}

/**
 * Build the per-eye iris_color object inserted into vision_features. Adds an
 * `iridological_hint` field only when iridologicalHintForPrimary returns a value;
 * otherwise the field is omitted (keeps the JSON clean).
 */
function buildIrisColorBlock(aggregate: IrisColorAggregate): Record<string, unknown> {
  const hint = iridologicalHintForPrimary(aggregate.primary)
  const block: Record<string, unknown> = {
    primary: aggregate.primary,
    secondary: aggregate.secondary,
    central_heterochromia: aggregate.central_heterochromia,
    dominant_pigments: aggregate.dominant_pigments,
    confidence: aggregate.confidence,
    source: 'canonical_metadata' as const,
  }
  if (hint !== null) block.iridological_hint = hint
  return block
}
