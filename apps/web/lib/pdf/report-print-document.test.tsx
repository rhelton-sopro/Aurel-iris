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
  '14_mensagem_cliente':
    '## 14. Mensagem para o Cliente\n\nQuerida Nailli, este é o seu momento.',
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

  it('renders a full-bleed cover with the inlined logo + client name', () => {
    expect(html).toContain('class="cover"')
    expect(html).toContain('class="cover-glow"')
    expect(html).toContain('src="data:image/png;base64,')
    expect(html).toContain('A íris como mapa do ser')
    expect(html).toContain('class="cover-name">Nailli Test')
  })

  it('renders section eyebrow + title + teal rule (no inline `N.` prefix)', () => {
    expect(html).toContain('Seção 1')
    expect(html).toContain('Constituição e Temperamento')
    expect(html).toContain('class="sec-rule"')
    expect(html).toContain('Fibras compactas e densas.')
    // The "1. " numeric prefix is now the eyebrow, not glued to the title.
    expect(html).not.toContain('>1. Constituição e Temperamento<')
  })

  it('renders §14 Mensagem as a letter, not a plain section body', () => {
    expect(html).toContain('report-section letter')
    expect(html).toContain('class="letter-body"')
    expect(html).toContain('este é o seu momento')
  })

  it('renders §16 as a card grid with per-card accent borders', () => {
    expect(html).toContain('sintese-grid')
    expect(html).toContain('sintese-card')
    expect(html).toContain('🔴 Fragilidades')
    expect(html).toContain('🟢 Forças')
    // First card accent = teal-dark from SINTESE_ACCENTS[0].
    expect(html.toLowerCase()).toContain('border-left-color:#1e6b61')
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
