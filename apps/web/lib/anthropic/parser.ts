/**
 * Section-boundary parser for incremental LLM streaming persistence.
 *
 * Detects `^## N. ` or `^### N. ` headings (N=1..13) over an accumulated
 * buffer (NOT delta events — Pitfall 2 mandates buffer-level scan). Defenses:
 *   - Regex: `^#{2,3} (\d{1,2})\.\s+` in multiline mode (line-start anchor)
 *   - Number must be in [1, 13] inclusive
 *   - Numbers must be strictly monotonic (`number === lastNumber + 1`)
 *   - Resets `lastIndex` per call (no cross-invocation state leak)
 *
 * Heading depth: prompt asks for `### N.` (H3) but Sonnet 4.6 sometimes adds
 * its own H1 doc title and bumps sections up to H2 (`## N.`). Both are accepted;
 * `#` (H1) and `####` (H4) still rejected. Surfaced 2026-05-08 dogfooding.
 *
 * Phase 7 | Plan 07-04 | Decisions: D-S2, RESEARCH §Code Examples, Pitfall 2
 */
import 'server-only'
import { SECTION_KEY_BY_NUMBER, type NumberedSectionKey } from './types'

const BOUNDARY_RE = /^#{2,3} (\d{1,2})\.\s+/gm

export interface BoundaryMatch {
  /** 1..13 — the section number from the heading. */
  number: number
  /** Canonical jsonb key for the section, e.g. '5_psicoemocional'. */
  key: NumberedSectionKey
  /** Index in buffer where '### ' begins (just after \n or buffer start). */
  startIdx: number
  /** Index after the heading line newline (start of section body content). */
  headingEndIdx: number
}

/**
 * Scan an accumulated buffer for all section boundaries `^### N. `, with
 * Pitfall-2 defenses (out-of-range rejection, non-monotonic rejection,
 * line-start anchor enforcement).
 */
export function findAllBoundaries(buffer: string): BoundaryMatch[] {
  BOUNDARY_RE.lastIndex = 0
  const matches: BoundaryMatch[] = []
  let m: RegExpExecArray | null
  let lastNumber = 0
  while ((m = BOUNDARY_RE.exec(buffer)) !== null) {
    const number = parseInt(m[1]!, 10)
    if (number < 1 || number > 13) continue
    if (number !== lastNumber + 1) continue
    lastNumber = number
    const matchEnd = m.index + m[0].length
    const lineEnd = buffer.indexOf('\n', matchEnd)
    matches.push({
      number,
      key: SECTION_KEY_BY_NUMBER[number]!,
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
