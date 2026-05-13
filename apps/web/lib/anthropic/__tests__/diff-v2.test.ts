// IMPLEMENTED BY: 07.4-03 (diff-v2.ts — per-system_id diff classifier)
// Source: 07.4-VALIDATION.md, D-SCH3.
import { describe, it, expect } from 'vitest'
import { classifyAllSystemsV2 } from '../diff-v2'
import type { ReportV2 } from '../report-schema'
import type { SystemId } from '../report-schema'

function makeSystem(id: SystemId, overrides: Partial<ReportV2['systems_with_tendency'][number]> = {}) {
  return {
    system_id: id,
    system_name: 'sistema',
    tendency_grade: 3,
    tendency_label: 'moderada' as const,
    clinical_description: 'descrição clínica base do sistema',
    associated_manifestations: [],
    investigation_points: [],
    therapeutic_direction: 'orientação terapêutica base',
    ...overrides,
  }
}

function makeReport(overrides: Partial<ReportV2> = {}): ReportV2 {
  return {
    report_version: '2.0',
    executive_summary: 'resumo executivo base',
    constitutional_pattern: { description: '', key_traits: [] },
    systems_with_tendency: [],
    integrative_axes: [],
    bilateral_findings: { asymmetry_present: false, description: null },
    therapeutic_synthesis: 'síntese terapêutica base',
    priority_focus: ['foco a', 'foco b', 'foco c'],
    clinical_note: 'nota clínica base',
    advanced_analysis: { available: true, generated: false, credit_cost: 1 },
    ...overrides,
  }
}

describe('lib/anthropic/diff-v2 (D-SCH3) — Plan 07.4-03', () => {
  it('unchanged report → all keys classified as none', () => {
    const r = makeReport({
      systems_with_tendency: [makeSystem('linfatico'), makeSystem('hepatico_biliar')],
    })
    const diff = classifyAllSystemsV2(r, r)
    expect(diff.executive_summary?.type).toBe('none')
    expect(diff.therapeutic_synthesis?.type).toBe('none')
    expect(diff.clinical_note?.type).toBe('none')
    expect(diff.priority_focus?.type).toBe('none')
    expect(diff.linfatico?.type).toBe('none')
    expect(diff.hepatico_biliar?.type).toBe('none')
  })

  it('diff keyed by system_id (not section number)', () => {
    const gen = makeReport({
      systems_with_tendency: [
        makeSystem('linfatico', { clinical_description: 'base lymphatic prose' }),
      ],
    })
    const del = makeReport({
      systems_with_tendency: [
        makeSystem('linfatico', {
          clinical_description:
            'reescrito completo lymphatic prose com expressão totalmente diferente que muda quase tudo',
        }),
      ],
    })
    const diff = classifyAllSystemsV2(gen, del)
    expect(diff['linfatico']).toBeDefined()
    expect(diff['linfatico']!.type).not.toBe('none')
    // No numbered keys like '1_constituicao' should appear
    expect(diff['1_constituicao']).toBeUndefined()
  })

  it('top-level keys (executive_summary, therapeutic_synthesis, clinical_note) get separate diff entries', () => {
    const gen = makeReport({ executive_summary: 'um conteúdo de resumo' })
    const del = makeReport({ executive_summary: 'um conteúdo de resumo editado' })
    const diff = classifyAllSystemsV2(gen, del)
    expect(diff.executive_summary).toBeDefined()
    expect(diff.executive_summary!.type).not.toBe('none')
    expect(diff.therapeutic_synthesis!.type).toBe('none')
    expect(diff.clinical_note!.type).toBe('none')
  })

  it("removed system → type='removido'", () => {
    const gen = makeReport({
      systems_with_tendency: [makeSystem('linfatico'), makeSystem('renal')],
    })
    const del = makeReport({ systems_with_tendency: [makeSystem('renal')] })
    const diff = classifyAllSystemsV2(gen, del)
    expect(diff.linfatico).toBeDefined()
    expect(diff.linfatico!.type).toBe('removido')
    expect(diff.renal!.type).toBe('none')
  })

  it("added system → type='adicionado'", () => {
    const gen = makeReport({ systems_with_tendency: [makeSystem('linfatico')] })
    const del = makeReport({
      systems_with_tendency: [makeSystem('linfatico'), makeSystem('digestivo')],
    })
    const diff = classifyAllSystemsV2(gen, del)
    expect(diff.digestivo!.type).toBe('adicionado')
    expect(diff.linfatico!.type).toBe('none')
  })

  it('priority_focus joined for diff — change in any item produces non-none', () => {
    const gen = makeReport({ priority_focus: ['a', 'b', 'c'] })
    const del = makeReport({ priority_focus: ['a', 'b', 'd'] })
    const diff = classifyAllSystemsV2(gen, del)
    expect(diff.priority_focus!.type).not.toBe('none')
  })

  it('null generated / null delivered handled gracefully', () => {
    const r = makeReport()
    expect(() => classifyAllSystemsV2(null, r)).not.toThrow()
    expect(() => classifyAllSystemsV2(r, null)).not.toThrow()
    expect(() => classifyAllSystemsV2(null, null)).not.toThrow()
  })

  it('serializes clinical_description + therapeutic_direction together for system diff', () => {
    // If only therapeutic_direction changes, the system entry must still register non-none.
    const gen = makeReport({
      systems_with_tendency: [
        makeSystem('linfatico', {
          clinical_description: 'idêntico',
          therapeutic_direction: 'orientação original a manter',
        }),
      ],
    })
    const del = makeReport({
      systems_with_tendency: [
        makeSystem('linfatico', {
          clinical_description: 'idêntico',
          therapeutic_direction: 'orientação completamente reescrita com diferentes palavras-chave',
        }),
      ],
    })
    const diff = classifyAllSystemsV2(gen, del)
    expect(diff.linfatico!.type).not.toBe('none')
  })
})
