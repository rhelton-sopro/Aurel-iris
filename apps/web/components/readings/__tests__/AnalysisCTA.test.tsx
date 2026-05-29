import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalysisCTA } from '../AnalysisCTA'

describe('components/readings/AnalysisCTA — Surface 1 button group', () => {
  it('renderiza apenas "Gerar análise" quando hasReport=false', () => {
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={false}
        regenerationCount={0}
        isDelivered={false}
        onTrigger={vi.fn()}
      />,
    )
    expect(screen.getByText('Gerar análise')).toBeDefined()
    expect(screen.queryByText('Editar análise')).toBeNull()
  })

  it('renderiza "Editar análise" + "Regenerar análise (0/1)" quando hasReport=true (1 regen disponível)', () => {
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
    // regenerationCount=1 = original gerada, 0 regens usados → "(0/1)", disponível.
    expect(screen.getByText(/Regenerar análise \(0\/1\)/)).toBeDefined()
    expect(
      screen.getByTestId('analysis-cta-regenerate').hasAttribute('disabled'),
    ).toBe(false)
  })

  it('Regenerar fica disabled e mostra (1/1) quando regenerationCount=2 (cap = 1 regen atingido)', () => {
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={2}
        isDelivered={false}
        onTrigger={vi.fn()}
      />,
    )
    expect(screen.getByText(/Regenerar análise \(1\/1\)/)).toBeDefined()
    const btn = screen.getByTestId('analysis-cta-regenerate')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('Regenerar fica disabled quando isDelivered=true', () => {
    render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={1}
        isDelivered={true}
        onTrigger={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('analysis-cta-regenerate')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('onTrigger é chamado ao clicar "Gerar análise"', () => {
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
    fireEvent.click(screen.getByText('Gerar análise'))
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('Tooltip wrapper presente (data-slot tooltip-trigger) quando regenerationCount=2 (cap atingido)', () => {
    const { container } = render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={2}
        isDelivered={false}
        onTrigger={vi.fn()}
      />,
    )
    // Base-UI Tooltip renders a trigger wrapper element with data-slot="tooltip-trigger"
    // Tooltip content text is lazily rendered on hover (not in initial DOM in jsdom)
    const trigger = container.querySelector('[data-slot="tooltip-trigger"]')
    expect(trigger).toBeDefined()
    // And the regenerate button inside is disabled
    const btn = screen.getByTestId('analysis-cta-regenerate')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('Tooltip wrapper presente quando isDelivered=true, botão disabled', () => {
    const { container } = render(
      <AnalysisCTA
        readingId="r1"
        hasReport={true}
        regenerationCount={1}
        isDelivered={true}
        onTrigger={vi.fn()}
      />,
    )
    // Tooltip is rendered around the disabled button
    const trigger = container.querySelector('[data-slot="tooltip-trigger"]')
    expect(trigger).toBeDefined()
    const btn = screen.getByTestId('analysis-cta-regenerate')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })
})
