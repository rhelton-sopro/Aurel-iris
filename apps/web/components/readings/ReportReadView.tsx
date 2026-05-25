/**
 * ReportReadView — the therapist's reading surface for the Iris Codex report.
 *
 * Plan 7.4-28 (UAT iter-4, CHANGE 6): the web view now mirrors the PDF's
 * editorial design language so the therapist sees the same premium document
 * they will export. Shared tokens (lib/design/report-tokens) drive both
 * surfaces. Web-specific: white continuous scroll (no cover/per-page footer),
 * anchor-link Índice, action buttons on top.
 *
 * Composition (top → bottom):
 *   1. Header — horizontal logo + client name (h1) + reading date, teal rule
 *   2. topActionsSlot — right-aligned button group (Exportar PDF / Editar / …)
 *   3. "Em poucas palavras" — essence_phrase as a distinct centered block
 *   4. Índice — anchor links to each present section (clickable, scrolls)
 *   5. Sections — `{N} — {Title}` (teal num) + teal rule + markdown body;
 *        §14 = letter treatment; §15 = tinted card grid (shared palette)
 *   6. Footer — encerramento_disclaimer as italic muted note
 *
 * RSC by default — no 'use client'. ReactMarkdown is RSC-safe. The action
 * buttons are a separate 'use client' island passed via topActionsSlot.
 *
 * This project has NO @tailwindcss/typography plugin, so `prose` is inert —
 * every ReactMarkdown surface MUST style its elements via `components`.
 *
 * Phase 7.4 | Plan 07.4-28 | Decisions: DC-1, DC-3, DC-6 + UAT iter-4
 */
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ReactNode } from 'react'

import { LocalDateTime } from '@/components/ui/local-date-time'
import {
  NUMBERED_SECTION_HEADINGS,
  SECTION_KEY_BY_NUMBER,
  sectionDisplayTitle,
} from '@/lib/anthropic/types'
import {
  REPORT_COLORS,
  REPORT_FONTS,
  SINTESE_CARD_PALETTE,
} from '@/lib/design/report-tokens'

const STRIP_LEADING_HEADING_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][^\n]*\n+/u

const SERIF = { fontFamily: REPORT_FONTS.serif }
const C = REPORT_COLORS

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
    strong: ({ children }) => (
      <strong className="font-semibold" style={{ color: C.ink }}>
        {children}
      </strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    h3: ({ children }) => (
      <h3 className="mb-3 mt-8 text-lg font-semibold italic" style={{ color: C.teal }}>
        {children}
      </h3>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className="my-6 border-l-2 pl-5 italic"
        style={{ borderColor: C.teal, color: C.tealDark }}
      >
        {children}
      </blockquote>
    ),
    a: ({ children, href }) => (
      <a href={href} className="underline underline-offset-2" style={{ color: C.teal }}>
        {children}
      </a>
    ),
  }
}

const SUBSECTION_SPLIT_RE = /^###\s+(.+)$/gm

interface ParsedSubsection {
  /** Heading label including emoji, e.g. '🔴 Fragilidades'. */
  label: string
  /** Markdown body content of the subsection (trimmed). */
  body: string
}

/**
 * Parse §15 body markdown into ordered subsections. Splits on `### ` headings.
 * Returns [] if none detected (caller falls back to default prose render).
 */
export function parseSubsections(body: string): ParsedSubsection[] {
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

export interface ReportReadViewProps {
  /** jsonb dictionary keyed by ReportSectionKey. Source: report_delivered ?? report_generated. */
  sections: Record<string, string>
  clientName: string
  /** ISO timestamp string of when the reading was created (or generated). */
  readingDate: string | null
  /**
   * Versão do método de análise que gerou esta leitura — exibido como
   * pílula ao lado da data (ex: "sonnet_2x v0.1.3"). v2.4.4: founder
   * pediu visibilidade da versão pra rastrear qual iteração do prompt
   * gerou cada leitura. null quando a coluna method_version ainda não
   * estava preenchida (rows pré-v2.3.0).
   */
  analysisVersion?: string | null
  /** Optional right-aligned action button row above the body. */
  topActionsSlot?: ReactNode
  /** Optional technical notice (e.g. canonicalization fallback). Rendered as
   * a small muted banner above the body — NOT clinical content. */
  technicalNotice?: string
}

export function ReportReadView({
  sections,
  clientName,
  readingDate,
  analysisVersion,
  topActionsSlot,
  technicalNotice,
}: ReportReadViewProps) {
  const encerramento = sections['encerramento_disclaimer']
  const essence = sections['essence_phrase']?.trim()
  const zeroSection = sections['0_em_poucas_palavras']?.trim()
  const present = NUMBERED_SECTION_HEADINGS.filter((h) => {
    const raw = sections[SECTION_KEY_BY_NUMBER[h]]
    return raw && raw.trim().length > 0
  })

  return (
    <article
      lang="pt-BR"
      data-testid="report-read-view"
      className="mx-auto max-w-prose space-y-6"
      style={{
        ...SERIF,
        color: C.ink,
        hyphens: 'manual',
        overflowWrap: 'break-word',
        wordBreak: 'normal',
      }}
    >
      <header className="space-y-4 pb-6" style={{ borderBottom: `1.5px solid ${C.teal}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/iris_codex_horizontal.png"
          alt="Iris Codex"
          className="h-7 w-auto"
        />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" style={SERIF}>
            {clientName}
          </h1>
          {readingDate && (
            <p className="text-sm flex flex-wrap items-center gap-2" style={{ color: C.mist }}>
              <span>
                Leitura realizada em <LocalDateTime iso={readingDate} />
              </span>
              {analysisVersion && (
                <span
                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums"
                  style={{ borderColor: C.mist, color: C.tealDark }}
                  title="Versão do método de análise que gerou esta leitura"
                >
                  {analysisVersion}
                </span>
              )}
            </p>
          )}
        </div>
      </header>

      {topActionsSlot && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {topActionsSlot}
        </div>
      )}

      {technicalNotice && (
        <p
          data-testid="report-technical-notice"
          className="rounded-md border px-3 py-2 text-xs"
          style={{ color: C.mist, borderColor: C.mist }}
        >
          {technicalNotice}
        </p>
      )}

      {essence && (
        <section
          data-testid="report-read-view-essence"
          className="flex flex-col items-center px-6 py-10 text-center"
        >
          <p
            className="text-xs uppercase"
            style={{ color: C.teal, letterSpacing: '0.25em' }}
          >
            Em uma palavra
          </p>
          <p
            className="mt-6 max-w-md text-2xl italic"
            style={{ ...SERIF, color: C.ink, lineHeight: 1.5 }}
          >
            {essence}
          </p>
          <div
            className="mt-8"
            style={{ width: 80, borderTop: `1px solid ${C.teal}` }}
          />
          <p className="mt-5 text-sm italic" style={{ color: C.mist }}>
            Esta é a essência que atravessa este relatório.
          </p>
        </section>
      )}

      {zeroSection && (
        <section
          data-testid="report-read-view-zero"
          id="sec-0"
          className="scroll-mt-6 px-2 py-6 print:break-inside-avoid"
        >
          <p
            className="mb-4 text-xs uppercase"
            style={{ color: C.teal, letterSpacing: '0.25em' }}
          >
            Em poucas palavras
          </p>
          <div
            className="text-lg italic leading-relaxed"
            style={{ ...SERIF, color: C.ink }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents('body')}
            >
              {zeroSection}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {present.length > 1 && (
        <nav
          data-testid="report-read-view-toc"
          aria-label="Índice"
          className="space-y-1 py-2"
        >
          <p
            className="mb-3 text-xs uppercase"
            style={{ color: C.teal, letterSpacing: '0.25em' }}
          >
            Índice
          </p>
          {present.map((h) => (
            <a
              key={h}
              href={`#sec-${h}`}
              className="flex items-baseline gap-3 py-0.5 no-underline"
              style={{ color: C.ink }}
            >
              <span className="w-6 text-sm" style={{ color: C.teal }}>
                {h}
              </span>
              <span className="text-sm">{sectionDisplayTitle(h, clientName)}</span>
            </a>
          ))}
        </nav>
      )}

      <div className="space-y-2">
        {NUMBERED_SECTION_HEADINGS.map((headingStr, idx) => {
          const key = SECTION_KEY_BY_NUMBER[headingStr]
          const raw = sections[key]
          if (!raw || raw.trim().length === 0) return null
          const body = raw.replace(STRIP_LEADING_HEADING_RE, '')
          const title = sectionDisplayTitle(headingStr, clientName)
          const headingMargin = idx === 0 ? 'mt-6' : 'mt-14'
          const isLetter = headingStr === '14'
          const isSinteseRapida = headingStr === '15'
          const parsedBlocks = isSinteseRapida ? parseSubsections(body) : []
          return (
            <section
              key={key}
              id={`sec-${headingStr}`}
              data-section-key={key}
              data-section-heading={headingStr}
              className="scroll-mt-6 print:break-inside-avoid"
              style={SERIF}
            >
              <h2
                className={`${headingMargin} text-2xl font-bold tracking-tight`}
                style={SERIF}
              >
                <span style={{ color: C.teal }}>{headingStr}</span>
                <span className="font-normal">{' — '}</span>
                {title}
              </h2>
              <hr
                className="mb-5 mt-3"
                style={{ border: 0, borderTop: `1.5px solid ${C.teal}` }}
              />

              {isSinteseRapida && parsedBlocks.length > 0 ? (
                <div
                  data-testid="report-read-view-sintese-grid"
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                  {parsedBlocks.map((block, blockIdx) => {
                    const c =
                      SINTESE_CARD_PALETTE[blockIdx % SINTESE_CARD_PALETTE.length]!
                    return (
                      <div
                        key={`${block.label}-${blockIdx}`}
                        data-testid={`sintese-block-${blockIdx}`}
                        className="rounded-lg border p-5 print:break-inside-avoid"
                        style={{
                          backgroundColor: c.bg,
                          borderColor: C.cardBorder,
                          borderLeft: `4px solid ${c.accent}`,
                        }}
                      >
                        <h3
                          className="mb-3 pb-2 text-xs font-bold uppercase"
                          style={{
                            color: c.accent,
                            letterSpacing: '0.18em',
                            borderBottom: `1px solid ${c.accent}4D`,
                          }}
                        >
                          {block.label}
                        </h3>
                        <div
                          className="leading-relaxed [&>*:last-child]:mb-0"
                          style={SERIF}
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents('card')}
                          >
                            {block.body}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div
                  data-testid="section-markdown"
                  className="leading-relaxed [&>*:last-child]:mb-0"
                  style={
                    isLetter
                      ? {
                          ...SERIF,
                          fontSize: '13.5pt',
                          backgroundColor: C.ivory,
                          borderLeft: `3px solid ${C.teal}`,
                          padding: '24px 28px',
                          color: '#2A2420',
                        }
                      : { ...SERIF, fontSize: '13.5pt' }
                  }
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
          className="my-8 border-l-2 pl-5 text-sm italic"
          style={{ borderColor: C.teal, color: C.mist }}
        >
          <div className="leading-relaxed [&>*:last-child]:mb-0" style={SERIF}>
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
