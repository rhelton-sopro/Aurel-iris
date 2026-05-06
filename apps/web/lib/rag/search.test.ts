/**
 * Tests for `apps/web/lib/rag/search.ts` (06-11, RAG-04, D-R1..R5, D-N2).
 *
 * Mocks Supabase server client, embedTexts, and rerankChunks at module scope so
 * the orchestrator runs entirely in memory. Covers the 10 contracts from
 * 06-11-PLAN:
 *  - throws when user is unauthenticated (mirror readings.ts auth gate)
 *  - returns empty array when no queries built (no embed/rpc call)
 *  - caps result at 30 chunks (D-R3)
 *  - dedupes by id (keeps highest cosine score across overlapping queries)
 *  - runs RPC calls in parallel (Promise.all — D-R5)
 *  - latency p95 <= 2s with 8 mocked queries (D-N4 early-warning gate)
 *  - logs telemetry event rag_retrieve with no PII (RESEARCH telemetry §)
 *  - orders chunks by score desc (D-R3)
 *  - embeds with inputType='query' (RESEARCH §input_type for retrieval)
 *  - ALTA_PRIORIDADE_BOOKS stays in sync with books_manifest.json (W3 drift detection)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mocks — must register BEFORE the import of search.ts.
const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockEmbedTexts = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  }),
}))

vi.mock('./embed', () => ({
  embedTexts: (args: { texts: string[]; inputType?: string }) => mockEmbedTexts(args),
}))

vi.mock('./rerank', () => ({
  rerankChunks: vi.fn(async (args: { candidates: unknown[]; topK?: number }) => {
    return args.candidates.slice(0, args.topK ?? 30)
  }),
  RERANK_MODEL: 'voyage-rerank-2.5',
}))

import { retrieveRelevantKnowledge, ALTA_PRIORIDADE_BOOKS } from './search'
import type { IrisFeaturesForRag } from './build-queries'

function makeFeatures(): IrisFeaturesForRag {
  return {
    constitution: { primary: 'biliar' },
    sectors: [{ hour: 7, findings: [{ type: 'lacuna_aberta' }] }],
    rings: { anel_tensao: { present: true } },
  }
}

interface RpcRow {
  id: string
  content: string
  source_book: string
  source_chapter: string | null
  source_page: number | null
  metadata: Record<string, unknown>
  source_type: string
  score: number
}

function makeRpcResponse(rows: Array<Partial<RpcRow>>): { data: RpcRow[]; error: null } {
  return {
    data: rows.map((r) => ({
      id: r.id ?? 'x',
      content: r.content ?? 'text',
      source_book: r.source_book ?? 'Book',
      source_chapter: r.source_chapter ?? null,
      source_page: r.source_page ?? 1,
      metadata:
        r.metadata ??
        {
          autor: 'A',
          escola: 'Jensen',
          idioma: 'pt',
          ano: 2000,
          constituicao_referenciada: [],
          setores_referenciados: [],
          sinais_referenciados: [],
          dimensoes: [],
          tags_livres: [],
        },
      source_type: r.source_type ?? 'biblioteca',
      score: r.score ?? 0.5,
    })),
    error: null,
  }
}

describe('retrieveRelevantKnowledge (RAG-04, D-R1..R5, D-N2)', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockRpc.mockReset()
    mockEmbedTexts.mockReset()
    // Default: 3 fake embeddings (matches buildFamilyA output for makeFeatures())
    mockEmbedTexts.mockImplementation((args: { texts: string[]; inputType?: string }) => {
      return Promise.resolve({
        embeddings: args.texts.map((_, i) => [0.1 + i * 0.05]),
        totalTokens: 100,
      })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('throws when user is unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } })
    await expect(
      retrieveRelevantKnowledge({ features: makeFeatures(), reportSections: ['constituicao'] }),
    ).rejects.toThrow(/Unauthenticated/)
  })

  it('returns empty array when no queries built', async () => {
    const features: IrisFeaturesForRag = {
      constitution: { primary: '' }, // empty string falsy -> no Family A constitution query
      sectors: [],
      rings: {},
    }
    const result = await retrieveRelevantKnowledge({ features, reportSections: [] })
    expect(result).toEqual([])
    expect(mockEmbedTexts).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('caps result at 30 chunks (D-R3)', async () => {
    // Mock RPC returning 50 unique chunks per query
    mockRpc.mockImplementation(() =>
      Promise.resolve(
        makeRpcResponse(
          Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, score: 0.5 + i * 0.005 })),
        ),
      ),
    )
    const result = await retrieveRelevantKnowledge({
      features: makeFeatures(),
      reportSections: ['constituicao'],
    })
    expect(result.length).toBeLessThanOrEqual(30)
  })

  it('dedupes by id (keeps highest score)', async () => {
    // Three queries return overlapping chunks
    mockRpc
      .mockResolvedValueOnce(makeRpcResponse([{ id: 'a', score: 0.6 }, { id: 'b', score: 0.5 }]))
      .mockResolvedValueOnce(makeRpcResponse([{ id: 'a', score: 0.9 }, { id: 'c', score: 0.4 }]))
      .mockResolvedValueOnce(makeRpcResponse([{ id: 'b', score: 0.3 }]))
      .mockResolvedValue(makeRpcResponse([]))
    const result = await retrieveRelevantKnowledge({
      features: makeFeatures(),
      reportSections: ['constituicao'],
    })
    const ids = result.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length) // all unique
    const aChunk = result.find((c) => c.id === 'a')
    expect(aChunk?.score).toBeGreaterThan(0.6) // 0.9 won (may be reweighted but never lower than 0.9)
  })

  it('runs RPC calls in parallel (Promise.all)', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    mockRpc.mockImplementation(async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((r) => setTimeout(r, 10))
      concurrent--
      return makeRpcResponse([{ id: `c${Math.random()}`, score: 0.5 }])
    })
    await retrieveRelevantKnowledge({
      features: makeFeatures(),
      reportSections: ['constituicao'],
    })
    // makeFeatures + 'constituicao' section -> 4 queries (constituição biliar +
    // lacuna_aberta no setor 7 + anel_tensao presente + caracterização da constituição biliar)
    expect(maxConcurrent).toBeGreaterThan(1)
  })

  it('latency p95 <= 2s with 8 mocked queries (D-N4 early-warning)', async () => {
    // Richer features payload to generate ~8 queries
    const features: IrisFeaturesForRag = {
      constitution: { primary: 'biliar', secondary: 'linfatica' },
      sectors: [
        { hour: 7, findings: [{ type: 'lacuna_aberta' }] },
        { hour: 3, findings: [{ type: 'cripta' }] },
      ],
      rings: { anel_tensao: { present: true }, arco_senil: { present: true } },
    }
    mockRpc.mockResolvedValue(makeRpcResponse([{ id: 'c1', score: 0.5 }]))
    const samples: number[] = []
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      await retrieveRelevantKnowledge({
        features,
        reportSections: ['psicoemocional', 'transgeracional'],
      })
      samples.push(performance.now() - t0)
    }
    samples.sort((a, b) => a - b)
    const p95 = samples[Math.floor(samples.length * 0.95)]
    expect(p95).toBeLessThan(2000) // 2s — D-N4 early warning
  })

  it('logs telemetry event with no PII', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mockRpc.mockResolvedValue(makeRpcResponse([{ id: 'c1', score: 0.7 }]))
    await retrieveRelevantKnowledge({
      features: makeFeatures(),
      reportSections: ['constituicao'],
    })
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'rag_retrieve',
        queries_count: expect.any(Number),
        chunks_returned: expect.any(Number),
      }),
    )
    // Assert no PII keys
    const logCall = consoleSpy.mock.calls[0][0] as Record<string, unknown>
    expect(logCall).not.toHaveProperty('user_id')
    expect(logCall).not.toHaveProperty('client_id')
    expect(logCall).not.toHaveProperty('reading_id')
    consoleSpy.mockRestore()
  })

  it('orders chunks by score desc', async () => {
    mockRpc.mockResolvedValue(
      makeRpcResponse([
        { id: 'low', score: 0.3 },
        { id: 'high', score: 0.9 },
        { id: 'mid', score: 0.6 },
      ]),
    )
    const result = await retrieveRelevantKnowledge({
      features: makeFeatures(),
      reportSections: ['constituicao'],
    })
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
    }
  })

  it('embeds with inputType="query" (RESEARCH §input_type for retrieval)', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse([{ id: 'c1', score: 0.5 }]))
    await retrieveRelevantKnowledge({
      features: makeFeatures(),
      reportSections: ['constituicao'],
    })
    expect(mockEmbedTexts).toHaveBeenCalledWith(
      expect.objectContaining({ inputType: 'query' }),
    )
  })

  it('ALTA_PRIORIDADE_BOOKS stays in sync with books_manifest.json (W3 drift detection)', async () => {
    // Reads the canonical manifest at test-time and asserts the hardcoded TS Set
    // in search.ts matches the alta_prioridade=true keys. Future edits to the
    // manifest must be mirrored in the TS constant or this test fails loudly.
    const fs = await import('node:fs')
    const path = await import('node:path')
    const manifestPath = path.resolve(
      __dirname,
      '../../../../vision-service/scripts/data/books_manifest.json',
    )
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
      books: Record<string, { alta_prioridade?: boolean }>
    }
    const expected = new Set(
      Object.entries(manifest.books)
        .filter(([, v]) => v.alta_prioridade === true)
        .map(([k]) => k),
    )
    expect(new Set(ALTA_PRIORIDADE_BOOKS)).toEqual(expected)
  })
})
