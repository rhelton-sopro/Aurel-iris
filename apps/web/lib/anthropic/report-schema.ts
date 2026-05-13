import 'server-only'
import { z } from 'zod'

/**
 * Iris Codex V1 — `report_v2` zod schema (D-SCH1, D-VAL1).
 *
 * Schema design follows RESEARCH.md §Anthropic JSON mode + LANDMINE-2:
 * - NO .min/.max/.length on numeric/string/array — Anthropic strips these on wire.
 *   The local zod validator still applies them after JSON.parse (defense-in-depth).
 *   Prompt must instruct Sonnet: "tendency_grade integer 1-5", "priority_focus length 3".
 * - .refine() on systems_with_tendency asserts system_id uniqueness — triggers retry on dup.
 * - advanced_analysis.affirmations is optional placeholder reserved for V1.1 add-on.
 *
 * Consumer: lib/anthropic/analyze-v2.ts uses `zodOutputFormat(reportV2Schema)` helper
 * from `@anthropic-ai/sdk/helpers/zod` (do NOT add zod-to-json-schema dep — zod 4
 * native + SDK helper handle wire conversion).
 *
 * Phase 7.4 | Plan 07.4-00 | Decisions: D-SCH1, D-VAL1, D-PR3
 */

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

const systemTendencySchema = z.object({
  system_id: z.enum(SYSTEM_IDS),
  system_name: z.string(),
  tendency_grade: z.number().int(),
  tendency_label: z.enum(TENDENCY_LABELS),
  clinical_description: z.string(),
  associated_manifestations: z.array(z.string()),
  investigation_points: z.array(z.string()),
  therapeutic_direction: z.string(),
})

export const reportV2Schema = z.object({
  report_version: z.literal('2.0'),
  executive_summary: z.string(),
  constitutional_pattern: z.object({
    description: z.string(),
    key_traits: z.array(z.string()),
  }),
  systems_with_tendency: z
    .array(systemTendencySchema)
    .refine(
      (sys) => new Set(sys.map((s) => s.system_id)).size === sys.length,
      { message: 'systems_with_tendency contains duplicate system_id' },
    ),
  integrative_axes: z.array(
    z.object({
      axis_name: z.string(),
      status: z.enum(AXIS_STATUSES),
      description: z.string(),
    }),
  ),
  bilateral_findings: z.object({
    asymmetry_present: z.boolean(),
    description: z.string().nullable(),
  }),
  therapeutic_synthesis: z.string(),
  priority_focus: z.array(z.string()).length(3),
  clinical_note: z.string(),
  advanced_analysis: z.object({
    available: z.literal(true),
    generated: z.literal(false),
    credit_cost: z.literal(1),
    affirmations: z.array(z.string()).optional(),
  }),
})

export type ReportV2 = z.infer<typeof reportV2Schema>
export type SystemTendency = z.infer<typeof systemTendencySchema>

/**
 * Fixed ordering for streaming top-level key detection (D-VAL3 path b).
 * Sonnet is instructed in the prompt to emit keys in this exact order.
 * `lib/anthropic/stream-parser-v2.ts` uses this constant.
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
