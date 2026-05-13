// IMPLEMENTED BY: 07.4-00 (Wave 0) — schema authored alongside this test.
// Plan: 07.4-00-PLAN.md — D-SCH1 + D-VAL1 + D-PR3.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  reportV2Schema,
  SYSTEM_IDS,
  TENDENCY_LABELS,
  REPORT_V2_TOP_LEVEL_KEYS,
  AXIS_STATUSES,
} from '../report-schema'

const FIX_DIR = path.join(__dirname, 'fixtures')

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(FIX_DIR, name), 'utf8'))
}

describe('lib/anthropic/report-schema (D-SCH1, D-VAL1, Plan 07.4-00)', () => {
  it('parses valid report fixture successfully', () => {
    const parsed = reportV2Schema.safeParse(loadFixture('report-v2-valid.json'))
    expect(parsed.success).toBe(true)
  })

  it('parses empty-systems fixture successfully (adaptive empty state)', () => {
    const parsed = reportV2Schema.safeParse(
      loadFixture('report-v2-empty-systems.json'),
    )
    expect(parsed.success).toBe(true)
  })

  it('rejects missing required field (executive_summary)', () => {
    const parsed = reportV2Schema.safeParse(
      loadFixture('report-v2-invalid-missing-required.json'),
    )
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('executive_summary')
    }
  })

  it('rejects duplicate system_id via .refine()', () => {
    const dup = {
      ...(loadFixture('report-v2-valid.json') as Record<string, unknown>),
      systems_with_tendency: [
        {
          system_id: 'linfatico',
          system_name: 'A',
          tendency_grade: 1,
          tendency_label: 'leve',
          clinical_description: 'a',
          associated_manifestations: [],
          investigation_points: [],
          therapeutic_direction: 'a',
        },
        {
          system_id: 'linfatico',
          system_name: 'B',
          tendency_grade: 2,
          tendency_label: 'leve-moderada',
          clinical_description: 'b',
          associated_manifestations: [],
          investigation_points: [],
          therapeutic_direction: 'b',
        },
      ],
    }
    const parsed = reportV2Schema.safeParse(dup)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => i.message.includes('duplicate')),
      ).toBe(true)
    }
  })

  it('SYSTEM_IDS has 12 entries with linfatico + reprodutor', () => {
    expect(SYSTEM_IDS.length).toBe(12)
    expect(SYSTEM_IDS).toContain('linfatico')
    expect(SYSTEM_IDS).toContain('hepatico_biliar')
    expect(SYSTEM_IDS).toContain('reprodutor')
  })

  it('TENDENCY_LABELS matches D-UI4 5-element enum', () => {
    expect(TENDENCY_LABELS).toEqual([
      'leve',
      'leve-moderada',
      'moderada',
      'alta',
      'muito alta',
    ])
  })

  it('REPORT_V2_TOP_LEVEL_KEYS has 10 ordered keys starting with report_version', () => {
    expect(REPORT_V2_TOP_LEVEL_KEYS.length).toBe(10)
    expect(REPORT_V2_TOP_LEVEL_KEYS[0]).toBe('report_version')
    expect(REPORT_V2_TOP_LEVEL_KEYS).toContain('systems_with_tendency')
    expect(REPORT_V2_TOP_LEVEL_KEYS).toContain('advanced_analysis')
  })

  it('AXIS_STATUSES enum is exactly [ativo, latente, inativo]', () => {
    expect(AXIS_STATUSES).toEqual(['ativo', 'latente', 'inativo'])
  })

  it('priority_focus.length(3) enforced post-parse (defense-in-depth)', () => {
    const data = loadFixture('report-v2-valid.json') as Record<string, unknown>
    const bad = { ...data, priority_focus: ['only', 'two'] }
    const parsed = reportV2Schema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })
})
