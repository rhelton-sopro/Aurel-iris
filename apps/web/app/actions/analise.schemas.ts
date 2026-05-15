import { z } from 'zod'

// Phase 7.4 Plan 27 (UAT-iter-3) — §2.5 collapsed into §2; Síntese Rápida
// renumbered §16 → §15. Strictly sequential 1..15 + encerramento.
// Plan 28 (UAT-iter-4) — adds non-numbered `essence_phrase` ("Em uma
// palavra" page). Keep in sync with types.ts ReportSectionKey.
const REPORT_KEYS = [
  '1_constituicao_temperamento',
  '2_mapa_organico',
  '3_linha_tempo_emocional',
  '4_padroes_emocionais_ativos',
  '5_eixo_psicossomatico',
  '6_herancas_transgeracionais',
  '7_carencias_funcionais',
  '8_estado_mental_nervoso',
  '9_recursos_forcas',
  '10_dimensao_arquetipica',
  '11_sugestoes_integrativas',
  '12_roteiro_anamnese',
  '13_sintese_integrativa',
  '14_mensagem_cliente',
  '15_sintese_rapida',
  'essence_phrase',
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

// Phase 7.4 Plan 10 (Direction Correction): reportV2DeliveredSchema +
// ReportV2DeliveredInput removed (depended on report-schema.ts which is
// being deleted). Plan 11 will reintroduce v2 schemas designed around
// 14-section markdown.
