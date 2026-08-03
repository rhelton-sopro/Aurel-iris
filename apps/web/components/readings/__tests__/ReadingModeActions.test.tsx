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
  it('renders 3 action buttons when not delivered (Plan 19)', () => {
    render(
      <ReadingModeActions readingId="reading-123" isDelivered={false} deliveredAt={null} />,
    )
    expect(screen.getByTestId('reading-mode-export-pdf')).toBeDefined()
    expect(screen.getByTestId('reading-mode-edit')).toBeDefined()
    expect(screen.getByTestId('reading-mode-deliver')).toBeDefined()
  })

  it('"Regenerar análise" NÃO existe mais — nem para founder (founder, 2026-08-03)', () => {
    render(
      <ReadingModeActions readingId="reading-123" isDelivered={false} deliveredAt={null} />,
    )
    expect(screen.queryByTestId('reading-mode-regenerate')).toBeNull()
    expect(screen.queryByText(/Regenerar/i)).toBeNull()
  })

  it('Plan 23: ExportPdfButton renders as Button (no href — direct fetch + blob download)', () => {
    render(
      <ReadingModeActions
        readingId="reading-xyz"
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
    // 2026-07-30: o botão passou a nomear o DOCUMENTO ("Dossiê"), não a ação, agora
    // que a leitura tem dois relatórios — o Dossiê e o Mapa do Ser.
    expect(pdf.textContent).toContain('Dossiê')
  })

  it('Editar análise links to /leituras/[id]/editar', () => {
    render(
      <ReadingModeActions
        readingId="reading-abc"
        isDelivered={false}
        deliveredAt={null}
      />,
    )
    const editLink = screen.getByTestId('reading-mode-edit')
    expect(editLink.getAttribute('href')).toBe('/leituras/reading-abc/editar')
  })

  it('isDelivered=true hides edit/deliver but KEEPS o PDF do Dossiê visível (Plan 19)', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
        isDelivered={true}
        deliveredAt="2026-05-14T15:00:00.000Z"
      />,
    )
    // Plan 19: PDF stays visible — re-export of delivered reading is allowed
    expect(screen.getByTestId('reading-mode-export-pdf')).toBeDefined()
    // Os botões que MODIFICAM estado somem
    expect(screen.queryByTestId('reading-mode-edit')).toBeNull()
    expect(screen.queryByTestId('reading-mode-deliver')).toBeNull()
    const status = screen.getByTestId('reading-mode-delivered-status')
    expect(status.textContent).toContain('Leitura concluída')
  })

  it('isDelivered=true with no deliveredAt still renders status without crashing', () => {
    render(
      <ReadingModeActions
        readingId="reading-123"
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
        isDelivered={false}
        deliveredAt={null}
        isSelfReading={true}
      />,
    )
    // Os outros botões seguem renderizando — só o deliver é escondido
    expect(screen.getByTestId('reading-mode-export-pdf')).toBeDefined()
    expect(screen.getByTestId('reading-mode-edit')).toBeDefined()
    expect(screen.queryByTestId('reading-mode-deliver')).toBeNull()
  })
})
