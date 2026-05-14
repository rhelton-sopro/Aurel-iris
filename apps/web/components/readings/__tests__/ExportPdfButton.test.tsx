/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExportPdfButton } from '../ExportPdfButton'

describe('components/readings/ExportPdfButton (Plan 7.4-19 — print page navigation)', () => {
  it('renders a link to /leituras/[readingId]/print', () => {
    render(<ExportPdfButton readingId="reading-abc-123" />)
    const link = screen.getByTestId('reading-mode-export-pdf')
    expect(link.getAttribute('href')).toBe('/leituras/reading-abc-123/print')
  })

  it('renders the "Exportar PDF" label', () => {
    render(<ExportPdfButton readingId="reading-abc" />)
    expect(screen.getByText('Exportar PDF')).toBeDefined()
  })

  it('renders the Download icon (lucide svg)', () => {
    const { container } = render(<ExportPdfButton readingId="reading-abc" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })
})
