/**
 * ReportPrintDocument — server-rendered HTML for the Iris Codex 16-section
 * report, converted to PDF by Gotenberg (headless Chromium) on Render.
 *
 * Plan 7.4-26 introduced the HTML/CSS→Gotenberg architecture (replacing the
 * @react-pdf path that failed 3 UAT rounds). Plan 7.4-27 is the PREMIUM
 * redesign: this PDF is the primary client touchpoint and must feel like a
 * fine-art catalog / Aesop-grade artifact — not a form.
 *
 * Layout model (why it works with Gotenberg/Chromium):
 *   - Gotenberg margins: top/left/right = 0, bottom ≈ 0.6in. Side/top
 *     whitespace is CSS padding, NOT page margin, so the cover bleeds to the
 *     paper edge. The bottom 0.6in is the only reserved band — Gotenberg
 *     renders footer.html there on EVERY page (native per-page footer, no
 *     fixed-element overlap hacks). The footer band is ivory, so it reads as
 *     a deliberate signature plinth on the black cover AND the white pages.
 *   - Cover = one full page (height 281mm = A4 − footer band), break-after.
 *   - react-markdown renders section bodies; all styling is PRINT_CSS (this
 *     is our own document — unlike the web view, no `prose` dependency).
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
import { IRIS_CODEX_LOGO_DARK_DATA_URI } from './logo-assets'

// Mirrors ReportReadView / parser BOUNDARY_RE — strips a leading `## N. Title`
// (or legacy `## §N — Title`) line so the styled <h2> isn't duplicated.
const STRIP_LEADING_HEADING_RE =
  /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][^\n]*\n+/u

const SUBSECTION_SPLIT_RE = /^###\s+(.+)$/gm

// Per-card accent for §16, in subsection order
// (🔴 Fragilidades / 🟢 Forças / 💛 Emoções / ✨ Potências / 🧭 Perfil / 🌱 Aptidões).
const SINTESE_ACCENTS = ['#1E6B61', '#3D9B8C', '#5BBFB0', '#7A7A7A', '#000000', '#3D9B8C']

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

// Georgia is present in the Gotenberg image; no @font-face so Chromium never
// blocks on a network font. All brand colours from the locked palette.
const PRINT_CSS = `
  :root {
    --black:#000000; --teal:#3D9B8C; --teal-light:#5BBFB0; --teal-dark:#1E6B61;
    --ivory:#F2EDE4; --mist:#7A7A7A; --white:#FFFFFF; --ink:#1A1A1A;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--white); }
  body {
    font-family: Georgia, "Times New Roman", "Liberation Serif", serif;
    color: var(--ink);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ---- Cover (page 1, full bleed) ---- */
  .cover {
    position: relative;
    height: 281mm;            /* A4 height − the 0.6in ivory footer band */
    background: var(--black);
    color: var(--ivory);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    overflow: hidden;
    break-after: page;
    page-break-after: always;
  }
  .cover-glow {
    position: absolute;
    width: 150mm; height: 150mm;
    top: 50%; left: 50%;
    transform: translate(-50%, -62%);
    background: radial-gradient(circle,
      rgba(91,191,176,0.18) 0%,
      rgba(61,155,140,0.07) 38%,
      rgba(0,0,0,0) 70%);
  }
  .cover-inner { position: relative; padding: 0 28mm; }
  .cover-logo { width: 200px; height: auto; display: block; margin: 0 auto 26px; }
  .cover-tagline {
    font-style: italic;
    color: var(--teal-light);
    font-size: 10.5pt;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    margin: 0 0 64px;
  }
  .cover-eyebrow {
    color: var(--mist);
    font-size: 8.5pt;
    letter-spacing: 0.42em;
    text-transform: uppercase;
    margin: 0 0 14px;
  }
  .cover-name {
    font-size: 30pt;
    font-weight: 700;
    color: var(--ivory);
    line-height: 1.18;
    margin: 0 0 22px;
  }
  .cover-date {
    color: var(--mist);
    font-size: 10pt;
    font-style: italic;
    letter-spacing: 0.06em;
  }

  /* ---- Internal pages ---- */
  .content { padding: 24mm 18mm 12mm; background: var(--white); }
  section.report-section { break-inside: auto; margin: 0 0 30px; }
  .sec-eyebrow {
    color: var(--teal-dark);
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    margin: 0 0 6px;
  }
  h2.sec-title {
    font-size: 18pt;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.2;
    margin: 0 0 9px;
    break-after: avoid;
    page-break-after: avoid;
  }
  .sec-rule {
    height: 1px;
    background: var(--teal);
    border: 0;
    margin: 0 0 16px;
  }
  .section-body { font-size: 11pt; line-height: 1.9; color: #2A2A2A; }
  .section-body p { margin: 0 0 16px; }
  .section-body p:last-child { margin-bottom: 0; }
  .section-body ul, .section-body ol { margin: 0 0 16px; padding-left: 22px; }
  .section-body li { margin: 0 0 9px; }
  .section-body strong { font-weight: 700; color: var(--ink); }
  .section-body em { font-style: italic; }
  /* Pull quote — for the strongest statements (markdown blockquotes). */
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
  section.letter .sec-rule { background: var(--teal-light); }
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

  /* §16 Síntese Rápida — a dashboard summary. */
  .sintese-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 4px;
  }
  .sintese-card {
    background: var(--white);
    border: 1px solid #ECECEC;
    border-left-width: 4px;
    border-radius: 5px;
    padding: 15px 17px;
    box-shadow: 0 2px 7px rgba(0,0,0,0.07);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sintese-card h3 {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin: 0 0 9px;
  }
  .sintese-card .sintese-body { font-size: 10.5pt; line-height: 1.7; color: #2A2A2A; }
  .sintese-card p { margin: 0 0 7px; }
  .sintese-card p:last-child { margin-bottom: 0; }
  .sintese-card ul, .sintese-card ol { margin: 0; padding-left: 16px; }
  .sintese-card li { margin: 0 0 5px; }

  /* Closing disclaimer (full text — the running footer carries a condensed line). */
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
  return (
    <html lang="pt-BR">
      {/* Not a Next.js page — this is a standalone HTML document fed to
          Gotenberg/Chromium, so a real <head> is required, not next/head. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <title>{`Iris Codex — Leitura de ${clientName}`}</title>
        <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      </head>
      <body>
        <div className="cover">
          <div className="cover-glow" />
          <div className="cover-inner">
            {/* Standalone Gotenberg doc — next/image is meaningless here and
                would inject the Next runtime; a plain <img> data-URI is correct. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cover-logo"
              src={IRIS_CODEX_LOGO_DARK_DATA_URI}
              alt="Iris Codex"
            />
            <div className="cover-tagline">A íris como mapa do ser</div>
            <div className="cover-eyebrow">Leitura iridológica clínico-funcional</div>
            <div className="cover-name">{clientName}</div>
            {readingDate && (
              <div className="cover-date">{formatDate(readingDate)}</div>
            )}
          </div>
        </div>

        <div className="content">
          {NUMBERED_SECTION_HEADINGS.map((headingStr) => {
            const key = SECTION_KEY_BY_NUMBER[headingStr]
            const raw = sections[key]
            if (!raw || raw.trim().length === 0) return null
            const body = raw.replace(STRIP_LEADING_HEADING_RE, '')
            const title = SECTION_TITLE_BY_NUMBER[headingStr]
            const isSintese = headingStr === '16'
            const isLetter = headingStr === '14'
            const subs = isSintese ? parseSubsections(body) : []
            return (
              <section
                className={`report-section${isLetter ? ' letter' : ''}`}
                key={key}
              >
                <div className="sec-eyebrow">Seção {headingStr}</div>
                <h2 className="sec-title">{title}</h2>
                <hr className="sec-rule" />
                {isSintese && subs.length > 0 ? (
                  <div className="sintese-grid">
                    {subs.map((sub, i) => (
                      <div
                        className="sintese-card"
                        key={`${sub.label}-${i}`}
                        style={{
                          borderLeftColor:
                            SINTESE_ACCENTS[i % SINTESE_ACCENTS.length],
                        }}
                      >
                        <h3
                          style={{
                            color: SINTESE_ACCENTS[i % SINTESE_ACCENTS.length],
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
                    ))}
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
 *
 * `react-dom/server` is dynamically imported: Next.js App Router hard-bans a
 * STATIC `import ... from 'react-dom/server'` anywhere in the module graph
 * (it assumes client-bundling). A dynamic import inside this server-only
 * function sidesteps that SWC check while still rendering on the server.
 */
export async function renderReportPrintHtml(
  props: ReportPrintDocumentProps,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  return `<!DOCTYPE html>${renderToStaticMarkup(<ReportPrintDocument {...props} />)}`
}

/**
 * Gotenberg `footer.html` — a COMPLETE html doc rendered in the reserved
 * bottom band on EVERY page (Chromium injects `.pageNumber`/`.totalPages`).
 * Ivory plinth + teal hairline so it reads as a deliberate signature on both
 * the black cover and the white pages. External assets won't load — all inline.
 */
export function renderFooterHtml(clientName: string, disclaimerLine: string): string {
  const safe = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    html,body{margin:0;padding:0;width:100%;}
    .bar{
      width:100%;background:#F2EDE4;border-top:1px solid #3D9B8C;
      font-family:Georgia,"Times New Roman",serif;color:#7A7A7A;font-size:6.8pt;
      padding:5px 16mm 0;display:flex;align-items:center;justify-content:space-between;gap:14px;
    }
    .brand{color:#1E6B61;letter-spacing:0.24em;text-transform:uppercase;white-space:nowrap;font-weight:700;}
    .disc{flex:1;font-style:italic;text-align:center;overflow:hidden;}
    .pg{white-space:nowrap;letter-spacing:0.08em;}
  </style></head><body><div class="bar">
    <span class="brand">Iris Codex</span>
    <span class="disc">${safe(clientName)} — ${safe(disclaimerLine)}</span>
    <span class="pg"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
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
