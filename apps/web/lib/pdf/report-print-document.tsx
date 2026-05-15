/**
 * ReportPrintDocument — server-rendered HTML for the Iris Codex report,
 * converted to PDF by Gotenberg (headless Chromium) on Render.
 *
 * Plan 7.4-26 introduced the HTML/CSS→Gotenberg architecture; Plan 7.4-27
 * (iter-3) is the major restructure + polish:
 *   - 15 strictly-sequential sections (§2.5 collapsed into §2; Síntese §16→§15)
 *   - LIGHT cover (ivory + light-bg logo)
 *   - single-line heading "N — Title" + teal rule (no "SEÇÃO" eyebrow)
 *   - Índice (TOC) page after the cover
 *   - footer without the cream plinth (transparent + teal hairline)
 *   - §2 renders an opening paragraph + two `###` subsections (the LLM emits
 *     "Sistemas que requerem atenção" / "Sistemas em bom funcionamento")
 *   - §15 Síntese Rápida = premium tinted dashboard cards
 *
 * Layout model: Gotenberg margins top/L/R = 0 (cover bleeds), bottom ≈ 0.45in
 * for the per-page footer band. react-markdown renders bodies; all styling is
 * PRINT_CSS (our own document — no `prose` dependency).
 *
 * TOC limitation: Chromium/Gotenberg cannot resolve "section → page N" at
 * render time (no CSS target-counter; that needs Prince or a 2-pass). The
 * Índice therefore lists number + title + dotted leader WITHOUT page numbers.
 *
 * Phase 7.4 | Plan 07.4-27 | Engine: Gotenberg/Chromium on Render
 */
import 'server-only'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  NUMBERED_SECTION_HEADINGS,
  SECTION_KEY_BY_NUMBER,
  SECTION_TITLE_BY_NUMBER,
} from '@/lib/anthropic/types'
import { IRIS_CODEX_LOGO_LIGHT_DATA_URI } from './logo-assets'

const STRIP_LEADING_HEADING_RE =
  /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][^\n]*\n+/u

const SUBSECTION_SPLIT_RE = /^###\s+(.+)$/gm

// §15 card accent + 4%-tint background, in subsection order
// (Fragilidades / Forças / Emoções a Cuidar / Potências / Perfil / Aptidões).
const SINTESE_CARD = [
  { accent: '#C0392B', bg: '#FBF4F3' },
  { accent: '#3D9B8C', bg: '#F2F8F6' },
  { accent: '#C8920A', bg: '#FBF6E8' },
  { accent: '#5BBFB0', bg: '#EFF8F5' },
  { accent: '#1E6B61', bg: '#EEF3F1' },
  { accent: '#555555', bg: '#F4F4F2' },
]

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

const PRINT_CSS = `
  :root {
    --teal:#3D9B8C; --teal-light:#5BBFB0; --teal-dark:#1E6B61;
    --ivory:#F2EDE4; --mist:#7A7A7A; --ink:#1E1E1E; --white:#FFFFFF;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--white); }
  body {
    font-family: Georgia, "Times New Roman", "Liberation Serif", serif;
    color: var(--ink);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ---- Cover (page 1, full bleed, ivory) ---- */
  .cover {
    position: relative;
    height: 280mm;
    background: var(--ivory);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 28mm;
    break-after: page;
    page-break-after: always;
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

  /* ---- Índice (page 2) ---- */
  .toc {
    background: var(--white);
    padding: 28mm 60px;
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

  /* ---- Content pages ---- */
  .content { padding: 0 18mm 14mm; background: var(--white); }
  section.report-section { break-inside: auto; }
  h2.sec-title {
    font-family: Georgia, serif;
    font-size: 22pt;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.25;
    margin: 48px 0 0;
    break-after: avoid;
    page-break-after: avoid;
  }
  section.report-section:first-of-type h2.sec-title { margin-top: 24px; }
  h2.sec-title .sec-num { color: var(--teal); }
  h2.sec-title .sec-dash { font-weight: 400; }
  .sec-rule {
    height: 0;
    border: 0;
    border-top: 1.5px solid var(--teal);
    margin: 10px 0 20px;
  }

  .section-body { font-size: 11pt; line-height: 1.9; color: #2A2A2A; }
  .section-body p { margin: 0 0 16px; }
  .section-body p:last-child { margin-bottom: 0; }
  .section-body ul, .section-body ol { margin: 0 0 16px; padding-left: 22px; }
  .section-body li { margin: 0 0 9px; }
  .section-body strong { font-weight: 700; color: var(--ink); }
  .section-body em { font-style: italic; }
  /* §2 (and any) subsection subtitles emitted as markdown ### */
  .section-body h3 {
    font-size: 13pt;
    font-weight: 700;
    font-style: italic;
    color: var(--teal);
    margin: 20px 0 12px;
  }
  /* Pull quote — strongest statements (markdown blockquotes). */
  .section-body blockquote {
    margin: 22px 0;
    padding: 2px 0 2px 22px;
    border-left: 2px solid var(--teal);
    font-style: italic;
    font-size: 12.5pt;
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
    font-size: 11.5pt;
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
    border: 1px solid #E8E0D4;
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
  .sintese-card .sintese-body { font-size: 10.5pt; line-height: 1.7; color: #2A2A2A; }
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

function ReportPrintDocument({
  sections,
  clientName,
  readingDate,
}: ReportPrintDocumentProps) {
  const encerramento = sections['encerramento_disclaimer']
  const present = NUMBERED_SECTION_HEADINGS.filter((h) => {
    const raw = sections[SECTION_KEY_BY_NUMBER[h]]
    return raw && raw.trim().length > 0
  })
  return (
    <html lang="pt-BR">
      {/* Standalone Gotenberg doc — a real <head> is required, not next/head. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <title>{`Iris Codex — Leitura de ${clientName}`}</title>
        <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      </head>
      <body>
        {/* Cover */}
        <div className="cover">
          {/* Standalone Gotenberg doc — next/image would inject the Next runtime. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cover-logo"
            src={IRIS_CODEX_LOGO_LIGHT_DATA_URI}
            alt="Iris Codex"
          />
          <div className="cover-tagline">A íris como mapa do ser.</div>
          <div className="cover-divider" />
          <div className="cover-label">Leitura Iridológica Clínico-Funcional</div>
          <div className="cover-name">{clientName}</div>
          {readingDate && <div className="cover-date">{formatDate(readingDate)}</div>}
          <div className="cover-wordmark">Iris Codex</div>
        </div>

        {/* Índice */}
        <div className="toc">
          <div className="toc-title">Índice</div>
          <div className="toc-rule" />
          {present.map((h) => (
            <div className="toc-row" key={h}>
              <span className="toc-num">{h}</span>
              <span className="toc-name">{SECTION_TITLE_BY_NUMBER[h]}</span>
              <span className="toc-leader" />
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="content">
          {NUMBERED_SECTION_HEADINGS.map((headingStr) => {
            const key = SECTION_KEY_BY_NUMBER[headingStr]
            const raw = sections[key]
            if (!raw || raw.trim().length === 0) return null
            const body = raw.replace(STRIP_LEADING_HEADING_RE, '')
            const title = SECTION_TITLE_BY_NUMBER[headingStr]
            const isSintese = headingStr === '15'
            const isLetter = headingStr === '14'
            const subs = isSintese ? parseSubsections(body) : []
            return (
              <section
                className={`report-section${isLetter ? ' letter' : ''}`}
                key={key}
              >
                <h2 className="sec-title">
                  <span className="sec-num">{headingStr}</span>
                  <span className="sec-dash"> — </span>
                  {title}
                </h2>
                <hr className="sec-rule" />
                {isSintese && subs.length > 0 ? (
                  <div className="sintese-grid">
                    {subs.map((sub, i) => {
                      const c = SINTESE_CARD[i % SINTESE_CARD.length]!
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
      </body>
    </html>
  )
}

/**
 * Full standalone HTML document string for Gotenberg's `index.html`.
 * `react-dom/server` is dynamically imported — Next.js App Router hard-bans
 * the static import (assumes client-bundling).
 */
export async function renderReportPrintHtml(
  props: ReportPrintDocumentProps,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  return `<!DOCTYPE html>${renderToStaticMarkup(<ReportPrintDocument {...props} />)}`
}

/**
 * Gotenberg `footer.html` — a COMPLETE html doc rendered in the reserved
 * bottom band on every page (Chromium injects `.pageNumber`/`.totalPages`).
 * No background plinth (Plan 27): transparent, a single teal hairline on top.
 */
export function renderFooterHtml(clientName: string, disclaimerLine: string): string {
  const safe = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    html,body{margin:0;padding:0;width:100%;background:transparent;}
    .bar{
      width:100%;border-top:1px solid #3D9B8C;
      font-family:Georgia,"Times New Roman",serif;color:#7A7A7A;font-size:8pt;
      padding:8px 16mm 12px;display:flex;align-items:center;justify-content:space-between;gap:14px;
    }
    .brand{color:#3D9B8C;letter-spacing:0.22em;text-transform:uppercase;font-size:7pt;white-space:nowrap;}
    .disc{flex:1;text-align:center;overflow:hidden;}
    .pg{white-space:nowrap;}
    .pg .cur{color:#3D9B8C;}
  </style></head><body><div class="bar">
    <span class="brand">Iris Codex</span>
    <span class="disc">${safe(clientName)} — ${safe(disclaimerLine)}</span>
    <span class="pg">p. <span class="cur pageNumber"></span> / <span class="totalPages"></span></span>
  </div></body></html>`
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
