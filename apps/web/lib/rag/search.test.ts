import { describe, it } from 'vitest'

// Wave 0 scaffolding (06-01-PLAN). Each `it.todo` will be flipped to `it(...)`
// in 06-11-PLAN when retrieveRelevantKnowledge lands.
//
// Covers RAG-04 retrieve contract + D-R3 dedup/cap + D-R5 latency budget +
// D-N4 early-warning gate.

describe('retrieveRelevantKnowledge', () => {
  it.todo('returns ≤30 chunks deduped by id (D-R3)')
  it.todo('orders chunks by score desc (D-R3)')
  it.todo('embeds queries with inputType: "query" (RESEARCH §input_type)')
  it.todo('parallelizes pgvector RPC calls via Promise.all (D-R5)')
  it.todo('latency p95 ≤ 2s with 8 mocked queries (D-N4 early warning)')
  it.todo('latency p99 ≤ 3s with 8 mocked queries (D-R5 hard cap)')
  it.todo('throws when user is unauthenticated (mirror readings.ts auth gate)')
  it.todo('logs telemetry event rag_retrieve with no PII (RESEARCH telemetry §)')
  it.todo('falls back to cosine sort if rerank throws (D-N2 graceful)')
})
