/**
 * ReportReadView — continuous flowing reading surface (Plan 7.4-18 — UAT-3 UX flip).
 *
 * Renders the 15-section Iris Codex report as a single professionally
 * formatted document — NOT an accordion. The accordion lives only on the
 * /editar route for granular per-section edits. This component is the default
 * view on /leituras/[id] when the report is ready/edited.
 *
 * Composition (top → bottom):
 *   1. Header — client name (h1, font-serif) + reading date (muted small)
 *   2. Optional topActionsSlot row — right-aligned button group passed by parent
 *   3. Main body — 15 sections rendered in NUMBERED_SECTION_HEADINGS order:
 *        - h2 styled as `§{N} — {Title}` (font-serif text-2xl bold)
 *        - body via ReactMarkdown + remarkGfm in prose font-serif leading-relaxed
 *        - leading `## §N — Title` heading line stripped from body to avoid
 *          duplication with the styled h2 above
 *        - empty/missing sections are skipped (defensive — sections may have
 *          fewer than 15 keys mid-stream or for legacy 1.0 readings)
 *   4. Footer — encerramento_disclaimer rendered as italic muted blockquote
 *      (omitted if absent in jsonb)
 *
 * RSC by default — no 'use client'. ReactMarkdown is RSC-safe; no client state
 * needed. The action buttons live in ReadingModeActions (separate 'use client'
 * island passed via topActionsSlot).
 *
 * Phase 7.4 | Plan 07.4-18 | Decisions: DC-1, DC-3, DC-6 + UAT-3 UX flip
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ReactNode } from 'react'

import { LocalDateTime } from '@/components/ui/local-date-time'
import {
  NUMBERED_SECTION_HEADINGS,
  SECTION_KEY_BY_NUMBER,
  SECTION_TITLE_BY_NUMBER,
} from '@/lib/anthropic/types'

// Mirrors EditorSectionItem STRIP_LEADING_HEADING_RE + parser.ts BOUNDARY_RE.
// Strips a leading `## §N — Title` (or `### N. Title` legacy) heading line +
// trailing blank lines so the rendered body doesn't duplicate the styled h2
// above. Handles decimal `.5` for §2.5 (Plan 17).
const STRIP_LEADING_HEADING_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][^\n]*\n+/u

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
                §{headingStr} — {title}
              </h2>
              <div className="prose prose-neutral max-w-none font-serif leading-relaxed prose-p:my-3 prose-li:my-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            </section>
          )
        })}
      </div>

      {encerramento && encerramento.trim().length > 0 && (
        <footer
          data-testid="report-read-view-footer"
          className="my-8 border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground"
        >
          <div className="prose prose-sm prose-neutral max-w-none font-serif">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{encerramento}</ReactMarkdown>
          </div>
        </footer>
      )}
    </article>
  )
}
