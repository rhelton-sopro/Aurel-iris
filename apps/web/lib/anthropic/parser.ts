/**
 * Section-boundary parser for incremental LLM streaming persistence.
 *
 * Detects section headings (N=1..14) over an accumulated buffer (NOT delta
 * events — Pitfall 2 mandates buffer-level scan). Defenses:
 *   - Regex (multiline): line starts with 2 or 3 hashes, optional `§` glyph,
 *     digit 1-2 chars, then either `.` or em-dash/en-dash/hyphen separator
 *   - Number must be in [1, 14] inclusive
 *   - Numbers must be strictly monotonic (`number === lastNumber + 1`)
 *   - Resets `lastIndex` per call (no cross-invocation state leak)
 *
 * Accepted heading variants (observed across Sonnet 4.6 dogfooding):
 *   - `### 1. Constituição Iridológica`     (canonical prompt format)
 *   - `## 1. Constituição Iridológica`      (Sonnet sometimes bumps H3→H2)
 *   - `## §1 — Constituição Iridológica`    (Sonnet 4.6 post-2026-05-12;
 *                                            surfaced after Phase 07.1.6 UAT:
 *                                            buffer had full 40KB report but
 *                                            ZERO boundaries matched the
 *                                            old `.` separator regex →
 *                                            report_generated stayed empty)
 *   - `### §1 — ...`, `## 1 — ...`, `### 1 —`, etc. — same shape, any combo
 *
 * Rejected: `#` (H1) and `####` (H4) bypass the boundary check. Pitfall 2
 * defenses still hold for all variants.
 *
 * Phase 7 | Plan 07-04 | Decisions: D-S2, RESEARCH §Code Examples, Pitfall 2
 * Phase 07.1.6 UAT-1 fix (2026-05-12): regex tolerance for `## §N —` format.
 * Phase 7.4 Plan 11 (Direction Correction DC-1/DC-3): range extended 13 → 14
 * to match the new Iris Codex V1 14-section markdown structure.
 */
import 'server-only'
import { SECTION_KEY_BY_NUMBER, type NumberedSectionKey } from './types'

// Anatomy:
//   ^[ \t]*        — line start with optional indent (defensive — Sonnet rarely indents but seen 1× in dogfooding)
//   #{2,3}         — 2 or 3 hashes (H2 or H3)
//   [ \t]+         — at least one space/tab after hashes
//   §?             — optional section glyph (`§1` vs `1`)
//   [ \t]*         — optional spaces between § and number
//   (\d{1,2})      — capture 1-14 (range-checked below)
//   [ \t]*         — optional spaces between number and separator
//   [\p{Pd}.]      — separator: period OR any Unicode Dash Punctuation
//                    (\p{Pd} covers em-dash, en-dash, hyphen-minus, figure-dash,
//                    swung-dash, two-em-dash, etc — robust against character variants)
//   [ \t]*         — optional trailing space (no-space variants like `1.Title` accepted)
// u flag required for \p{Pd}; m flag for line-start anchor.
const BOUNDARY_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*(\d{1,2})[ \t]*[\p{Pd}.][ \t]*/gmu

export interface BoundaryMatch {
  /** 1..14 — the section number from the heading. */
  number: number
  /** Canonical jsonb key for the section, e.g. '5_eixo_psicossomatico'. */
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
    if (number < 1 || number > 14) continue
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
