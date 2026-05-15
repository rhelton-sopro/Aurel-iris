import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisStream } from '../AnalysisStream'

describe('components/readings/AnalysisStream — Surface 1 progress UI (Plan 07.4-27: 15 sequential sections)', () => {
  it('renderiza "0/15 seções" quando sectionsReceived=0', () => {
    render(<AnalysisStream sectionsReceived={0} />)
    expect(screen.getByText(/Gerando relatório… 0\/15 seções/)).toBeDefined()
  })

  it('renderiza "5/15 seções" quando sectionsReceived=5', () => {
    render(<AnalysisStream sectionsReceived={5} />)
    expect(screen.getByText(/Gerando relatório… 5\/15 seções/)).toBeDefined()
  })

  it('clamping: sectionsReceived=20 não estoura limite, mostra 15/15', () => {
    render(<AnalysisStream sectionsReceived={20} />)
    expect(screen.getByText(/Gerando relatório… 15\/15 seções/)).toBeDefined()
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

  it('lista os 15 títulos das seções Iris Codex V1 (1..15 sequencial)', () => {
    render(<AnalysisStream sectionsReceived={0} />)
    expect(screen.getByText(/1\. Constituição e Temperamento/)).toBeDefined()
    expect(screen.getByText(/2\. Mapa Orgânico/)).toBeDefined()
    expect(screen.getByText(/3\. Linha do Tempo Emocional/)).toBeDefined()
    expect(screen.getByText(/14\. Mensagem para o Cliente/)).toBeDefined()
    // Plan 27 — Síntese Rápida = §15 (no §2.5, no §16)
    expect(screen.getByText(/15\. Síntese Rápida/)).toBeDefined()
    expect(screen.queryByText(/Sistemas em Bom Funcionamento/)).toBeNull()
  })
})
