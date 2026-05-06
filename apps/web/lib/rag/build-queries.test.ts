import { describe, it, expect } from 'vitest'

import { buildFamilyA, buildFamilyB, type IrisFeaturesForRag } from './build-queries'
import type { ReportSection } from './types'

// Wave 0 scaffolding (06-01-PLAN) flipped GREEN in 06-10-PLAN.
// Covers RAG-04 + D-R2 (Família A: achados visuais; Família B: seções do super prompt).

function makeFeatures(overrides: Partial<IrisFeaturesForRag> = {}): IrisFeaturesForRag {
  return {
    constitution: { primary: 'biliar' },
    sectors: [],
    rings: {},
    ...overrides,
  }
}

describe('buildFamilyA (visual findings — D-R2A)', () => {
  it('emits 1 query per primary constitution', () => {
    const queries = buildFamilyA(makeFeatures())
    expect(queries).toContain('constituição biliar')
  })

  it('emits 1 query per secondary constitution when present', () => {
    const queries = buildFamilyA(
      makeFeatures({
        constitution: { primary: 'biliar', secondary: 'linfatica' },
      }),
    )
    expect(queries).toContain('constituição biliar')
    expect(queries).toContain('constituição linfatica')
  })

  it('emits 1 query per sector with findings.length > 0', () => {
    const queries = buildFamilyA(
      makeFeatures({
        sectors: [
          { hour: 7, findings: [{ type: 'lacuna_aberta' }, { type: 'cripta' }] },
          { hour: 3, findings: [] }, // no findings → no query
        ],
      }),
    )
    expect(queries.some((q) => q.includes('setor 7'))).toBe(true)
    expect(queries.some((q) => q.includes('lacuna_aberta'))).toBe(true)
    expect(queries.some((q) => q.includes('setor 3'))).toBe(false)
  })

  it('emits 1 query per active global ring/sign', () => {
    const queries = buildFamilyA(
      makeFeatures({
        rings: {
          anel_tensao: { present: true },
          arco_senil: { present: false },
        },
      }),
    )
    expect(queries.some((q) => q.includes('anel_tensao'))).toBe(true)
    expect(queries.some((q) => q.includes('arco_senil'))).toBe(false)
  })

  it('returns empty when features has no constitution and no findings', () => {
    const queries = buildFamilyA({
      constitution: { primary: '' },
      sectors: [],
      rings: {},
    })
    // Empty primary string is falsy — no constitution query
    expect(queries).toEqual([])
  })

  it('compounds: constitution + sector + ring all emit', () => {
    const queries = buildFamilyA(
      makeFeatures({
        constitution: { primary: 'biliar', secondary: 'linfatica' },
        sectors: [{ hour: 7, findings: [{ type: 'cripta' }] }],
        rings: { anel_tensao: { present: true } },
      }),
    )
    expect(queries.length).toBeGreaterThanOrEqual(4)
  })
})

describe('buildFamilyB (report sections — D-R2B)', () => {
  it('emits queries from SECTION_QUERY_TEMPLATES for each section', () => {
    const queries = buildFamilyB(makeFeatures(), ['psicoemocional', 'transgeracional'])
    expect(queries.some((q) => q.includes('biliar'))).toBe(true)
    expect(
      queries.some((q) => q.includes('psicoemocional') || q.includes('emocional')),
    ).toBe(true)
    expect(queries.some((q) => q.includes('transgeracional'))).toBe(true)
  })

  it('combines constitution.primary into each section template', () => {
    const queries = buildFamilyB(
      makeFeatures({ constitution: { primary: 'neurogenica' } }),
      ['constituicao'],
    )
    expect(queries.some((q) => q.includes('neurogenica'))).toBe(true)
  })

  it('returns empty when reportSections is empty', () => {
    const queries = buildFamilyB(makeFeatures(), [])
    expect(queries).toEqual([])
  })

  it('skips sections without a registered template (no throw)', () => {
    // Cast to bypass type-check for the test
    const queries = buildFamilyB(makeFeatures(), ['nonexistent' as ReportSection])
    expect(queries).toEqual([])
  })
})
