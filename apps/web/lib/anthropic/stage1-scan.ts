/**
 * `runStage1Scan` — Etapa 1 do pipeline Sonnet 2x (v2.3.0 Caminho 1).
 *
 * Faz UMA chamada Sonnet 4.6 com tool use:
 *   - system prompt = stage1-scan.md (varredura estruturada + glossário 42)
 *   - user content = client context + 6 fotos da íris
 *   - tools = [REGISTRAR_EXAME_TOOL] (forçado por tool_choice)
 *
 * Resposta = tool_use block com input = ExameIridologico structured JSON.
 * Validado por validateExameIridologico (5 blindagens semânticas).
 * Retry 1x se inválido com instrução de correção.
 * Após 2 tentativas inválidas, retorna best-effort parcial com
 * validation_status='invalid_final' — orquestrador segue pra Etapa 2.
 *
 * Não streama (Etapa 1 é blocking — cliente espera o stream da Etapa 2).
 * Não vê audit / não persiste — orquestrador (route.ts) faz isso.
 *
 * v2.3.0 Caminho 1 | Sonnet 4.6 (tool use)
 */
import 'server-only'

import Anthropic from '@anthropic-ai/sdk'

import {
  anthropicClient,
  MODEL,
  DEFAULT_SYSTEM_CACHE_CONTROL,
} from './client'

/**
 * Model fallback quando Sonnet 4.6 falha com 429/503/5xx.
 * Founder decisão 2026-05-23: fallback inline (só Etapa 1, blocking).
 * Etapa 2 streaming NÃO faz fallback — propaga erro pro orquestrador
 * (terapeuta clica Reprocessar).
 */
const FALLBACK_MODEL = 'claude-sonnet-4-5' as const

type FallbackReason = 'rate_limit' | 'overloaded' | 'server_error'

function isFallbackTrigger(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError)) return false
  const status = err.status
  if (status === undefined) return false
  return status === 429 || status === 503 || (status >= 500 && status < 600)
}

function classifyFallbackError(err: unknown): FallbackReason {
  if (!(err instanceof Anthropic.APIError)) return 'server_error'
  if (err.status === 429) return 'rate_limit'
  if (err.status === 503) return 'overloaded'
  return 'server_error'
}

function logModelFallback(
  reason: FallbackReason,
  ctx: { reading_id: string; therapist_id: string },
): void {
  console.info({
    event: 'sonnet_model_fallback',
    reason,
    primary_model: MODEL,
    fallback_model: FALLBACK_MODEL,
    reading_id: ctx.reading_id,
    therapist_id: ctx.therapist_id,
  })
}

function logToolUseMissing(
  ctx: { reading_id: string; therapist_id: string; attempt: 1 | 2 },
  responsePreview: string,
): void {
  console.warn({
    event: 'stage1_tool_use_missing',
    reading_id: ctx.reading_id,
    therapist_id: ctx.therapist_id,
    attempt: ctx.attempt,
    response_preview: responsePreview.slice(0, 200),
  })
}
import {
  REGISTRAR_EXAME_TOOL,
  validateExameIridologico,
  extractToolUseInput,
  logOffGlossaryUsage,
  type ExameIridologico,
  type ValidationOutcome,
} from './stage1-schema'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

import type { DirectImage } from './analyze-direct'

const STAGE1_PROMPT_FILENAME = 'stage1-scan.md'
// v2.3.0 (2026-05-23): 0.1.0 init.
// v2.3.1 (2026-05-23): 0.1.0 → 0.1.2 — calibração linha_temporal em
// stage1-scan.md (mínimo 3 marcadores não-negociável, conhecimento
// multi-escolas, declaração de limitação em íris ilegível). Pula 0.1.1
// pra alinhar com Stage 2 que foi 0.1.0→0.1.1 (anti-fórmula).
//
// v2.5.1 (2026-05-24): bump MINOR 0.1.2 → 0.2.0 — calibração
// determinística Stage 1, 5 fixes paralelos motivados pela variância
// Cristiane regen=1 vs regen=2 (5 achados viraram 8, fígado mudou de
// 10-11h pra 5-7h sem novo sinal visual):
//   1. temperature: 0.1 no requestBody (estabilidade entre regens)
//   2. campo agora é zod enum forçado (KNOWN_CAMPOS_LIST, 40 termos)
//      + enum no Anthropic tool input_schema (Sonnet vê a restrição)
//   3. validação coerência campo↔zona em modo warning: descricao_
//      visual c/ horas fora da zona canônica do glossário → meta-flag
//      coherence_warning no achado + log estruturado (não rejeita)
//   4. 6ª blindagem auto-aplicável no prompt: cada achado tem
//      descricao_visual com (zona horária + olho + foto número + tipo
//      de marca) — promovida de implícita-via-few-shot a regra explícita
//   5. bloco novo "Quando midríase bilateral obscurece pericentrais":
//      NÃO OMITIR pineal_hipotalamica / eixo_pituitario_adrenal /
//      anel_neuroendocrino quando midríase obscurece — registrar como
//      indeterminada + caveat explícito. Skip silencioso → silêncio
//      ambíguo. Indeterminada explícita → auditável.
const STAGE1_METHOD_VERSION = 'sonnet_2x_0.2.0' as const

let _stage1PromptCache: string | null = null
let _stage1ShaCache: string | null = null

function loadStage1Prompt(): string {
  if (_stage1PromptCache !== null) return _stage1PromptCache
  const filepath = path.join(process.cwd(), 'prompts', STAGE1_PROMPT_FILENAME)
  _stage1PromptCache = readFileSync(filepath, 'utf8')
  return _stage1PromptCache
}

function getStage1PromptSha(): string {
  if (_stage1ShaCache !== null) return _stage1ShaCache
  _stage1ShaCache = createHash('sha256')
    .update(loadStage1Prompt())
    .digest('hex')
    .slice(0, 12)
  return _stage1ShaCache
}

export interface Stage1ScanArgs {
  readingId: string
  therapistId: string
  images: DirectImage[]
  clientName: string
  clientAge: number | null
}

export interface Stage1ScanResult {
  /** Status da validação após até 2 tentativas */
  validation_status: 'valid' | 'valid_with_warnings' | 'invalid_retried' | 'invalid_final'
  /** Exame estruturado — sempre presente, mesmo se invalid_final (parcial best-effort) */
  exame: ExameIridologico | null
  /** XML/JSON bruto da última tentativa (pra report_findings.raw_xml — debug) */
  raw_output: string
  /** Termos fora dos 42 canônicos (alimentam log + decisão futura de RAG) */
  unknown_terms: string[]
  /** Quantos itens foram filtrados pelas 5 blindagens semânticas */
  filtered_out: {
    correlacoes_vagas: number
    marcadores_narrativos: number
    preservados_por_ausencia: number
  }
  /** Metadados de geração */
  prompt_version: string
  prompt_sha: string
  method_version: typeof STAGE1_METHOD_VERSION
  model: string
  tokens_in: number
  tokens_out: number
  /** Anthropic cache writes acumulados cross-attempt. Migration 0031. */
  cache_creation_input_tokens: number
  /** Anthropic cache reads acumulados cross-attempt. Migration 0031. */
  cache_read_input_tokens: number
  cost_usd: number
  latency_ms: number
}

function buildUserContent(
  args: Stage1ScanArgs,
): Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
  const ctx =
    `<client_context>\n` +
    `Nome: ${args.clientName}\n` +
    `Idade: ${args.clientAge != null ? String(args.clientAge) : ''}\n` +
    `</client_context>\n\n` +
    `Abaixo estão as 6 fotografias da íris desta pessoa. Faça a varredura ` +
    `visual estruturada conforme o prompt e registre o exame via UMA chamada ` +
    `da tool registrar_exame_iridologico.`

  const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
    { type: 'text', text: ctx },
  ]

  args.images.forEach((img, i) => {
    const eyeLabel = img.eye === 'right' ? 'Olho direito (OD)' : 'Olho esquerdo (OE)'
    const lightingLabel = img.angle === 'backlight' ? 'frontal, sem flash' : 'frontal, com flash'
    content.push({
      type: 'text',
      text: `\n— Imagem ${i + 1}/${args.images.length}: ${eyeLabel}, ${lightingLabel}`,
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

  return content
}

/**
 * Estimativa de custo em USD baseada em Sonnet 4.6 rates ($3/$15 per MTok).
 * Espelha estimateCostUsd de client.ts mas inline (sem dep extra).
 */
function estimateCostUsd(usage: {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}): number {
  const SONNET_IN_RATE = 3.0 / 1_000_000
  const SONNET_OUT_RATE = 15.0 / 1_000_000
  const CACHE_WRITE_RATE = 3.75 / 1_000_000 // 1.25× input
  const CACHE_READ_RATE = 0.30 / 1_000_000  // 0.1× input
  return (
    usage.input_tokens * SONNET_IN_RATE +
    usage.output_tokens * SONNET_OUT_RATE +
    usage.cache_creation_input_tokens * CACHE_WRITE_RATE +
    usage.cache_read_input_tokens * CACHE_READ_RATE
  )
}

/**
 * Single-shot Sonnet call com tool_choice forçado. Retorna response + raw
 * output text (pra debug e raw_xml persistido).
 *
 * Fallback: se Sonnet 4.6 falhar com 429/503/5xx, tenta UMA vez com Sonnet
 * 4.5. Loga structured event `sonnet_model_fallback`. Erros 4xx que não
 * sejam 429 (invalid_request) NÃO acionam fallback — propagam pro caller.
 *
 * Erros não-fallback (4xx invalid_request, network errors, timeout)
 * propagam — orquestrador trata.
 */
async function callSonnetWithTool(
  systemPrompt: string,
  userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>,
  ctx: { reading_id: string; therapist_id: string },
  correctionInstruction?: string,
): Promise<{ message: Anthropic.Message; rawOutput: string; latencyMs: number }> {
  const startedAt = Date.now()

  const finalUserContent = correctionInstruction
    ? [
        ...userContent,
        {
          type: 'text' as const,
          text:
            `\n\nA tentativa anterior teve falhas de validação. Corrija e ` +
            `submeta novamente:\n${correctionInstruction}`,
        },
      ]
    : userContent

  const requestBody = (model: string) => ({
    model,
    max_tokens: 8192,
    // v2.5.1 (2026-05-24): Stage 1 é extração estruturada com tool_choice
    // forçado — temperature baixa garante estabilidade entre regens. Voz
    // vive no Stage 2 que permanece em temperature default. Causa raiz #1
    // da variância Cristiane regen=1 vs regen=2 (achado dominante mudando
    // de coordenada 10-11h → 5-7h sem mudança no input visual).
    temperature: 0.1,
    system: [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: DEFAULT_SYSTEM_CACHE_CONTROL,
      },
    ],
    tools: [REGISTRAR_EXAME_TOOL],
    tool_choice: { type: 'tool' as const, name: REGISTRAR_EXAME_TOOL.name },
    messages: [{ role: 'user' as const, content: finalUserContent }],
  })

  let message: Anthropic.Message
  try {
    message = await anthropicClient.messages.create(requestBody(MODEL), {
      maxRetries: 0,
    })
  } catch (err) {
    if (!isFallbackTrigger(err)) throw err
    logModelFallback(classifyFallbackError(err), ctx)
    // 1 tentativa com modelo de fallback. Se este também falhar, propaga.
    message = await anthropicClient.messages.create(
      requestBody(FALLBACK_MODEL),
      { maxRetries: 0 },
    )
  }

  // raw output = JSON do tool_use input se presente, senão concatenação de text blocks
  const toolUse = message.content.find(b => b.type === 'tool_use')
  let rawOutput: string
  if (toolUse && toolUse.type === 'tool_use') {
    rawOutput = JSON.stringify(toolUse.input, null, 2)
  } else {
    rawOutput = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')
  }

  return { message, rawOutput, latencyMs: Date.now() - startedAt }
}

/**
 * Executa a Etapa 1 com retry 1x em caso de validation invalid.
 * Sempre retorna Stage1ScanResult (degradação graciosa — pipeline não trava).
 */
export async function runStage1Scan(
  args: Stage1ScanArgs,
): Promise<Stage1ScanResult> {
  const overallStartedAt = Date.now()
  const systemPrompt = loadStage1Prompt()
  const userContent = buildUserContent(args)

  // Acumuladores cross-tentativas (somamos tokens e cost de TODAS as
  // tentativas porque Anthropic cobra cada uma).
  let totalTokensIn = 0
  let totalTokensOut = 0
  let totalCacheCreation = 0
  let totalCacheRead = 0
  let totalCost = 0

  const ctx = { reading_id: args.readingId, therapist_id: args.therapistId }

  // --- Tentativa 1 ---
  const attempt1 = await callSonnetWithTool(systemPrompt, userContent, ctx)
  totalTokensIn += attempt1.message.usage.input_tokens ?? 0
  totalTokensOut += attempt1.message.usage.output_tokens ?? 0
  totalCacheCreation += attempt1.message.usage.cache_creation_input_tokens ?? 0
  totalCacheRead += attempt1.message.usage.cache_read_input_tokens ?? 0
  totalCost += estimateCostUsd({
    input_tokens: attempt1.message.usage.input_tokens ?? 0,
    output_tokens: attempt1.message.usage.output_tokens ?? 0,
    cache_creation_input_tokens: attempt1.message.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: attempt1.message.usage.cache_read_input_tokens ?? 0,
  })

  const input1 = extractToolUseInput(attempt1.message)
  if (input1 == null) {
    logToolUseMissing({ ...ctx, attempt: 1 }, attempt1.rawOutput)
  }
  const validation1 = input1 != null
    ? validateExameIridologico(input1)
    : ({ status: 'invalid', error: 'tool_use block not found', partial: null } satisfies ValidationOutcome)

  if (validation1.status === 'valid' || validation1.status === 'valid_with_warnings') {
    logOffGlossaryUsage(validation1.unknownTerms, {
      reading_id: args.readingId,
      therapist_id: args.therapistId,
    })
    return assembleResult({
      validation_status: validation1.status === 'valid' ? 'valid' : 'valid_with_warnings',
      exame: validation1.exame,
      raw_output: attempt1.rawOutput,
      unknown_terms: validation1.unknownTerms,
      filtered_out: validation1.filteredOut,
      tokens_in: totalTokensIn,
      tokens_out: totalTokensOut,
      cache_creation_input_tokens: totalCacheCreation,
      cache_read_input_tokens: totalCacheRead,
      cost_usd: totalCost,
      latency_ms: Date.now() - overallStartedAt,
      model: attempt1.message.model,
    })
  }

  // --- Tentativa 2 (retry com instrução de correção) ---
  // Type narrowing: aqui validation1 só pode ser status='invalid' (os outros
  // retornaram acima). 'error' in validation1 confirma pro TS.
  const errorMsg1 =
    'error' in validation1 ? validation1.error : 'unknown validation error'
  console.warn('[stage1-scan] attempt 1 invalid; retrying', {
    reading_id: args.readingId,
    error: errorMsg1,
  })

  const attempt2 = await callSonnetWithTool(
    systemPrompt,
    userContent,
    ctx,
    errorMsg1,
  )
  totalTokensIn += attempt2.message.usage.input_tokens ?? 0
  totalTokensOut += attempt2.message.usage.output_tokens ?? 0
  totalCacheCreation += attempt2.message.usage.cache_creation_input_tokens ?? 0
  totalCacheRead += attempt2.message.usage.cache_read_input_tokens ?? 0
  totalCost += estimateCostUsd({
    input_tokens: attempt2.message.usage.input_tokens ?? 0,
    output_tokens: attempt2.message.usage.output_tokens ?? 0,
    cache_creation_input_tokens: attempt2.message.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: attempt2.message.usage.cache_read_input_tokens ?? 0,
  })

  const input2 = extractToolUseInput(attempt2.message)
  if (input2 == null) {
    logToolUseMissing({ ...ctx, attempt: 2 }, attempt2.rawOutput)
  }
  const validation2 = input2 != null
    ? validateExameIridologico(input2)
    : ({ status: 'invalid', error: 'tool_use block not found on retry', partial: null } satisfies ValidationOutcome)

  if (validation2.status === 'valid' || validation2.status === 'valid_with_warnings') {
    logOffGlossaryUsage(validation2.unknownTerms, {
      reading_id: args.readingId,
      therapist_id: args.therapistId,
    })
    return assembleResult({
      validation_status: 'invalid_retried',
      exame: validation2.exame,
      raw_output: attempt2.rawOutput,
      unknown_terms: validation2.unknownTerms,
      filtered_out: validation2.filteredOut,
      tokens_in: totalTokensIn,
      tokens_out: totalTokensOut,
      cache_creation_input_tokens: totalCacheCreation,
      cache_read_input_tokens: totalCacheRead,
      cost_usd: totalCost,
      latency_ms: Date.now() - overallStartedAt,
      model: attempt2.message.model,
    })
  }

  // Both attempts invalid — return best-effort partial (degradação graciosa).
  // Type narrowing: ambas só podem ser status='invalid' aqui.
  console.error('[stage1-scan] both attempts invalid; returning partial', {
    reading_id: args.readingId,
    attempt1_error: 'error' in validation1 ? validation1.error : 'unknown',
    attempt2_error: 'error' in validation2 ? validation2.error : 'unknown',
  })

  return assembleResult({
    validation_status: 'invalid_final',
    exame: null,
    raw_output: attempt2.rawOutput,
    unknown_terms: [],
    filtered_out: { correlacoes_vagas: 0, marcadores_narrativos: 0, preservados_por_ausencia: 0 },
    tokens_in: totalTokensIn,
    tokens_out: totalTokensOut,
    cache_creation_input_tokens: totalCacheCreation,
    cache_read_input_tokens: totalCacheRead,
    cost_usd: totalCost,
    latency_ms: Date.now() - overallStartedAt,
    model: attempt2.message.model,
  })
}

function assembleResult(partial: {
  validation_status: Stage1ScanResult['validation_status']
  exame: ExameIridologico | null
  raw_output: string
  unknown_terms: string[]
  filtered_out: Stage1ScanResult['filtered_out']
  tokens_in: number
  tokens_out: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  cost_usd: number
  latency_ms: number
  model: string
}): Stage1ScanResult {
  return {
    ...partial,
    prompt_version: STAGE1_METHOD_VERSION,
    prompt_sha: getStage1PromptSha(),
    method_version: STAGE1_METHOD_VERSION,
  }
}

/** Reset cache do prompt — test only. Produção NÃO chama. */
export function _resetStage1PromptCache(): void {
  _stage1PromptCache = null
  _stage1ShaCache = null
}
