/**
 * ReportDocument — server-side PDF render of the Iris Codex 16-section
 * report via @react-pdf/renderer (Plan 7.4-23, supersedes Plan 19 Print CSS).
 *
 * Founder approved @react-pdf/renderer install during UAT-4 — direct file
 * download replaces the browser-print-dialog approach. The document mirrors
 * the on-screen ReportReadView visually as much as @react-pdf primitives
 * allow: serif typography (Times-Roman built-in), max-width prose container,
 * brand mark + tagline header on first page, encerramento disclaimer footer
 * on every page, 16 sections in NUMBERED_SECTION_HEADINGS order with
 * `N. Title` headings, §16 Síntese Rápida rendered as 2-column card grid.
 *
 * Markdown handling: @react-pdf does NOT render markdown natively. This
 * module ships a lightweight inline parser that covers the markdown shapes
 * Sonnet emits: paragraphs (split on blank lines) / bullet lists (lines
 * starting `- `) / numbered lists (`1. `) / blockquotes (`> `). Inline
 * formatting (**bold**, *italic*) is stripped — the PDF v1 prioritizes
 * structure + readability over inline styling. Founder iteration in UAT-5
 * may request inline support.
 *
 * Phase 7.4 | Plan 07.4-23 | UAT-4 fix #3 (PDF direct download)
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'

import {
  NUMBERED_SECTION_HEADINGS,
  SECTION_KEY_BY_NUMBER,
  SECTION_TITLE_BY_NUMBER,
} from '@/lib/anthropic/types'

// Ensure @react-pdf doesn't try to load Times via network/disk in serverless
// environments — Times-Roman is the default built-in serif font and works
// without registration.
//
// The callback also chunks any token longer than MAX_UNBREAKABLE_TOKEN. With
// the previous `(word) => [word]` no token could ever break, so a single
// pathologically long unbreakable run (e.g. a huge raw number the LLM leaks
// into prose) would overflow @react-pdf's Yoga layout and crash with
// `Got unsupported number: 1.92e+21`. Chunking guarantees a break opportunity
// for any over-long run while leaving normal words untouched.
const MAX_UNBREAKABLE_TOKEN = 32
Font.registerHyphenationCallback((word) => {
  if (word.length <= MAX_UNBREAKABLE_TOKEN) return [word]
  const chunks: string[] = []
  for (let i = 0; i < word.length; i += MAX_UNBREAKABLE_TOKEN) {
    chunks.push(word.slice(i, i + MAX_UNBREAKABLE_TOKEN))
  }
  return chunks
})

// =============================================================================
// Styles
// =============================================================================

const COLORS = {
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  cardBg: '#f9fafb',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 70,
    paddingHorizontal: 60,
    fontFamily: 'Times-Roman',
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 1.6,
  },
  pageHeader: {
    position: 'absolute',
    top: 24,
    left: 60,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 9,
    color: COLORS.muted,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
  },
  pageHeaderBrand: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
    color: COLORS.text,
  },
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 60,
    right: 60,
    fontSize: 8,
    color: COLORS.muted,
    fontStyle: 'italic',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    borderTopStyle: 'solid',
  },
  documentHeader: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
  },
  brandMark: {
    fontFamily: 'Times-Bold',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  brandTagline: {
    fontStyle: 'italic',
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  clientName: {
    fontFamily: 'Times-Bold',
    fontSize: 22,
    marginBottom: 4,
  },
  readingDate: {
    fontSize: 10,
    color: COLORS.muted,
  },
  sectionHeading: {
    fontFamily: 'Times-Bold',
    fontSize: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionHeadingFirst: {
    fontFamily: 'Times-Bold',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  paragraph: {
    marginBottom: 12,
  },
  list: {
    marginBottom: 12,
    marginLeft: 12,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  listBullet: {
    width: 14,
  },
  listText: {
    flex: 1,
  },
  blockquote: {
    marginVertical: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
    borderLeftStyle: 'solid',
    fontStyle: 'italic',
    color: COLORS.muted,
  },
  // §16 grid
  sinteseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginHorizontal: -4,
  },
  sinteseCard: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sinteseCardInner: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 8,
  },
  sinteseCardLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    marginBottom: 4,
  },
})

// =============================================================================
// Markdown → @react-pdf rendering
// =============================================================================

const STRIP_LEADING_HEADING_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][^\n]*\n+/u

function stripInlineFormatting(text: string): string {
  // Remove bold (**text**), italic (*text* or _text_), inline code (`text`).
  // PDF v1 priority is structure + readability; inline styling is a follow-up.
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, '$1')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
}

// A standalone run of 15+ digits (optionally with a decimal tail) — far beyond
// any figure that legitimately belongs in a clinical-functional report. If one
// leaks into the prose, react-pdf measures it as a single unbreakable token;
// compact it to scientific shorthand so it reads sanely AND can't dominate the
// line box. Mirrors the founder's sanitizeValue(v): |v| > 1e10 → exponential.
const HUGE_NUMERIC_RUN_RE = /(?<![\w.])\d{15,}(?:\.\d+)?(?![\w.])/g

function sanitizeNumber(v: number): string {
  return Number.isFinite(v) && Math.abs(v) > 1e10 ? v.toExponential(2) : String(v)
}

function sanitizeText(text: string): string {
  return text.replace(HUGE_NUMERIC_RUN_RE, (run) => {
    const n = Number(run)
    return Number.isFinite(n) && Math.abs(n) > 1e10 ? sanitizeNumber(n) : run
  })
}

function renderInlineText(text: string): string {
  return sanitizeText(stripInlineFormatting(text)).replace(/\s+/g, ' ').trim()
}

function isBulletList(block: string): boolean {
  return block.split('\n').every((line) => /^[ \t]*-\s/.test(line))
}

function isNumberedList(block: string): boolean {
  return block.split('\n').every((line) => /^[ \t]*\d+\.\s/.test(line))
}

function isBlockquote(block: string): boolean {
  return block.split('\n').every((line) => /^[ \t]*>/.test(line))
}

interface ParsedSubsection {
  label: string
  body: string
}

function parseSinteseSubsections(body: string): ParsedSubsection[] {
  const re = /^###\s+(.+)$/gm
  const headings: Array<{ label: string; startIdx: number; matchEnd: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    headings.push({
      label: m[1]!.trim(),
      startIdx: m.index,
      matchEnd: m.index + m[0].length,
    })
  }
  if (headings.length === 0) return []
  return headings.map((h, i) => ({
    label: h.label,
    body: body.slice(h.matchEnd, headings[i + 1]?.startIdx ?? body.length).trim(),
  }))
}

function renderMarkdownBlocks(body: string): ReactNode[] {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return blocks.map((block, idx) => {
    if (isBulletList(block)) {
      const items = block.split('\n').map((line) => line.replace(/^[ \t]*-\s/, ''))
      return (
        <View key={idx} style={styles.list}>
          {items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.listBullet}>{`• `}</Text>
              <Text style={styles.listText}>{renderInlineText(item)}</Text>
            </View>
          ))}
        </View>
      )
    }
    if (isNumberedList(block)) {
      const items = block.split('\n').map((line) => line.replace(/^[ \t]*\d+\.\s+/, ''))
      return (
        <View key={idx} style={styles.list}>
          {items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.listBullet}>{`${i + 1}. `}</Text>
              <Text style={styles.listText}>{renderInlineText(item)}</Text>
            </View>
          ))}
        </View>
      )
    }
    if (isBlockquote(block)) {
      const text = block
        .split('\n')
        .map((line) => line.replace(/^[ \t]*>\s?/, ''))
        .join(' ')
      return (
        <View key={idx} style={styles.blockquote}>
          <Text>{renderInlineText(text)}</Text>
        </View>
      )
    }
    // Default — paragraph (collapse newlines within a paragraph to spaces)
    const paraText = block.replace(/\n/g, ' ')
    return (
      <Text key={idx} style={styles.paragraph}>
        {renderInlineText(paraText)}
      </Text>
    )
  })
}

// =============================================================================
// Document
// =============================================================================

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

export interface ReportDocumentProps {
  /** jsonb dictionary keyed by ReportSectionKey. Source: report_delivered ?? report_generated. */
  sections: Record<string, string>
  clientName: string
  /** ISO timestamp of when the reading was generated/created. */
  readingDate: string | null
}

export function ReportDocument({
  sections,
  clientName,
  readingDate,
}: ReportDocumentProps): ReactElement {
  const safeClientName = sanitizeText(clientName)
  const encerramento = sections['encerramento_disclaimer'] ?? ''
  const footerText = sanitizeText(
    encerramento
      .split('\n')
      .map((line) => line.replace(/^>\s?/, '').trim())
      .filter(Boolean)
      .join(' '),
  )

  return (
    <Document
      title={`Iris Codex — Leitura de ${safeClientName}`}
      author="Iris Codex"
      subject="Leitura iridológica clínico-funcional"
      creator="Iris Codex"
    >
      <Page size="A4" style={styles.page}>
        {/* Fixed page header (every page after first) */}
        <View style={styles.pageHeader} fixed render={({ pageNumber }) => (
          pageNumber > 1 ? (
            <>
              <Text style={styles.pageHeaderBrand}>Iris Codex</Text>
              <Text>{safeClientName}</Text>
            </>
          ) : null
        )} />

        {/* First-page document header — brand + client */}
        <View style={styles.documentHeader}>
          <Text style={styles.brandMark}>Iris Codex</Text>
          <Text style={styles.brandTagline}>A íris como mapa do ser.</Text>
          <Text style={styles.clientName}>{safeClientName}</Text>
          {readingDate && (
            <Text style={styles.readingDate}>
              Leitura realizada em {formatDate(readingDate)}
            </Text>
          )}
        </View>

        {/* 16 sections */}
        {NUMBERED_SECTION_HEADINGS.map((headingStr, idx) => {
          const key = SECTION_KEY_BY_NUMBER[headingStr]
          const raw = sections[key]
          if (!raw || raw.trim().length === 0) return null
          const body = raw.replace(STRIP_LEADING_HEADING_RE, '')
          const title = SECTION_TITLE_BY_NUMBER[headingStr]
          const isSinteseRapida = headingStr === '16'
          const subsections = isSinteseRapida ? parseSinteseSubsections(body) : []
          return (
            <View key={key} wrap={true}>
              <Text style={idx === 0 ? styles.sectionHeadingFirst : styles.sectionHeading}>
                {headingStr}. {title}
              </Text>
              {isSinteseRapida && subsections.length > 0 ? (
                <View style={styles.sinteseGrid}>
                  {subsections.map((sub, sIdx) => (
                    <View key={sIdx} style={styles.sinteseCard} wrap={false}>
                      <View style={styles.sinteseCardInner}>
                        <Text style={styles.sinteseCardLabel}>{sanitizeText(sub.label)}</Text>
                        {renderMarkdownBlocks(sub.body)}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                renderMarkdownBlocks(body)
              )}
            </View>
          )
        })}

        {/* Fixed page footer with disclaimer (every page) */}
        {footerText && (
          <View style={styles.pageFooter} fixed>
            <Text>{footerText}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

export function buildPdfFilename(clientName: string, readingDate: string | null): string {
  const safeName = clientName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  const datePart = readingDate
    ? new Date(readingDate).toISOString().slice(0, 10) // YYYY-MM-DD
    : new Date().toISOString().slice(0, 10)
  return `Leitura-${safeName || 'cliente'}-${datePart}.pdf`
}
