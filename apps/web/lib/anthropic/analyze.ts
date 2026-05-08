/**
 * `analyzeReading` — orchestrates a Phase 7 LLM analysis call.
 *
 * Composition (CONTEXT D-S1, D-S2, D-PR1, D-PR2, D-T1, RESEARCH §Pattern 1, §Pattern 2):
 *   1. Parallel: load system.md + feature-injection.md from FS (cached)
 *      + retrieveRelevantKnowledge(features, REPORT_SECTIONS) (frozen Fase 6)
 *   2. Render user content via mustache substitution
 *   3. Open Anthropic stream with cache_control: ephemeral on system block
 *   4. Return { stream: AsyncIterable<string>, finalize: () => Promise<...> }
 *
 * Auth gate is NOT here — it's the caller's (Route Handler) responsibility.
 * This module is invoked by `app/api/readings/[id]/analyze/route.ts` AFTER
 * the route validates session + ownership + status + regen-cap.
 *
 * LGPD: telemetry log explicitly excludes client_name + therapist_notes.
 * Logs only UUIDs + counts + latencies + token counts (D-T1).
 *
 * Phase 7 | Plan 07-07 | Decisions: D-PR1, D-PR2, D-S1, D-S2, D-T1
 */
import 'server-only'

import {
  anthropicClient,
  MODEL,
  DEFAULT_SYSTEM_CACHE_CONTROL,
  MAX_OUTPUT_TOKENS,
  estimateCostUsd,
} from './client'
import {
  loadSystemPrompt,
  loadInjectionTemplate,
  renderInjection,
} from './prompts'
import { REPORT_SECTIONS } from './types'
import { retrieveRelevantKnowledge } from '@/lib/rag/search'
import type { IrisFeaturesForRag } from '@/lib/rag/build-queries'
import type { KnowledgeChunkRow } from '@/lib/rag/types'

export interface AnalyzeArgs {
  readingId: string
  therapistId: string
  visionFeatures: IrisFeaturesForRag & Record<string, unknown>
  clientName: string
  clientAge: number | null
  therapistNotes: string | null
  irisMap?: 'jensen' | 'jausas' | 'hidalgo'
  /** Optional AbortSignal — Route Handler passes request.signal here. */
  signal?: AbortSignal
}

export interface AnalyzeFinalization {
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  }
  latency_ms: number
  cost_estimate_usd: number
  n_chunks_rag: number
}

export interface AnalyzeResult {
  stream: AsyncIterable<string>
  finalize: () => Promise<AnalyzeFinalization>
}

function concatChunksForKnowledge(chunks: KnowledgeChunkRow[]): string {
  return chunks
    .map((c) => `[${c.source_book}, p.${c.page ?? '?'}] ${c.text}`)
    .join('\n\n')
}

/**
 * Main entry point. Returns immediately with a stream + finalize promise.
 * Caller (Route Handler) drives the stream into a Web ReadableStream and
 * awaits finalize() AFTER the stream loop completes.
 */
export async function analyzeReading(args: AnalyzeArgs): Promise<AnalyzeResult> {
  const startedAt = Date.now()

  // 1. Parallel: prompts + RAG (D-PR2 frozen contract — passes REPORT_SECTIONS)
  const [systemPrompt, injectionTemplate, ragChunks] = await Promise.all([
    Promise.resolve(loadSystemPrompt()),
    Promise.resolve(loadInjectionTemplate()),
    retrieveRelevantKnowledge({
      features: args.visionFeatures,
      reportSections: REPORT_SECTIONS,
    }),
  ])

  // 2. Render user content
  const userContent = renderInjection(injectionTemplate, {
    client_name: args.clientName,
    age: args.clientAge != null ? String(args.clientAge) : '',
    therapist_notes: args.therapistNotes ?? '',
    iris_map: args.irisMap ?? 'jensen',
    vision_features_json: JSON.stringify(args.visionFeatures, null, 2),
    rag_chunks_concatenated_with_citations: concatChunksForKnowledge(ragChunks),
  })

  // 3. Open Anthropic stream
  const llmStream = anthropicClient.messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: DEFAULT_SYSTEM_CACHE_CONTROL,
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  })

  // 4. Wire AbortSignal if provided
  if (args.signal) {
    args.signal.addEventListener('abort', () => {
      try {
        llmStream.controller.abort()
      } catch {
        // already ended — no-op
      }
    })
  }

  // Forward text deltas as plain strings — caller does buffer + parsing.
  async function* toTextStream(): AsyncIterable<string> {
    for await (const event of llmStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }

  async function finalize(): Promise<AnalyzeFinalization> {
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
      event: 'llm_generate',
      reading_id: args.readingId,
      therapist_id: args.therapistId,
      model_version: MODEL,
      n_chunks_rag: ragChunks.length,
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
      n_chunks_rag: ragChunks.length,
    }
  }

  return {
    stream: toTextStream(),
    finalize,
  }
}
