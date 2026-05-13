/**
 * Stream parser for report_v2 JSON: detects top-level key completion via
 * next-key-start regex (D-VAL3 path b1 per RESEARCH.md).
 *
 * Strategy: prompt instructs Sonnet to emit keys in `REPORT_V2_TOP_LEVEL_KEYS`
 * fixed order. When the NEXT key's `,\s*"key_name"\s*:` substring appears in
 * the accumulated buffer, the PREVIOUS key is marked complete. Handles depth
 * counting implicitly because Anthropic emits well-formed JSON.
 *
 * Pitfall-2 defenses (mirror parser.ts):
 *  - Reset state per call (no leaked lastIndex — uses fresh RegExp per probe)
 *  - Strict monotonic ordering — once a key fails detection, all downstream
 *    keys are NOT marked complete (they haven't streamed yet)
 *
 * If founder UAT shows false positives, swap to `partial-json@0.1.7` (path a)
 * — same external contract, internal parser changes.
 *
 * Phase 7.4 | Plan 07.4-03 | Decisões: D-VAL3 path b1
 */
import 'server-only'

import { REPORT_V2_TOP_LEVEL_KEYS } from './report-schema'

// 'report_version' is the FIRST key — it emits trivially before anything else
// (its trailing comma triggers next-key-start for executive_summary, so we
// mark report_version complete when executive_summary appears).
// 'advanced_analysis' is the LAST key — there is no key after it; completion
// is signalled by the caller via the `streamEnded` flag.
const DETECTABLE_KEYS = REPORT_V2_TOP_LEVEL_KEYS.filter(
  (k) => k !== 'advanced_analysis',
)

/**
 * Returns the ordered list of top-level keys whose closing has been observed
 * via next-key-start detection. Marks final key 'clinical_note' complete only
 * when 'advanced_analysis' next-key-start substring appears.
 *
 * Caller invokes after each text_delta chunk; idempotent — safe to call
 * repeatedly on the growing buffer (returns full completed-list each time).
 *
 * NOTE: 'advanced_analysis' is marked complete only when the caller signals
 * stream end (via the optional `streamEnded` flag). This avoids false-positive
 * completion based on opening brace alone.
 *
 * Truncated streams that never reach advanced_analysis will leave clinical_note
 * Skeleton on the client UI even when zod parse succeeds on the final buffer.
 * This is a cosmetic limitation (the final report renders correctly; only the
 * streaming progress indicator stays on the last block). Accepted as a
 * documented V1 limitation.
 */
export function detectCompletedKeys(
  buffer: string,
  options: { streamEnded?: boolean } = {},
): string[] {
  const completed: string[] = []

  for (let i = 0; i < DETECTABLE_KEYS.length; i++) {
    const currentKey = DETECTABLE_KEYS[i]!
    // Sentinel = beginning of the key AFTER this one.
    // If currentKey is last in DETECTABLE_KEYS (i.e. 'clinical_note'), the
    // sentinel is 'advanced_analysis' (the literal last REPORT_V2 key, which
    // IS the next-key-start signal we want).
    const nextKey =
      i < DETECTABLE_KEYS.length - 1
        ? DETECTABLE_KEYS[i + 1]!
        : 'advanced_analysis'
    // Match: comma + optional whitespace + quoted next key + optional whitespace + colon
    const nextKeyStartRe = new RegExp(`,\\s*"${nextKey}"\\s*:`)
    if (nextKeyStartRe.test(buffer)) {
      completed.push(currentKey)
    } else {
      // Monotonic: once a key fails detection, downstream keys haven't completed either
      break
    }
  }

  if (options.streamEnded && completed.includes('clinical_note')) {
    // Stream completed cleanly + clinical_note observed → advanced_analysis is implicit-complete
    completed.push('advanced_analysis')
  }

  return completed
}

export { REPORT_V2_TOP_LEVEL_KEYS } from './report-schema'
