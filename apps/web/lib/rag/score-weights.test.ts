import { describe, it, expect } from 'vitest'

import { applyWeights, WEIGHTS } from './score-weights'
import type { KnowledgeChunkRow } from './types'

// Wave 0 scaffolding (06-01-PLAN) flipped GREEN in 06-10-PLAN.
// Covers RAG-04 + D-R4 (multiplicadores pós-retrieval).

function makeChunk(overrides: Partial<KnowledgeChunkRow> = {}): KnowledgeChunkRow {
  return {
    id: 'c1',
    text: 'sample',
    source_book: 'Generic Book',
    chapter: null,
    section: null,
    page: 1,
    metadata: {
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
    source_type: 'biblioteca',
    score: 0.5,
    ...overrides,
  }
}

describe('WEIGHTS constants (D-R4)', () => {
  it('CLINICAL_DATA = 1.5', () => {
    expect(WEIGHTS.CLINICAL_DATA).toBe(1.5)
  })
  it('ALTA_PRIORIDADE = 1.1', () => {
    expect(WEIGHTS.ALTA_PRIORIDADE).toBe(1.1)
  })
  it('DIMENSAO_INTERSECT = 1.2', () => {
    expect(WEIGHTS.DIMENSAO_INTERSECT).toBe(1.2)
  })
})

describe('applyWeights (D-R4)', () => {
  it('multiplies score by 1.5 when source_type === clinical_data', () => {
    const result = applyWeights(
      [makeChunk({ score: 0.5, source_type: 'clinical_data' })],
      null,
      new Set(),
    )
    expect(result[0].score).toBeCloseTo(0.75, 6)
  })

  it('multiplies score by 1.1 when book in altaPrioridadeBooks', () => {
    const result = applyWeights(
      [makeChunk({ score: 0.5, source_book: 'Jensen Simplified' })],
      null,
      new Set(['Jensen Simplified']),
    )
    expect(result[0].score).toBeCloseTo(0.55, 6)
  })

  it('multiplies score by 1.2 when dimensoes intersects section theme', () => {
    const result = applyWeights(
      [
        makeChunk({
          score: 0.5,
          metadata: { ...makeChunk().metadata, dimensoes: ['psicossomatica'] },
        }),
      ],
      'psicoemocional',
      new Set(),
    )
    expect(result[0].score).toBeCloseTo(0.6, 6)
  })

  it('does NOT multiply by dimensoes when section is null', () => {
    const result = applyWeights(
      [
        makeChunk({
          score: 0.5,
          metadata: { ...makeChunk().metadata, dimensoes: ['psicossomatica'] },
        }),
      ],
      null,
      new Set(),
    )
    expect(result[0].score).toBeCloseTo(0.5, 6)
  })

  it('compounds all 3 multipliers (1.5 × 1.1 × 1.2 = 1.98×)', () => {
    const result = applyWeights(
      [
        makeChunk({
          score: 0.5,
          source_type: 'clinical_data',
          source_book: 'Jensen',
          metadata: { ...makeChunk().metadata, dimensoes: ['psicossomatica'] },
        }),
      ],
      'psicoemocional',
      new Set(['Jensen']),
    )
    expect(result[0].score).toBeCloseTo(0.5 * 1.5 * 1.1 * 1.2, 6) // 0.99
  })

  it('does not mutate input array', () => {
    const input = [makeChunk({ score: 0.5, source_type: 'clinical_data' })]
    const original = input[0].score
    applyWeights(input, null, new Set())
    expect(input[0].score).toBe(original)
  })

  it('preserves chunk shape (only score changes)', () => {
    const input = [
      makeChunk({ score: 0.5, source_type: 'clinical_data', text: 'unique text' }),
    ]
    const result = applyWeights(input, null, new Set())
    expect(result[0].text).toBe('unique text')
    expect(result[0].id).toBe('c1')
    expect(result[0].metadata).toEqual(input[0].metadata)
  })
})
