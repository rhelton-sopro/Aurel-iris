import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisStream } from '../AnalysisStream'

describe('components/readings/AnalysisStream — Surface 1 progress UI (Plan 07.4-22: 16 sections including §2.5 and §16)', () => {
  it('renderiza "0/16 seções" quando sectionsReceived=0', () => {
    render(<AnalysisStream sectionsReceived={0} />)
    expect(screen.getByText(/Gerando relatório… 0\/16 seções/)).toBeDefined()
  })

  it('renderiza "5/16 seções" quando sectionsReceived=5', () => {
    render(<AnalysisStream sectionsReceived={5} />)
    expect(screen.getByText(/Gerando relatório… 5\/16 seções/)).toBeDefined()
  })

  it('clamping: sectionsReceived=20 não estoura limite, mostra 16/16', () => {
    render(<AnalysisStream sectionsReceived={20} />)
    expect(screen.getByText(/Gerando relatório… 16\/16 seções/)).toBeDefined()
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

  it('lista os 16 títulos das seções Iris Codex V1 (1, 2, 2.5, 3..14, 16)', () => {
    render(<AnalysisStream sectionsReceived={0} />)
    expect(screen.getByText(/1\. Constituição e Temperamento/)).toBeDefined()
    expect(screen.getByText(/2\. Mapa Orgânico/)).toBeDefined()
    expect(screen.getByText(/2\.5\. Sistemas em Bom Funcionamento/)).toBeDefined()
    expect(screen.getByText(/3\. Linha do Tempo Emocional/)).toBeDefined()
    expect(screen.getByText(/14\. Mensagem para o Cliente/)).toBeDefined()
    // Plan 22 — §16 Síntese Rápida (skip 15)
    expect(screen.getByText(/16\. Síntese Rápida/)).toBeDefined()
  })
})
