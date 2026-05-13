/**
 * Per-system_id + top-level-key diff classification for report_v2 (D-SCH3).
 *
 * Reuses `classifyEdit` primitive from `./diff` AS-IS — do NOT duplicate. Only
 * the iteration keyspace changes (system_id + top-level keys instead of
 * numbered section keys).
 *
 * Output shape (D-SCH3): `{ [key]: ClassifiedEditV2 }` where keys are:
 *  - top-level: 'executive_summary', 'therapeutic_synthesis', 'clinical_note', 'priority_focus'
 *  - per-system: every system_id appearing in generated.systems_with_tendency OR delivered.systems_with_tendency
 *
 * Phase 7.4 | Plan 07.4-03 | Decisões: D-SCH3
 */
import 'server-only'

import { classifyEdit, type ClassifiedEdit } from './diff'
import type { ReportV2 } from './report-schema'
import type { ClassifiedEditV2, ReportV2EditDiff } from './types-v2'

/**
 * Top-level prose fields that take a diff. `priority_focus` is handled
 * separately (joined newline) because it's an array.
 */
const TOP_LEVEL_DIFFABLE_KEYS = [
  'executive_summary',
  'therapeutic_synthesis',
  'clinical_note',
] as const

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/**
 * Serialize a SystemTendency's editable text fields into a single string for
 * diff comparison. Order: clinical_description + therapeutic_direction (the
 * two prose fields per UI-SPEC).
 */
function serializeSystemForDiff(sys: ReportV2['systems_with_tendency'][number]): string {
  return [sys.clinical_description ?? '', sys.therapeutic_direction ?? '']
    .join('\n---\n')
    .trim()
}

/**
 * Coerce a ClassifiedEdit (from `./diff`) to ClassifiedEditV2 shape. Type
 * surfaces are identical at runtime — the V2 EditDiffType union matches the
 * Phase 7 EditTipo string union 1:1. This cast carries the contract that the
 * `type` discriminant lives in both unions.
 */
function toV2(e: ClassifiedEdit): ClassifiedEditV2 {
  return e as unknown as ClassifiedEditV2
}

export function classifyAllSystemsV2(
  generated: ReportV2 | null,
  delivered: ReportV2 | null,
): ReportV2EditDiff {
  const out: ReportV2EditDiff = {}
  const gen = generated ?? ({} as Partial<ReportV2>)
  const del = delivered ?? ({} as Partial<ReportV2>)

  // Top-level prose fields
  for (const key of TOP_LEVEL_DIFFABLE_KEYS) {
    const g = (gen[key] as string | undefined) ?? ''
    const d = (del[key] as string | undefined) ?? ''
    out[key] = toV2(classifyEdit(g, d))
  }

  // priority_focus — join as newline-separated string for diff
  const gPrio = safeArray<string>(gen.priority_focus).join('\n').trim()
  const dPrio = safeArray<string>(del.priority_focus).join('\n').trim()
  out['priority_focus'] = toV2(classifyEdit(gPrio, dPrio))

  // Per-system diff (union of system_ids in both)
  const gSystems = new Map(
    safeArray<ReportV2['systems_with_tendency'][number]>(gen.systems_with_tendency).map(
      (s) => [s.system_id, s] as const,
    ),
  )
  const dSystems = new Map(
    safeArray<ReportV2['systems_with_tendency'][number]>(del.systems_with_tendency).map(
      (s) => [s.system_id, s] as const,
    ),
  )
  const allSystemIds = new Set([...gSystems.keys(), ...dSystems.keys()])
  for (const sid of allSystemIds) {
    const g = gSystems.get(sid)
    const d = dSystems.get(sid)
    const gText = g ? serializeSystemForDiff(g) : ''
    const dText = d ? serializeSystemForDiff(d) : ''
    out[sid] = toV2(classifyEdit(gText, dText))
  }

  return out
}
