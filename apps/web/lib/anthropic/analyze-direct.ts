/**
 * `analyzeReadingDirect` — Column C generator: ANÁLISE DIRETA SONNET.
 *
 * Isolates the value of Sonnet's DIRECT VISION. No pipeline features, no RAG —
 * the model receives the same 6 iris photos the pipeline (A/B) consumes and
 * must produce the full 15-section Iris Codex report by looking at them.
 *
 * Same {stream, finalize} contract as `analyzeReading` (lib/anthropic/analyze)
 * so it is a drop-in third method for the calibration comparison harness.
 *
 * Difference vs. the production path:
 *   - system block 1 = system.md VERBATIM (byte-identical to A/B → shares the
 *     Anthropic prompt-cache prefix; the Iris Codex format / 9 rules / LGPD
 *     vocabulary / tone are unchanged)
 *   - system block 2 = VISUAL_MODE_OVERRIDE — neutralizes the JSON-feature
 *     reading instructions and the "[cite a feature]" anchoring, redirecting
 *     the calibration anchor to a structure SEEN in the photos. Everything
 *     else (15 sections, "Em poucas palavras", Regra 3, §2 subsections, §15
 *     card grid, server-appended encerramento) stays identical.
 *   - user content = client_context + 6 labeled image blocks + the
 *     visual-analysis instruction. NO <features>, NO <knowledge>.
 *
 * method_version: `sonnet_direct_0.1.0` (distinct from the Sonnet MODEL id;
 * both are recorded in run metadata + report_generations).
 *
 * Phase 7.4 | Column C | calibration harness
 */
import 'server-only'

import type Anthropic from '@anthropic-ai/sdk'

import {
  anthropicClient,
  MODEL,
  DEFAULT_SYSTEM_CACHE_CONTROL,
  MAX_OUTPUT_TOKENS,
  estimateCostUsd,
} from './client'
import { loadSystemPrompt } from './prompts'

export const SONNET_DIRECT_METHOD_VERSION = 'sonnet_direct_0.1.0' as const

export interface DirectImage {
  eye: string
  angle: string
  /** image/jpeg | image/png | image/webp — Anthropic-supported. */
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Base64 (no data: prefix). */
  base64: string
}

export interface AnalyzeDirectArgs {
  readingId: string
  therapistId: string
  images: DirectImage[]
  clientName: string
  clientAge: number | null
  /** Optional AbortSignal — Route Handler passes request.signal here. */
  signal?: AbortSignal
}

export interface AnalyzeDirectFinalization {
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  }
  latency_ms: number
  cost_estimate_usd: number
  n_images: number
}

export interface AnalyzeDirectResult {
  stream: AsyncIterable<string>
  finalize: () => Promise<AnalyzeDirectFinalization>
}

/**
 * Authoritative override appended as the 2nd system block. It re-points every
 * "read the JSON / cite the feature" instruction in system.md to direct visual
 * observation WITHOUT loosening the 9 absolute rules or the global calibration
 * filter — those still apply verbatim (skip-rather-than-fabricate included).
 */
export const VISUAL_MODE_OVERRIDE = `# MODO DE ANÁLISE: VISÃO DIRETA (prevalece sobre a leitura de features acima)

Nesta geração **NÃO existe** o bloco \`<features>\` (JSON do pipeline) nem o
bloco \`<knowledge>\` (RAG). Em vez disso você recebe **as 6 fotografias da
íris** do cliente (olho direito e olho esquerdo, 3 ângulos cada). Sua tarefa
é produzir o MESMO relatório clínico-funcional de 15 seções **observando
diretamente as imagens**.

Substituições obrigatórias em relação às instruções acima:

1. Onde o prompt manda ler \`findings[]\`, \`sectoral_pigments\`,
   \`asymmetry_notes\` ou "citar a feature do JSON que ancora": isso **não se
   aplica**. A âncora de cada interpretação é a **estrutura que você enxerga
   na foto** (lacuna, cripta, pigmento/mancha, anel, padrão de fibras,
   colorido) com posição identificável — descrita em linguagem clínica.
2. Identifique a **constituição** visualmente (cor de base, densidade e
   trama das fibras, presença de anéis/pigmentos). Localize os achados
   setoriais usando o **mapa de Jensen** que você já conhece (ele não vem no
   RAG — use seu conhecimento interno do mapa).
3. A **Regra de calibração global** continua valendo integralmente: se uma
   afirmação caberia em qualquer pessoa, está errada; só vale o que ESTA
   íris exige. Em dúvida, diga menos e ancore mais. Estrutura não visível
   com confiança razoável nas fotos → **omita** (não preencha com prosa
   hipotética; melhor menos achados ancorados que muitos genéricos).
4. **NÃO emita** marcadores tipo \`[feature.x]\`, \`[ancorado em ...]\`,
   coordenadas, "hora/setor", nem meta-linguagem de pipeline — não há
   pipeline nesta geração. As **9 Regras absolutas** continuam valendo na
   íntegra, em especial a Regra 3 (sem hora/setor/lado de olho fora da §2 —
   você localiza internamente mas traduz para significado clínico no texto).
5. Todo o resto é **idêntico** ao caminho normal: comece direto na §1, as
   15 seções sequenciais, as duas subseções da §2, a §15 Síntese Rápida em
   6 blocos, e o bloco "## Em poucas palavras" como ÚLTIMO conteúdo (DEPOIS da
   §15 — síntese final ancorada numa estrutura visível, ver system prompt),
   o vocabulário LGPD, o tom. NÃO emita o encerramento/disclaimer (o
   servidor anexa o texto literal).

Gere o relatório completo agora, baseado exclusivamente na sua observação
visual direta das 6 imagens.`

const EYE_LABEL: Record<string, string> = {
  right: 'Olho direito (OD)',
  left: 'Olho esquerdo (OE)',
}

function eyeLabel(eye: string): string {
  return EYE_LABEL[eye] ?? `Olho ${eye}`
}

/**
 * Label visível ao Sonnet, descrevendo a foto em termos do protocolo
 * 2026-05-22 (3 frontais por olho, variação só de iluminação). NÃO usa
 * mais "ângulo: X" porque o identifier `lateral`/`backlight` ficou
 * semanticamente desatualizado (ver doc em lib/capture/sequence.ts).
 *
 * Mapeamento:
 *   frontal   → "frontal, com flash" (1ª foto do olho)
 *   lateral   → "frontal, com flash" (2ª foto do olho — redundância)
 *   backlight → "frontal, sem flash" (3ª foto, revela pigmento real)
 *
 * Sonnet recebe esse texto como contexto verbal junto com cada imagem.
 * Não interpreta como geometria — só como rótulo descritivo da iluminação.
 */
function photoDescriptionLabel(angle: string): string {
  if (angle === 'backlight') return 'frontal, sem flash'
  return 'frontal, com flash'
}

/**
 * Build the user message content: client context, then each of the 6 photos
 * preceded by an eye/angle label, then the closing instruction.
 *
 * INVARIANTE §5 (anti-viés de confirmação): o bloco <client_context>
 * carrega SOMENTE nome + idade + mapa. NENHUM dado clínico/anamnese
 * (queixa, condições, medicamentos, observações do terapeuta) pode entrar
 * aqui. A barreira é por construção — `AnalyzeDirectArgs` não tem campo de
 * texto livre clínico; reintroduzir um quebra `analyze-direct.guard.test`
 * (regex de rótulos clínicos) E o `tsc` (type-level keyof guard). Se este
 * teste falhar, NÃO afrouxe o teste — reverta a mudança que reabriu o canal.
 *
 * `export` apenas para o teste-guarda consumir a montagem real.
 */
export function buildUserContent(
  args: AnalyzeDirectArgs,
): Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
  const ctx =
    `<client_context>\n` +
    `Nome: ${args.clientName}\n` +
    `Idade: ${args.clientAge != null ? String(args.clientAge) : ''}\n` +
    `Mapa preferido: jensen\n` +
    `</client_context>\n\n` +
    `Abaixo estão as 6 fotografias da íris desta pessoa (olho direito e ` +
    `olho esquerdo, 3 ângulos cada). Analise-as visualmente e gere a ` +
    `leitura iridológica integrativa seguindo a estrutura de 15 seções ` +
    `definida no system prompt.`

  const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
    { type: 'text', text: ctx },
  ]

  args.images.forEach((img, i) => {
    content.push({
      type: 'text',
      text: `\n— Imagem ${i + 1}/${args.images.length}: ${eyeLabel(img.eye)}, ${photoDescriptionLabel(img.angle)}`,
    })
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64,
      },
    })
  })

  content.push({
    type: 'text',
    text:
      '\nGere agora as 15 seções no formato Iris Codex, ancorando cada ' +
      'interpretação no que você efetivamente observa nas imagens acima.',
  })

  return content
}

/**
 * Main entry point. Returns immediately with a stream + finalize promise —
 * the caller (orchestrator / route) drives the stream and awaits finalize()
 * AFTER the stream loop completes. Mirrors `analyzeReading`'s contract.
 */
export async function analyzeReadingDirect(
  args: AnalyzeDirectArgs,
): Promise<AnalyzeDirectResult> {
  const startedAt = Date.now()

  const systemPrompt = loadSystemPrompt()
  const userContent = buildUserContent(args)

  const llmStream = anthropicClient.messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: DEFAULT_SYSTEM_CACHE_CONTROL,
        },
        { type: 'text', text: VISUAL_MODE_OVERRIDE },
      ],
      messages: [{ role: 'user', content: userContent }],
    },
    // Per-request override (does NOT touch the shared client used by the
    // production vigente / SAM paths). The SDK default maxRetries=2 silently
    // re-issues the WHOLE request on a transient error; on this long
    // (~150s) 6-image + 16k-system stream Anthropic bills the failed partial
    // attempt too, but finalMessage().usage only reports the final attempt —
    // so a retry doubled real cost while report_generations under-counted.
    // For a cost-measurement harness, accurate accounting > silent recovery:
    // fail fast on transient errors (founder re-triggers = one honest bill;
    // logged tokens == billed tokens).
    { maxRetries: 0 },
  )

  if (args.signal) {
    args.signal.addEventListener('abort', () => {
      try {
        llmStream.controller.abort()
      } catch {
        // already ended — no-op
      }
    })
  }

  async function* toTextStream(): AsyncIterable<string> {
    for await (const event of llmStream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }

  async function finalize(): Promise<AnalyzeDirectFinalization> {
    const final = await llmStream.finalMessage()
    const usage = {
      input_tokens: final.usage.input_tokens ?? 0,
      output_tokens: final.usage.output_tokens ?? 0,
      cache_creation_input_tokens: final.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: final.usage.cache_read_input_tokens ?? 0,
    }
    const latencyMs = Date.now() - startedAt
    const cost = estimateCostUsd(usage)

    // D-T1 telemetry — NO PII (no clientName, no report text)
    console.info({
      event: 'llm_generate_direct',
      reading_id: args.readingId,
      therapist_id: args.therapistId,
      method_version: SONNET_DIRECT_METHOD_VERSION,
      model_version: MODEL,
      n_images: args.images.length,
      latency_ms: latencyMs,
      tokens_in: usage.input_tokens,
      tokens_out: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens,
      cost_estimate_usd: Number(cost.toFixed(4)),
    })

    return {
      usage,
      latency_ms: latencyMs,
      cost_estimate_usd: cost,
      n_images: args.images.length,
    }
  }

  return { stream: toTextStream(), finalize }
}

// ============================================================
// v2.3.0 — Etapa 2 (composição ancorada no exame da Etapa 1)
// ============================================================

import type { ExameIridologico } from './stage1-schema'

/**
 * Override do system prompt da Etapa 2: explica que a observação visual
 * JÁ FOI feita pela Etapa 1 e o JSON estruturado está injetado no user
 * content. Substitui o VISUAL_MODE_OVERRIDE (que assumia que Sonnet ia
 * olhar as fotos).
 *
 * Mantém as 9 Regras Absolutas + estrutura de 15 seções + tom do system.md
 * atual (que produziu o UAU 2026-05-23). NÃO pede pra Sonnet "ver" fotos
 * porque não há fotos nesta chamada.
 */
const STAGE2_MODE_OVERRIDE = `# MODO DE ANÁLISE: COMPOSIÇÃO ANCORADA (Etapa 2 do pipeline Sonnet 2x)

Nesta geração você NÃO recebe as 6 fotografias da íris. A observação
visual já foi feita pela Etapa 1 e está estruturada em formato JSON no
bloco \`<exame_iridologico_da_etapa_1>\` dentro do user content abaixo.

Substituições obrigatórias em relação às instruções do system principal:

1. Onde o prompt original manda OLHAR as fotos / observar diretamente / citar
   estrutura visual que você vê: agora você ancora em \`achados_de_atencao[]\`,
   \`sistemas_preservados[]\`, \`correlacoes_observadas[]\`, \`linha_temporal[]\`
   e \`constituicao_base\` do JSON injetado. Trate esses dados como SEU
   raciocínio interno cristalizado — você compõe o relatório a partir deles.

2. **Ordem por saliência** (Regra global do system): use \`achados_de_atencao[0]\`
   como protagonista (já ordenado por intensidade DESC pela Etapa 1).
   §2 "Sistemas que requerem atenção" lista os achados na ordem do array.
   §15 🔴 Fragilidades = top 3 achados; 🟢 Forças = sistemas_preservados.

3. **§3 Linha do Tempo**: use APENAS os marcadores em \`linha_temporal[]\`
   (cada um já validado com marca_visivel real pela Etapa 1). Array vazio
   = §3 com 1 parágrafo curto explicando ausência de marcadores. NUNCA
   invente faixas que não estão no array.

4. **§5/§10 — eixos psicossomáticos e arquetípico**: ancore nas
   \`correlacoes_observadas[]\` que a Etapa 1 já costurou. Use a
   \`ancora_visual\` da correlação como sustentação CLÍNICA mental, mas
   no texto fala da PESSOA (vida emocional, padrão, sensação) — não da
   estrutura iridológica. Aspectos visuais ficam no raciocínio interno.

5. **MEMÓRIA inter-leituras**: se o user content trouxer o bloco
   \`<relatorios_recentes_deste_terapeuta>\`, leia com atenção e
   **NÃO repita as frases listadas nem variações próximas**. Mantém o
   MESMO TOM, a MESMA VOZ, o MESMO REGISTRO — varia só a SINTAXE e a
   IMAGEM CONCRETA. O TOM é o que faz a pessoa chorar; sintaxe repetida
   é o que faz a pessoa desconfiar.

6. As **9 Regras absolutas** do system principal continuam valendo na
   íntegra (sem autor / sem escola / sem hora-setor-olho fora de §2 /
   §3 4 campos / §10 simbólico / §13 humano / §1 polimento / sem
   §-cross-refs / sem jargão não-explicado).

Gere o relatório completo agora, ancorado exclusivamente no
\`<exame_iridologico_da_etapa_1>\` do user content.`

export interface ComposeStage2Args {
  readingId: string
  therapistId: string
  /** JSON estruturado validado da Etapa 1 */
  exameIridologico: ExameIridologico
  /**
   * Bloco XML pré-formatado da memória inter-leituras. Empty string se
   * primeira leitura do terapeuta — orquestrador trata como ausente.
   */
  recentPhrasesBlock: string
  clientName: string
  clientAge: number | null
  signal?: AbortSignal
}

function buildStage2UserContent(args: ComposeStage2Args): Anthropic.TextBlockParam[] {
  const ctx =
    `<client_context>\n` +
    `Nome: ${args.clientName}\n` +
    `Idade: ${args.clientAge != null ? String(args.clientAge) : ''}\n` +
    `Mapa preferido: jensen\n` +
    `</client_context>`

  const exameBlock =
    `<exame_iridologico_da_etapa_1>\n` +
    JSON.stringify(args.exameIridologico, null, 2) +
    `\n</exame_iridologico_da_etapa_1>`

  const blocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: ctx },
    { type: 'text', text: exameBlock },
  ]

  // Memória inter-leituras só entra se terapeuta já tem leituras anteriores
  if (args.recentPhrasesBlock.trim().length > 0) {
    blocks.push({ type: 'text', text: args.recentPhrasesBlock })
  }

  blocks.push({
    type: 'text',
    text:
      `\nGere agora as 15 seções no formato Iris Codex, ancorando cada ` +
      `interpretação no <exame_iridologico_da_etapa_1> acima. Texto fala ` +
      `da PESSOA, das emoções, do que ela viveu — vocabulário visual ` +
      `iridológico fica no raciocínio interno (ancoragem), NÃO no texto ` +
      `entregue ao cliente.`,
  })

  return blocks
}

export const STAGE2_METHOD_VERSION = 'sonnet_2x_0.1.0' as const

// v2.3.0 (2026-05-23): split do STAGE2_METHOD_VERSION em method qualitativo +
// semver pra alinhar com a convenção nova de report_generations (migration
// 0031: method='sonnet_2x' + method_version='0.1.0'). report_findings e
// report_phrases mantêm a string concatenada por compatibilidade — débito
// de harmonização registrado pra v2.3.x.
export const STAGE2_METHOD = 'sonnet_2x' as const
export const STAGE2_VERSION = '0.1.0' as const

/**
 * Etapa 2 do pipeline Sonnet 2x — composição streaming ancorada no JSON
 * da Etapa 1. Mesmo contract `{stream, finalize}` que `analyzeReadingDirect`
 * pra o caller (route.ts) não precisar mudar a lógica de stream consumption.
 *
 * Diferenças vs analyzeReadingDirect:
 *   - NÃO envia imagens (Etapa 1 já viu, JSON é o pacto)
 *   - System block 2 = STAGE2_MODE_OVERRIDE (não VISUAL_MODE_OVERRIDE)
 *   - User content = ctx + JSON Etapa 1 + memória recente + instrução
 *
 * Mantém: streaming, cost estimation, cache control no system principal,
 * abort signal handling, finalize() promise contract.
 */
export async function analyzeReadingComposeStage2(
  args: ComposeStage2Args,
): Promise<AnalyzeDirectResult> {
  const startedAt = Date.now()

  const systemPrompt = loadSystemPrompt()
  const userContent = buildStage2UserContent(args)

  const llmStream = anthropicClient.messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: DEFAULT_SYSTEM_CACHE_CONTROL,
        },
        { type: 'text', text: STAGE2_MODE_OVERRIDE },
      ],
      messages: [{ role: 'user', content: userContent }],
    },
    { maxRetries: 0 },
  )

  if (args.signal) {
    args.signal.addEventListener('abort', () => {
      try {
        llmStream.controller.abort()
      } catch {
        // already ended — no-op
      }
    })
  }

  async function* toTextStream(): AsyncIterable<string> {
    for await (const event of llmStream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }

  async function finalize(): Promise<AnalyzeDirectFinalization> {
    const final = await llmStream.finalMessage()
    const usage = {
      input_tokens: final.usage.input_tokens ?? 0,
      output_tokens: final.usage.output_tokens ?? 0,
      cache_creation_input_tokens: final.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: final.usage.cache_read_input_tokens ?? 0,
    }
    const latencyMs = Date.now() - startedAt
    const cost = estimateCostUsd(usage)

    console.info({
      event: 'llm_generate_stage2',
      reading_id: args.readingId,
      therapist_id: args.therapistId,
      method_version: STAGE2_METHOD_VERSION,
      model_version: MODEL,
      n_images: 0, // Stage 2 não envia imagens
      latency_ms: latencyMs,
      tokens_in: usage.input_tokens,
      tokens_out: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens,
      cost_estimate_usd: Number(cost.toFixed(4)),
    })

    return {
      usage,
      latency_ms: latencyMs,
      cost_estimate_usd: cost,
      n_images: 0,
    }
  }

  return { stream: toTextStream(), finalize }
}
