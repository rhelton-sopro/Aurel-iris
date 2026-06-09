/**
 * Iris Codex report → PDF (Gotenberg / headless Chromium on Render).
 *
 * Plan 7.4-28 (UAT iter-4) — SPLIT architecture:
 *   The cover must stay full-bleed with NO running header, while every other
 *   page carries a horizontal-logo header. Chromium print headers apply to
 *   ALL pages with no per-page skip, so the route renders TWO PDFs and merges:
 *     1. COVER  — renderCoverHtml  → its own PDF, zero margins, no header/footer
 *     2. BODY   — renderBodyHtml   → Índice + "Em poucas palavras" + §1..§15 +
 *                disclaimer, with the Gotenberg header.html (horizontal logo +
 *                client + p.N/total) and a slim footer band
 *   The two are concatenated via Gotenberg /forms/pdfengines/merge. Page
 *   numbers in the header therefore count BODY pages — "p. 1" is the Índice
 *   (the cover is page 1 of the final doc but excluded from the count, which
 *   reads correctly as "first content page").
 *
 * iter-4 changes implemented here:
 *   1. Horizontal-logo running header on every internal page (renderHeaderHtml)
 *   2. Cover background pure white (#FFFFFF)
 *   3. Breathing room — header band reserves ~28px below its teal rule; section
 *      gap 48px; first section on the first content page starts flush
 *   4. TOC keeps dotted leaders + a navigation footnote; clickable bookmark
 *      tree comes from Gotenberg generateDocumentOutline (set in the route)
 *   5. "Em poucas palavras" page between Índice and §1 (essence_phrase)
 *
 * Design tokens (colors / fonts / §15 palette) are shared with the web
 * reading view via lib/design/report-tokens — the two surfaces must match.
 *
 * Phase 7.4 | Plan 07.4-28 | Engine: Gotenberg/Chromium on Render
 */
import 'server-only'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  resolveDisplayOrder,
  SECTION_KEY_BY_NUMBER,
  sectionDisplayTitle,
} from '@/lib/anthropic/types'
import {
  REPORT_COLORS,
  REPORT_FONTS,
  SINTESE_CARD_PALETTE,
} from '@/lib/design/report-tokens'
import {
  IRIS_CODEX_LOGO_LIGHT_DATA_URI,
  IRIS_CODEX_LOGO_HORIZONTAL_DATA_URI,
} from './logo-assets'

const STRIP_LEADING_HEADING_RE =
  /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][^\n]*\n+/u

const SUBSECTION_SPLIT_RE = /^###\s+(.+)$/gm

interface ParsedSubsection {
  label: string
  body: string
}

function parseSubsections(body: string): ParsedSubsection[] {
  const headings: Array<{ label: string; startIdx: number; matchEnd: number }> = []
  SUBSECTION_SPLIT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = SUBSECTION_SPLIT_RE.exec(body)) !== null) {
    headings.push({ label: m[1]!.trim(), startIdx: m.index, matchEnd: m.index + m[0].length })
  }
  if (headings.length === 0) return []
  return headings.map((h, i) => {
    const nextStart = headings[i + 1]?.startIdx ?? body.length
    return { label: h.label, body: body.slice(h.matchEnd, nextStart).trim() }
  })
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const C = REPORT_COLORS

const PRINT_CSS = `
  :root {
    --teal:${C.teal}; --teal-light:${C.tealLight}; --teal-dark:${C.tealDark};
    --ivory:${C.ivory}; --mist:${C.mist}; --ink:${C.ink}; --white:${C.white};
    --card-border:${C.cardBorder};
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--white); }
  body {
    font-family: ${REPORT_FONTS.serif};
    color: var(--ink);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    /* iter-5 FIX 2 — never split words mid-syllable ("racionalizadaou");
       hyphenate naturally (lang="pt-BR" on <html>), break only very long
       unbreakable runs. */
    word-break: normal;
    overflow-wrap: break-word;
    hyphens: auto;
    -webkit-hyphens: auto;
  }

  /* ---- Cover (its own PDF — full bleed, pure white, no header) ---- */
  .cover {
    position: relative;
    height: 297mm;
    background: var(--white);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 28mm;
  }
  .cover-logo { width: 220px; height: auto; display: block; margin: 0 auto 30px; }
  .cover-tagline {
    color: var(--teal);
    font-style: italic;
    font-size: 14px;
    letter-spacing: 2px;
    margin: 0 0 22px;
  }
  .cover-divider {
    width: 180px; height: 0;
    border-top: 1px solid var(--teal);
    margin: 0 auto 22px;
  }
  .cover-label {
    color: var(--mist);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 3px;
    margin: 0 0 40px;
  }
  .cover-name {
    color: var(--ink);
    font-weight: 700;
    font-size: 32px;
    line-height: 1.2;
    margin: 0 0 14px;
  }
  .cover-date {
    color: var(--mist);
    font-style: italic;
    font-size: 13px;
  }
  .cover-wordmark {
    position: absolute;
    bottom: 26mm; left: 0; right: 0;
    text-align: center;
    color: var(--teal);
    font-size: 11px;
    letter-spacing: 4px;
    text-transform: uppercase;
  }

  /* ---- Índice ---- */
  /* Real @page margins (route: 0.7in L/R, 0.85 top, 0.7 bottom) own the
     frame now — internal CSS padding is minimal so insets don't double. */
  .toc {
    background: var(--white);
    padding: 0 0 8px;
    break-after: page;
    page-break-after: always;
  }
  .toc-title {
    text-align: center;
    font-size: 24pt;
    font-weight: 700;
    color: var(--ink);
    margin: 0 0 10px;
  }
  .toc-rule {
    width: 120px; height: 0;
    border-top: 1.5px solid var(--teal);
    margin: 0 auto 30px;
  }
  .toc-row { display: flex; align-items: baseline; height: 28px; }
  .toc-num { width: 32px; color: var(--teal); font-size: 11pt; }
  .toc-name { color: var(--ink); font-size: 12pt; }
  .toc-leader { flex: 1; border-bottom: 1px dotted #C0C0C0; margin: 0 8px 4px; }
  /* TOC rows are anchor links (clickable nav in every reader incl. mobile —
     survives the cover+body pdfcpu merge, unlike the outline). Keep them
     visually identical to plain rows: no underline, no link-blue. */
  a.toc-row { text-decoration: none; color: inherit; }
  a.toc-row:hover { text-decoration: none; }
  /* Visually-hidden but present in the layout/heading tree so the body
     PDF carries a well-formed outline root (bonus for if/when the merge
     stops stripping outlines). display:none would drop it from the tree. */
  .doc-title {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /* ---- "Em poucas palavras" page ---- */
  .essence-page {
    background: var(--white);
    min-height: 215mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 0 8px;
    break-after: page;
    page-break-after: always;
  }
  .essence-label {
    color: var(--teal);
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 4px;
    margin: 0;
  }
  .essence-phrase {
    font-style: italic;
    font-size: 22pt;
    color: var(--ink);
    line-height: 1.5;
    max-width: 480px;
    margin: 32px auto 0;
  }
  .essence-divider {
    width: 80px; height: 0;
    border-top: 1px solid var(--teal);
    margin: 40px auto 0;
  }
  .essence-foot {
    color: var(--mist);
    font-style: italic;
    font-size: 10pt;
    margin: 20px 0 0;
  }

  /* ---- §0 — "Em poucas palavras" microfilme page (Marca 7 v2 — v2.7.0) ---- */
  /* §0 is the narrative opener: 6-9 lines of microfilme + maieutic question
     paragraph. Sits between essence_phrase (short) and the Índice page block.
     Uses larger italic body type but is left-aligned (vs. essence's center). */
  section.zero-section {
    background: var(--white);
    padding: 48px 0;
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  section.zero-section .essence-label {
    margin-bottom: 18px;
  }
  section.zero-section .zero-body {
    font-family: ${REPORT_FONTS.serif};
    font-size: 14pt;
    color: var(--ink);
    font-style: italic;
    line-height: 1.65;
    max-width: 620px;
    margin: 0 auto;
  }
  section.zero-section .zero-body p { margin: 0 0 1em; }
  section.zero-section .zero-body p:last-child { margin-bottom: 0; }

  /* ---- Content pages ---- */
  .content { padding: 0; background: var(--white); }
  section.report-section { break-inside: auto; }
  h2.sec-title {
    font-family: ${REPORT_FONTS.serif};
    font-size: 22pt;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.25;
    margin: 56px 0 0;
    break-after: avoid;
    page-break-after: avoid;
  }
  section.report-section:first-of-type h2.sec-title { margin-top: 0; }
  h2.sec-title .sec-num { color: var(--teal); }
  h2.sec-title .sec-dash { font-weight: 400; }
  .sec-rule {
    height: 0;
    border: 0;
    border-top: 1.5px solid var(--teal);
    margin: 10px 0 20px;
  }

  .section-body { font-size: 13.5pt; line-height: 1.9; color: ${C.body}; }
  .section-body p { margin: 0 0 16px; }
  .section-body p:last-child { margin-bottom: 0; }
  .section-body ul, .section-body ol { margin: 0 0 16px; padding-left: 22px; }
  .section-body li { margin: 0 0 9px; }
  .section-body strong { font-weight: 700; color: var(--ink); }
  .section-body em { font-style: italic; }
  .section-body h3 {
    font-size: 14pt;
    font-weight: 700;
    font-style: italic;
    color: var(--teal);
    margin: 20px 0 12px;
  }
  .section-body blockquote {
    margin: 22px 0;
    padding: 2px 0 2px 22px;
    border-left: 2px solid var(--teal);
    font-style: italic;
    font-size: 14.5pt;
    line-height: 1.7;
    color: var(--teal-dark);
  }
  .section-body blockquote p { margin: 0 0 8px; }
  .section-body blockquote p:last-child { margin-bottom: 0; }

  /* §14 Mensagem para o Cliente — a letter, not a form. */
  .letter-body {
    background: var(--ivory);
    border-left: 3px solid var(--teal);
    padding: 26px 30px;
    font-size: 12.5pt;
    line-height: 2.0;
    color: #2A2420;
  }
  .letter-body p { margin: 0 0 16px; }
  .letter-body p:first-child { margin-top: 0; }
  .letter-body p:last-child { margin-bottom: 0; }
  .letter-body em { font-style: italic; }

  /* §15 Síntese Rápida — premium dashboard cards. */
  .sintese-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 4px;
  }
  .sintese-card {
    border: 1px solid var(--card-border);
    border-left-width: 4px;
    border-radius: 10px;
    padding: 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sintese-card h3 {
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 3px;
    margin: 0 0 10px;
    padding-bottom: 10px;
  }
  .sintese-card .sintese-body { font-size: 11.5pt; line-height: 1.7; color: ${C.body}; }
  .sintese-card .sintese-body p { margin: 0 0 8px; }
  .sintese-card .sintese-body p:last-child { margin-bottom: 0; }
  .sintese-card .sintese-body ul,
  .sintese-card .sintese-body ol { margin: 0; padding: 0; list-style: none; }
  .sintese-card .sintese-body li {
    margin: 0 0 8px;
    padding-left: 14px;
    position: relative;
  }
  .sintese-card .sintese-body li::before {
    content: "·";
    color: var(--teal);
    position: absolute;
    left: 2px;
    font-weight: 700;
  }

  .disclaimer {
    margin-top: 34px;
    padding-top: 16px;
    border-top: 1px solid var(--teal);
    font-size: 9pt;
    font-style: italic;
    line-height: 1.7;
    color: var(--mist);
    break-inside: avoid;
    page-break-inside: avoid;
  }
`

export interface ReportPrintDocumentProps {
  /** jsonb dictionary keyed by ReportSectionKey. Source: report_delivered ?? report_generated. */
  sections: Record<string, string>
  clientName: string
  /** ISO timestamp of when the reading was generated/created. */
  readingDate: string | null
}

function htmlDoc(title: string, bodyInner: string): string {
  return (
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<title>${htmlEscape(title)}</title>` +
    `<style>${PRINT_CSS}</style></head><body>${bodyInner}</body></html>`
  )
}

/**
 * COVER — its own standalone PDF (the route renders it with zero margins and
 * NO header/footer so it bleeds and carries no running header).
 */
export function renderCoverHtml(props: ReportPrintDocumentProps): string {
  const { clientName, readingDate } = props
  const date = readingDate ? formatDate(readingDate) : ''
  const cover =
    `<div class="cover">` +
    `<img class="cover-logo" src="${IRIS_CODEX_LOGO_LIGHT_DATA_URI}" alt="Iris Codex">` +
    `<div class="cover-tagline">A íris como mapa do ser.</div>` +
    `<div class="cover-divider"></div>` +
    `<div class="cover-label">Leitura Iridológica Clínico-Funcional</div>` +
    `<div class="cover-name">${htmlEscape(clientName)}</div>` +
    (date ? `<div class="cover-date">${htmlEscape(date)}</div>` : '') +
    `<div class="cover-wordmark">Iris Codex</div>` +
    `</div>`
  return htmlDoc(`Iris Codex — Leitura de ${clientName}`, cover)
}

/**
 * BODY — Índice + "Em poucas palavras" + §1..§15 + disclaimer. Rendered with the
 * Gotenberg header.html / footer.html bands (page numbers count these pages).
 * `react-dom/server` is dynamically imported — Next App Router hard-bans the
 * static import (assumes client bundling).
 */
export async function renderBodyHtml(
  props: ReportPrintDocumentProps,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { sections, clientName } = props
  const encerramento = sections['encerramento_disclaimer']
  const essence = sections['essence_phrase']?.trim()
  const zeroSection = sections['0_em_poucas_palavras']?.trim()
  // Apresentação: flag narrativa → arco da devolutiva (renumerado por posição);
  // legacy → ordem de emissão 1..15 com número original. Não-retroativo.
  const { headings: displayHeadings, renumber } = resolveDisplayOrder(sections)
  const present = displayHeadings.filter((h) => {
    const raw = sections[SECTION_KEY_BY_NUMBER[h]]
    return raw && raw.trim().length > 0
  })

  const inner = renderToStaticMarkup(
    <>
      {/* Outline root — visually hidden, present in the heading tree */}
      <h1 className="doc-title">Iris Codex — Leitura de {clientName}</h1>

      {/* Índice */}
      <div className="toc">
        <div className="toc-title">Índice</div>
        <div className="toc-rule" />
        {present.map((h, i) => (
          <a className="toc-row" key={h} href={`#sec-${h}`}>
            <span className="toc-num">{renumber ? i + 1 : h}</span>
            <span className="toc-name">{sectionDisplayTitle(h, clientName)}</span>
            <span className="toc-leader" />
          </a>
        ))}
      </div>

      {/* Em uma palavra (essence_phrase — frase curta sintética, Plan 28) */}
      {essence && (
        <div className="essence-page">
          <p className="essence-label">Em uma palavra</p>
          <p className="essence-phrase">{essence}</p>
          <div className="essence-divider" />
          <p className="essence-foot">
            Esta é a essência que atravessa este relatório.
          </p>
        </div>
      )}

      {/* §0 — Em poucas palavras (Marca 7 v2 microfilme + pergunta maiêutica) */}
      {zeroSection && (
        <section id="sec-0" className="report-section zero-section">
          <p className="essence-label">Em poucas palavras</p>
          <div className="zero-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{zeroSection}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* Sections */}
      <div className="content">
        {present.map((headingStr, secIdx) => {
          const key = SECTION_KEY_BY_NUMBER[headingStr]
          const raw = sections[key]
          if (!raw || raw.trim().length === 0) return null
          const body = raw.replace(STRIP_LEADING_HEADING_RE, '')
          const title = sectionDisplayTitle(headingStr, clientName)
          const isSintese = headingStr === '15'
          const isLetter = headingStr === '14'
          const subs = isSintese ? parseSubsections(body) : []
          return (
            <section
              id={`sec-${headingStr}`}
              className={`report-section${isLetter ? ' letter' : ''}`}
              key={key}
            >
              <h2 className="sec-title">
                <span className="sec-num">{renumber ? secIdx + 1 : headingStr}</span>
                <span className="sec-dash"> — </span>
                {title}
              </h2>
              <hr className="sec-rule" />
              {isSintese && subs.length > 0 ? (
                <div className="sintese-grid">
                  {subs.map((sub, i) => {
                    const c = SINTESE_CARD_PALETTE[i % SINTESE_CARD_PALETTE.length]!
                    return (
                      <div
                        className="sintese-card"
                        key={`${sub.label}-${i}`}
                        style={{ backgroundColor: c.bg, borderLeftColor: c.accent }}
                      >
                        <h3
                          style={{
                            color: c.accent,
                            borderBottom: `1px solid ${c.accent}4D`,
                          }}
                        >
                          {sub.label}
                        </h3>
                        <div className="sintese-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {sub.body}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : isLetter ? (
                <div className="letter-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              ) : (
                <div className="section-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              )}
            </section>
          )
        })}

        {encerramento && encerramento.trim().length > 0 && (
          <div className="disclaimer">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{encerramento}</ReactMarkdown>
          </div>
        )}
      </div>
    </>,
  )

  return htmlDoc(`Iris Codex — Leitura de ${clientName}`, inner)
}

/**
 * Gotenberg `header.html` — a COMPLETE doc rendered in the reserved top band
 * on every BODY page (Plan 7.4-28 CHANGE 1). Horizontal logo (inlined base64
 * — Chromium header docs cannot read public/) on the left; client name +
 * `p. N / total` on the right; teal rule under it. The band height (route
 * marginTop) is taller than this content so ~28px of breathing sits below the
 * rule before the body starts (CHANGE 3).
 */
export function renderHeaderHtml(clientName: string): string {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>` +
    `*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}` +
    `html,body{margin:0;padding:0;width:100%;background:transparent;` +
    `font-family:${REPORT_FONTS.serif};}` +
    `.hd{width:100%;display:flex;align-items:center;justify-content:space-between;` +
    `gap:16px;padding:0 0.7in 10px;border-bottom:1px solid ${C.teal};}` +
    `.hd img{height:24px;width:auto;display:block;}` +
    `.hd .meta{color:${C.mist};font-size:9pt;white-space:nowrap;}` +
    `.hd .meta .pageNumber,.hd .meta .totalPages{color:${C.mist};}` +
    `</style></head><body><div class="hd">` +
    `<img src="${IRIS_CODEX_LOGO_HORIZONTAL_DATA_URI}" alt="Iris Codex">` +
    `<span class="meta">${htmlEscape(clientName)} — p. ` +
    `<span class="pageNumber"></span> / <span class="totalPages"></span></span>` +
    `</div></body></html>`
  )
}

/**
 * Gotenberg `footer.html` — slim transparent band on every BODY page. The
 * teal hairline + brand + condensed LGPD reassurance ride here; the page
 * number now lives in the header (Plan 7.4-28), so the footer no longer
 * prints it.
 */
export function renderFooterHtml(clientName: string, disclaimerLine: string): string {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>` +
    `*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}` +
    `html,body{margin:0;padding:0;width:100%;background:transparent;}` +
    `.bar{width:100%;border-top:1px solid ${C.teal};` +
    `font-family:${REPORT_FONTS.serif};color:${C.mist};font-size:8pt;` +
    `padding:8px 0.7in 12px;display:flex;align-items:center;justify-content:space-between;gap:14px;}` +
    `.brand{color:${C.teal};letter-spacing:0.22em;text-transform:uppercase;font-size:7pt;white-space:nowrap;}` +
    `.disc{flex:1;text-align:center;overflow:hidden;}` +
    `</style></head><body><div class="bar">` +
    `<span class="brand">Iris Codex</span>` +
    `<span class="disc">${htmlEscape(clientName)} — ${htmlEscape(disclaimerLine)}</span>` +
    `<span class="brand">&nbsp;</span>` +
    `</div></body></html>`
  )
}

export function buildPdfFilename(clientName: string, readingDate: string | null): string {
  const safeName = clientName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  const datePart = readingDate
    ? new Date(readingDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  return `Leitura-${safeName || 'cliente'}-${datePart}.pdf`
}
