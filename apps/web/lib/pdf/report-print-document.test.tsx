/**
 * @vitest-environment jsdom
 *
 * Guards the Gotenberg input — the HTML string this builds IS the PDF (Plan
 * 7.4-26). A live Gotenberg isn't needed to catch template regressions.
 */
import { describe, it, expect, beforeAll } from 'vitest'

import {
  renderReportPrintHtml,
  renderFooterHtml,
  buildPdfFilename,
} from './report-print-document'

const SECTIONS = {
  '1_constituicao_temperamento':
    '## 1. Constituição e Temperamento\n\nFibras compactas e densas.\n\nSegundo parágrafo de respiro.',
  '16_sintese_rapida':
    '## 16. Síntese Rápida\n\n### 🔴 Fragilidades\n\n- Sistema linfático sob carga\n\n### 🟢 Forças\n\n- Vitalidade preservada',
  encerramento_disclaimer:
    '> Este relatório é ferramenta de apoio à anamnese terapêutica integrativa.',
}

describe('renderReportPrintHtml', () => {
  let html = ''
  beforeAll(async () => {
    html = await renderReportPrintHtml({
      sections: SECTIONS,
      clientName: 'Nailli Test',
      readingDate: '2026-05-15T12:00:00.000Z',
    })
  })

  it('is a complete standalone HTML document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<html lang="pt-BR">')
    expect(html).toContain('</html>')
  })

  it('renders brand header + client name + styled section title', () => {
    expect(html).toContain('Iris Codex')
    expect(html).toContain('Nailli Test')
    expect(html).toContain('1. Constituição e Temperamento')
    expect(html).toContain('Fibras compactas e densas.')
  })

  it('renders §16 as a CSS grid of subsection cards (Chromium supports grid)', () => {
    expect(html).toContain('sintese-grid')
    expect(html).toContain('sintese-card')
    expect(html).toContain('🔴 Fragilidades')
    expect(html).toContain('🟢 Forças')
  })

  it('renders the disclaimer block when present', () => {
    expect(html).toContain('class="disclaimer"')
    expect(html).toContain('apoio à anamnese terapêutica integrativa')
  })

  it('strips the duplicate leading `## N.` heading from the body', () => {
    expect(html).not.toContain('## 1. Constituição')
  })
})

describe('renderFooterHtml', () => {
  it('is a complete doc with Chromium pageNumber/totalPages hooks + escaped name', () => {
    const footer = renderFooterHtml('A & B <x>', 'Linha de aviso.')
    expect(footer.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(footer).toContain('class="pageNumber"')
    expect(footer).toContain('class="totalPages"')
    expect(footer).toContain('A &amp; B &lt;x&gt;')
  })
})

describe('buildPdfFilename', () => {
  it('strips accents/spaces and appends the reading date', () => {
    expect(buildPdfFilename('Náilli São João', '2026-05-15T00:00:00.000Z')).toBe(
      'Leitura-Nailli-Sao-Joao-2026-05-15.pdf',
    )
  })

  it('falls back to "cliente" and today when name empty / date null', () => {
    const name = buildPdfFilename('', null)
    expect(name).toMatch(/^Leitura-cliente-\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})
