/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReadingModeActions } from '../ReadingModeActions'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/app/actions/analise', () => ({
  markReadingDelivered: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('components/readings/ReadingModeActions (Plan 7.4-18 — UAT-3 reading-mode top buttons)', () => {
  it('renders 4 action buttons when not delivered (Plan 19: includes Exportar PDF)', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={0}
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    expect(screen.getByTestId('reading-mode-export-pdf')).toBeDefined()
    expect(screen.getByTestId('reading-mode-edit')).toBeDefined()
    expect(screen.getByTestId('reading-mode-deliver')).toBeDefined()
    expect(screen.getByTestId('reading-mode-regenerate')).toBeDefined()
  })

  it('Plan 19: ExportPdfButton link href = /leituras/[id]/print', () => {
    render(
      <ReadingModeActions
        readingId="reading-xyz"
        regenerationCount={0}
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    const pdf = screen.getByTestId('reading-mode-export-pdf')
    expect(pdf.getAttribute('href')).toBe('/leituras/reading-xyz/print')
  })

  it('Editar análise links to /leituras/[id]/editar', () => {
    render(
      <ReadingModeActions
        readingId="reading-abc"
        regenerationCount={0}
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    const editLink = screen.getByTestId('reading-mode-edit')
    expect(editLink.getAttribute('href')).toBe('/leituras/reading-abc/editar')
  })

  it('Regenerar análise shows {n}/3 counter', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={2}
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    expect(screen.getByText(/Regenerar análise \(2\/3\)/)).toBeDefined()
  })

  it('Regenerar disabled at 3/3 with tooltip explanation', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={3}
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    const regen = screen.getByTestId('reading-mode-regenerate')
    expect(regen.hasAttribute('disabled')).toBe(true)
    expect(regen.getAttribute('aria-label')).toContain('3/3')
  })

  it('isDelivered=true hides edit/deliver/regenerate but KEEPS Exportar PDF visible (Plan 19)', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={1}
        isDelivered={true}
        deliveredAt="2026-05-14T15:00:00.000Z"
      />,
    )
    // Plan 19: PDF stays visible — re-export of delivered reading is allowed
    expect(screen.getByTestId('reading-mode-export-pdf')).toBeDefined()
    // The 3 state-modifying buttons are hidden
    expect(screen.queryByTestId('reading-mode-edit')).toBeNull()
    expect(screen.queryByTestId('reading-mode-deliver')).toBeNull()
    expect(screen.queryByTestId('reading-mode-regenerate')).toBeNull()
    const status = screen.getByTestId('reading-mode-delivered-status')
    expect(status.textContent).toContain('Entregue ao cliente')
  })

  it('isDelivered=true with no deliveredAt still renders status without crashing', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={0}
        isDelivered={true}
        deliveredAt={null}
      />,
    )
    const status = screen.getByTestId('reading-mode-delivered-status')
    expect(status.textContent).toContain('Entregue ao cliente')
  })

  it('clicking Entregar opens DeliverDialog (rendered after click)', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={0}
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    // Dialog content not visible before click
    expect(screen.queryByText(/Entregar ao cliente\?/)).toBeNull()
    fireEvent.click(screen.getByTestId('reading-mode-deliver'))
    // Dialog title appears
    expect(screen.getByText(/Entregar ao cliente\?/)).toBeDefined()
  })
})
