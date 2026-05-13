/**
 * `analyzeReadingV2` — Iris Codex V1 LLM analysis call (Phase 7.4 D-VAL1/D-VAL2/D-VAL3/D-TEL2).
 *
 * Carryover from Phase 7 analyze.ts:
 *  - anthropicClient + MODEL + DEFAULT_SYSTEM_CACHE_CONTROL + MAX_OUTPUT_TOKENS + estimateCostUsd
 *  - cache_control: ephemeral on system block
 *  - Telemetry log pattern (extended with V2 fields per D-TEL2)
 *  - AbortSignal forwarding from Route Handler
 *
 * New in V2:
 *  - output_config: { format: zodOutputFormat(reportV2Schema) } via SDK helper
 *    (per RESEARCH §Anthropic JSON mode — CONTEXT D-VAL1 sketch was outdated;
 *     corrected by RESEARCH to current API surface using SDK helper).
 *  - Retry loop on zod validation failure (max 2 retries; 3rd → throws ZodValidationFailedError)
 *  - Receives <tendencies> block (D-PR2) instead of raw vision_features
 *  - Buffer-then-parse pattern (vs Phase 7 incremental section-detection) — per-key
 *    persistence handled by Plan 07.4-05 route handler via detectCompletedKeys
 *
 * SDK note: @anthropic-ai/sdk@^0.92.0 ships output_config as a typed parameter
 * on MessageStreamParams (verified locally against
 * node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts line 2164).
 * No type-suppression directive is needed; if a future minor bump breaks this,
 * add a SINGLE targeted suppression with the version + rationale only — never
 * a blanket coercion cast to bypass the type system.
 *
 * Auth gate is NOT here — Route Handler responsibility (Plan 07.4-05).
 * LGPD: telemetry excludes client_name/therapist_notes.
 *
 * Phase 7.4 | Plan 07.4-03 | Decisões: D-VAL1, D-VAL2, D-VAL3, D-TEL2, D-PR2
 */
import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

import {
  anthropicClient,
  MODEL,
  DEFAULT_SYSTEM_CACHE_CONTROL,
  MAX_OUTPUT_TOKENS,
  estimateCostUsd,
} from './client'
import { loadSystemPrompt } from './prompts'
import { reportV2Schema, type ReportV2 } from './report-schema'
import { runAuditV2 } from './audit-v2'
import type { AuditV2Result, IrisCodexTelemetryEvent } from './types-v2'
import type { Tendency } from '@/lib/tendency-engine/types'
import type { KnowledgeChunkRow } from '@/lib/rag/types'
import type { z } from 'zod'

/** D-VAL2: 1st + 2nd retry; 3rd attempt is fail-flag path. */
export const MAX_RETRIES = 2

export class ZodValidationFailedError extends Error {
  constructor(
    public readonly rawOutput: string,
    public readonly zodError: z.ZodError,
    public readonly attempts: number,
  ) {
    super(`Iris Codex JSON validation failed after ${attempts} attempts`)
    this.name = 'ZodValidationFailedError'
  }
}

export interface AnalyzeV2Args {
  readingId: string
  therapistId: string
  clientName: string
  clientAge: number | null
  clientSex: string | null
  therapistNotes: string | null
  /** From tendency-engine placeholder (Plan 07.4-04) — D-PR2. */
  tendencies: Tendency[]
  /** From RAG retrieval (Fase 6 contract — already in scope). */
  knowledgeChunks: KnowledgeChunkRow[]
  signal?: AbortSignal
}

export interface AnalyzeV2Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

export interface AnalyzeV2Finalization {
  report: ReportV2
  /** The buffered JSON text — for incremental persistence / debug. */
  rawOutput: string
  audit: AuditV2Result
  retryCount: 0 | 1 | 2
  usage: AnalyzeV2Usage
  latency_ms: number
  cost_estimate_usd: number
  n_chunks_rag: number
}

export interface AnalyzeV2Result {
  /** Async iterable of text deltas — Route Handler enqueues into Web ReadableStream for client. */
  stream: AsyncIterable<string>
  /** Resolves after stream completes + zod validation + (potentially) retries. */
  finalize: () => Promise<AnalyzeV2Finalization>
}

function renderUserPrompt(args: AnalyzeV2Args): string {
  const clientCtx = [
    `nome: ${args.clientName}`,
    args.clientAge != null ? `idade: ${args.clientAge}` : null,
    args.clientSex != null ? `sexo: ${args.clientSex}` : null,
    args.therapistNotes ? `queixa_principal: ${args.therapistNotes}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const tendenciesJson = JSON.stringify(args.tendencies, null, 2)

  const knowledgeText = args.knowledgeChunks
    .map((c) => `[${c.source_book}, p.${c.page ?? '?'}] ${c.text}`)
    .join('\n\n')

  return [
    '<client_context>',
    clientCtx,
    '</client_context>',
    '',
    '<tendencies>',
    tendenciesJson,
    '</tendencies>',
    '',
    '<knowledge>',
    knowledgeText,
    '</knowledge>',
  ].join('\n')
}

/**
 * One-shot call (used by retry loop). Buffers the full text then resolves.
 * Re-attempts share the cached system block (cache_read hit), so retry cost
 * is dominated by the corrective user message + retry output tokens.
 */
async function runSingleCall(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  signal: AbortSignal | undefined,
): Promise<{ rawText: string; usage: AnalyzeV2Usage }> {
  const stream = anthropicClient.messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [{ type: 'text', text: systemPrompt, cache_control: DEFAULT_SYSTEM_CACHE_CONTROL }],
    messages,
    output_config: { format: zodOutputFormat(reportV2Schema) },
  })

  if (signal) {
    signal.addEventListener('abort', () => {
      try {
        stream.controller.abort()
      } catch {
        /* already ended */
      }
    })
  }

  let buffer = ''
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      buffer += event.delta.text
    }
  }
  const final = await stream.finalMessage()
  const usage: AnalyzeV2Usage = {
    input_tokens: final.usage.input_tokens ?? 0,
    output_tokens: final.usage.output_tokens ?? 0,
    cache_creation_input_tokens: final.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: final.usage.cache_read_input_tokens ?? 0,
  }
  return { rawText: buffer, usage }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Main entry. Two-phase return:
 *  1. Immediate: { stream, finalize } — Route Handler attaches stream to Web ReadableStream
 *  2. finalize() resolves with full ReportV2 + audit + telemetry after all retries done
 *
 * Note: the stream surface is ONLY the FIRST attempt's text_delta. If retry fires,
 * the retry call happens inside finalize() and is NOT streamed to the client. Client
 * may see partial JSON during the first attempt; if retry happens, the route handler
 * decides whether to discard the first-attempt partials or update UI accordingly
 * (Plan 07.4-05 handles client-side reconciliation).
 *
 * Cost guard advisory: with MAX_RETRIES=2 worst-case is ~142% of baseline. If
 * telemetry retry_count > 0 fires often (>5% of generations), reduce MAX_RETRIES
 * to 1 — flag for monitoring (see retry_count field in IrisCodexTelemetryEvent).
 */
export async function analyzeReadingV2(args: AnalyzeV2Args): Promise<AnalyzeV2Result> {
  const startedAt = Date.now()
  const systemPrompt = loadSystemPrompt()
  const userPrompt = renderUserPrompt(args)

  // First-attempt stream — exposed to client for progressive render
  const firstMessages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  const firstStream = anthropicClient.messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [{ type: 'text', text: systemPrompt, cache_control: DEFAULT_SYSTEM_CACHE_CONTROL }],
    messages: firstMessages,
    output_config: { format: zodOutputFormat(reportV2Schema) },
  })

  if (args.signal) {
    args.signal.addEventListener('abort', () => {
      try {
        firstStream.controller.abort()
      } catch {
        /* already ended */
      }
    })
  }

  // Buffer first-attempt text while exposing async iterator to caller
  let firstBuffer = ''

  async function* textStream(): AsyncIterable<string> {
    for await (const event of firstStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        firstBuffer += event.delta.text
        yield event.delta.text
      }
    }
  }

  async function finalize(): Promise<AnalyzeV2Finalization> {
    // Route handler MUST consume the textStream() generator before calling finalize().
    // finalMessage() resolves only after the stream has fully terminated.
    const finalFirst = await firstStream.finalMessage()
    let lastUsage: AnalyzeV2Usage = {
      input_tokens: finalFirst.usage.input_tokens ?? 0,
      output_tokens: finalFirst.usage.output_tokens ?? 0,
      cache_creation_input_tokens: finalFirst.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: finalFirst.usage.cache_read_input_tokens ?? 0,
    }

    // Validate first attempt
    let lastRaw = firstBuffer
    let parsed = reportV2Schema.safeParse(safeJsonParse(lastRaw))
    let attempt: 0 | 1 | 2 = 0

    while (!parsed.success && attempt < MAX_RETRIES) {
      attempt = (attempt + 1) as 1 | 2
      const retryMessages: Anthropic.MessageParam[] = [
        ...firstMessages,
        { role: 'assistant', content: lastRaw },
        {
          role: 'user',
          content: [
            'O JSON anterior falhou validação contra o schema esperado.',
            '',
            'Erros específicos:',
            ...parsed.error.issues.map(
              (i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`,
            ),
            '',
            'Por favor produza um JSON válido conforme o schema acima. Corrija APENAS os campos com erro; mantenha os campos válidos exatamente como antes.',
          ].join('\n'),
        },
      ]
      const retryResult = await runSingleCall(systemPrompt, retryMessages, args.signal)
      lastRaw = retryResult.rawText
      // Accumulate token cost across retries (each retry is a fresh call with cache hit on system)
      lastUsage = {
        input_tokens: lastUsage.input_tokens + retryResult.usage.input_tokens,
        output_tokens: lastUsage.output_tokens + retryResult.usage.output_tokens,
        cache_creation_input_tokens:
          lastUsage.cache_creation_input_tokens + retryResult.usage.cache_creation_input_tokens,
        cache_read_input_tokens:
          lastUsage.cache_read_input_tokens + retryResult.usage.cache_read_input_tokens,
      }
      parsed = reportV2Schema.safeParse(safeJsonParse(lastRaw))
    }

    if (!parsed.success) {
      // 3rd attempt failed — Route Handler catches this, saves raw + flags audit
      throw new ZodValidationFailedError(lastRaw, parsed.error, attempt + 1)
    }

    const report = parsed.data
    const audit = runAuditV2(report, {
      json_validation_passed: true,
      retry_count: attempt,
    })
    const latencyMs = Date.now() - startedAt
    const cost = estimateCostUsd(lastUsage)

    // D-TEL2 — structured telemetry log (NO PII)
    const gradeDist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const sys of report.systems_with_tendency) {
      const g = sys.tendency_grade
      if (g === 1 || g === 2 || g === 3 || g === 4 || g === 5) {
        gradeDist[g]++
      }
    }
    const event: IrisCodexTelemetryEvent = {
      event: 'iris_codex_report_generate',
      reading_id: args.readingId,
      therapist_id: args.therapistId,
      model_version: MODEL,
      report_version: '2.0',
      n_chunks_rag: args.knowledgeChunks.length,
      latency_ms: latencyMs,
      tokens_in: lastUsage.input_tokens,
      tokens_out: lastUsage.output_tokens,
      cache_creation_input_tokens: lastUsage.cache_creation_input_tokens,
      cache_read_input_tokens: lastUsage.cache_read_input_tokens,
      cost_estimate_usd: Number(cost.toFixed(4)),
      systems_detected: report.systems_with_tendency.length,
      grade_distribution: gradeDist,
      json_validation_passed: true,
      retry_count: attempt,
      iridological_jargon_hits: audit.iridological_jargon.length,
      sopro_vocab_hits: audit.sopro_vocab.length,
      forbidden_vocab_hits: audit.forbidden_vocab.length,
    }
    console.info(event)

    return {
      report,
      rawOutput: lastRaw,
      audit,
      retryCount: attempt,
      usage: lastUsage,
      latency_ms: latencyMs,
      cost_estimate_usd: cost,
      n_chunks_rag: args.knowledgeChunks.length,
    }
  }

  return {
    stream: textStream(),
    finalize,
  }
}
