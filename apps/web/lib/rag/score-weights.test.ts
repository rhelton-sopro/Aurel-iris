import { describe, it } from 'vitest'

// Wave 0 scaffolding (06-01-PLAN). Flipped GREEN in 06-10-PLAN when
// applyWeights lands in apps/web/lib/rag/score-weights.ts.
//
// Covers RAG-04 + D-R4 (multiplicadores pós-retrieval).

describe('applyWeights', () => {
  it.todo('multiplies score by 1.5 when source_type === "clinical_data" (D-R4)')
  it.todo('multiplies score by 1.1 when source_book in altaPrioridadeBooks (D-R4)')
  it.todo('multiplies score by 1.2 when metadata.dimensoes intersects section themes (D-R4)')
  it.todo('compounds multiple multipliers (clinical_data + alta_prioridade + dimensoes intersect)')
  it.todo('preserves chunk shape (only score changes)')
  it.todo('does not mutate input array')
  it.todo('WEIGHTS constant exposes CLINICAL_DATA=1.5, ALTA_PRIORIDADE=1.1, DIMENSAO_INTERSECT=1.2')
})
