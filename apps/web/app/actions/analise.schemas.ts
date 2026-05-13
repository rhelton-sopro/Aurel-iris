import { z } from 'zod'

import { reportV2Schema } from '@/lib/anthropic/report-schema'

const REPORT_KEYS = [
  '1_constituicao',
  '2_estrutural_fisica',
  '3_indicacoes_sistemicas',
  '4_toxemia',
  '5_psicoemocional',
  '6_cargas_temporais',
  '7_carencias_nutricionais',
  '8_simbolico_espiritual',
  '9_cuidados_integrativos',
  '10_potenciais_forcas',
  '11_afirmacoes_integracao',
  '12_sintese_integrativa',
  '13_mensagem_final',
  'encerramento_disclaimer',
] as const

/** D-P3 canonical jsonb shape; passthrough() per Pitfall 10 (RESEARCH). */
export const reportDeliveredSchema = z
  .object(
    Object.fromEntries(
      REPORT_KEYS.map((k) => [k, z.string().optional()]),
    ) as { [K in (typeof REPORT_KEYS)[number]]: z.ZodOptional<z.ZodString> },
  )
  .passthrough()

export const readingIdSchema = z.object({
  reading_id: z.string().uuid('reading_id inválido'),
})

export type ReportDeliveredInput = z.infer<typeof reportDeliveredSchema>

// === Phase 7.4 additions ===
// reportV2DeliveredSchema accepts a Partial<ReportV2> so per-block save can submit
// only the keys the user changed. Full-report save (sticky footer "Salvar alterações")
// passes the whole object; per-block save (per-card "Salvar bloco") passes 1 key.
//
// Strategy: build a passthrough partial of reportV2Schema. We avoid `.partial()`
// directly on reportV2Schema because the .refine() on systems_with_tendency
// would fire for partial inputs without the array key. Instead, build a custom
// partial by re-using individual `.shape` keys with `.optional()`.
//
// Post-merge: priority_focus length-3 invariant is enforced by saveReportV2Delivered
// against the merged result (not on the partial input here).
//
// Phase 7.4 | Plan 07.4-05 | Decisões: D-UI2, D-VOC3
export const reportV2DeliveredSchema = z
  .object({
    report_version: z.literal('2.0').optional(),
    executive_summary: z.string().optional(),
    constitutional_pattern: reportV2Schema.shape.constitutional_pattern.optional(),
    systems_with_tendency: z
      .array(reportV2Schema.shape.systems_with_tendency.element)
      .optional(),
    integrative_axes: reportV2Schema.shape.integrative_axes.optional(),
    bilateral_findings: reportV2Schema.shape.bilateral_findings.optional(),
    therapeutic_synthesis: z.string().optional(),
    priority_focus: z.array(z.string()).optional(),
    clinical_note: z.string().optional(),
    advanced_analysis: reportV2Schema.shape.advanced_analysis.optional(),
  })
  .passthrough()

export type ReportV2DeliveredInput = z.infer<typeof reportV2DeliveredSchema>
