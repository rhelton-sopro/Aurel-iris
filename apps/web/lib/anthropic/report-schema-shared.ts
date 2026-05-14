/**
 * Iris Codex V1 — `report_v2` shared types + const arrays.
 *
 * This module is CLIENT-SAFE — no `'server-only'` directive, no zod runtime,
 * no Anthropic SDK imports. Both server and client components import from
 * here. The companion `report-schema.ts` keeps the zod schema (which depends
 * on `'server-only'`) and re-exports these symbols for backwards compatibility
 * with existing server-side imports.
 *
 * Split rationale (Plan 07.4-09, D-DEF-09-01 resolution): Plan 07.4-07
 * introduced client-side editor components that import `TENDENCY_LABELS`
 * (a runtime value) from `report-schema.ts`. Next.js webpack refused to
 * bundle a module marked `'server-only'` into a client chunk, breaking
 * `pnpm build`. Splitting the file into client-safe shared + server-only
 * schema unblocks the production build without churning the existing
 * server-side import surface.
 *
 * Type strategy: `ReportV2` and `SystemTendency` are expressed as plain
 * TypeScript interfaces mirroring the zod-inferred shape exactly. Indexed
 * access (`ReportV2['systems_with_tendency'][number]`) continues to work
 * in every consumer.
 *
 * Phase 7.4 | Plan 07.4-09 | Decisions: D-SCH1, D-VAL1, D-PR3
 */

// ---------------------------------------------------------------------------
// Const arrays (runtime values — must be in shared so client components can
// reference them at runtime; `as const` for literal-type narrowing).
// ---------------------------------------------------------------------------

export const SYSTEM_IDS = [
  'linfatico',
  'hepatico_biliar',
  'renal',
  'digestivo',
  'nervoso_autonomo',
  'cardiovascular',
  'endocrino',
  'imune',
  'respiratorio',
  'musculoesqueletico',
  'pele_tegumento',
  'reprodutor',
] as const

export type SystemId = (typeof SYSTEM_IDS)[number]

export const TENDENCY_LABELS = [
  'leve',
  'leve-moderada',
  'moderada',
  'alta',
  'muito alta',
] as const

export type TendencyLabel = (typeof TENDENCY_LABELS)[number]

export const AXIS_STATUSES = ['ativo', 'latente', 'inativo'] as const
export type AxisStatus = (typeof AXIS_STATUSES)[number]

/**
 * Fixed ordering for streaming top-level key detection (D-VAL3 path b).
 * Sonnet is instructed in the prompt to emit keys in this exact order.
 * `lib/anthropic/stream-parser-v2.ts` (server) uses this constant; the
 * client streaming detector in `analise-client.tsx` inlines its own copy
 * because it cannot import from `lib/anthropic/*` (server-only adjacency).
 */
export const REPORT_V2_TOP_LEVEL_KEYS = [
  'report_version',
  'executive_summary',
  'constitutional_pattern',
  'systems_with_tendency',
  'integrative_axes',
  'bilateral_findings',
  'therapeutic_synthesis',
  'priority_focus',
  'clinical_note',
  'advanced_analysis',
] as const

export type ReportV2TopLevelKey = (typeof REPORT_V2_TOP_LEVEL_KEYS)[number]

// ---------------------------------------------------------------------------
// Plain TS interfaces (mirror the zod-inferred shape from report-schema.ts).
// Kept in sync manually with the zod schema; the lib/anthropic/__tests__
// schema-shape contract test asserts both produce structurally identical
// types. If you change one, change both + update the contract test.
// ---------------------------------------------------------------------------

/**
 * Single system-tendency entry inside `report_v2.systems_with_tendency[]`.
 * Mirrors `systemTendencySchema` z-inferred shape.
 */
export interface SystemTendency {
  system_id: SystemId
  system_name: string
  tendency_grade: number
  tendency_label: TendencyLabel
  clinical_description: string
  associated_manifestations: string[]
  investigation_points: string[]
  therapeutic_direction: string
}

/**
 * Single integrative-axis entry inside `report_v2.integrative_axes[]`.
 */
export interface IntegrativeAxis {
  axis_name: string
  status: AxisStatus
  description: string
}

/**
 * Iris Codex V1 report shape (D-SCH1). Mirrors `reportV2Schema` z-inferred
 * shape. Server-side validation goes through `report-schema.ts.reportV2Schema`;
 * this interface is the type surface consumed everywhere else.
 */
export interface ReportV2 {
  report_version: '2.0'
  executive_summary: string
  constitutional_pattern: {
    description: string
    key_traits: string[]
  }
  systems_with_tendency: SystemTendency[]
  integrative_axes: IntegrativeAxis[]
  bilateral_findings: {
    asymmetry_present: boolean
    description: string | null
  }
  therapeutic_synthesis: string
  priority_focus: string[]
  clinical_note: string
  advanced_analysis: {
    available: true
    generated: false
    credit_cost: 1
    affirmations?: string[]
  }
}
