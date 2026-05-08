import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisStream } from '../AnalysisStream'

describe('components/readings/AnalysisStream — Surface 1 progress UI', () => {
  it('renderiza "0/13 seções" quando sectionsReceived=0', () => {
    render(<AnalysisStream sectionsReceived={0} />)
    expect(screen.getByText(/Gerando relatório… 0\/13 seções/)).toBeDefined()
  })

  it('renderiza "5/13 seções" quando sectionsReceived=5', () => {
    render(<AnalysisStream sectionsReceived={5} />)
    expect(screen.getByText(/Gerando relatório… 5\/13 seções/)).toBeDefined()
  })

  it('clamping: sectionsReceived=20 não estoura limite, mostra 13/13', () => {
    render(<AnalysisStream sectionsReceived={20} />)
    expect(screen.getByText(/Gerando relatório… 13\/13 seções/)).toBeDefined()
  })

  it('aria-live="polite" region presente para acessibilidade', () => {
    const { container } = render(<AnalysisStream sectionsReceived={3} />)
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toBeDefined()
  })

  it('renderiza copy de reasseguramento "Você pode atualizar a página — o progresso fica salvo"', () => {
    render(<AnalysisStream sectionsReceived={2} />)
    expect(screen.getByText(/Você pode atualizar a página/)).toBeDefined()
  })

  it('renderiza error fallback quando prop error é fornecida', () => {
    render(<AnalysisStream sectionsReceived={4} error="conexão perdida" />)
    expect(screen.getByText(/A geração foi interrompida/)).toBeDefined()
  })

  it('lista os 13 títulos das seções (1..13)', () => {
    render(<AnalysisStream sectionsReceived={0} />)
    expect(screen.getByText(/1\. Constituição/)).toBeDefined()
    expect(screen.getByText(/13\. Mensagem Final/)).toBeDefined()
  })
})
