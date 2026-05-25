/**
 * Section-boundary parser for incremental LLM streaming persistence.
 *
 * Detects section headings (NUMBERED_SECTION_HEADINGS = '1','2',…,'15')
 * over an accumulated buffer (NOT delta events — Pitfall 2 mandates buffer-level
 * scan). Defenses:
 *   - Regex (multiline): line starts with 2 or 3 hashes, optional `§` glyph,
 *     digit 1-2 chars (decimal `.N` still tolerated for legacy buffers but no
 *     longer emitted), then either `.` or em-dash/en-dash/hyphen separator
 *   - Heading string must be in NUMBERED_SECTION_HEADINGS array
 *   - Order must be monotonic by array INDEX (membership + sequence gate;
 *     numeric `> lastNumber` would accept invalid orderings like '5' after '2')
 *   - Resets `lastIndex` per call (no cross-invocation state leak)
 *
 * Accepted heading variants (observed across Sonnet 4.6 dogfooding):
 *   - `### 1. Constituição Iridológica`     (canonical legacy format)
 *   - `## 1. Constituição Iridológica`      (Sonnet sometimes bumps H3→H2)
 *   - `## §1 — Constituição Iridológica`    (Sonnet 4.6 post-2026-05-12)
 *   - `### §1 — ...`, `## 1 — ...`, `### 1 —`, etc. — same shape, any combo
 *
 * Rejected: `#` (H1) and `####` (H4) bypass the boundary check. Pitfall 2
 * defenses still hold for all variants.
 *
 * Phase 7 | Plan 07-04 | Decisions: D-S2, RESEARCH §Code Examples, Pitfall 2
 * Phase 07.1.6 UAT-1 fix (2026-05-12): regex tolerance for `## §N —` format.
 * Phase 7.4 Plan 11 (Direction Correction DC-1/DC-3): range extended 13 → 14.
 * Phase 7.4 Plan 27 (UAT-iter-3): §2.5 collapsed into §2; 15 sequential (1..15).
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
  /** Heading number as a string ('1'..'15'). */
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

// Essence marker. The LLM emits it ONCE as a line containing the essence
// heading (any heading depth #..####, **bold**, any case, optional
// separator), then the phrase — same line (`## …: …` / `— …`) OR following
// lines.
//
// v2.7.0 (2026-05-25): regex narrowed to ONLY "em uma palavra" (Plan 28
// naming). Plan 35 had widened to "em poucas palavras" but that collided
// with the Marca 7 v2 §0 microfilme (same heading), causing the parser to
// capture the 600+ char microfilme as essence_phrase + truncate to 400 chars
// + drop the maieutic question. Diagnóstico Evanilce reading
// e8976f11-f404-4e34-8fa3-3f2047d0e4ea. Fix: §0 microfilme has its own
// numbered heading (`## 0. Em poucas palavras` — extracted by
// extractZeroSection) and essence_phrase reverts to original "Em uma palavra"
// short form.
//
// Phase 7.4-35: the essence is generated LAST — emitted AFTER §15. The
// marker is line-anchored (`^|\n`) so it won't fire on prose like
// "…em uma palavra…".
const ESSENCE_MARKER_RE =
  /(?:^|\n)[ \t]*(?:#{1,4}[ \t]+)?\*{0,2}[ \t]*em uma palavra[ \t]*\*{0,2}[ \t]*(?:[:—–-][ \t]*)?/iu

// §0 marker. Marca 7 v2 (§0 — Em poucas palavras) emits as the FIRST
// numbered heading of the report, with format `## 0. Em poucas palavras`
// (or `### 0. ...`, `## §0 — ...`, etc — same shape as §1..§15 boundaries).
// We extract §0 SEPARATELY from findAllBoundaries so '0' doesn't enter
// NUMBERED_SECTION_HEADINGS monotonicity (which would break if Sonnet ever
// emitted §1 without §0). The slice spans from §0 heading to either the §1
// boundary or end-of-buffer.
const ZERO_BOUNDARY_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*0[ \t]*[\p{Pd}.][ \t]*/mu

/**
 * Absolute buffer index of the essence-marker line, searching only from
 * `fromIdx` onward. -1 when absent. Used to (a) extract the post-§15
 * essence and (b) stop the last section from swallowing it.
 */
function essenceMarkerIndex(buffer: string, fromIdx: number): number {
  const m = ESSENCE_MARKER_RE.exec(buffer.slice(fromIdx))
  return m ? fromIdx + m.index : -1
}

/**
 * Extract the "essence phrase". New contract (07.4-35): the marker sits in
 * the region AFTER the last numbered boundary (post-§15). If not found
 * there, fall back to the pre-§1 region (legacy buffers). Returns the
 * phrase as one cleaned line (markdown/blockquote/wrapping-quotes stripped,
 * whitespace collapsed). null when the marker is absent. Length-capped.
 */
export function extractEssencePhrase(buffer: string): string | null {
  const boundaries = findAllBoundaries(buffer)
  let region: string
  if (boundaries.length > 0) {
    const tailStart = boundaries[boundaries.length - 1]!.startIdx
    region = ESSENCE_MARKER_RE.test(buffer.slice(tailStart))
      ? buffer.slice(tailStart) // new contract: essence after §15
      : buffer.slice(0, boundaries[0]!.startIdx) // legacy: essence pre-§1
  } else {
    region = buffer
  }
  const m = ESSENCE_MARKER_RE.exec(region)
  if (!m) return null
  const cleaned = region
    .slice(m.index + m[0].length)
    .replace(/^[ \t]*>[ \t]?/gm, '') // blockquote markers
    .replace(/[*_`#]/g, '') // markdown emphasis / stray heading hashes
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '') // wrapping quotes
    .trim()
  if (cleaned.length === 0) return null
  return cleaned.length > 400 ? `${cleaned.slice(0, 399)}…` : cleaned
}

/**
 * Extract §0 (Marca 7 v2 — Em poucas palavras) microfilme. Looks for
 * `## 0. ...` heading (or `### 0. ...`, etc) anywhere in the buffer, then
 * slices content from that heading down to the §1 boundary (or end of
 * buffer if §1 absent).
 *
 * v2.7.0 (2026-05-25): introduced to fix the §0/essence_phrase collision
 * — Marca 7 v2 was emitting `## Em poucas palavras` without number,
 * colliding with essence_phrase and getting truncated to 400 chars.
 * §0 now has its own numbered heading and is extracted separately, OUT of
 * NUMBERED_SECTION_HEADINGS (so '0' doesn't enter monotonicity — Sonnet
 * sometimes skips §0, and that should still let §1..§15 parse normally).
 *
 * Returns the trimmed §0 body (heading stripped) or null when absent.
 * No length cap — §0 is a 6-9 line microfilme with a separated maieutic
 * question paragraph. The full content goes to report_generated as
 * `0_em_poucas_palavras`.
 */
export function extractZeroSection(buffer: string): string | null {
  const m = ZERO_BOUNDARY_RE.exec(buffer)
  if (!m) return null
  const headingStartIdx = m.index
  const matchEnd = headingStartIdx + m[0].length
  // End of the heading line (where the title text continues — we don't
  // include it in the body, but we need to start the body AFTER the line
  // break that follows the heading).
  const headingLineEnd = buffer.indexOf('\n', matchEnd)
  const bodyStart = headingLineEnd === -1 ? matchEnd : headingLineEnd + 1
  // §0 body ends at §1 boundary (first numbered heading after §0). If §1
  // is absent (incomplete buffer), slice to end of buffer.
  const boundaries = findAllBoundaries(buffer)
  const firstNumbered = boundaries[0]?.startIdx
  const bodyEnd =
    firstNumbered !== undefined && firstNumbered > bodyStart
      ? firstNumbered
      : buffer.length
  const body = buffer.slice(bodyStart, bodyEnd).trim()
  return body.length === 0 ? null : body
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
  // 07.4-35: the essence block is emitted AFTER the last section (§15). The
  // last section must NOT swallow it — truncate the last section at the
  // essence marker when it appears after the final boundary.
  const lastStart = boundaries.length
    ? boundaries[boundaries.length - 1]!.startIdx
    : 0
  const essenceIdx = boundaries.length
    ? essenceMarkerIndex(buffer, lastStart)
    : -1
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i]!
    const nextBoundary = boundaries[i + 1]
    let endIdx = nextBoundary ? nextBoundary.startIdx : buffer.length
    if (!nextBoundary && essenceIdx !== -1 && essenceIdx > boundary.startIdx) {
      endIdx = essenceIdx
    }
    const content = buffer.slice(boundary.startIdx, endIdx).trim()
    result.push({ key: boundary.key, content })
  }
  return result
}
