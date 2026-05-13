// IMPLEMENTED BY: 07.4-04 (tendency-engine/placeholder.ts — hand-crafted heuristics)
// Plan 07.4-00 RED scaffold → Plan 07.4-04 RED real tests. Source: 07.4-VALIDATION.md, D-PR3.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

import { SYSTEM_IDS, type SystemId } from '@/lib/anthropic/report-schema'
import type { IrisFeaturesForRag } from '@/lib/rag/build-queries'
import { mapVisionFeaturesToTendencies } from '@/lib/tendency-engine'

const PLACEHOLDER_PATH = path.resolve(
  __dirname,
  '..',
  'placeholder.ts',
)

function emptyFeatures(): IrisFeaturesForRag {
  return {
    constitution: { primary: '' },
    sectors: [],
    rings: {},
  }
}

describe('lib/tendency-engine/placeholder (D-PR3) — Plan 07.4-04', () => {
  it('lymph_rosary present → emits linfatico tendency grade 3+', () => {
    const features: IrisFeaturesForRag = {
      ...emptyFeatures(),
      rings: { lymph_rosary: { present: true } },
    }
    const out = mapVisionFeaturesToTendencies(features)
    const linf = out.find((t) => t.system_id === 'linfatico')
    expect(linf, 'expected a linfatico tendency').toBeDefined()
    expect(linf!.tendency_grade).toBeGreaterThanOrEqual(3)
    expect(linf!.evidence.length).toBeGreaterThan(0)
  })

  it('sector 7 lacuna → emits digestivo tendency', () => {
    const features: IrisFeaturesForRag = {
      ...emptyFeatures(),
      sectors: [{ hour: 7, findings: [{ type: 'lacuna' }] }],
    }
    const out = mapVisionFeaturesToTendencies(features)
    const dig = out.find((t) => t.system_id === 'digestivo')
    expect(dig, 'expected a digestivo tendency').toBeDefined()
    expect(dig!.tendency_grade).toBeGreaterThanOrEqual(1)
    expect(dig!.tendency_grade).toBeLessThanOrEqual(5)
  })

  it('features with no significant findings → returns empty array', () => {
    const out = mapVisionFeaturesToTendencies(emptyFeatures())
    expect(out).toEqual([])
  })

  it('returns Tendency[] with valid system_ids (all members of SYSTEM_IDS enum)', () => {
    const features: IrisFeaturesForRag = {
      constitution: { primary: 'linfática' },
      sectors: [
        { hour: 1, findings: [{ type: 'lacuna' }] },
        { hour: 5, findings: [{ type: 'lacuna' }] },
        { hour: 7, findings: [{ type: 'cripta' }] },
        { hour: 8, findings: [{ type: 'lacuna' }] },
      ],
      rings: {
        lymph_rosary: { present: true },
        nerve_ring: { present: true },
        stress_rings: { present: true },
      },
    }
    const out = mapVisionFeaturesToTendencies(features)
    expect(out.length).toBeGreaterThan(0)
    const allowed = new Set<SystemId>(SYSTEM_IDS)
    for (const t of out) {
      expect(allowed.has(t.system_id), `unexpected system_id ${t.system_id}`).toBe(
        true,
      )
      expect(t.tendency_grade).toBeGreaterThanOrEqual(1)
      expect(t.tendency_grade).toBeLessThanOrEqual(5)
      expect(Number.isInteger(t.tendency_grade)).toBe(true)
      expect(t.system_name).toEqual(expect.any(String))
      expect(t.system_name.length).toBeGreaterThan(0)
      expect(t.rationale).toEqual(expect.any(String))
      expect(t.rationale.length).toBeGreaterThan(0)
      expect(Array.isArray(t.evidence)).toBe(true)
    }
  })

  it('rule comments contain "TODO Phase 7.5" marker for swap-out (>= 6 occurrences)', () => {
    const src = readFileSync(PLACEHOLDER_PATH, 'utf8')
    const matches = src.match(/TODO Phase 7\.5/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(6)
  })

  it('covers at least 6 distinct SYSTEM_IDS across all rule combinations', () => {
    // Drive every rule branch we can with a maximal feature set, then assert
    // the union of system_ids encountered covers >=6 of the 12 SYSTEM_IDS.
    const features: IrisFeaturesForRag = {
      constitution: { primary: 'linfática', secondary: 'hematogênica' },
      sectors: [
        { hour: 1, findings: [{ type: 'lacuna' }] },
        { hour: 2, findings: [{ type: 'cripta' }] },
        { hour: 4, findings: [{ type: 'lacuna' }] },
        { hour: 5, findings: [{ type: 'lacuna' }] },
        { hour: 6, findings: [{ type: 'lacuna' }] },
        { hour: 7, findings: [{ type: 'cripta' }] },
        { hour: 8, findings: [{ type: 'lacuna' }] },
      ],
      rings: {
        lymph_rosary: { present: true },
        nerve_ring: { present: true },
        stress_rings: { present: true },
      },
    }
    const out = mapVisionFeaturesToTendencies(features)
    const distinct = new Set(out.map((t) => t.system_id))
    expect(distinct.size).toBeGreaterThanOrEqual(6)
  })

  it('barrel @/lib/tendency-engine re-exports mapVisionFeaturesToTendencies', () => {
    // Test imports from the barrel path at the top of this file — if the
    // re-export were missing, the import would throw at module load.
    expect(typeof mapVisionFeaturesToTendencies).toBe('function')
  })
})
