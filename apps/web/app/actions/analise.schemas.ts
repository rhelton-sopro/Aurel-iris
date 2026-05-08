import { z } from 'zod'

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
