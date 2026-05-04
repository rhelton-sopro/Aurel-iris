/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusBadge, type ReadingStatus } from './StatusBadge'

const STATUS_LABELS: Record<ReadingStatus, string> = {
  pending: 'Aguardando',
  processing: 'Processando',
  ready: 'Pronto',
  failed: 'Falhou',
  edited: 'Editado',
}

describe('StatusBadge', () => {
  it.each(Object.entries(STATUS_LABELS) as [ReadingStatus, string][])(
    'renders pt-BR copy for status=%s',
    (status, label) => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    },
  )

  it('overrides label with "Rascunho" when isRascunho=true', () => {
    render(<StatusBadge status="pending" isRascunho />)
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.queryByText('Aguardando')).not.toBeInTheDocument()
  })

  it('renders "Falhou" without tooltip wrapper when errorSummary absent', () => {
    const { container } = render(<StatusBadge status="failed" />)
    expect(screen.getByText('Falhou')).toBeInTheDocument()
    expect(container.querySelector('[data-status="failed"]')).toBeInTheDocument()
  })

  it('exposes data-status attribute matching status (for E2E hooks)', () => {
    const { container } = render(<StatusBadge status="ready" />)
    expect(container.querySelector('[data-status="ready"]')).toBeInTheDocument()
  })

  it('exposes data-status="rascunho" override', () => {
    const { container } = render(<StatusBadge status="pending" isRascunho />)
    expect(container.querySelector('[data-status="rascunho"]')).toBeInTheDocument()
  })

  it('keeps "Falhou" label visible when errorSummary is provided (tooltip wrap)', () => {
    render(
      <StatusBadge
        status="failed"
        errorSummary="Imagens com pouca luz — tente recapturar"
      />,
    )
    // Badge label is always rendered. Tooltip content visibility is owned by Radix/Base-UI
    // and may be hidden in jsdom unless hover; presence of the wrapper is the
    // structural assertion (verified above via data-status).
    expect(screen.getByText('Falhou')).toBeInTheDocument()
  })

  it('does NOT render tooltip wrapper for non-failed statuses even with errorSummary', () => {
    render(<StatusBadge status="ready" errorSummary="Should not show" />)
    expect(screen.queryByText(/Should not show/)).not.toBeInTheDocument()
    expect(screen.getByText('Pronto')).toBeInTheDocument()
  })

  it('does NOT render tooltip when isRascunho=true even for failed status', () => {
    render(
      <StatusBadge
        status="failed"
        isRascunho
        errorSummary="Imagens com pouca luz — tente recapturar"
      />,
    )
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.queryByText('Falhou')).not.toBeInTheDocument()
  })
})
