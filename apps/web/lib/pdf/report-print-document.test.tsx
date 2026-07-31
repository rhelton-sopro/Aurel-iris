/**
 * @vitest-environment jsdom
 *
 * Guards the Gotenberg input — the HTML this builds IS the PDF.
 * Plan 7.4-28 (UAT iter-4): split render (cover / body), horizontal-logo
 * header, white cover, "Em poucas palavras" essence page, TOC nav footnote.
 */
import { describe, it, expect, beforeAll } from 'vitest'

import {
  renderCoverHtml,
  renderBodyHtml,
  renderHeaderHtml,
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
  essence_phrase:
    'Um organismo que aprendeu a sustentar — e que agora pede permissão para ser sustentado.',
  encerramento_disclaimer:
    '> Este relatório é ferramenta de apoio à anamnese terapêutica integrativa.',
}

const PROPS = {
  sections: SECTIONS,
  clientName: 'Nailli Test',
  readingDate: '2026-05-15T12:00:00.000Z',
}

describe('renderCoverHtml', () => {
  const html = renderCoverHtml(PROPS)

  it('is a complete standalone HTML document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<html lang="pt-BR">')
    expect(html).toContain('</html>')
  })

  it('renders the WHITE cover with inlined logo + client name, no header', () => {
    expect(html).toContain('class="cover"')
    expect(html).toContain('class="cover-logo"')
    expect(html).toContain('src="data:image/png;base64,')
    expect(html).toContain('A íris como mapa do ser.')
    expect(html).toContain('class="cover-divider"')
    // 2026-07-30: default neutro. "Clínico-Funcional" saiu (enfoque não-médico) e o
    // rótulo real passou a vir da rota, por variante: "Dossiê" / "Leitura Iridológica".
    expect(html).toContain('Leitura Iridológica')
    expect(html).not.toContain('Clínico')
    expect(html).toContain('class="cover-name">Nailli Test')
    expect(html).toContain('class="cover-wordmark">Iris Codex')
    // White cover (CHANGE 2): --white token is #FFFFFF and the cover uses it.
    expect(html).toContain('--white:#FFFFFF')
    expect(html).toContain('.cover {')
    expect(html).toContain('background: var(--white)')
    // No black cover / radial glow; no running header on the cover.
    expect(html).not.toContain('class="cover-glow"')
    expect(html).not.toContain('class="hd"')
    // Cover doc carries no TOC / sections.
    expect(html).not.toContain('class="toc"')
  })
})

describe('renderBodyHtml', () => {
  let html = ''
  beforeAll(async () => {
    html = await renderBodyHtml(PROPS)
  })

  it('is a complete standalone HTML document (no cover)', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('</html>')
    expect(html).not.toContain('class="cover"')
  })

  it('renders an Índice page with dotted leaders (no technical footnote)', () => {
    expect(html).toContain('class="toc"')
    expect(html).toContain('Índice')
    expect(html).toContain('class="toc-leader"')
    expect(html).toContain('class="toc-name">Constituição e Temperamento')
    expect(html).toContain('class="toc-name">Síntese Rápida')
    expect(html).not.toContain('class="toc-foot"')
    expect(html).not.toContain('Ctrl+F')
  })

  it('TOC rows are clickable anchor links + body has a well-formed outline root', () => {
    // Hidden h1 outline root (survives in the heading tree, not display:none)
    expect(html).toContain('class="doc-title"')
    expect(html).toMatch(/<h1[^>]*class="doc-title"/)
    // Each Índice row is an <a href="#sec-N"> (GoTo link, survives pdfcpu merge)
    expect(html).toMatch(/<a class="toc-row"[^>]*href="#sec-1"/)
    expect(html).toMatch(/<a class="toc-row"[^>]*href="#sec-15"/)
    // The jump targets exist on the sections
    expect(html).toContain('id="sec-1"')
    expect(html).toContain('id="sec-15"')
  })

  it('renders the "Em poucas palavras" essence page when present', () => {
    expect(html).toContain('class="essence-page"')
    expect(html).toContain('class="essence-label">Em poucas palavras')
    expect(html).toContain('aprendeu a sustentar')
    expect(html).toContain('class="essence-divider"')
    expect(html).toContain('essência que atravessa este relatório')
  })

  it('omits the essence page when essence_phrase is absent', async () => {
    const noEssence = { ...SECTIONS } as Record<string, string>
    delete noEssence.essence_phrase
    const h = await renderBodyHtml({ ...PROPS, sections: noEssence })
    expect(h).not.toContain('class="essence-page"')
  })

  it('renders single-line heading "N — Title" + teal rule', () => {
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

  it('renders §14 Mensagem as a letter', () => {
    expect(html).toContain('report-section letter')
    expect(html).toContain('class="letter-body"')
    expect(html).toContain('este é o seu momento')
  })

  it('renders §15 as tinted cards with per-card accent + tint', () => {
    expect(html).toContain('sintese-grid')
    expect(html).toContain('sintese-card')
    expect(html).toContain('🔴 Fragilidades')
    expect(html).toContain('🟢 Forças')
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

describe('renderHeaderHtml', () => {
  it('is a complete doc with horizontal logo + client + page counters', () => {
    const header = renderHeaderHtml('A & B <x>')
    expect(header.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(header).toContain('src="data:image/png;base64,')
    expect(header).toContain('class="pageNumber"')
    expect(header).toContain('class="totalPages"')
    expect(header).toContain('A &amp; B &lt;x&gt;')
    expect(header).toContain('border-bottom:1px solid #3D9B8C')
    expect(header).toContain('background:transparent')
  })

  it('FIX 4 — label is "p. {pageNumber} / {totalPages}" (cover excluded by split-merge)', () => {
    // Chromium fills .pageNumber/.totalPages within the BODY render only —
    // the cover is a separate PDF merged in front, so it is excluded from
    // the count (Índice = p.1, disclaimer = p.N/N, total = body pages).
    const header = renderHeaderHtml('Nailli')
    expect(header).toMatch(
      /p\.\s*<span class="pageNumber"><\/span>\s*\/\s*<span class="totalPages"><\/span>/,
    )
  })
})

describe('renderFooterHtml', () => {
  it('is a transparent doc with brand + escaped name, no page number', () => {
    const footer = renderFooterHtml('A & B <x>', 'Linha de aviso.')
    expect(footer.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(footer).toContain('A &amp; B &lt;x&gt;')
    expect(footer).toContain('Iris Codex')
    expect(footer).toContain('background:transparent')
    // Page numbering moved to the header (Plan 7.4-28).
    expect(footer).not.toContain('class="cur pageNumber"')
    expect(footer).not.toContain('class="totalPages"')
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
