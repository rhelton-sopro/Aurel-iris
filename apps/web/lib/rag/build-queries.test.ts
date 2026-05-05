import { describe, it } from 'vitest'

// Wave 0 scaffolding (06-01-PLAN). Flipped GREEN in 06-10-PLAN when
// buildFamilyA / buildFamilyB land in apps/web/lib/rag/build-queries.ts.
//
// Covers RAG-04 + D-R2 (Família A: achados visuais; Família B: seções do super prompt).

describe('buildFamilyA (visual findings)', () => {
  it.todo('emits 1 query per primary constitution (D-R2A)')
  it.todo('emits 1 query per secondary constitution when present (D-R2A)')
  it.todo('emits 1 query per sector with findings.length > 0, including type names (D-R2A)')
  it.todo('emits 1 query per active global ring/sign (D-R2A)')
  it.todo('returns empty when features has no constitution and no findings')
})

describe('buildFamilyB (report sections)', () => {
  it.todo('emits queries from SECTION_QUERY_TEMPLATES for each requested reportSection (D-R2B)')
  it.todo('combines constitution.primary into each section template (D-R2B)')
  it.todo('returns empty when reportSections is empty')
  it.todo('skips sections without a registered template (no throw)')
})
