// audit-vocabulary:allowlist — este teste exemplifica termos proibidos para
// validar detecção runtime. Marker honra apps/web/scripts/audit-vocabulary.mjs.
// IMPLEMENTED BY: 07.4-03 (audit-v2.ts — extended vocab audit per D-VOC1/3)
// Source: 07.4-VALIDATION.md, D-VOC1.
import { describe, it, expect } from 'vitest'
import { runAuditV2 } from '../audit-v2'
import type { ReportV2 } from '../report-schema'
import type { SystemId } from '../report-schema'

const META_OK = { json_validation_passed: true, retry_count: 0 } as const

function makeReport(overrides: Partial<ReportV2> = {}): ReportV2 {
  return {
    report_version: '2.0',
    executive_summary: 'Resumo neutro do panorama clínico-funcional.',
    constitutional_pattern: {
      description: 'Padrão estrutural com expressões funcionais.',
      key_traits: ['traço estrutural neutro'],
    },
    systems_with_tendency: [],
    integrative_axes: [],
    bilateral_findings: { asymmetry_present: false, description: null },
    therapeutic_synthesis: 'Síntese de orientações acolhedoras.',
    priority_focus: ['orientação 1', 'orientação 2', 'orientação 3'],
    clinical_note: 'Nota clínica sem termos proibidos.',
    advanced_analysis: {
      available: true,
      generated: false,
      credit_cost: 1,
    },
    ...overrides,
  }
}

function makeSystem(id: SystemId, overrides: Partial<ReportV2['systems_with_tendency'][number]> = {}) {
  return {
    system_id: id,
    system_name: 'sistema',
    tendency_grade: 3,
    tendency_label: 'moderada' as const,
    clinical_description: 'Descrição clínica neutra.',
    associated_manifestations: [],
    investigation_points: [],
    therapeutic_direction: 'Orientação acolhedora.',
    ...overrides,
  }
}

describe('lib/anthropic/audit-v2 (D-VOC1, D-VOC3) — Plan 07.4-03', () => {
  it('detects iridological jargon ("constituição linfática") in a system clinical_description', () => {
    const report = makeReport({
      systems_with_tendency: [
        makeSystem('linfatico', {
          clinical_description: 'Sinais sugerem constituição linfática evidente nos sectores nasais.',
        }),
      ],
    })
    const result = runAuditV2(report, META_OK)
    expect(result.iridological_jargon.length).toBeGreaterThanOrEqual(1)
    const found = result.iridological_jargon.find((h) =>
      h.field.includes('systems_with_tendency.linfatico.clinical_description'),
    )
    expect(found).toBeDefined()
    expect(found?.term).toBe('constituição linfática')
  })

  it('detects Sopro vocab ("centelha divina") in therapeutic_synthesis', () => {
    const report = makeReport({
      therapeutic_synthesis: 'Convide a pessoa a contactar sua centelha divina interior.',
    })
    const result = runAuditV2(report, META_OK)
    expect(result.sopro_vocab.length).toBeGreaterThanOrEqual(1)
    expect(result.sopro_vocab.some((h) => h.term === 'centelha divina')).toBe(true)
    expect(result.sopro_vocab.some((h) => h.field === 'therapeutic_synthesis')).toBe(true)
  })

  it('does NOT trip on compound words (curadoria, naturocultura) that contain "cura" as substring', () => {
    const report = makeReport({
      therapeutic_synthesis: 'A curadoria do processo é parte da naturocultura terapêutica.',
    })
    const result = runAuditV2(report, META_OK)
    // The standalone forbidden term "cura" must NOT match inside "curadoria" or "naturocultura".
    expect(result.forbidden_vocab).toEqual([])
  })

  it('respects NEG_CONTEXT_RE for LGPD set: disclaimer-style "não constitui diagnóstico" not flagged', () => {
    const report = makeReport({
      clinical_note: 'Este relatório não constitui diagnóstico médico.',
    })
    const result = runAuditV2(report, META_OK)
    // "diagnóstico" preceded by "não constitui" → LGPD-correct → skipped
    expect(result.forbidden_vocab).toEqual([])
  })

  it('DOES flag bare "diagnóstico" without neg-context', () => {
    const report = makeReport({
      executive_summary: 'O diagnóstico apresenta padrões de complexidade.',
    })
    const result = runAuditV2(report, META_OK)
    expect(result.forbidden_vocab.length).toBeGreaterThanOrEqual(1)
    expect(result.forbidden_vocab.some((h) => h.term === 'diagnóstico')).toBe(true)
  })

  it('clean report produces zero hits across all 3 sets', () => {
    const result = runAuditV2(makeReport(), META_OK)
    expect(result.iridological_jargon).toEqual([])
    expect(result.sopro_vocab).toEqual([])
    expect(result.forbidden_vocab).toEqual([])
    expect(result.json_validation_passed).toBe(true)
    expect(result.retry_count).toBe(0)
    expect(typeof result.audited_at).toBe('string')
  })

  it('scans investigation_points + associated_manifestations + key_traits + integrative_axes descriptions', () => {
    const report = makeReport({
      constitutional_pattern: {
        description: 'Estrutura.',
        key_traits: ['anel nervoso pronunciado'],
      },
      systems_with_tendency: [
        makeSystem('hepatico_biliar', {
          associated_manifestations: ['referência a Jensen em outro contexto'],
          investigation_points: ['pipeline detectou algo'],
        }),
      ],
      integrative_axes: [
        { axis_name: 'fígado', status: 'ativo', description: 'Eixo associado à constituição mista.' },
      ],
    })
    const result = runAuditV2(report, META_OK)
    const fields = result.iridological_jargon.map((h) => h.field)
    expect(fields).toContain('constitutional_pattern.key_traits')
    expect(fields).toContain('systems_with_tendency.hepatico_biliar.associated_manifestations')
    expect(fields).toContain('systems_with_tendency.hepatico_biliar.investigation_points')
    expect(fields.some((f) => f.startsWith('integrative_axes.fígado'))).toBe(true)
  })

  it('counts repeated occurrences of the same term within one field', () => {
    const report = makeReport({
      clinical_note: 'Referência a Jensen e novamente Jensen no encerramento — Jensen.',
    })
    const result = runAuditV2(report, META_OK)
    const jensenHit = result.iridological_jargon.find(
      (h) => h.field === 'clinical_note' && h.term === 'jensen',
    )
    expect(jensenHit).toBeDefined()
    expect(jensenHit!.count).toBe(3)
  })

  it('propagates meta.retry_count and json_validation_passed', () => {
    const result = runAuditV2(makeReport(), { json_validation_passed: false, retry_count: 2 })
    expect(result.json_validation_passed).toBe(false)
    expect(result.retry_count).toBe(2)
  })
})
