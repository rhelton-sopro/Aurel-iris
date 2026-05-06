/**
 * `retrieveRelevantKnowledge` — server action exposing the RAG retrieval pipeline.
 *
 * Composition (D-R1..R5, D-N2, D-N4):
 *   1. Auth gate (Supabase server-side user check — mirror readings.ts)
 *   2. Build queries (Family A from features + Family B from reportSections)
 *   3. Embed all queries in parallel via Voyage `voyage-3` (D-R5 Promise.all)
 *   4. Run pgvector RPC `match_knowledge_chunks` for each embedding (Promise.all)
 *   5. Dedup by id, keep best cosine score
 *   6. Rerank top candidates via voyage-rerank-2.5 (graceful fallback — D-N2)
 *   7. Apply D-R4 weights (clinical_data 1.5x, alta_prioridade 1.1x, dimensoes 1.2x)
 *   8. Final sort by score desc, slice(0, 30) (D-R3 cap)
 *   9. Telemetry log (no PII — counts and aggregate scores only)
 *
 * Phase: 06-rag-ingestao | Plan: 06-11 | Decisions: D-R1, D-R3, D-R4, D-R5, D-N2
 *
 * LGPD: telemetry log explicitly excludes user_id, client_id, reading_id and
 * any free-text fields. The `pnpm audit:vocabulary` script (DIRS extension to
 * lib/rag/ lands in 06-12) verifies no proibido vocabulary in static strings.
 */
'use server'
import { createClient } from '@/lib/supabase/server'
import { embedTexts } from './embed'
import { buildFamilyA, buildFamilyB, type IrisFeaturesForRag } from './build-queries'
import { rerankChunks } from './rerank'
import { applyWeights } from './score-weights'
import type { KnowledgeChunkRow, ReportSection, KnowledgeChunkMetadata } from './types'

const TOP_K_PER_QUERY = 10 // D-N2: bumped from 5 -> 10 to feed reranker (overfetch)
const FINAL_CAP = 30 // D-R3 cap
const MATCH_THRESHOLD = 0.0 // RPC default — no minimum score floor

export interface RetrieveArgs {
  features: IrisFeaturesForRag
  reportSections: ReportSection[]
}

/**
 * Hardcoded set of book names marked alta_prioridade in books_manifest.json
 * (manifest version 0.1.2 — 06-08 commit `64d54e5` flipped 2 scan-only books
 * to skip:true / alta_prioridade:false: "Bernard Jensen Iridology Simplified"
 * and "dictionary of iridology pdf"). If founder updates the manifest,
 * this set MUST be updated in lockstep — the W3 drift detection test in
 * `search.test.ts` reads the manifest at test-time and asserts equality to
 * catch any drift loudly.
 *
 * Source of truth: vision-service/scripts/data/books_manifest.json — entries
 * where `alta_prioridade: true` (canonical source_book keys, not filenames).
 *
 * Hardcoded for cold-start performance — avoiding a per-request DB call to
 * dynamically load the set. A future plan may move this to a server-side cache
 * if the founder's edit cadence on the manifest grows.
 */
export const ALTA_PRIORIDADE_BOOKS: ReadonlySet<string> = new Set([
  'A Iridologia Em Defesa Da Vida',
  'Bernard Jensen Iridology pdf',
  'Iridologia Psicoemocional livro compa tivel bekup',
  'What the Eye Reveals',
  'Iridologia Del Profondo Birello Lucio Rito Daniele Lo 2007 Enea Edizioni 84f083031f5e812f466e932 1',
])

/**
 * Coerce a single RPC row (typed as `Json` in the Supabase generated types) to
 * the strongly-typed KnowledgeChunkRow consumed by the rest of the pipeline.
 *
 * Defensive on every field that the RPC types as nullable (source_chapter,
 * source_page) and on metadata which is `Json` from the generator's perspective
 * but conforms to KnowledgeChunkMetadata at runtime (locked invariant —
 * vision-service/scripts/lib/manifest.py BookEntry mirrors this shape).
 */
function rpcRowToChunk(row: {
  id: string
  content: string
  source_book: string
  source_chapter: string | null
  source_page: number | null
  metadata: unknown
  source_type: string
  score: number
}): KnowledgeChunkRow {
  return {
    id: row.id,
    text: row.content,
    source_book: row.source_book,
    chapter: row.source_chapter,
    section: null, // section lives inside metadata, not its own column (post-0005 schema)
    page: row.source_page,
    metadata: (row.metadata ?? {}) as KnowledgeChunkMetadata,
    source_type: row.source_type === 'clinical_data' ? 'clinical_data' : 'biblioteca',
    score: Number(row.score),
  }
}

export async function retrieveRelevantKnowledge(
  args: RetrieveArgs,
): Promise<KnowledgeChunkRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (!user || authErr) {
    throw new Error('Unauthenticated')
  }

  // Step 2: build queries (D-R2 Family A + Family B)
  const queriesA = buildFamilyA(args.features)
  const queriesB = buildFamilyB(args.features, args.reportSections)
  const allQueries = [...queriesA, ...queriesB]
  if (allQueries.length === 0) {
    return []
  }

  // Step 3: embed queries in parallel (D-R5)
  const { embeddings } = await embedTexts({ texts: allQueries, inputType: 'query' })

  // Step 4: pgvector RPC for each query, parallel (D-R5)
  const rpcPromises = embeddings.map((emb) =>
    supabase.rpc('match_knowledge_chunks', {
      // Supabase JS serializes number[] -> pgvector format; the generator types
      // this as `string` (vector literal serialized form), but the SDK accepts
      // arrays at runtime. The cast follows the same pattern in PATTERNS.md §1124.
      query_embedding: emb as unknown as string,
      match_count: TOP_K_PER_QUERY,
      match_threshold: MATCH_THRESHOLD,
    }),
  )
  const responses = await Promise.all(rpcPromises)

  // Step 5: dedup by id, keep best cosine score
  const dedupMap = new Map<string, KnowledgeChunkRow>()
  for (const { data } of responses) {
    if (!data) continue
    for (const row of data) {
      const chunk = rpcRowToChunk(row)
      const existing = dedupMap.get(chunk.id)
      if (!existing || chunk.score > existing.score) {
        dedupMap.set(chunk.id, chunk)
      }
    }
  }
  let candidates = Array.from(dedupMap.values())

  // Step 6: rerank (graceful fallback — D-N2). Overfetch (FINAL_CAP * 2) so the
  // weight-driven re-ordering in step 7 has headroom to promote chunks past
  // the cap on rerank score alone.
  candidates = await rerankChunks({
    query: allQueries.join(' '),
    candidates,
    topK: FINAL_CAP * 2,
  })

  // Step 7: apply D-R4 weights using primary section (multipliers compound).
  // applyWeights expects a mutable Set<string>; ALTA_PRIORIDADE_BOOKS is
  // declared ReadonlySet for callers — pass through Set<string> view safely.
  const primarySection = args.reportSections[0] ?? null
  candidates = applyWeights(candidates, primarySection, ALTA_PRIORIDADE_BOOKS as Set<string>)

  // Step 8: final sort + cap (D-R3)
  candidates.sort((a, b) => b.score - a.score)
  const result = candidates.slice(0, FINAL_CAP)

  // Step 9: telemetry — no PII (counts and aggregate scores only)
  console.info({
    event: 'rag_retrieve',
    queries_count: allQueries.length,
    chunks_returned: result.length,
    top_score: result[0]?.score ?? null,
    bottom_score: result[result.length - 1]?.score ?? null,
  })
  return result
}
