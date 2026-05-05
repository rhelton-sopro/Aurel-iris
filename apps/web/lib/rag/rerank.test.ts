import { describe, it } from 'vitest'

// Wave 0 scaffolding (06-01-PLAN). Flipped GREEN in 06-11-PLAN when
// rerankChunks lands in apps/web/lib/rag/rerank.ts.
//
// Covers RAG-04 + D-N2 (voyage-rerank-2.5 reorder + graceful fallback + latency).

describe('rerankChunks', () => {
  it.todo('reorders top-50 → top-30 candidates correctly via voyage-rerank-2.5 (D-N2)')
  it.todo('falls back to cosine sort on API error (D-N2 graceful — never throws)')
  it.todo('falls back to cosine sort when VOYAGE_API_KEY missing')
  it.todo('uses RERANK_MODEL from VOYAGE_RERANK_MODEL env var (defaults voyage-rerank-2.5)')
  it.todo('latency under 1s p95 in 50 chunks (mocked Voyage with simulated delay)')
  it.todo('replaces score with relevanceScore from rerank response')
  it.todo('respects topK arg (default 30)')
})
