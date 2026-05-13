// IMPLEMENTED BY: 07.4-03 (stream-parser-v2.ts — fixed-order top-level key detection)
// Source: 07.4-VALIDATION.md, D-VAL3 path (b).
import { describe, it, expect } from 'vitest'
import { detectCompletedKeys, REPORT_V2_TOP_LEVEL_KEYS } from '../stream-parser-v2'

describe('lib/anthropic/stream-parser-v2 (D-VAL3) — Plan 07.4-03', () => {
  it('empty buffer → 0 completed keys', () => {
    expect(detectCompletedKeys('')).toEqual([])
  })

  it('partial JSON with only report_version not yet followed by next key → 0 completed', () => {
    const buffer = '{"report_version":"2.0"'
    expect(detectCompletedKeys(buffer)).toEqual([])
  })

  it('report_version followed by executive_summary → 1 completed (report_version)', () => {
    const buffer = '{"report_version":"2.0","executive_summary":"resum'
    expect(detectCompletedKeys(buffer)).toEqual(['report_version'])
  })

  it('executive_summary closed + constitutional_pattern starting → 2 completed', () => {
    const buffer = '{"report_version":"2.0","executive_summary":"resumo completo","constitutional_pattern":{"des'
    expect(detectCompletedKeys(buffer)).toEqual(['report_version', 'executive_summary'])
  })

  it('all keys present and clinical_note closed before advanced_analysis → 9 completed (excludes advanced_analysis)', () => {
    const buffer =
      '{"report_version":"2.0",' +
      '"executive_summary":"a",' +
      '"constitutional_pattern":{},' +
      '"systems_with_tendency":[],' +
      '"integrative_axes":[],' +
      '"bilateral_findings":{},' +
      '"therapeutic_synthesis":"b",' +
      '"priority_focus":[],' +
      '"clinical_note":"c",' +
      '"advanced_analysis":{}'
    const completed = detectCompletedKeys(buffer)
    expect(completed).toEqual([
      'report_version',
      'executive_summary',
      'constitutional_pattern',
      'systems_with_tendency',
      'integrative_axes',
      'bilateral_findings',
      'therapeutic_synthesis',
      'priority_focus',
      'clinical_note',
    ])
  })

  it('streamEnded=true with clinical_note closed → advanced_analysis also marked complete (10 total)', () => {
    const buffer =
      '{"report_version":"2.0",' +
      '"executive_summary":"a",' +
      '"constitutional_pattern":{},' +
      '"systems_with_tendency":[],' +
      '"integrative_axes":[],' +
      '"bilateral_findings":{},' +
      '"therapeutic_synthesis":"b",' +
      '"priority_focus":[],' +
      '"clinical_note":"c",' +
      '"advanced_analysis":{}}'
    const completed = detectCompletedKeys(buffer, { streamEnded: true })
    expect(completed).toContain('advanced_analysis')
    expect(completed.length).toBe(10)
  })

  it('streamEnded=true but clinical_note never observed → advanced_analysis NOT pushed (truncated stream)', () => {
    const buffer = '{"report_version":"2.0","executive_summary":"truncado'
    const completed = detectCompletedKeys(buffer, { streamEnded: true })
    expect(completed).not.toContain('advanced_analysis')
    expect(completed).toEqual(['report_version'])
  })

  it('cross-call state isolation — different buffers do not leak via regex lastIndex', () => {
    const bufA = '{"report_version":"2.0","executive_summary":"x"'
    const bufB = ''
    detectCompletedKeys(bufA)
    expect(detectCompletedKeys(bufB)).toEqual([])
    detectCompletedKeys(bufA)
    detectCompletedKeys(bufB)
    expect(detectCompletedKeys(bufA)).toEqual(['report_version'])
  })

  it('monotonic — out-of-order key detection rejected (constitutional_pattern but no executive_summary → just report_version if pattern starts)', () => {
    // No comma-prefixed next-key for any key → 0 completed.
    const buffer = '{"constitutional_pattern":{}'
    expect(detectCompletedKeys(buffer)).toEqual([])
  })

  it('handles flexible whitespace in next-key-start match', () => {
    const buffer = '{"report_version":"2.0" ,  "executive_summary"  :  "resumo'
    expect(detectCompletedKeys(buffer)).toEqual(['report_version'])
  })

  it('re-exports REPORT_V2_TOP_LEVEL_KEYS with 10 items in canonical order', () => {
    expect(REPORT_V2_TOP_LEVEL_KEYS.length).toBe(10)
    expect(REPORT_V2_TOP_LEVEL_KEYS[0]).toBe('report_version')
    expect(REPORT_V2_TOP_LEVEL_KEYS[REPORT_V2_TOP_LEVEL_KEYS.length - 1]).toBe('advanced_analysis')
  })
})
