/**
 * Thin wrapper for Voyage embeddings — D-E1 voyage-3, dim 1024.
 * Mirror of `vision-service/scripts/lib/embedder.py` (06-05).
 *
 * EMBEDDING_MODEL constant MUST match the Python file.
 * RESEARCH Pitfall 4: model mismatch puts queries and documents in incompatible
 * embedding spaces — recall drops to near-random. Locked invariant defended by
 * embed.test.ts (this tree) + test_embedder.py (Python tree).
 *
 * Server-only via Next.js Reserved Module — prevents VOYAGE_API_KEY leakage to
 * browser bundles (RESEARCH Pitfall 10). Pattern mirrors apps/web/lib/supabase/service.ts.
 *
 * Phase: 06-rag-ingestao | Plan: 06-09 | Decisions: D-E1, D-N4, D-R3
 */
import 'server-only'
import { VoyageAIClient } from 'voyageai'

/** PINNED — must match `vision-service/scripts/lib/embedder.py` (RESEARCH Pitfall 4). */
export const EMBEDDING_MODEL = 'voyage-3'

/** D-N4 latency budget — single-call ceiling. Voyage typically returns in ~200ms;
 *  10s gives 50× headroom for transient slowdowns before failing fast. */
export const EMBED_TIMEOUT_MS = 10_000

export interface EmbedArgs {
  texts: string[]
  /** RESEARCH §input_type — `'query'` for retrieval, `'document'` for ingestion.
   *  Default `'query'` because the primary consumer of this module is the
   *  retrieval-side server action `apps/web/lib/rag/search.ts` (06-11). The
   *  Python ingest pipeline (`embedder.py`) defaults to `'document'` instead. */
  inputType?: 'query' | 'document'
}

export interface EmbedResult {
  /** dim-1024 vectors, parallel to args.texts. */
  embeddings: number[][]
  totalTokens: number
}

export class VoyageEmbedError extends Error {
  public readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'VoyageEmbedError'
    this.status = status
  }
}

/**
 * Embed a list of texts via the Voyage TS SDK.
 *
 * Returns `{embeddings, totalTokens}`. Throws `VoyageEmbedError` if
 * `VOYAGE_API_KEY` is unset. Empty `texts` short-circuits without an API call
 * (avoids burning a request and a token).
 *
 * The Voyage SDK has built-in retry (default limit 2 — RESEARCH lines 244–258),
 * so we don't add an explicit retry layer here. Python's `embedder.py` adds
 * 1s/4s/16s manually because the Python SDK lacks built-in retries; do not
 * mirror that pattern in TS.
 *
 * Note on Fern-generated SDK types: `EmbedResponse.data`,
 * `EmbedResponseDataItem.embedding`, and `EmbedResponseUsage.totalTokens` are
 * all marked optional in the generated `.d.mts`. We coerce them to the
 * expected shape (empty arrays / 0 tokens if absent) rather than asserting —
 * defensive against future SDK schema drift.
 */
export async function embedTexts(args: EmbedArgs): Promise<EmbedResult> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new VoyageEmbedError('VOYAGE_API_KEY is not set')
  }
  if (args.texts.length === 0) {
    return { embeddings: [], totalTokens: 0 }
  }
  const client = new VoyageAIClient({ apiKey })
  const result = await client.embed({
    input: args.texts,
    model: EMBEDDING_MODEL,
    inputType: args.inputType ?? 'query',
  })
  const embeddings = (result.data ?? []).map((d) => d.embedding ?? [])
  const totalTokens = result.usage?.totalTokens ?? 0
  return { embeddings, totalTokens }
}
