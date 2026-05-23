/**
 * Stage 1 Schema — Runtime guards + zod + Anthropic Tool + validator
 * pra Etapa 1 do pipeline Sonnet 2x (v2.3.0 Caminho 1).
 *
 * GLOSSARY puro (sem 'server-only' guard) vive em ./stage1-glossary —
 * separado pra que o script standalone scripts/generate-schema-artifacts.ts
 * consiga importá-lo fora do contexto Next.js. Re-exportado aqui pros
 * callers de runtime acharem tudo num lugar só.
 *
 * Este arquivo cobre:
 *   1. Re-export de GLOSSARY, KNOWN_CAMPOS, GlossaryEntry
 *   2. Zod schemas (validação interna + inferência de tipos TS)
 *   3. REGISTRAR_EXAME_TOOL — Anthropic Tool object (JSONSchema espelha
 *      os zod schemas)
 *   4. validateExameIridologico() — validator com 5 blindagens semânticas
 *   5. GENERIC_PHRASE_PATTERNS — regex anti-vague exportadas
 *   6. logOffGlossaryUsage() — observabilidade pra termos fora do glossário
 *   7. extractToolUseInput() — helper pra pegar input do tool_use block
 *
 * O bloco "Glossário canônico" do stage1-scan.md é GERADO a partir do
 * GLOSSARY[] daqui via scripts/generate-schema-artifacts.ts (Turno 2).
 * Editar tabela markdown manualmente vira inconsistência detectada por
 * `pnpm generate:schema-artifacts:check` no pre-commit/CI.
 *
 * Validação bibliográfica do GLOSSARY contra acervo em 2026-05-23:
 * detalhe em ./stage1-glossary.ts + memory/project_caminho_1_sonnet_2x_architecture.md.
 *
 * Caminho 1 | v2.3.0 | Sonnet 4.6 (Etapa 1 com tool use)
 */
import 'server-only'
import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'

// Re-exports do glossary puro (sem 'server-only' guard)
export { GLOSSARY, KNOWN_CAMPOS } from './stage1-glossary'
export type { GlossaryEntry } from './stage1-glossary'

// ============================================================
// ENUMS + ZOD SCHEMAS
// ============================================================

export const NATUREZA_DA_CARGA = [
  'cronica_sustentada',
  'aguda_recente',
  'em_reorganizacao_ativa',
  'herdada_constitucional',
  'indeterminada',
] as const

export const LATERALIDADE = [
  'bilateral_simetrico',
  'bilateral_assimetrico',
  'unilateral_OE',
  'unilateral_OD',
] as const

export const POLARIDADE_FUNCIONAL = ['vital_ativo', 'neutro'] as const

export const STATUS_TEMPORAL = ['a_resolver', 'em_processo', 'resolvido'] as const

export const COR_PREDOMINANTE = [
  'castanho_escuro',
  'castanho_claro',
  'verde_acinzentado',
  'azul',
  'azul_acinzentado',
  'misto',
] as const

export const TRAMA_FIBRAS = ['compacta_densa', 'media', 'aberta', 'irregular'] as const

export const PUPILA = [
  'centrada_regular',
  'descentrada',
  'deformada',
  'miose',
  'midriase',
] as const

export const BORDAS_PUPILARES = [
  'regulares',
  'achatamentos',
  'descentralizacoes',
  'irregulares',
] as const

const AchadoSchema = z.object({
  campo: z.string().min(2),
  intensidade: z.number().int().min(1).max(5),
  natureza_da_carga: z.enum(NATUREZA_DA_CARGA),
  lateralidade: z.enum(LATERALIDADE),
  descricao_visual: z.string().min(15),
  observacao_qualifying: z.string().nullable(),
})

const SistemaPreservadoSchema = z.object({
  campo: z.string().min(2),
  polaridade_funcional: z.enum(POLARIDADE_FUNCIONAL),
  sinal_visual_positivo: z.string().min(15),
  implicacao_funcional: z.string().min(15),
  observacao_qualifying: z.string().nullable(),
})

const CorrelacaoSchema = z.object({
  campos: z.array(z.string().min(2)).length(2),
  natureza: z.string().min(20),
  ancora_visual: z.string().min(20),
})

const MarcadorTemporalSchema = z.object({
  idade_aproximada: z.string().min(3),
  marca_visivel: z.string().min(15),
  tipo_provavel: z.string().min(10),
  status: z.enum(STATUS_TEMPORAL),
})

const ConstituicaoBaseSchema = z.object({
  cor_predominante: z.enum(COR_PREDOMINANTE),
  trama_fibras: z.enum(TRAMA_FIBRAS),
  pupila: z.enum(PUPILA),
  bordas_pupilares: z.enum(BORDAS_PUPILARES),
  outros_sinais_globais: z.array(z.string()),
})

export const ExameIridologicoSchema = z.object({
  assinatura_visual_caracteristica: z.string().min(40),
  achados_de_atencao: z.array(AchadoSchema),
  sistemas_preservados: z.array(SistemaPreservadoSchema),
  correlacoes_observadas: z.array(CorrelacaoSchema).max(4),
  linha_temporal: z.array(MarcadorTemporalSchema),
  constituicao_base: ConstituicaoBaseSchema,
})

export type ExameIridologico = z.infer<typeof ExameIridologicoSchema>
export type Achado = z.infer<typeof AchadoSchema>
export type SistemaPreservado = z.infer<typeof SistemaPreservadoSchema>
export type Correlacao = z.infer<typeof CorrelacaoSchema>
export type MarcadorTemporal = z.infer<typeof MarcadorTemporalSchema>

// ============================================================
// ANTHROPIC TOOL DEFINITION
// ============================================================

/**
 * Tool object pra passar no `tools[]` da chamada Anthropic Messages API.
 * Anthropic enforce o input_schema em runtime — Sonnet responde com
 * message.content = [{ type: 'tool_use', name: 'registrar_exame_iridologico',
 * input: {...validated...} }].
 *
 * Espelho do ExameIridologicoSchema acima. Em v2.3.0 o script
 * generate-schema-artifacts (Turno 2) verifica que continua sincronizado
 * com o zod schema; divergência falha pre-commit.
 */
export const REGISTRAR_EXAME_TOOL: Anthropic.Tool = {
  name: 'registrar_exame_iridologico',
  description:
    'Registra a observação estruturada da íris após varredura visual ' +
    'das 6 fotos. Use UMA única vez por chamada. Output define o exame ' +
    'técnico que a Etapa 2 vai usar como ancoragem pra compor o relatório.',
  input_schema: {
    type: 'object',
    required: [
      'assinatura_visual_caracteristica',
      'achados_de_atencao',
      'sistemas_preservados',
      'correlacoes_observadas',
      'linha_temporal',
      'constituicao_base',
    ],
    properties: {
      assinatura_visual_caracteristica: {
        type: 'string',
        minLength: 40,
        description:
          '3-5 elementos cromático-estruturais que NÃO caberiam em outra íris.',
      },
      achados_de_atencao: {
        type: 'array',
        description:
          'Achados ordenados por intensidade DESCENDENTE. achados[0] é o ' +
          'protagonista. Array vazio é válido.',
        items: {
          type: 'object',
          required: [
            'campo', 'intensidade', 'natureza_da_carga',
            'lateralidade', 'descricao_visual', 'observacao_qualifying',
          ],
          properties: {
            campo: { type: 'string', minLength: 2 },
            intensidade: { type: 'integer', minimum: 1, maximum: 5 },
            natureza_da_carga: { type: 'string', enum: NATUREZA_DA_CARGA as unknown as string[] },
            lateralidade: { type: 'string', enum: LATERALIDADE as unknown as string[] },
            descricao_visual: { type: 'string', minLength: 15 },
            observacao_qualifying: { type: ['string', 'null'] },
          },
        },
      },
      sistemas_preservados: {
        type: 'array',
        items: {
          type: 'object',
          required: [
            'campo', 'polaridade_funcional', 'sinal_visual_positivo',
            'implicacao_funcional', 'observacao_qualifying',
          ],
          properties: {
            campo: { type: 'string', minLength: 2 },
            polaridade_funcional: { type: 'string', enum: POLARIDADE_FUNCIONAL as unknown as string[] },
            sinal_visual_positivo: { type: 'string', minLength: 15 },
            implicacao_funcional: { type: 'string', minLength: 15 },
            observacao_qualifying: { type: ['string', 'null'] },
          },
        },
      },
      correlacoes_observadas: {
        type: 'array',
        maxItems: 4,
        description: 'Máximo 4. Cada uma DEVE ter ancora_visual concreta nomeável.',
        items: {
          type: 'object',
          required: ['campos', 'natureza', 'ancora_visual'],
          properties: {
            campos: {
              type: 'array',
              items: { type: 'string', minLength: 2 },
              minItems: 2,
              maxItems: 2,
            },
            natureza: { type: 'string', minLength: 20 },
            ancora_visual: { type: 'string', minLength: 20 },
          },
        },
      },
      linha_temporal: {
        type: 'array',
        description:
          'SÓ marcadores com marca visível REAL. Array vazio é válido.',
        items: {
          type: 'object',
          required: ['idade_aproximada', 'marca_visivel', 'tipo_provavel', 'status'],
          properties: {
            idade_aproximada: { type: 'string', minLength: 3 },
            marca_visivel: { type: 'string', minLength: 15 },
            tipo_provavel: { type: 'string', minLength: 10 },
            status: { type: 'string', enum: STATUS_TEMPORAL as unknown as string[] },
          },
        },
      },
      constituicao_base: {
        type: 'object',
        required: [
          'cor_predominante', 'trama_fibras', 'pupila',
          'bordas_pupilares', 'outros_sinais_globais',
        ],
        properties: {
          cor_predominante: { type: 'string', enum: COR_PREDOMINANTE as unknown as string[] },
          trama_fibras: { type: 'string', enum: TRAMA_FIBRAS as unknown as string[] },
          pupila: { type: 'string', enum: PUPILA as unknown as string[] },
          bordas_pupilares: { type: 'string', enum: BORDAS_PUPILARES as unknown as string[] },
          outros_sinais_globais: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

// ============================================================
// GENERIC_PHRASE_PATTERNS — regex anti-vague (exportada)
// ============================================================

/**
 * Padrões genéricos que o validator filtra DEPOIS do parse zod.
 * Exportada como const pra facilitar adicionar novos padrões quando
 * paráfrases novas aparecerem em produção — sem refatorar o validator.
 *
 * Manutenção: quando observação empírica revelar nova paráfrase
 * recorrente, adiciona o regex aqui. Sem deploy gigante — só commit
 * de constante.
 */
export const GENERIC_PHRASE_PATTERNS = {
  /** ancora_visual de correlação — palavras-mola sem estrutura concreta */
  correlacao_vaga: [
    /\bpadr[oõ]es?\s+(comuns?|convergentes?|gerais?|t[ií]picos?)\b/i,
    /\bevid[eê]ncias?\s+(convergentes?|comuns?|gerais?)\b/i,
    /\bsinais?\s+(comuns?|gerais?|t[ií]picos?)\b/i,
    /^padr[oõ]es?\s+(visuais?|estruturais?)\s*$/i,
  ],
  /** marca_visivel — narrativa biográfica em vez de descrição visual */
  marca_narrativa: [
    /^fase\s+(t[ií]pica|cl[aá]ssica|comum)/i,
    /^per[ií]odo\s+(t[ií]pico|cl[aá]ssico|comum|de\s+transi[cç][aã]o)/i,
    /^transi[cç][aã]o\s+(t[ií]pica|cl[aá]ssica|de\s+vida)/i,
    /^etapa\s+(t[ií]pica|cl[aá]ssica|natural)/i,
  ],
  /** sinal_visual_positivo de preservado — inferência por ausência */
  preservado_por_ausencia: [
    /^aus[eê]ncia\s+de\b/i,
    /^sem\s+(manchas?|problemas?|patologia|carga)/i,
    /^n[aã]o\s+(apresenta|h[aá])\b/i,
  ],
} as const

// ============================================================
// VALIDATOR + NORMALIZER + OFF-GLOSSARY LOG
// ============================================================

import { KNOWN_CAMPOS } from './stage1-glossary'

export type ValidationOutcome =
  | {
      status: 'valid' | 'valid_with_warnings'
      exame: ExameIridologico
      unknownTerms: string[]
      filteredOut: {
        correlacoes_vagas: number
        marcadores_narrativos: number
        preservados_por_ausencia: number
      }
    }
  | {
      status: 'invalid'
      error: string
      partial: unknown
    }

/**
 * Valida o input do tool_use com 5 blindagens (zod + 4 semânticas) e
 * retorna o exame normalizado + metadados.
 *
 * Filosofia: DEGRADAÇÃO GRACIOSA. Filtra elementos inválidos em vez de
 * rejeitar o exame todo. Só retorna 'invalid' se o schema zod falhar
 * (campos required ausentes, enums errados, etc) — nesse caso o
 * orquestrador faz retry 1x.
 */
export function validateExameIridologico(input: unknown): ValidationOutcome {
  // Blindagem 1: zod parse
  const parsed = ExameIridologicoSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: 'invalid',
      error: parsed.error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
      partial: input,
    }
  }
  const exame = parsed.data

  // Blindagem 2: reordena achados por intensidade DESC (tolerante)
  exame.achados_de_atencao = [...exame.achados_de_atencao].sort(
    (a, b) => b.intensidade - a.intensidade,
  )

  // Blindagem 3: filtra correlações com ancora_visual genérica
  const correlacoesVagas = exame.correlacoes_observadas.filter(c =>
    GENERIC_PHRASE_PATTERNS.correlacao_vaga.some(p => p.test(c.ancora_visual)),
  ).length
  exame.correlacoes_observadas = exame.correlacoes_observadas.filter(
    c => !GENERIC_PHRASE_PATTERNS.correlacao_vaga.some(p => p.test(c.ancora_visual)),
  )

  // Blindagem 4: filtra marcadores temporais com marca_visivel genérica
  const marcadoresNarrativos = exame.linha_temporal.filter(m =>
    GENERIC_PHRASE_PATTERNS.marca_narrativa.some(p => p.test(m.marca_visivel)),
  ).length
  exame.linha_temporal = exame.linha_temporal.filter(
    m => !GENERIC_PHRASE_PATTERNS.marca_narrativa.some(p => p.test(m.marca_visivel)),
  )

  // Blindagem 5: filtra preservados com sinal_visual_positivo por ausência
  const preservadosPorAusencia = exame.sistemas_preservados.filter(s =>
    GENERIC_PHRASE_PATTERNS.preservado_por_ausencia.some(p =>
      p.test(s.sinal_visual_positivo),
    ),
  ).length
  exame.sistemas_preservados = exame.sistemas_preservados.filter(
    s =>
      !GENERIC_PHRASE_PATTERNS.preservado_por_ausencia.some(p =>
        p.test(s.sinal_visual_positivo),
      ),
  )

  // Observabilidade: campos fora do glossário canônico
  const unknownTerms = collectUnknownTerms(exame)

  const filteredOut = {
    correlacoes_vagas: correlacoesVagas,
    marcadores_narrativos: marcadoresNarrativos,
    preservados_por_ausencia: preservadosPorAusencia,
  }
  const hasWarnings =
    unknownTerms.length > 0 ||
    correlacoesVagas + marcadoresNarrativos + preservadosPorAusencia > 0

  return {
    status: hasWarnings ? 'valid_with_warnings' : 'valid',
    exame,
    unknownTerms,
    filteredOut,
  }
}

function collectUnknownTerms(exame: ExameIridologico): string[] {
  const terms = new Set<string>()
  for (const a of exame.achados_de_atencao) {
    if (!KNOWN_CAMPOS.has(a.campo)) terms.add(a.campo)
  }
  for (const p of exame.sistemas_preservados) {
    if (!KNOWN_CAMPOS.has(p.campo)) terms.add(p.campo)
  }
  for (const c of exame.correlacoes_observadas) {
    for (const cf of c.campos) {
      if (!KNOWN_CAMPOS.has(cf)) terms.add(cf)
    }
  }
  return [...terms].sort()
}

/**
 * Observabilidade pra alimentar decisão de RAG em v2.3.1+.
 * Loga STRUCTURED quando Sonnet usa termo fora dos 42 canônicos.
 * Não bloqueia, não custa LLM, não custa banco — só console.info
 * estruturado que vai pros logs do Vercel.
 *
 * Decisão founder 2026-05-23: revisar logs após 30 dias de prod.
 * Se Sonnet sair do glossário em volume relevante, considera RAG
 * em v2.3.1 — com base em EVIDÊNCIA EMPÍRICA, não em especulação
 * ([[metodologia-rigor-empirico]]).
 */
export function logOffGlossaryUsage(
  unknownTerms: string[],
  context: { reading_id?: string; therapist_id?: string },
): void {
  if (unknownTerms.length === 0) return
  console.info({
    event: 'stage1_off_glossary_usage',
    reading_id: context.reading_id,
    therapist_id: context.therapist_id,
    unknown_terms: unknownTerms,
    count: unknownTerms.length,
    glossary_size: KNOWN_CAMPOS.size,
  })
}

// ============================================================
// ANTHROPIC TOOL_USE EXTRACTION HELPER
// ============================================================

/**
 * Extrai o input do tool_use block do response do Anthropic.
 * Espera message.content = [..., { type: 'tool_use', name: 'registrar_exame_iridologico', input: {...} }].
 * Retorna null se a tool não foi chamada (Sonnet retornou texto livre,
 * por exemplo) — orquestrador trata isso como error retryable.
 */
export function extractToolUseInput(
  message: Anthropic.Message,
): unknown | null {
  const toolUse = message.content.find(
    block => block.type === 'tool_use' && block.name === REGISTRAR_EXAME_TOOL.name,
  )
  if (!toolUse || toolUse.type !== 'tool_use') return null
  return toolUse.input
}
