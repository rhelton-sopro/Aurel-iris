/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportPdfButton } from '../ExportPdfButton'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const originalFetch = global.fetch
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom does not implement createObjectURL — stub for the download flow.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  global.fetch = originalFetch
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

describe('components/readings/ExportPdfButton (Plan 7.4-23 — direct PDF download)', () => {
  it('renders the "Exportar PDF" label with Download icon', () => {
    render(<ExportPdfButton readingId="reading-abc" />)
    expect(screen.getByText('Exportar PDF')).toBeDefined()
    expect(screen.getByTestId('reading-mode-export-pdf')).toBeDefined()
  })

  it('click → fetch GET /api/readings/[id]/pdf with credentials and download blob', async () => {
    const fakePdf = new Blob(['fake-pdf-bytes'], { type: 'application/pdf' })
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(fakePdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'attachment; filename="Leitura-Nailli-2026-05-15.pdf"',
        },
      }),
    )
    global.fetch = mockFetch as never

    render(<ExportPdfButton readingId="reading-abc" />)
    fireEvent.click(screen.getByTestId('reading-mode-export-pdf'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/readings/reading-abc/pdf',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled()
    })
  })

  it('displays Loader2 icon + "Gerando PDF…" label while pending', async () => {
    let resolveResp: (v: Response) => void = () => {}
    const blocking = new Promise<Response>((r) => {
      resolveResp = r
    })
    global.fetch = vi.fn().mockReturnValue(blocking) as never

    render(<ExportPdfButton readingId="reading-abc" />)
    fireEvent.click(screen.getByTestId('reading-mode-export-pdf'))

    await waitFor(() => {
      expect(screen.getByText('Gerando PDF…')).toBeDefined()
    })

    // Resolve to clean up the test
    resolveResp(
      new Response(new Blob(['x']), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )
  })

  it('on HTTP error, shows toast.error and does not crash', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Reading not found', { status: 404 }),
    ) as never

    const { toast } = (await import('sonner')) as unknown as {
      toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
    }

    render(<ExportPdfButton readingId="reading-abc" />)
    fireEvent.click(screen.getByTestId('reading-mode-export-pdf'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
