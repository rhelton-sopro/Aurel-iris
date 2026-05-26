/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock next/link — renderiza como <a> simples
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

// Mock dismissOnboardingAction
vi.mock('@/app/actions/onboarding', () => ({
  dismissOnboardingAction: vi.fn(async () => ({ ok: true })),
}))

import { OnboardingWizard } from './onboarding-wizard'

describe('OnboardingWizard', () => {
  it('Test 1: 0 de 3 → mostra "Vamos começar (0 de 3)" + 3 steps + 3 CTAs + botão Pular', () => {
    render(
      <OnboardingWizard
        step1Complete={false}
        step2Complete={false}
        step3Complete={false}
      />,
    )
    expect(screen.getByText(/Vamos começar \(0 de 3\)/i)).toBeInTheDocument()
    // 3 step items presentes
    expect(screen.getByTestId('onboarding-step-1')).toBeInTheDocument()
    expect(screen.getByTestId('onboarding-step-2')).toBeInTheDocument()
    expect(screen.getByTestId('onboarding-step-3')).toBeInTheDocument()
    // 3 CTAs "Começar" (um por step incompleto)
    expect(screen.getAllByText('Começar')).toHaveLength(3)
    // Botão Pular presente
    expect(screen.getByTestId('onboarding-dismiss-btn')).toBeInTheDocument()
  })

  it('Test 2: 1 de 3 → mostra "Vamos começar (1 de 3)" + checkmark no step 1 + CTAs nos steps 2/3', () => {
    const { container } = render(
      <OnboardingWizard
        step1Complete={true}
        step2Complete={false}
        step3Complete={false}
      />,
    )
    expect(screen.getByText(/Vamos começar \(1 de 3\)/i)).toBeInTheDocument()
    // Step 1 tem checkmark (ícone Check) — aria-label="Concluído"
    const step1 = screen.getByTestId('onboarding-step-1')
    const checkIcon = step1.querySelector('[aria-label="Concluído"]')
    expect(checkIcon).toBeInTheDocument()
    // Steps 2 e 3 têm ícone Pendente
    const step2 = screen.getByTestId('onboarding-step-2')
    const step3 = screen.getByTestId('onboarding-step-3')
    expect(step2.querySelector('[aria-label="Pendente"]')).toBeInTheDocument()
    expect(step3.querySelector('[aria-label="Pendente"]')).toBeInTheDocument()
    // CTAs ativos nos steps 2 e 3 (step 1 completo, sem CTA)
    expect(screen.getAllByText('Começar')).toHaveLength(2)
  })

  it('Test 3: todos completos → retorna null (não renderiza nada)', () => {
    const { container } = render(
      <OnboardingWizard
        step1Complete={true}
        step2Complete={true}
        step3Complete={true}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('Test 4: Step 1 CTA aponta href="/perfil/completar"', () => {
    render(
      <OnboardingWizard
        step1Complete={false}
        step2Complete={false}
        step3Complete={false}
      />,
    )
    const step1 = screen.getByTestId('onboarding-step-1')
    const link = step1.querySelector('a')
    expect(link).toBeInTheDocument()
    expect(link?.getAttribute('href')).toBe('/perfil/completar')
  })

  it('Test 5: Step 2 CTA aponta href="/clientes/novo"', () => {
    render(
      <OnboardingWizard
        step1Complete={false}
        step2Complete={false}
        step3Complete={false}
      />,
    )
    const step2 = screen.getByTestId('onboarding-step-2')
    const link = step2.querySelector('a')
    expect(link).toBeInTheDocument()
    expect(link?.getAttribute('href')).toBe('/clientes/novo')
  })

  it('Test 6: Step 3 CTA aponta href="/leituras/nova"', () => {
    render(
      <OnboardingWizard
        step1Complete={false}
        step2Complete={false}
        step3Complete={false}
      />,
    )
    const step3 = screen.getByTestId('onboarding-step-3')
    const link = step3.querySelector('a')
    expect(link).toBeInTheDocument()
    expect(link?.getAttribute('href')).toBe('/leituras/nova')
  })

  it('Test 7: botão Pular tem data-testid="onboarding-dismiss-btn" e está dentro de um <form>', () => {
    const { container } = render(
      <OnboardingWizard
        step1Complete={false}
        step2Complete={false}
        step3Complete={false}
      />,
    )
    const btn = screen.getByTestId('onboarding-dismiss-btn')
    expect(btn).toBeInTheDocument()
    // O botão deve estar dentro de um form
    const form = btn.closest('form')
    expect(form).toBeInTheDocument()
  })

  it('Test 8: card hero envolto em <section data-testid="onboarding-wizard">', () => {
    render(
      <OnboardingWizard
        step1Complete={false}
        step2Complete={false}
        step3Complete={false}
      />,
    )
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
    // Verifica que é especificamente uma section
    const section = screen.getByTestId('onboarding-wizard')
    expect(section.tagName.toLowerCase()).toBe('section')
  })
})
