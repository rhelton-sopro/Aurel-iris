/**
 * Section-boundary parser for incremental LLM streaming persistence.
 *
 * Detects section headings (NUMBERED_SECTION_HEADINGS = '1','2','2.5','3'..'14')
 * over an accumulated buffer (NOT delta events — Pitfall 2 mandates buffer-level
 * scan). Defenses:
 *   - Regex (multiline): line starts with 2 or 3 hashes, optional `§` glyph,
 *     digit 1-2 chars + optional decimal `.5`, then either `.` or em-dash/
 *     en-dash/hyphen separator
 *   - Heading string must be in NUMBERED_SECTION_HEADINGS array
 *   - Order must be monotonic by array INDEX (not numeric — '2.5' sits between
 *     '2' and '3' in the canonical sequence; numeric `> lastNumber` would
 *     accept invalid orderings like '5' immediately after '2')
 *   - Resets `lastIndex` per call (no cross-invocation state leak)
 *
 * Accepted heading variants (observed across Sonnet 4.6 dogfooding):
 *   - `### 1. Constituição Iridológica`     (canonical legacy format)
 *   - `## 1. Constituição Iridológica`      (Sonnet sometimes bumps H3→H2)
 *   - `## §1 — Constituição Iridológica`    (Sonnet 4.6 post-2026-05-12)
 *   - `## §2.5 — Sistemas em Bom Funcionamento` (Plan 17 — decimal heading)
 *   - `### §1 — ...`, `## 1 — ...`, `### 1 —`, etc. — same shape, any combo
 *
 * Rejected: `#` (H1) and `####` (H4) bypass the boundary check. Pitfall 2
 * defenses still hold for all variants.
 *
 * Phase 7 | Plan 07-04 | Decisions: D-S2, RESEARCH §Code Examples, Pitfall 2
 * Phase 07.1.6 UAT-1 fix (2026-05-12): regex tolerance for `## §N —` format.
 * Phase 7.4 Plan 11 (Direction Correction DC-1/DC-3): range extended 13 → 14.
 * Phase 7.4 Plan 17 (UAT-3): decimal headings (§2.5) + array-index monotonicity.
 */
import 'server-only'
import {
  SECTION_KEY_BY_NUMBER,
  NUMBERED_SECTION_HEADINGS,
  type NumberedSectionKey,
  type NumberedSectionHeading,
} from './types'

// Anatomy:
//   ^[ \t]*               — line start with optional indent
//   #{2,3}                — 2 or 3 hashes (H2 or H3)
//   [ \t]+                — at least one space/tab after hashes
//   §?                    — optional section glyph (`§1` vs `1`)
//   [ \t]*                — optional spaces between § and number
//   (\d{1,2}(?:\.\d)?)    — capture: 1-2 digits + optional `.<digit>` decimal
//                            ('1', '14', '2.5' all match)
//   [ \t]*                — optional spaces between number and separator
//   [\p{Pd}.]             — separator: period OR any Unicode Dash Punctuation
//   [ \t]*                — optional trailing space
// u flag required for \p{Pd}; m flag for line-start anchor.
const BOUNDARY_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*(\d{1,2}(?:\.\d)?)[ \t]*[\p{Pd}.][ \t]*/gmu

export interface BoundaryMatch {
  /** Heading number as a string ('1', '2', '2.5', ..., '14'). String form
   * preserves the literal '2.5' for downstream consumers. */
  headingNumber: NumberedSectionHeading
  /** Canonical jsonb key for the section, e.g. '5_eixo_psicossomatico'. */
  key: NumberedSectionKey
  /** Index in buffer where '### ' begins (just after \n or buffer start). */
  startIdx: number
  /** Index after the heading line newline (start of section body content). */
  headingEndIdx: number
}

/**
 * Scan an accumulated buffer for all section boundaries, with Pitfall-2
 * defenses (membership rejection via NUMBERED_SECTION_HEADINGS, non-monotonic
 * rejection via array index, line-start anchor enforcement).
 */
export function findAllBoundaries(buffer: string): BoundaryMatch[] {
  BOUNDARY_RE.lastIndex = 0
  const matches: BoundaryMatch[] = []
  let m: RegExpExecArray | null
  let lastIndex = -1
  while ((m = BOUNDARY_RE.exec(buffer)) !== null) {
    const headingStr = m[1]!
    const idx = (NUMBERED_SECTION_HEADINGS as readonly string[]).indexOf(headingStr)
    if (idx === -1) continue
    if (idx !== lastIndex + 1) continue
    lastIndex = idx
    const headingNumber = headingStr as NumberedSectionHeading
    const matchEnd = m.index + m[0].length
    const lineEnd = buffer.indexOf('\n', matchEnd)
    matches.push({
      headingNumber,
      key: SECTION_KEY_BY_NUMBER[headingNumber]!,
      startIdx: m.index,
      headingEndIdx: lineEnd === -1 ? matchEnd : lineEnd + 1,
    })
  }
  return matches
}

export interface ClosedSection {
  key: NumberedSectionKey
  /** Content sliced from `boundary.startIdx` to next boundary's `startIdx`
   *  (or end of buffer for last). Trimmed. */
  content: string
}

/**
 * Given a stable list of boundaries in a complete buffer, produce closed
 * sections with content sliced between consecutive boundaries.
 *
 * Used post-stream to assemble the final report_generated jsonb.
 */
export function closeSections(boundaries: BoundaryMatch[], buffer: string): ClosedSection[] {
  const result: ClosedSection[] = []
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i]!
    const nextBoundary = boundaries[i + 1]
    const endIdx = nextBoundary ? nextBoundary.startIdx : buffer.length
    const content = buffer.slice(boundary.startIdx, endIdx).trim()
    result.push({ key: boundary.key, content })
  }
  return result
}
