/**
 * Phase 07.1.6 UAT item 2 — merge-iris-color unit tests.
 *
 * Pure function tests, no mocks. Verifies:
 *   - canonical iris_color overrides Modal's stale vision_features value
 *   - verde_acinzentado triggers the iridological_hint
 *   - missing canonical_metadata is a no-op (backward-compat)
 *   - input visionFeatures is not mutated
 */
import { describe, it, expect } from 'vitest'
import {
  mergeCanonicalIrisColor,
  iridologicalHintForPrimary,
  iridologicalConstitutionForPrimary,
} from '../merge-iris-color'
import type { CanonicalMetadata, IrisColorAggregate } from '@/lib/anthropic/types'

const baseMetadata = {
  sonnet_input_tokens: 10000,
  sonnet_output_tokens: 500,
  cost_usd: 0.05,
  status_summary: { ok: 6, fallback: 0, disabled: 0 },
  canonicalized_at: '2026-05-12T12:00:00.000Z',
}

const verdeAcinzentadoLeft: IrisColorAggregate = {
  primary: 'verde_acinzentado',
  secondary: 'castanho',
  central_heterochromia: false,
  dominant_pigments: ['pigmento_amarelo'],
  confidence: 0.82,
}

const castanhoRight: IrisColorAggregate = {
  primary: 'castanho',
  secondary: null,
  central_heterochromia: false,
  dominant_pigments: [],
  confidence: 0.91,
}

describe('iridologicalHintForPrimary', () => {
  it('returns a biliar-linfática hint for verde_acinzentado (UAT item 2 mapping)', () => {
    const hint = iridologicalHintForPrimary('verde_acinzentado')
    expect(hint).not.toBeNull()
    expect(hint).toContain('biliar-linfática')
    expect(hint).toContain('NÃO hematogênica')
  })

  it('returns null for non-mapped categories (lets LLM/RAG handle)', () => {
    expect(iridologicalHintForPrimary('castanho')).toBeNull()
    expect(iridologicalHintForPrimary('azul')).toBeNull()
    expect(iridologicalHintForPrimary('verde')).toBeNull()
    expect(iridologicalHintForPrimary('acinzentado')).toBeNull()
    expect(iridologicalHintForPrimary('azul_acinzentado')).toBeNull()
    expect(iridologicalHintForPrimary('castanho_acinzentado')).toBeNull()
    expect(iridologicalHintForPrimary(null)).toBeNull()
  })
})

describe('mergeCanonicalIrisColor', () => {
  it('overrides vision_features.{eye}.iris_color with canonical aggregate when both present', () => {
    const vf = {
      left_eye: { iris_color: { primary: 'verde' /* stale Modal value */ }, fiber_density: { score: 7 } },
      right_eye: { iris_color: { primary: 'castanho' }, rings: {} },
    }
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: verdeAcinzentadoLeft, right: castanhoRight },
    }
    const merged = mergeCanonicalIrisColor(vf, meta)
    const leftIris = (merged.left_eye as Record<string, unknown>).iris_color as Record<string, unknown>
    expect(leftIris.primary).toBe('verde_acinzentado')
    expect(leftIris.source).toBe('canonical_metadata')
    // Preserves other fiber_density etc.
    expect((merged.left_eye as Record<string, unknown>).fiber_density).toEqual({ score: 7 })
  })

  it('injects iridological_hint for verde_acinzentado', () => {
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: verdeAcinzentadoLeft, right: null },
    }
    const merged = mergeCanonicalIrisColor({}, meta)
    const leftIris = (merged.left_eye as Record<string, unknown>).iris_color as Record<string, unknown>
    expect(leftIris.iridological_hint).toContain('biliar-linfática')
  })

  it('omits iridological_hint when primary is not in the mapping table', () => {
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: null, right: castanhoRight },
    }
    const merged = mergeCanonicalIrisColor({}, meta)
    const rightIris = (merged.right_eye as Record<string, unknown>).iris_color as Record<string, unknown>
    expect(rightIris.iridological_hint).toBeUndefined()
    expect(rightIris.primary).toBe('castanho')
  })

  it('is a no-op when canonicalMetadata is null (backward-compat with old readings)', () => {
    const vf = { left_eye: { iris_color: { primary: 'verde' }, fiber_density: { score: 5 } } }
    const merged = mergeCanonicalIrisColor(vf, null)
    expect(merged).toEqual(vf)
  })

  it('is a no-op when iris_color_by_eye is absent (backward-compat with pre-UAT canonical_metadata)', () => {
    const vf = { left_eye: { iris_color: { primary: 'verde' } } }
    const merged = mergeCanonicalIrisColor(vf, baseMetadata as CanonicalMetadata)
    expect(merged).toEqual(vf)
  })

  it('does not mutate the input visionFeatures', () => {
    const vf = { left_eye: { iris_color: { primary: 'verde' } } }
    const original = JSON.parse(JSON.stringify(vf))
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: verdeAcinzentadoLeft, right: null },
    }
    mergeCanonicalIrisColor(vf, meta)
    expect(vf).toEqual(original)
  })

  it('creates left_eye/right_eye when visionFeatures was empty (canonical-only path)', () => {
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: verdeAcinzentadoLeft, right: castanhoRight },
    }
    const merged = mergeCanonicalIrisColor(null, meta)
    expect((merged.left_eye as Record<string, unknown>).iris_color).toMatchObject({
      primary: 'verde_acinzentado',
    })
    expect((merged.right_eye as Record<string, unknown>).iris_color).toMatchObject({
      primary: 'castanho',
    })
  })

  // -------------------------------------------------------------------------
  // Constitution override (UAT item 1 follow-up, 2026-05-12)
  // analyze.ts reads vision_features.{eye}.constitution.primary → RAG, NOT
  // iris_color. So patching iris_color alone wasn't enough — the LLM kept
  // generating 'hematogênica' reports because Modal's constitution.primary
  // stayed stale. mergeCanonicalIrisColor now also overrides constitution
  // when canonical iris_color triggers a confirmed iridological mapping.
  // -------------------------------------------------------------------------

  it('overrides vision_features.{eye}.constitution when verde_acinzentado primary present', () => {
    const vf = {
      right_eye: {
        iris_color: { primary: 'verde' /* stale */ },
        constitution: { primary: 'hematogênica' /* stale Modal value — UAT bug */ },
        fiber_density: { score: 7 },
      },
    }
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: null, right: { ...verdeAcinzentadoLeft } },
    }
    const merged = mergeCanonicalIrisColor(vf, meta)
    const rightEye = merged.right_eye as Record<string, unknown>
    const constitution = rightEye.constitution as Record<string, unknown>
    expect(constitution.primary).toBe('biliar')
    expect(constitution.secondary).toBe('linfática')
    expect(constitution.source).toBe('canonical_metadata')
    // Other right_eye fields untouched.
    expect(rightEye.fiber_density).toEqual({ score: 7 })
  })

  it('leaves constitution untouched when canonical primary has no mapping', () => {
    const vf = {
      right_eye: {
        constitution: { primary: 'hematogênica' },
      },
    }
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: null, right: castanhoRight },
    }
    const merged = mergeCanonicalIrisColor(vf, meta)
    const constitution = (merged.right_eye as Record<string, unknown>).constitution as Record<string, unknown>
    // 'castanho' has no founder-confirmed iridological override → Modal's value preserved.
    expect(constitution.primary).toBe('hematogênica')
  })

  it('exposes iridologicalConstitutionForPrimary for direct use', () => {
    expect(iridologicalConstitutionForPrimary('verde_acinzentado')).toEqual({
      primary: 'biliar',
      secondary: 'linfática',
      source: 'canonical_metadata',
    })
    expect(iridologicalConstitutionForPrimary('castanho')).toBeNull()
    expect(iridologicalConstitutionForPrimary(null)).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Top-level constitution override (UAT-1 root cause, 2026-05-12)
  // system.md:115 anchors to `features.constitution.primary` at TOP LEVEL,
  // not nested under right_eye/left_eye. Eye-level override alone was
  // shadowed — LLM kept generating hematogênica reports. Now also patches
  // the top-level field.
  // -------------------------------------------------------------------------

  it('overrides TOP-LEVEL vision_features.constitution when verde_acinzentado present', () => {
    const vf = {
      constitution: { primary: 'hematogênica' /* Modal top-level stale */ },
      right_eye: { constitution: { primary: 'hematogênica' /* Modal nested stale */ } },
    }
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: null, right: verdeAcinzentadoLeft },
    }
    const merged = mergeCanonicalIrisColor(vf, meta)
    const topConstitution = merged.constitution as Record<string, unknown>
    expect(topConstitution.primary).toBe('biliar')
    expect(topConstitution.secondary).toBe('linfática')
    expect(topConstitution.source).toBe('canonical_metadata')
  })

  it('prefers right_eye mapping over left_eye for top-level override (matches analyze.ts eyeSource pattern)', () => {
    const vf = { constitution: { primary: 'hematogênica' } }
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: {
        left: { ...verdeAcinzentadoLeft, primary: 'verde_acinzentado' },
        right: { ...verdeAcinzentadoLeft, primary: 'verde_acinzentado' },
      },
    }
    const merged = mergeCanonicalIrisColor(vf, meta)
    expect((merged.constitution as Record<string, unknown>).primary).toBe('biliar')
  })

  it('leaves TOP-LEVEL constitution untouched when no eye has a confirmed mapping', () => {
    const vf = { constitution: { primary: 'hematogênica' /* Modal stale */ } }
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: { left: castanhoRight, right: castanhoRight },
    }
    const merged = mergeCanonicalIrisColor(vf, meta)
    // No mapping for 'castanho' — Modal's value passes through.
    expect((merged.constitution as Record<string, unknown>).primary).toBe('hematogênica')
  })

  it('falls back to left_eye mapping when right_eye has no mapping', () => {
    const vf = { constitution: { primary: 'hematogênica' } }
    const meta: CanonicalMetadata = {
      ...baseMetadata,
      iris_color_by_eye: {
        left: { ...verdeAcinzentadoLeft, primary: 'verde_acinzentado' },
        right: castanhoRight, // no mapping
      },
    }
    const merged = mergeCanonicalIrisColor(vf, meta)
    expect((merged.constitution as Record<string, unknown>).primary).toBe('biliar')
  })
})
