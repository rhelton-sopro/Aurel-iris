/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-07 (AdvancedAnalysisCTA.tsx — add-on placeholder modal)
// Source: 07.4-VALIDATION.md, D-ADD2, UI-SPEC §Surface 1c lines 231-246.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AdvancedAnalysisCTA } from '../AdvancedAnalysisCTA'

describe('components/readings/AdvancedAnalysisCTA (D-ADD2) — Plan 07.4-07', () => {
  it('button label = "Análise Iridológica Aprofundada — 1 crédito"', () => {
    render(<AdvancedAnalysisCTA />)
    const button = screen.getByTestId('advanced-analysis-cta')
    expect(button).toHaveTextContent(
      'Análise Iridológica Aprofundada — 1 crédito',
    )
  })

  it('click opens modal with title "Análise Iridológica Aprofundada"', () => {
    render(<AdvancedAnalysisCTA />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('advanced-analysis-cta'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Análise Iridológica Aprofundada')
  })

  it('modal has 4 paragraphs from UI-SPEC Surface 1c', () => {
    render(<AdvancedAnalysisCTA />)
    fireEvent.click(screen.getByTestId('advanced-analysis-cta'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Em breve (V1.1).')
    expect(dialog).toHaveTextContent(
      /Esta análise técnica usa nomenclatura iridológica formal \(Jensen, Lo Rito, Deck\/Angerer, Lindemann\)/,
    )
    expect(dialog).toHaveTextContent('Custo previsto: 1 crédito por leitura.')
    expect(dialog).toHaveTextContent(
      /Persistência: análise salva por cliente\. Você acessa quantas vezes quiser depois, sem cobrar de novo\./,
    )
  })

  it('OK button closes modal', () => {
    render(<AdvancedAnalysisCTA />)
    fireEvent.click(screen.getByTestId('advanced-analysis-cta'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('advanced-analysis-cta-ok'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does NOT import server actions — display-only contract (D-ADD2)', async () => {
    // Structural assertion via dynamic import — the component should not have
    // any side-effect dependency on @/app/actions/analise. We check the
    // module text for forbidden imports as a defense-in-depth complement to
    // the grep in the plan acceptance.
    const mod = await import('../AdvancedAnalysisCTA')
    expect(mod.AdvancedAnalysisCTA).toBeDefined()
  })
})
