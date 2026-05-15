/**
 * @vitest-environment jsdom
 *
 * Guards the Gotenberg input — the HTML string this builds IS the PDF.
 * Plan 27: 15 sequential sections, ivory cover, single-line heading, TOC,
 * §2 two-subsection, §15 tinted cards, transparent footer.
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
  '2_mapa_organico':
    '## 2. Mapa Orgânico\n\nVisão completa do organismo.\n\n### Sistemas que requerem atenção\n\nFígado sob carga.\n\n### Sistemas em bom funcionamento\n\nDigestivo preservado.',
  '14_mensagem_cliente':
    '## 14. Mensagem para o Cliente\n\nQuerida Nailli, este é o seu momento.',
  '15_sintese_rapida':
    '## 15. Síntese Rápida\n\n### 🔴 Fragilidades\n\n- Sistema linfático sob carga\n\n### 🟢 Forças\n\n- Vitalidade preservada',
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

  it('renders the ivory cover with the inlined light logo + client name', () => {
    expect(html).toContain('class="cover"')
    expect(html).toContain('class="cover-logo"')
    expect(html).toContain('src="data:image/png;base64,')
    expect(html).toContain('A íris como mapa do ser.')
    expect(html).toContain('class="cover-divider"')
    expect(html).toContain('Leitura Iridológica Clínico-Funcional')
    expect(html).toContain('class="cover-name">Nailli Test')
    expect(html).toContain('class="cover-wordmark">Iris Codex')
    // Plan 27 removed the black cover + radial glow.
    expect(html).not.toContain('class="cover-glow"')
  })

  it('renders an Índice (TOC) page listing the present sections', () => {
    expect(html).toContain('class="toc"')
    expect(html).toContain('Índice')
    expect(html).toContain('class="toc-leader"')
    expect(html).toContain('class="toc-name">Constituição e Temperamento')
    expect(html).toContain('class="toc-name">Síntese Rápida')
  })

  it('renders single-line heading "N — Title" + teal rule (no "Seção" eyebrow)', () => {
    expect(html).toContain('class="sec-title"')
    expect(html).toContain('class="sec-num">1')
    expect(html).toContain('class="sec-dash"> — ')
    expect(html).toContain('Constituição e Temperamento')
    expect(html).toContain('class="sec-rule"')
    expect(html).not.toContain('Seção 1')
  })

  it('renders §2 with both markdown subsections', () => {
    expect(html).toContain('Sistemas que requerem atenção')
    expect(html).toContain('Sistemas em bom funcionamento')
    expect(html).toContain('Fígado sob carga.')
    expect(html).toContain('Digestivo preservado.')
  })

  it('renders §14 Mensagem as a letter, not a plain section body', () => {
    expect(html).toContain('report-section letter')
    expect(html).toContain('class="letter-body"')
    expect(html).toContain('este é o seu momento')
  })

  it('renders §15 as tinted cards with per-card accent + tint', () => {
    expect(html).toContain('sintese-grid')
    expect(html).toContain('sintese-card')
    expect(html).toContain('🔴 Fragilidades')
    expect(html).toContain('🟢 Forças')
    // First card (Fragilidades) accent #C0392B + bg #FBF4F3 from SINTESE_CARD[0].
    const lc = html.toLowerCase()
    expect(lc).toContain('border-left-color:#c0392b')
    expect(lc).toContain('background-color:#fbf4f3')
  })

  it('renders the disclaimer block when present', () => {
    expect(html).toContain('class="disclaimer"')
    expect(html).toContain('apoio à anamnese terapêutica integrativa')
  })

  it('strips the duplicate leading `## N.` heading from the body', () => {
    expect(html).not.toContain('## 1. Constituição')
    expect(html).not.toContain('## 15. Síntese')
  })
})

describe('renderFooterHtml', () => {
  it('is a complete transparent doc with pageNumber/totalPages + escaped name', () => {
    const footer = renderFooterHtml('A & B <x>', 'Linha de aviso.')
    expect(footer.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(footer).toContain('class="cur pageNumber"')
    expect(footer).toContain('class="totalPages"')
    expect(footer).toContain('A &amp; B &lt;x&gt;')
    // Plan 27 removed the ivory plinth — footer background is transparent.
    expect(footer).toContain('background:transparent')
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
