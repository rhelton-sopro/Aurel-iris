/**
 * D-N2 reranker — voyage-rerank-2.5 with graceful fallback.
 *
 * Caller passes a pre-sorted (by cosine score, descending) list of candidates
 * and a query string. We call Voyage's rerank endpoint to reorder them, replacing
 * each chunk's `score` with the reranker's `relevanceScore`. On any failure
 * (missing API key, network error, malformed response) we fall back to the
 * top-`topK` slice of the input (cosine sort preserved). This function NEVER
 * throws — D-N2 explicit: "Fallback graceful: se rerank API falha, retorna
 * top-30 cosine puro (não derruba retrieval)."
 *
 * RESEARCH §Reranking: voyage-rerank-2.5 free tier ~200M tokens covers ~12+
 * months of dogfooding; latency ~600ms p50.
 *
 * Server-only via Next.js Reserved Module — prevents VOYAGE_API_KEY leakage to
 * browser bundles. Pattern mirrors apps/web/lib/rag/embed.ts (06-09).
 *
 * Phase: 06-rag-ingestao | Plan: 06-11 | Decisions: D-N2, D-N4, D-R3
 */
import 'server-only'
import { VoyageAIClient } from 'voyageai'
import type { KnowledgeChunkRow } from './types'

/**
 * Rerank model name — env-overridable to allow swapping to `rerank-2.5-lite`
 * (lower cost, slightly lower quality) without code change. RESEARCH lines 137 —
 * lite is the documented fallback de custo.
 *
 * 2026-05-12: Voyage API rejected `voyage-rerank-2.5` (legacy name) with HTTP
 * 400; supported models are `rerank-lite-1 | rerank-2-lite | rerank-2 |
 * rerank-2.5 | rerank-2.5-lite`. Surfaced in f4408c23 analyze logs
 * (`[rag.rerank] reranker failed — falling back to cosine sort: ... Model
 * voyage-rerank-2.5 is not supported`). Default updated to `rerank-2.5`;
 * VOYAGE_RERANK_MODEL env override preserved.
 */
export const RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL ?? 'rerank-2.5'

/** D-R3 default cap — caller can override (e.g. 60 to overfetch before applyWeights). */
const DEFAULT_TOP_K = 30

export interface RerankArgs {
  query: string
  candidates: KnowledgeChunkRow[]
  /** Default 30 per D-R3 cap. */
  topK?: number
}

/**
 * Reorder candidates by reranker relevance. Graceful fallback semantics —
 * D-N2 explicit. Three paths:
 *
 *   1. No `VOYAGE_API_KEY`        → log warn, return `candidates.slice(0, topK)`
 *   2. Empty `candidates`          → return `[]` (no SDK call)
 *   3. SDK throws / malformed data → log warn, return `candidates.slice(0, topK)`
 *
 * Note on Fern-generated SDK types: `RerankResponse.data`, `RerankResponseDataItem.index`,
 * and `relevanceScore` are all marked optional in the generated `.d.mts`. We
 * defensively coerce — items missing `index` are skipped (cannot map back to
 * a candidate); items missing `relevanceScore` keep the input score.
 */
export async function rerankChunks(args: RerankArgs): Promise<KnowledgeChunkRow[]> {
  const topK = args.topK ?? DEFAULT_TOP_K
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    console.warn('[rag.rerank] VOYAGE_API_KEY missing — falling back to cosine sort')
    return args.candidates.slice(0, topK)
  }
  if (args.candidates.length === 0) {
    return []
  }
  try {
    const client = new VoyageAIClient({ apiKey })
    const result = await client.rerank({
      query: args.query,
      documents: args.candidates.map((c) => c.text),
      model: RERANK_MODEL,
      topK,
    })
    const items = result.data ?? []
    const reordered: KnowledgeChunkRow[] = []
    for (const item of items) {
      if (typeof item.index !== 'number') continue
      const original = args.candidates[item.index]
      if (!original) continue
      reordered.push({
        ...original,
        score: typeof item.relevanceScore === 'number' ? item.relevanceScore : original.score,
      })
    }
    // If the reranker returned nothing usable, fall back rather than emit empty.
    if (reordered.length === 0) {
      console.warn('[rag.rerank] rerank returned no usable items — falling back to cosine sort')
      return args.candidates.slice(0, topK)
    }
    return reordered
  } catch (err) {
    console.warn('[rag.rerank] reranker failed — falling back to cosine sort:', err)
    return args.candidates.slice(0, topK)
  }
}
