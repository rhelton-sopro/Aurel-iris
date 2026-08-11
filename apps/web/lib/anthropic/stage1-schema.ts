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
export { GLOSSARY, KNOWN_CAMPOS, KNOWN_CAMPOS_LIST, CAMPO_ZONA_MAP } from './stage1-glossary'
export type { GlossaryEntry } from './stage1-glossary'

import { KNOWN_CAMPOS, KNOWN_CAMPOS_LIST, CAMPO_ZONA_MAP } from './stage1-glossary'

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

// v2.5.1 (Fix 2): campo agora é ENUM forçado dos 40 termos canônicos
// do glossário. Antes era string aberta (min 2 chars) e o glossário só
// alimentava log de observabilidade — Sonnet podia inventar termos
// como "sistema_circulatorio_periferico_acinzentado" e passar. Agora,
// termo fora do enum = zod rejeita = retry com correção automática.
// Tuple cast com `as [string, ...string[]]` é exigência do z.enum
// pra aceitar runtime array (KNOWN_CAMPOS_LIST é readonly string[]).
const CAMPO_ENUM = [...KNOWN_CAMPOS_LIST] as [string, ...string[]]

// v2.6.0: enum pra qualificar QUAL é a causa quando natureza='indeterminada'.
// 'obscurecimento_estrutural' = causa tem leitura iridológica própria
// (midríase obscurece collarete; opacidade obscurece zona; etc) — o eixo
// específico não pode ser confirmado MAS a estrutura obscurecedora EM SI
// é achado clínico (registrado separadamente como achado ATIVO).
// 'limitacao_tecnica' = foto desfocada, mal iluminada, olho fechado —
// nem o eixo nem causa estrutural podem ser lidos.
// Routing pro Stage 2: obscurecimento_estrutural → §2 Categoria A.5;
// limitacao_tecnica → §2 Categoria C (mantém ANCHORING — bloqueado de
// §5/§7/§8/§10/§11/§13).
export const MOTIVO_INDETERMINACAO = [
  'obscurecimento_estrutural',
  'limitacao_tecnica',
] as const

const AchadoSchema = z.object({
  campo: z.enum(CAMPO_ENUM),
  intensidade: z.number().int().min(1).max(5),
  natureza_da_carga: z.enum(NATUREZA_DA_CARGA),
  lateralidade: z.enum(LATERALIDADE),
  // v2.9.0 (2026-05-27): min 15→40 chars. Audit das últimas 10 leituras
  // mostrou Sonnet qualificando achados com descrição muito breve
  // ("vasos dilatados visíveis bilateral" ~33 chars) que mascara viés
  // de detecção. Piso de 40 chars força descrição com estrutura nomeada
  // + posição/hora canônica + qualificador clínico (concentrado/difuso/
  // dominante/etc), reduzindo detecção de achados banais por default.
  descricao_visual: z.string().min(40),
  observacao_qualifying: z.string().nullable(),
  // v2.5.1 (Fix 3): meta-flag populado pelo validator quando as horas
  // mencionadas em descricao_visual não batem com a zona canônica do
  // campo (ex: campo='figado_vesicula' descrevendo zona ~10-11h, mas
  // glossário define fígado em 5-7h). Modo warning: não rejeita, só
  // marca pro Stage 2 ver e contextualizar. NÃO vem do LLM —
  // popula-se em validateExameIridologico após o parse.
  coherence_warning: z.string().nullable().optional(),
  // v2.6.0: motivo da indeterminação. Só preencher quando
  // natureza_da_carga='indeterminada'. Quando preenchido, Stage 2 roteia:
  // 'obscurecimento_estrutural' → §2 Categoria A.5 (com leitura clínica
  // ancorada); 'limitacao_tecnica' → §2 Categoria C (sem leitura clínica).
  motivo_indeterminacao: z.enum(MOTIVO_INDETERMINACAO).nullable().optional(),
})

const SistemaPreservadoSchema = z.object({
  campo: z.enum(CAMPO_ENUM),
  polaridade_funcional: z.enum(POLARIDADE_FUNCIONAL),
  // 2026-08-11 (founder): CLAREZA 1-5, espelhando `intensidade` do achado.
  // Antes o preservado era binário (vital_ativo / neutro) e 76% saíam `neutro` —
  // que não é força, é silêncio: o campo simplesmente não falou. Sem régua, o
  // motor tratava "não vi carga" e "vi integridade evidente" quase igual
  // (W_PRES 1.5 vs 2.0). Com a escala, "clareza 1" passa a ser uma resposta
  // honesta, que hoje não existe.
  // .optional(): exames GRAVADOS antes desta data não têm o campo, e precisam
  // continuar validando — o fallback vive em motor-calc.mjs.
  clareza: z.number().int().min(1).max(5).optional(),
  // v2.9.0: min 15→30 chars. Sistema preservado precisa de ancoragem
  // visual concreta — descrição vaga ("zona limpa") não permite Stage 2
  // construir leitura clínica. 30 chars (vs 40 de achado) reconhece que
  // ausência de carga é descrita com menos vocabulário que presença.
  sinal_visual_positivo: z.string().min(30),
  implicacao_funcional: z.string().min(15),
  observacao_qualifying: z.string().nullable(),
})

// Correlações têm 2 campos por entry; mantemos enum também — coerente
// com achados/preservados, evita "campos": ["fígado", "stress_chronico"]
// (segundo elemento não-canônico).
const CorrelacaoSchema = z.object({
  campos: z.array(z.enum(CAMPO_ENUM)).length(2),
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
            campo: { type: 'string', enum: CAMPO_ENUM },
            intensidade: { type: 'integer', minimum: 1, maximum: 5 },
            natureza_da_carga: { type: 'string', enum: NATUREZA_DA_CARGA as unknown as string[] },
            lateralidade: { type: 'string', enum: LATERALIDADE as unknown as string[] },
            // v2.9.0: minLength 15→40 — força descrição com estrutura
            // nomeada + posição/hora + qualificador clínico.
            descricao_visual: { type: 'string', minLength: 40 },
            observacao_qualifying: { type: ['string', 'null'] },
            motivo_indeterminacao: {
              type: ['string', 'null'],
              enum: [...MOTIVO_INDETERMINACAO, null],
              description:
                "Quando natureza_da_carga='indeterminada': qualifica a causa. " +
                "'obscurecimento_estrutural' = midríase/opacidade obscureceu o eixo " +
                '(estrutura obscurecedora é achado ATIVO em outro campo). ' +
                "'limitacao_tecnica' = foto desfocada/mal iluminada, sem leitura. " +
                'NULL quando natureza não é indeterminada.',
            },
          },
        },
      },
      sistemas_preservados: {
        type: 'array',
        items: {
          type: 'object',
          required: [
            'campo', 'polaridade_funcional', 'clareza', 'sinal_visual_positivo',
            'implicacao_funcional', 'observacao_qualifying',
          ],
          properties: {
            campo: { type: 'string', enum: CAMPO_ENUM },
            polaridade_funcional: { type: 'string', enum: POLARIDADE_FUNCIONAL as unknown as string[] },
            clareza: {
              type: 'integer', minimum: 1, maximum: 5,
              description:
                'QUANTO de integridade você viu neste campo, 1 a 5 — a régua espelha a ' +
                '`intensidade` do achado. 5 = sinal positivo inequívoco e extenso ' +
                '(fibra contínua, tom uniforme, varrido em toda a zona). 3 = integridade ' +
                'clara mas localizada. 1 = zona sem carga aparente, porém pouco ' +
                'conclusiva. ⛔ NÃO use 4-5 por ausência de achado: ausência de carga ' +
                'não é evidência de saúde. Se você não varreu a zona, o campo não entra.',
            },
            // v2.9.0: minLength 15→30 pra sinal_visual_positivo.
            sinal_visual_positivo: { type: 'string', minLength: 30 },
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
              items: { type: 'string', enum: CAMPO_ENUM },
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
          'Meta de ESFORÇO: 3 (varra infância/adolescência/vida adulta). ' +
          'SÓ marcadores com marca visível REAL que você consiga apontar. ' +
          'Achou só 2 marcas reais? Emita 2 — inventar o 3º é falha grave. ' +
          'idade_aproximada concreta e de preferência numérica em FAIXA ' +
          '("por volta dos 12 aos 14"), ancorada na maturidade da marca.',
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

// ============================================================
// COHERENCE CAMPO↔ZONA (v2.5.1 Fix 3 — modo warning)
// ============================================================

/**
 * Extrai horas (1-12) mencionadas num texto qualquer.
 *
 * Aceita formatos: '5h', '~5-7h', '5-7h', '~10h', 'às 12:30h',
 * '6 horas', '5-6 horas'. Range '5-7h' expande para [5,6,7].
 * Retorna [] se nenhuma hora detectada.
 *
 * Filosofia conservadora: não tenta parsear "noite", "metade", etc.
 * Só dígitos. Erros falsos-positivos são piores que falsos-negativos
 * aqui (warning errado polui Stage 2; warning omitido é só ruído
 * silencioso de qualidade).
 */
function extractHoras(text: string): number[] {
  const horas = new Set<number>()
  // range '5-7h' / '~5-7h' / '5-7 horas'
  const rangeRe = /~?(\d{1,2})\s*-\s*(\d{1,2})(?:h\b|:\d{2}h?\b|\s*horas?\b)/giu
  let m: RegExpExecArray | null
  while ((m = rangeRe.exec(text)) !== null) {
    const start = parseInt(m[1]!, 10)
    const end = parseInt(m[2]!, 10)
    if (start >= 1 && start <= 12 && end >= 1 && end <= 12 && end >= start) {
      for (let h = start; h <= end; h++) horas.add(h)
    }
  }
  // singletons '5h' / '~5h' / '12:30h' / '5 horas'
  const singleRe = /~?(\d{1,2})(?:h\b|:\d{2}h?\b|\s*horas?\b)/giu
  while ((m = singleRe.exec(text)) !== null) {
    const h = parseInt(m[1]!, 10)
    if (h >= 1 && h <= 12) horas.add(h)
  }
  return [...horas].sort((a, b) => a - b)
}

/**
 * Verifica se o achado descreve zona horária coerente com o campo
 * canônico do glossário. Retorna warning string ou null.
 *
 * Modo WARNING (não rejeita). Casos:
 * - Campo sem zona horária no glossário (sistêmico/global) → null
 * - Descrição sem horas detectáveis → null (não dá pra checar)
 * - Pelo menos UMA hora da descrição cai na zona canônica → null
 * - Nenhuma hora bate → warning citando zona canônica vs zona descrita
 */
function checkCampoZonaCoherence(
  campo: string,
  descricaoVisual: string,
): string | null {
  const zonaCanonica = CAMPO_ZONA_MAP.get(campo)
  if (!zonaCanonica) return null
  const horasCanonicas = extractHoras(zonaCanonica)
  if (horasCanonicas.length === 0) return null // sistêmico/global
  const horasDescritas = extractHoras(descricaoVisual)
  if (horasDescritas.length === 0) return null // não dá pra checar
  const canonSet = new Set(horasCanonicas)
  const hit = horasDescritas.some((h) => canonSet.has(h))
  if (hit) return null
  return (
    `descricao_visual menciona horas [${horasDescritas.join(',')}] ` +
    `mas zona canônica de '${campo}' é '${zonaCanonica}' ` +
    `(horas [${horasCanonicas.join(',')}]). Stage 2: usar com cautela.`
  )
}

// ============================================================
// PIGMENTO ÂMBAR PAIRING (v2.5.3 F4 — modo warning)
// ============================================================

/**
 * Detecta achados `pigmento_amber` órfãos — sem sistema-órgão pareado
 * em zona compatível no mesmo olho. Causa raiz típica: Sonnet vê
 * pigmento âmbar mas escolhe o campo cromático genérico em vez de
 * pesquisar qual sistema-órgão do glossário cobre a zona observada.
 *
 * Modo warning (não rejeita) — popula `coherence_warning` no achado +
 * loga estruturado. Stage 2 lê via JSON e pode contextualizar.
 *
 * Heurística de pareamento espacial: para cada achado pigmento_amber,
 * verifica se existe OUTRO achado de sistema-órgão (não pigmento_amber,
 * campo presente em KNOWN_CAMPOS, com zona horária no glossário) cuja
 * descricao_visual menciona horas que se intersectam com as horas
 * mencionadas em pigmento_amber.descricao_visual no MESMO olho.
 *
 * Se não há pareamento → warning sugerindo emitir sistema-órgão
 * correspondente à zona do pigmento.
 *
 * Mantém TODO F5: pós-UAT, se pigmento_amber órfão se repetir em
 * Carol/Evanilce, F5 promove a regra "pigmento_amber SEMPRE pareado
 * com sistema-órgão" de warning pra rejeição strict no schema.
 */

const EYE_TOKENS = {
  OD: /\b(OD|olho\s+direito)\b/iu,
  OE: /\b(OE|olho\s+esquerdo)\b/iu,
} as const

function describesEye(text: string, eye: 'OD' | 'OE'): boolean {
  return EYE_TOKENS[eye].test(text)
}

// ============================================================
// OBSCURECIMENTO ESTRUTURAL CHECK (v2.6.0 — modo warning)
// ============================================================

/**
 * Mapa: eixo obscurecido → estruturas obscurecedoras que devem estar
 * registradas como achado ATIVO quando o eixo é indeterminada com
 * motivo='obscurecimento_estrutural'. Mantém coerência entre Stage 1
 * (observação) e ANCHORING (composição Stage 2).
 *
 * Mapa não é exaustivo — cobre o caso principal (midríase obscurece
 * collarete/anel interno/zona pericentral) que motivou v2.6.0. Outros
 * padrões estruturais (opacidade periférica obscurecendo zonas
 * externas, manchas obscurecendo setores específicos) podem ser
 * adicionados aqui conforme observação empírica.
 */
const OBSCURECIMENTO_MAP: ReadonlyMap<string, ReadonlyArray<string>> = new Map([
  ['eixo_pituitario_adrenal', ['padrao_pupilar']],
  ['pineal_hipotalamica', ['padrao_pupilar']],
  ['sistema_nervoso_autonomico', ['padrao_pupilar']],
  ['anel_interno', ['padrao_pupilar']],
  ['coroa_simpatica', ['padrao_pupilar']],
  ['estomago', ['padrao_pupilar']],
])

/**
 * v2.6.0: quando achado é indeterminada com motivo='obscurecimento_estrutural',
 * a estrutura obscurecedora correspondente DEVE estar registrada como achado
 * ATIVO no exame. Modo warning (não rejeita) — popula coherence_warning +
 * loga estruturado. Stage 2 vê via JSON e contextualiza.
 *
 * Permite que Sonnet declare "indeterminada por obscurecimento estrutural"
 * de forma honesta E exige que o estrutural correspondente apareça como
 * achado ativo — fechando o loop entre observação parcial e leitura clínica
 * da causa.
 */
function checkObscurecimentoStrutural(
  achados: ReadonlyArray<{
    campo: string
    natureza_da_carga: string
    motivo_indeterminacao?: string | null
    coherence_warning?: string | null
  }>,
): Array<{ index: number; warning: string }> {
  const warnings: Array<{ index: number; warning: string }> = []
  const ativos = new Set(
    achados
      .filter((a) => a.natureza_da_carga !== 'indeterminada')
      .map((a) => a.campo),
  )
  for (let i = 0; i < achados.length; i++) {
    const a = achados[i]!
    if (a.natureza_da_carga !== 'indeterminada') continue
    if (a.motivo_indeterminacao !== 'obscurecimento_estrutural') continue

    const required = OBSCURECIMENTO_MAP.get(a.campo)
    if (!required || required.length === 0) continue

    const present = required.some((r) => ativos.has(r))
    if (!present) {
      warnings.push({
        index: i,
        warning:
          `v2.6.0 obscurecimento_estrutural: '${a.campo}' marcado indeterminada ` +
          `por obscurecimento estrutural, mas estrutura(s) obscurecedora(s) ` +
          `correspondente(s) [${required.join(', ')}] não estão presentes ` +
          `como achado ATIVO no exame. Stage 2: A.5 só roteia este achado ` +
          `se houver estrutura obscurecedora ativa pareada.`,
      })
    }
  }
  return warnings
}

/**
 * TODO F5 (v2.5.3 hipótese, revisita pós-UAT Carol/Evanilce):
 * Se pigmento_amber órfão se repetir em 2+ leituras pós-v2.5.3
 * (warnings em F4 recorrentes), promover a regra estrutural:
 * pigmento_amber SEMPRE deve ter sistema-órgão pareado no MESMO
 * exame — sem pareamento = REJEIÇÃO no validateExameIridologico
 * (não warning). Implementação: trocar `pairingWarnings` push no
 * coherence_warning por return { status: 'invalid', error: ... }
 * análogo ao strict de coherence I≥4.
 *
 * Se Carol/Evanilce vierem pareados (F3+F4+glossário pegam o caso),
 * F5 fica como tech debt fechado — registra em memória como decisão
 * empírica de não promover.
 */
function checkPigmentoAmberPairing(
  achados: ReadonlyArray<{
    campo: string
    descricao_visual: string
    lateralidade: string
    coherence_warning?: string | null
  }>,
): Array<{ index: number; warning: string }> {
  const warnings: Array<{ index: number; warning: string }> = []
  for (let i = 0; i < achados.length; i++) {
    const a = achados[i]!
    if (a.campo !== 'pigmento_amber') continue

    const horasPigmento = extractHoras(a.descricao_visual)
    const eyesPigmento: Array<'OD' | 'OE'> = []
    if (describesEye(a.descricao_visual, 'OD')) eyesPigmento.push('OD')
    if (describesEye(a.descricao_visual, 'OE')) eyesPigmento.push('OE')
    if (eyesPigmento.length === 0 && a.lateralidade === 'unilateral_OD') eyesPigmento.push('OD')
    if (eyesPigmento.length === 0 && a.lateralidade === 'unilateral_OE') eyesPigmento.push('OE')

    // Procura sistema-órgão pareado: outro achado, campo ≠ pigmento_amber,
    // que mencione hora intersectando + mesmo olho na descrição.
    const hasPaired = achados.some((other, j) => {
      if (j === i) return false
      if (other.campo === 'pigmento_amber') return false
      if (!CAMPO_ZONA_MAP.has(other.campo)) return false // só sistema-órgão com zona
      const horasOther = extractHoras(other.descricao_visual)
      const horaMatch = horasOther.some((h) => horasPigmento.includes(h))
      if (!horaMatch) return false
      if (eyesPigmento.length === 0) return true // sem info de olho, hora basta
      const eyeMatch = eyesPigmento.some((e) => describesEye(other.descricao_visual, e))
      return eyeMatch
    })

    if (!hasPaired) {
      warnings.push({
        index: i,
        warning:
          `F4: pigmento_amber sem sistema-órgão pareado em zona ` +
          `compatível${eyesPigmento.length > 0 ? ` (olhos: ${eyesPigmento.join(', ')})` : ''}` +
          `${horasPigmento.length > 0 ? ` (horas: ${horasPigmento.join(',')})` : ''}. ` +
          `Considere emitir achado adicional do sistema-órgão do glossário ` +
          `cuja zona canônica cobre essa região (ex: tireoide em 10-11h OD, ` +
          `pancreas em 7-8h OE, intestino_grosso na periferia, etc).`,
      })
    }
  }
  return warnings
}

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

  // v2.5.1 (Fix 3): popula coherence_warning quando descricao_visual
  // menciona horas que não batem com a zona canônica do campo. Modo
  // warning (não rejeita) — Stage 2 vê a meta-flag via JSON e pode
  // contextualizar. Aplicado em achados E preservados (mesmas regras
  // de coerência espacial).
  //
  // v2.5.2 (Fix B2 — STRICT pra protagonistas): se UM achado com
  // intensidade ≥4 tem coherence_warning, REJEITA o exame inteiro
  // → orquestrador faz retry com instrução explícita ("o campo X
  // estava em zona errada — releia o glossário"). Achados I<4
  // mantêm modo warning (não bloqueiam). Razão: protagonista em zona
  // errada compromete TODA a cascata de §2/§5/§7/§13 do Stage 2 —
  // não vale aceitar com warning silencioso. Achados secundários
  // toleram drift sem comprometer a leitura.
  let coherenceWarnings = 0
  const strictViolations: Array<{ campo: string; warning: string; intensidade: number }> = []
  for (const a of exame.achados_de_atencao) {
    const w = checkCampoZonaCoherence(a.campo, a.descricao_visual)
    if (w) {
      a.coherence_warning = w
      coherenceWarnings++
      if (a.intensidade >= 4) {
        strictViolations.push({ campo: a.campo, warning: w, intensidade: a.intensidade })
      }
    }
  }
  if (strictViolations.length > 0) {
    const detail = strictViolations
      .map(v => `[${v.campo} I=${v.intensidade}] ${v.warning}`)
      .join(' | ')
    return {
      status: 'invalid',
      error:
        `Achado(s) com intensidade ≥4 (protagonista) descrev[e][em] zona ` +
        `horária INCOERENTE com o glossário canônico. Releia a coluna "zona ` +
        `iridológica" do glossário e refaça a descricao_visual citando horas ` +
        `que caem na zona canônica do campo escolhido. Se o pigmento/sinal ` +
        `que você está vendo está em zona DIFERENTE da canônica, REPENSE ` +
        `qual campo do glossário descreve melhor essa zona — não force o ` +
        `nome "fígado" num achado que está na zona do "estômago", ou ` +
        `vice-versa. Detalhe: ${detail}`,
      partial: exame,
    }
  }
  for (const p of exame.sistemas_preservados) {
    const w = checkCampoZonaCoherence(p.campo, p.sinal_visual_positivo)
    if (w) {
      // Sistemas_preservados não tem campo coherence_warning no schema
      // (eles raramente carregam zona horária em sinal_visual_positivo —
      // descrevem integridade, não localização). Aqui apenas LOGAMOS,
      // sem mutar o objeto.
      console.info({
        event: 'stage1_coherence_warning_preservado',
        campo: p.campo,
        warning: w,
      })
      coherenceWarnings++
    }
  }

  // v2.5.3 F4: pigmento_amber órfão (sem sistema-órgão pareado em zona
  // compatível) recebe warning anexado ao coherence_warning. Modo warning
  // não rejeita — Stage 2 vê via JSON e contextualiza. TODO F5: se UAT
  // mostrar pigmento_amber órfão recorrente, promover a rejeição strict.
  const pairingWarnings = checkPigmentoAmberPairing(exame.achados_de_atencao)
  for (const pw of pairingWarnings) {
    const a = exame.achados_de_atencao[pw.index]!
    a.coherence_warning = a.coherence_warning
      ? `${a.coherence_warning} | ${pw.warning}`
      : pw.warning
    coherenceWarnings++
    console.info({
      event: 'stage1_f4_pigmento_amber_orfao',
      campo: a.campo,
      warning: pw.warning,
    })
  }
  // v2.6.0: obscurecimento estrutural — quando achado é indeterminada com
  // motivo='obscurecimento_estrutural', a estrutura obscurecedora deve estar
  // como achado ATIVO. Warning + log se não estiver. Modo warning não rejeita.
  const obscWarnings = checkObscurecimentoStrutural(exame.achados_de_atencao)
  for (const ow of obscWarnings) {
    const a = exame.achados_de_atencao[ow.index]!
    a.coherence_warning = a.coherence_warning
      ? `${a.coherence_warning} | ${ow.warning}`
      : ow.warning
    coherenceWarnings++
    console.info({
      event: 'stage1_v260_obscurecimento_estrutural_sem_ativo',
      campo: a.campo,
      warning: ow.warning,
    })
  }
  if (coherenceWarnings > 0) {
    console.info({
      event: 'stage1_coherence_warnings_total',
      count: coherenceWarnings,
    })
  }

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
