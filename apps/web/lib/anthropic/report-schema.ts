import 'server-only'
import { z } from 'zod'

import {
  SYSTEM_IDS,
  TENDENCY_LABELS,
  AXIS_STATUSES,
  REPORT_V2_TOP_LEVEL_KEYS,
  type SystemId,
  type TendencyLabel,
  type AxisStatus,
  type ReportV2TopLevelKey,
  type SystemTendency,
  type IntegrativeAxis,
  type ReportV2,
} from './report-schema-shared'

/**
 * Iris Codex V1 — `report_v2` zod schema (D-SCH1, D-VAL1).
 *
 * **SERVER-ONLY**: this file carries `import 'server-only'` because it pulls in
 * zod runtime + Anthropic-side wire-format helpers. The const arrays + plain
 * TS interfaces have been factored out to `./report-schema-shared.ts` so client
 * components can import them without tripping the server-only guard (Plan
 * 07.4-09, D-DEF-09-01 resolution).
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
 * Phase 7.4 | Plan 07.4-00, 07.4-09 | Decisions: D-SCH1, D-VAL1, D-PR3
 */

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

// ---------------------------------------------------------------------------
// Static contract: the zod-inferred shape must match the plain TS interface
// declared in report-schema-shared.ts. If you change one, change both. The
// `satisfies` clause + the `_TypeContract` const below give a compile-time
// error if the two shapes diverge (e.g., adding a field to zod without
// adding it to ReportV2 interface, or vice versa).
// ---------------------------------------------------------------------------

type ZodInferredReportV2 = z.infer<typeof reportV2Schema>
type ZodInferredSystemTendency = z.infer<typeof systemTendencySchema>

// If these assignments fail, the zod schema and the shared interface drifted.
// Edit one to match the other before merging.
const _ReportV2Contract: ZodInferredReportV2 extends ReportV2
  ? ReportV2 extends ZodInferredReportV2
    ? true
    : false
  : false = true
const _SystemTendencyContract: ZodInferredSystemTendency extends SystemTendency
  ? SystemTendency extends ZodInferredSystemTendency
    ? true
    : false
  : false = true
// Reference the contract constants to suppress unused-variable warnings.
void _ReportV2Contract
void _SystemTendencyContract

// ---------------------------------------------------------------------------
// Re-exports for backwards compatibility — existing server-side imports keep
// working without churn. New code should import from `./report-schema-shared`
// directly when only types/const arrays are needed.
// ---------------------------------------------------------------------------

export {
  SYSTEM_IDS,
  TENDENCY_LABELS,
  AXIS_STATUSES,
  REPORT_V2_TOP_LEVEL_KEYS,
}

export type {
  SystemId,
  TendencyLabel,
  AxisStatus,
  ReportV2TopLevelKey,
  SystemTendency,
  IntegrativeAxis,
  ReportV2,
}
