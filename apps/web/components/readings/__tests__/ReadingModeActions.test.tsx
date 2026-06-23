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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/app/actions/analise', () => ({
  markReadingDelivered: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('components/readings/ReadingModeActions (Plan 7.4-18 — UAT-3 reading-mode top buttons)', () => {
  it('founder: renders 4 action buttons when not delivered (Plan 19 + regen founder-only 2026-06-03)', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={0}
        isDelivered={false}
        deliveredAt={null}
        isFounder={true}
      />,
    )
    expect(screen.getByTestId('reading-mode-export-pdf')).toBeDefined()
    expect(screen.getByTestId('reading-mode-edit')).toBeDefined()
    expect(screen.getByTestId('reading-mode-deliver')).toBeDefined()
    expect(screen.getByTestId('reading-mode-regenerate')).toBeDefined()
  })

  it('terapeuta (não-founder): regen escondido — só 3 botões (2026-06-03)', () => {
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
    // Regen é exclusivo do founder agora — terapeuta nunca vê.
    expect(screen.queryByTestId('reading-mode-regenerate')).toBeNull()
  })

  it('Plan 23: ExportPdfButton renders as Button (no href — direct fetch + blob download)', () => {
    render(
      <ReadingModeActions
        readingId="reading-xyz"
        regenerationCount={0}
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    const pdf = screen.getByTestId('reading-mode-export-pdf')
    // Plan 23 (UAT-4 fix #3): ExportPdfButton was a Link to /print under
    // Plan 19; now it's a Button with onClick → fetch /api/readings/[id]/pdf
    // → blob download. No href anymore.
    expect(pdf.tagName.toLowerCase()).toBe('button')
    expect(pdf.getAttribute('href')).toBeNull()
    expect(pdf.textContent).toContain('Exportar PDF')
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

  it('Regenerar análise shows {n}/1 counter (cap = 1 regen grátis)', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={1}
        isDelivered={false}
        deliveredAt={null}
        isFounder={true}
      />,
    )
    // count=1 (1 geração feita, 0 regen usado) → exibe (0/1)
    expect(screen.getByText(/Regenerar análise \(0\/1\)/)).toBeDefined()
  })

  it('Regenerar disabled at 2/1 (1 regen usado) with tooltip explanation', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={2}
        isDelivered={false}
        deliveredAt={null}
        isFounder={true}
      />,
    )
    const regen = screen.getByTestId('reading-mode-regenerate')
    expect(regen.hasAttribute('disabled')).toBe(true)
    expect(regen.getAttribute('aria-label')).toContain('1/1')
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
    expect(status.textContent).toContain('Leitura concluída')
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
    expect(status.textContent).toContain('Leitura concluída')
  })

  it('clicking Concluir leitura opens DeliverDialog (rendered after click)', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        regenerationCount={0}
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    // Dialog content not visible before click
    expect(screen.queryByText(/Concluir leitura\?/)).toBeNull()
    fireEvent.click(screen.getByTestId('reading-mode-deliver'))
    // Dialog title appears
    expect(screen.getByText(/Concluir leitura\?/)).toBeDefined()
  })

  it('autoexame (isSelfReading=true): hides "Concluir leitura" button (2026-05-21)', () => {
    render(
      <ReadingModeActions
        readingId="reading-self"
        regenerationCount={0}
        isDelivered={false}
        deliveredAt={null}
        isSelfReading={true}
        isFounder={true}
      />,
    )
    // Outros 3 botões seguem renderizando — só o deliver é escondido
    expect(screen.getByTestId('reading-mode-export-pdf')).toBeDefined()
    expect(screen.getByTestId('reading-mode-edit')).toBeDefined()
    expect(screen.getByTestId('reading-mode-regenerate')).toBeDefined()
    expect(screen.queryByTestId('reading-mode-deliver')).toBeNull()
  })
})
