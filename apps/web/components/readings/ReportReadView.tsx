/**
 * ReportReadView — continuous flowing reading surface (Plan 7.4-18 — UAT-3
 * UX flip; Plan 7.4-22 — § removal in headings + §16 card-grid rendering).
 *
 * Renders the 16-section Iris Codex report as a single professionally
 * formatted document — NOT an accordion. The accordion lives only on the
 * /editar route for granular per-section edits. This component is the default
 * view on /leituras/[id] when the report is ready/edited.
 *
 * Composition (top → bottom):
 *   1. Header — client name (h1, font-serif) + reading date (muted small)
 *   2. Optional topActionsSlot row — right-aligned button group passed by parent
 *   3. Main body — 16 sections rendered in NUMBERED_SECTION_HEADINGS order:
 *        - h2 styled as `{N}. {Title}` (font-serif text-2xl bold)
 *          [Plan 22 (UAT-4): § symbol removed from heading display]
 *        - body via ReactMarkdown + remarkGfm in prose font-serif leading-relaxed
 *        - leading `## N. Title` (or legacy `## §N — Title`) heading line
 *          stripped from body to avoid duplication with the styled h2 above
 *        - empty/missing sections are skipped (defensive — sections may have
 *          fewer than 16 keys mid-stream or for legacy 1.0 readings)
 *        - §16 Síntese Rápida gets SPECIAL CARD-GRID rendering: body parsed
 *          into 6 emoji-labeled subsections, displayed as 2-column grid
 *          (1-col on mobile)
 *   4. Footer — encerramento_disclaimer rendered as italic muted blockquote
 *      (omitted if absent in jsonb)
 *
 * RSC by default — no 'use client'. ReactMarkdown is RSC-safe; no client state
 * needed. The action buttons live in ReadingModeActions (separate 'use client'
 * island passed via topActionsSlot).
 *
 * Phase 7.4 | Plan 07.4-18 + 07.4-22 | Decisions: DC-1, DC-3, DC-6 + UAT-4
 */
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ReactNode } from 'react'

import { LocalDateTime } from '@/components/ui/local-date-time'
import {
  NUMBERED_SECTION_HEADINGS,
  SECTION_KEY_BY_NUMBER,
  SECTION_TITLE_BY_NUMBER,
} from '@/lib/anthropic/types'

// Mirrors EditorSectionItem STRIP_LEADING_HEADING_RE + parser.ts BOUNDARY_RE.
// Strips a leading `## N. Title` (or legacy `## §N — Title`) heading line +
// trailing blank lines so the rendered body doesn't duplicate the styled h2
// above. Handles decimal `.5` for §2.5 (Plan 17). Optional `§?` keeps backward
// compat with reports generated under Plan 16's prompt.
const STRIP_LEADING_HEADING_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][^\n]*\n+/u

// This project has NO @tailwindcss/typography plugin (Tailwind v4, globals.css
// imports only "tailwindcss"). So `prose` / `prose-p:*` classes emit ZERO CSS,
// and Tailwind's preflight resets <p> margin to 0 — markdown paragraphs render
// flush with no separation. Every ReactMarkdown surface must therefore style
// its elements explicitly via `components`; relying on `prose` is a silent
// no-op (this was the UAT-5b "spacing not applied" root cause).
type MarkdownVariant = 'body' | 'card' | 'footer'

function markdownComponents(variant: MarkdownVariant): Components {
  const p =
    variant === 'body'
      ? 'mb-6 leading-relaxed'
      : variant === 'card'
        ? 'mb-3 text-sm leading-relaxed'
        : 'mb-3 leading-relaxed'
  const listGap = variant === 'body' ? 'mb-6 space-y-2 pl-6' : 'mb-3 space-y-1 pl-5'
  return {
    p: ({ children }) => <p className={p}>{children}</p>,
    ul: ({ children }) => <ul className={`list-disc ${listGap}`}>{children}</ul>,
    ol: ({ children }) => <ol className={`list-decimal ${listGap}`}>{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    h3: ({ children }) => (
      <h3 className="mb-3 mt-8 text-lg font-semibold">{children}</h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-4 border-muted-foreground/30 pl-4 italic">
        {children}
      </blockquote>
    ),
    a: ({ children, href }) => (
      <a href={href} className="underline underline-offset-2">
        {children}
      </a>
    ),
  }
}

// §16 subsection split — each block starts with `### ` (markdown h3) followed
// by a label that includes an emoji + name. Match the block heading line and
// capture the full block until the next `### ` (or end of body).
// Plan 22 (UAT-4): §16 Síntese Rápida is a 6-block card grid.
const SUBSECTION_SPLIT_RE = /^###\s+(.+)$/gm

interface ParsedSubsection {
  /** Heading label including emoji, e.g. '🔴 Fragilidades'. */
  label: string
  /** Markdown body content of the subsection (between this heading and next, trimmed). */
  body: string
}

/**
 * Parse §16 body markdown into ordered subsections. Splits on `### ` headings;
 * the first block (before any heading) is discarded as preamble. Returns
 * empty array if no `### ` headings detected (caller falls back to default
 * prose render).
 */
export function parseSubsections(body: string): ParsedSubsection[] {
  const headings: Array<{ label: string; startIdx: number; matchEnd: number }> = []
  // Reset lastIndex defensively — global regex is module-scoped.
  SUBSECTION_SPLIT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = SUBSECTION_SPLIT_RE.exec(body)) !== null) {
    headings.push({ label: m[1]!.trim(), startIdx: m.index, matchEnd: m.index + m[0].length })
  }
  if (headings.length === 0) return []
  return headings.map((h, i) => {
    const nextStart = headings[i + 1]?.startIdx ?? body.length
    const content = body.slice(h.matchEnd, nextStart).trim()
    return { label: h.label, body: content }
  })
}

export interface ReportReadViewProps {
  /** jsonb dictionary keyed by ReportSectionKey. Source: report_delivered ?? report_generated. */
  sections: Record<string, string>
  clientName: string
  /** ISO timestamp string of when the reading was created (or generated). */
  readingDate: string | null
  /** Optional right-aligned action button row above the body. */
  topActionsSlot?: ReactNode
}

export function ReportReadView({
  sections,
  clientName,
  readingDate,
  topActionsSlot,
}: ReportReadViewProps) {
  const encerramento = sections['encerramento_disclaimer']

  return (
    <article
      data-testid="report-read-view"
      className="mx-auto max-w-prose space-y-6"
    >
      <header className="space-y-2 border-b pb-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          {clientName}
        </h1>
        {readingDate && (
          <p className="text-sm text-muted-foreground">
            Leitura realizada em <LocalDateTime iso={readingDate} />
          </p>
        )}
      </header>

      {topActionsSlot && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {topActionsSlot}
        </div>
      )}

      <div className="space-y-2">
        {NUMBERED_SECTION_HEADINGS.map((headingStr, idx) => {
          const key = SECTION_KEY_BY_NUMBER[headingStr]
          const raw = sections[key]
          if (!raw || raw.trim().length === 0) return null
          const body = raw.replace(STRIP_LEADING_HEADING_RE, '')
          const title = SECTION_TITLE_BY_NUMBER[headingStr]
          const headingMargin = idx === 0 ? 'mt-8' : 'mt-12'
          const isSinteseRapida = headingStr === '16'
          const parsedBlocks = isSinteseRapida ? parseSubsections(body) : []
          return (
            <section
              key={key}
              data-section-key={key}
              data-section-heading={headingStr}
              className="font-serif print:break-inside-avoid"
            >
              <h2
                className={`${headingMargin} mb-4 text-2xl font-bold tracking-tight`}
              >
                {headingStr}. {title}
              </h2>

              {isSinteseRapida && parsedBlocks.length > 0 ? (
                <div
                  data-testid="report-read-view-sintese-grid"
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                  {parsedBlocks.map((block, blockIdx) => (
                    <div
                      key={`${block.label}-${blockIdx}`}
                      data-testid={`sintese-block-${blockIdx}`}
                      className="rounded-md border bg-muted/30 p-4 print:break-inside-avoid"
                    >
                      <h3 className="mb-2 font-serif text-lg font-semibold">
                        {block.label}
                      </h3>
                      <div className="font-serif leading-relaxed [&>*:last-child]:mb-0">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents('card')}
                        >
                          {block.body}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  data-testid="section-markdown"
                  className="font-serif leading-relaxed [&>*:last-child]:mb-0"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents('body')}
                  >
                    {body}
                  </ReactMarkdown>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {encerramento && encerramento.trim().length > 0 && (
        <footer
          data-testid="report-read-view-footer"
          className="my-8 border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground"
        >
          <div className="font-serif text-sm leading-relaxed [&>*:last-child]:mb-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents('footer')}
            >
              {encerramento}
            </ReactMarkdown>
          </div>
        </footer>
      )}
    </article>
  )
}
