/**
 * Tests for `apps/web/lib/rag/embed.ts` (06-09).
 *
 * Mocks the `voyageai` npm SDK at module scope via `vi.mock` so the wrapper
 * never makes a real HTTP call. Covers the 7 contracts from 06-09-PLAN:
 *  - EMBEDDING_MODEL constant pin (RESEARCH Pitfall 4 / mirror of Python)
 *  - VOYAGE_API_KEY env-missing guard (D-R3 server-only key handling)
 *  - empty-input no-op (avoid burning a roundtrip / token)
 *  - default inputType='query' (RESEARCH §input_type — retrieval-side default)
 *  - explicit inputType='document' passthrough
 *  - response shape mapping (data → embeddings[], usage → totalTokens)
 *  - VoyageEmbedError class shape (Error subclass, name set, optional status)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.mock at module-scope intercepts the import *before* embed.ts loads.
const mockEmbedFn = vi.fn()
vi.mock('voyageai', () => ({
  VoyageAIClient: vi.fn().mockImplementation(() => ({
    embed: mockEmbedFn,
  })),
}))

import { EMBEDDING_MODEL, embedTexts, VoyageEmbedError } from './embed'

describe('embed.ts', () => {
  beforeEach(() => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key-fake')
    mockEmbedFn.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('EMBEDDING_MODEL constant is "voyage-3" (must match Python pin — Pitfall 4)', () => {
    expect(EMBEDDING_MODEL).toBe('voyage-3')
  })

  it('throws VoyageEmbedError when VOYAGE_API_KEY missing', async () => {
    vi.unstubAllEnvs()
    await expect(embedTexts({ texts: ['hello'] })).rejects.toThrow(VoyageEmbedError)
    await expect(embedTexts({ texts: ['hello'] })).rejects.toThrow(/VOYAGE_API_KEY is not set/)
  })

  it('returns empty arrays for empty input (no API call)', async () => {
    const result = await embedTexts({ texts: [] })
    expect(result.embeddings).toEqual([])
    expect(result.totalTokens).toBe(0)
    expect(mockEmbedFn).not.toHaveBeenCalled()
  })

  it('passes inputType="query" by default (retrieval-side default)', async () => {
    mockEmbedFn.mockResolvedValue({
      data: [{ embedding: new Array(1024).fill(0.1) }],
      usage: { totalTokens: 5 },
    })
    await embedTexts({ texts: ['liver findings'] })
    expect(mockEmbedFn).toHaveBeenCalledWith({
      input: ['liver findings'],
      model: 'voyage-3',
      inputType: 'query',
    })
  })

  it('passes inputType="document" when explicitly set', async () => {
    mockEmbedFn.mockResolvedValue({
      data: [{ embedding: new Array(1024).fill(0.1) }],
      usage: { totalTokens: 5 },
    })
    await embedTexts({ texts: ['chunk text'], inputType: 'document' })
    expect(mockEmbedFn).toHaveBeenCalledWith({
      input: ['chunk text'],
      model: 'voyage-3',
      inputType: 'document',
    })
  })

  it('returns embeddings array parallel to input', async () => {
    const fakeEmbed = (idx: number) => new Array(1024).fill(idx * 0.1)
    mockEmbedFn.mockResolvedValue({
      data: [
        { embedding: fakeEmbed(1) },
        { embedding: fakeEmbed(2) },
        { embedding: fakeEmbed(3) },
      ],
      usage: { totalTokens: 30 },
    })
    const result = await embedTexts({ texts: ['a', 'b', 'c'] })
    expect(result.embeddings).toHaveLength(3)
    expect(result.embeddings[0]).toHaveLength(1024)
    expect(result.totalTokens).toBe(30)
  })

  it('VoyageEmbedError is an Error subclass with name set', () => {
    const err = new VoyageEmbedError('test', 500)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('VoyageEmbedError')
    expect(err.status).toBe(500)
  })
})
