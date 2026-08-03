import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalysisCTA } from '../AnalysisCTA'

describe('components/readings/AnalysisCTA — Surface 1 button group', () => {
  // 2026-07-30: o CTA passou a nomear o documento que vai gerar (Mapa do Ser),
  // porque a leitura passou a poder ter dois relatórios.
  it('renderiza apenas o CTA de gerar quando hasReport=false', () => {
    render(<AnalysisCTA readingId="r1" hasReport={false} onTrigger={vi.fn()} />)
    expect(screen.getByTestId('analysis-cta-generate').textContent).toContain(
      'Mapa do Ser',
    )
    expect(screen.queryByText('Editar análise')).toBeNull()
  })

  // Founder, 2026-08-03: "Regenerar análise" saiu da UI inteira. Com relatório na mão,
  // a única ação daqui é editar — para gerar de novo, nova leitura (ou /admin/regenerar).
  it('com relatório: só "Editar análise" — nenhum botão de regenerar', () => {
    render(<AnalysisCTA readingId="r1" hasReport={true} onTrigger={vi.fn()} />)
    expect(screen.getByText('Editar análise')).toBeDefined()
    expect(screen.queryByTestId('analysis-cta-regenerate')).toBeNull()
    expect(screen.queryByText(/Regenerar/i)).toBeNull()
  })

  it('onTrigger é chamado ao clicar no CTA de gerar', () => {
    const onTrigger = vi.fn()
    render(<AnalysisCTA readingId="r1" hasReport={false} onTrigger={onTrigger} />)
    fireEvent.click(screen.getByTestId('analysis-cta-generate'))
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })
})
