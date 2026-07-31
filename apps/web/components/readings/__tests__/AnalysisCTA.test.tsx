import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalysisCTA } from '../AnalysisCTA'

describe('components/readings/AnalysisCTA — Surface 1 button group', () => {
  // 2026-07-30: o CTA passou a nomear o documento que vai gerar (Mapa do Ser),
  // porque a leitura passou a poder ter dois relatórios.
  it('renderiza apenas o CTA de gerar quando hasReport=false', () => {
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={false}
        regenerationCount={0}
        isDelivered={false}
        onTrigger={vi.fn()}
      />,
    )
    expect(screen.getByTestId('analysis-cta-generate').textContent).toContain(
      'Mapa do Ser',
    )
    expect(screen.queryByText('Editar análise')).toBeNull()
  })

  it('terapeuta (não-founder) com relatório: só "Editar análise", regen escondido (2026-06-03)', () => {
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={1}
        isDelivered={false}
        onTrigger={vi.fn()}
      />,
    )
    expect(screen.getByText('Editar análise')).toBeDefined()
    expect(screen.queryByTestId('analysis-cta-regenerate')).toBeNull()
  })

  it('founder: "Editar análise" + "Regenerar análise (0/1)" quando hasReport=true (1 regen disponível)', () => {
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={1}
        isDelivered={false}
        onTrigger={vi.fn()}
        isFounder={true}
      />,
    )
    expect(screen.getByText('Editar análise')).toBeDefined()
    // regenerationCount=1 = original gerada, 0 regens usados → "(0/1)", disponível.
    expect(screen.getByText(/Regenerar análise \(0\/1\)/)).toBeDefined()
    expect(
      screen.getByTestId('analysis-cta-regenerate').hasAttribute('disabled'),
    ).toBe(false)
  })

  it('founder: Regenerar disabled e (1/1) quando regenerationCount=2 (cap atingido)', () => {
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={2}
        isDelivered={false}
        onTrigger={vi.fn()}
        isFounder={true}
      />,
    )
    expect(screen.getByText(/Regenerar análise \(1\/1\)/)).toBeDefined()
    const btn = screen.getByTestId('analysis-cta-regenerate')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('founder: Regenerar disabled quando isDelivered=true', () => {
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={1}
        isDelivered={true}
        onTrigger={vi.fn()}
        isFounder={true}
      />,
    )
    const btn = screen.getByTestId('analysis-cta-regenerate')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('onTrigger é chamado ao clicar no CTA de gerar', () => {
    const onTrigger = vi.fn()
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={false}
        regenerationCount={0}
        isDelivered={false}
        onTrigger={onTrigger}
      />,
    )
    fireEvent.click(screen.getByTestId('analysis-cta-generate'))
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('founder: Tooltip wrapper presente quando regenerationCount=2 (cap atingido)', () => {
    const { container } = render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={2}
        isDelivered={false}
        onTrigger={vi.fn()}
        isFounder={true}
      />,
    )
    // Base-UI Tooltip renders a trigger wrapper element with data-slot="tooltip-trigger"
    const trigger = container.querySelector('[data-slot="tooltip-trigger"]')
    expect(trigger).toBeDefined()
    const btn = screen.getByTestId('analysis-cta-regenerate')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('founder: Tooltip wrapper presente quando isDelivered=true, botão disabled', () => {
    const { container } = render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={1}
        isDelivered={true}
        onTrigger={vi.fn()}
        isFounder={true}
      />,
    )
    const trigger = container.querySelector('[data-slot="tooltip-trigger"]')
    expect(trigger).toBeDefined()
    const btn = screen.getByTestId('analysis-cta-regenerate')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })
})
