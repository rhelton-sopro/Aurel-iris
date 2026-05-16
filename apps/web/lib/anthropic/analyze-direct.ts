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
  therapistNotes: string | null
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
 * Build the user message content: client context, then each of the 6 photos
 * preceded by an eye/angle label, then the closing instruction.
 */
function buildUserContent(
  args: AnalyzeDirectArgs,
): Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
  const ctx =
    `<client_context>\n` +
    `Nome: ${args.clientName}\n` +
    `Idade: ${args.clientAge != null ? String(args.clientAge) : ''}\n` +
    `Observações do terapeuta: ${args.therapistNotes ?? ''}\n` +
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
      text: `\n— Imagem ${i + 1}/${args.images.length}: ${eyeLabel(img.eye)}, ângulo: ${img.angle}`,
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

    // D-T1 telemetry — NO PII (no clientName, no therapistNotes, no report text)
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
