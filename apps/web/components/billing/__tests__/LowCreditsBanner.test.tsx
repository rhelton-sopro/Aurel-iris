/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let pathname = '/dashboard'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

import { LowCreditsBanner } from '../LowCreditsBanner'

describe('LowCreditsBanner', () => {
  it('mostra nudge quando saldo baixo (0 < n ≤ 3) + link pra /assinatura/comprar', () => {
    pathname = '/dashboard'
    render(<LowCreditsBanner creditsRemaining={2} />)
    expect(screen.getByText(/créditos estão acabando/i)).toBeInTheDocument()
    expect(screen.getByText(/2 leituras restantes/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /comprar mais/i })).toHaveAttribute(
      'href',
      '/assinatura/comprar',
    )
  })

  it('usa singular com 1 leitura restante', () => {
    pathname = '/dashboard'
    render(<LowCreditsBanner creditsRemaining={1} />)
    expect(screen.getByText(/1 leitura restante/i)).toBeInTheDocument()
  })

  it('mostra no limiar exato (2)', () => {
    pathname = '/dashboard'
    render(<LowCreditsBanner creditsRemaining={2} />)
    expect(screen.getByTestId('low-credits-banner')).toBeInTheDocument()
  })

  it('esconde quando saldo 0 (trial/paywall, não é "acabando")', () => {
    pathname = '/dashboard'
    const { container } = render(<LowCreditsBanner creditsRemaining={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('esconde logo acima do limiar (3) — não cutuca cedo demais', () => {
    pathname = '/dashboard'
    const { container } = render(<LowCreditsBanner creditsRemaining={3} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('esconde na própria /assinatura (redundante)', () => {
    pathname = '/assinatura/comprar'
    const { container } = render(<LowCreditsBanner creditsRemaining={2} />)
    expect(container).toBeEmptyDOMElement()
  })
})
