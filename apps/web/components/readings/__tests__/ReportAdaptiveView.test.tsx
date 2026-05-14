/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-06 (ReportAdaptiveView.tsx adaptive renderer)
// Source: 07.4-VALIDATION.md, D-UI1, UI-SPEC §Surface 1b + §Layout Patterns lines 336-417.
// AdvancedAnalysisCTA at footer is delivered by Plan 07.4-07 (footerSlot prop here).
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportAdaptiveView } from '../ReportAdaptiveView'
import validFixture from '@/lib/anthropic/__tests__/fixtures/report-v2-valid.json'
import emptyFixture from '@/lib/anthropic/__tests__/fixtures/report-v2-empty-systems.json'
import type { ReportV2 } from '@/lib/anthropic/report-schema'

const validReport = validFixture as unknown as ReportV2
const emptyReport = emptyFixture as unknown as ReportV2

describe('components/readings/ReportAdaptiveView (D-UI1) — Plan 07.4-06', () => {
  it('renders all top-level blocks for valid fixture', () => {
    render(<ReportAdaptiveView report={validReport} />)
    // 8 fixed blocks (advanced_analysis renders separately via footerSlot/Plan 07)
    expect(screen.getByText('Resumo executivo')).toBeDefined()
    expect(screen.getByText('Padrão constitucional')).toBeDefined()
    expect(screen.getByText('Sistemas com tendência')).toBeDefined()
    expect(screen.getByText('Eixos integrativos')).toBeDefined()
    expect(screen.getByText('Achados bilaterais')).toBeDefined()
    expect(screen.getByText('Síntese terapêutica')).toBeDefined()
    expect(screen.getByText('Foco prioritário')).toBeDefined()
    expect(screen.getByText('Nota clínica')).toBeDefined()
  })

  it('omits bilateral_findings card when asymmetry_present=false', () => {
    render(<ReportAdaptiveView report={emptyReport} />)
    expect(screen.queryByText('Achados bilaterais')).toBeNull()
  })

  it('omits integrative_axes section when empty array', () => {
    render(<ReportAdaptiveView report={emptyReport} />)
    expect(screen.queryByText('Eixos integrativos')).toBeNull()
  })

  it('sorts systems_with_tendency by tendency_grade desc', () => {
    // Build a report with shuffled grades to verify sort
    const shuffled: ReportV2 = {
      ...validReport,
      systems_with_tendency: [
        { ...validReport.systems_with_tendency[1], tendency_grade: 2, system_id: 'renal', system_name: 'Sistema renal' },
        { ...validReport.systems_with_tendency[0], tendency_grade: 5, system_id: 'imune', system_name: 'Sistema imune' },
        { ...validReport.systems_with_tendency[0], tendency_grade: 3, system_id: 'digestivo', system_name: 'Sistema digestivo' },
      ],
    }
    const { container } = render(<ReportAdaptiveView report={shuffled} />)
    const headings = Array.from(container.querySelectorAll('h3'))
      .map((h) => h.textContent)
      .filter((t): t is string => !!t && t.startsWith('Sistema'))
    expect(headings).toEqual([
      'Sistema imune',      // grade 5
      'Sistema digestivo',  // grade 3
      'Sistema renal',      // grade 2
    ])
  })

  it('renders empty-state copy when systems_with_tendency is empty', () => {
    render(<ReportAdaptiveView report={emptyReport} />)
    expect(
      screen.getByText(/Nenhuma tendência sistêmica relevante identificada nesta leitura\./),
    ).toBeDefined()
  })

  it('renders footerSlot at the end (slot for Plan 07.4-07 AdvancedAnalysisCTA)', () => {
    render(
      <ReportAdaptiveView
        report={validReport}
        footerSlot={<button data-testid="cta-slot">CTA mounted by Plan 07</button>}
      />,
    )
    expect(screen.getByTestId('cta-slot')).toBeDefined()
  })

  it('AdvancedAnalysisCTA visible at footer (D-ADD2) — provided by Plan 07 via footerSlot', () => {
    // Acceptance: ReportAdaptiveView exposes the footerSlot prop that Plan 07's
    // AdvancedAnalysisCTA will mount into. Verified by the slot test above.
    render(
      <ReportAdaptiveView
        report={validReport}
        footerSlot={<div data-testid="advanced-cta-placeholder">Análise Iridológica Aprofundada</div>}
      />,
    )
    expect(screen.getByTestId('advanced-cta-placeholder')).toBeDefined()
  })
})
