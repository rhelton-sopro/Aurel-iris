/**
 * ReportPrintDocument — server-rendered HTML for the Iris Codex 16-section
 * report, converted to PDF by Gotenberg (headless Chromium) on Render.
 *
 * Plan 7.4-26 — supersedes Plan 23's @react-pdf/renderer (3 failed UAT rounds:
 * AFM-font emoji crash + a bespoke brittle markdown→primitives parser). The
 * decisive change is architectural: render the SAME content as real HTML/CSS
 * (Chromium renders full CSS3 — grid, colors, emoji, future logo/icons/images)
 * and let a dedicated Gotenberg service do the PDF conversion. Design now
 * evolves in ONE place (this CSS) and the PDF follows for free.
 *
 * This module returns a complete, self-contained HTML document string (inline
 * <style>, no external assets) via renderToStaticMarkup — the API route POSTs
 * that string to Gotenberg. No internal HTTP hop, no auth on an internal route,
 * fully deterministic. react-markdown renders the section bodies to semantic
 * HTML; all visual styling lives in PRINT_CSS.
 *
 * Phase 7.4 | Plan 07.4-26 | Engine: Gotenberg/Chromium on Render
 */
import 'server-only'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  NUMBERED_SECTION_HEADINGS,
  SECTION_KEY_BY_NUMBER,
  SECTION_TITLE_BY_NUMBER,
} from '@/lib/anthropic/types'

// Mirrors ReportReadView / parser BOUNDARY_RE — strips a leading `## N. Title`
// (or legacy `## §N — Title`) line so the styled <h2> isn't duplicated.
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

// Serif system stack — no @font-face so Gotenberg never waits on / fails a
// network font fetch. Georgia/Times are present in the Gotenberg image.
const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", "Liberation Serif", serif;
    font-size: 11.5pt;
    line-height: 1.65;
    color: #1f2937;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-header {
    text-align: center;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 18px;
    margin-bottom: 28px;
  }
  .brand-mark { font-size: 20pt; font-weight: 700; letter-spacing: 0.02em; }
  .brand-tagline { font-style: italic; color: #6b7280; font-size: 10.5pt; margin-top: 4px; }
  .client-name { font-size: 22pt; font-weight: 700; margin: 18px 0 4px; }
  .reading-date { color: #6b7280; font-size: 10pt; }
  section.report-section { margin-top: 26px; page-break-inside: auto; }
  section.report-section:first-of-type { margin-top: 0; }
  h2.section-title {
    font-size: 15pt;
    font-weight: 700;
    margin: 0 0 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #f0f0f0;
    page-break-after: avoid;
  }
  .section-body p { margin: 0 0 14px; }
  .section-body p:last-child { margin-bottom: 0; }
  .section-body ul, .section-body ol { margin: 0 0 14px; padding-left: 22px; }
  .section-body li { margin: 0 0 6px; }
  .section-body strong { font-weight: 700; }
  .section-body em { font-style: italic; }
  .section-body blockquote {
    margin: 14px 0;
    padding-left: 14px;
    border-left: 3px solid #e5e7eb;
    color: #6b7280;
    font-style: italic;
  }
  .sintese-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 6px;
  }
  .sintese-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 12px 14px;
    page-break-inside: avoid;
  }
  .sintese-card h3 { font-size: 12pt; font-weight: 700; margin: 0 0 6px; }
  .sintese-card p { margin: 0 0 8px; }
  .sintese-card p:last-child { margin-bottom: 0; }
  .sintese-card ul, .sintese-card ol { margin: 0 0 8px; padding-left: 18px; }
  .disclaimer {
    margin-top: 36px;
    padding-top: 14px;
    border-top: 1px solid #e5e7eb;
    font-size: 9.5pt;
    font-style: italic;
    color: #6b7280;
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
        <header className="doc-header">
          <div className="brand-mark">Iris Codex</div>
          <div className="brand-tagline">A íris como mapa do ser.</div>
          <div className="client-name">{clientName}</div>
          {readingDate && (
            <div className="reading-date">
              Leitura realizada em {formatDate(readingDate)}
            </div>
          )}
        </header>

        {NUMBERED_SECTION_HEADINGS.map((headingStr) => {
          const key = SECTION_KEY_BY_NUMBER[headingStr]
          const raw = sections[key]
          if (!raw || raw.trim().length === 0) return null
          const body = raw.replace(STRIP_LEADING_HEADING_RE, '')
          const title = SECTION_TITLE_BY_NUMBER[headingStr]
          const isSintese = headingStr === '16'
          const subs = isSintese ? parseSubsections(body) : []
          return (
            <section className="report-section" key={key}>
              <h2 className="section-title">
                {headingStr}. {title}
              </h2>
              {isSintese && subs.length > 0 ? (
                <div className="sintese-grid">
                  {subs.map((sub, i) => (
                    <div className="sintese-card" key={`${sub.label}-${i}`}>
                      <h3>{sub.label}</h3>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {sub.body}
                      </ReactMarkdown>
                    </div>
                  ))}
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
 * Gotenberg `footer.html` — must be a COMPLETE html doc; Chromium injects
 * `.pageNumber` / `.totalPages`. Carries the brand + a condensed disclaimer
 * line on every page (UAT-4 criterion #4). External assets won't load, so
 * everything is inline.
 */
export function renderFooterHtml(clientName: string, disclaimerLine: string): string {
  const safe = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:7pt;color:#9ca3af;width:100%;}
    .wrap{padding:0 14mm;display:flex;justify-content:space-between;align-items:center;}
    .disc{flex:1;font-style:italic;padding-right:10px;}
    .pg{white-space:nowrap;}
  </style></head><body><div class="wrap">
    <span class="disc">Iris Codex — ${safe(clientName)} — ${safe(disclaimerLine)}</span>
    <span class="pg"><span class="pageNumber"></span>/<span class="totalPages"></span></span>
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
