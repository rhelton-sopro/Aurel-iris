/**
 * D-PR2 frozen contract CI gate (Phase 7 + Phase 6 cross-reference).
 *
 * `analyze.ts` chama `retrieveRelevantKnowledge({ reportSections: REPORT_SECTIONS })`.
 * `SECTION_QUERY_TEMPLATES` em `lib/rag/section-queries.ts` é um Record com chaves
 * = todos os slugs aceitos. Se REPORT_SECTIONS adicionar um slug sem template,
 * o retrieval retorna queries Família B vazias para essa seção (silently broken).
 *
 * Esse teste falha LOUD quando o set REPORT_SECTIONS desvia do Record.
 *
 * Source: 07-CONTEXT.md D-PR2.
 */
import { describe, it, expect } from 'vitest'
import { SECTION_QUERY_TEMPLATES } from '../section-queries'
import { REPORT_SECTIONS } from '@/lib/anthropic/types'

describe('D-PR2 frozen contract: REPORT_SECTIONS ⊆ SECTION_QUERY_TEMPLATES', () => {
  it('every slug REPORT_SECTIONS passes is a key in SECTION_QUERY_TEMPLATES', () => {
    const recordKeys = new Set(Object.keys(SECTION_QUERY_TEMPLATES))
    const missing: string[] = []
    for (const slug of REPORT_SECTIONS) {
      if (!recordKeys.has(slug)) missing.push(slug)
    }
    expect(missing).toEqual([])
  })

  it('REPORT_SECTIONS tem exatamente 8 slugs (Phase 7.4 Plan 14 — biografia_temporal added for §3 UAT-2 fix)', () => {
    expect(REPORT_SECTIONS.length).toBe(8)
  })

  it('SECTION_QUERY_TEMPLATES tem >= 8 keys (pode adicionar mais sem quebrar)', () => {
    expect(Object.keys(SECTION_QUERY_TEMPLATES).length).toBeGreaterThanOrEqual(8)
  })

  it('Plan 07.4-14: biografia_temporal concern emits 4 biographical-mapping queries for §3', () => {
    const dummyFeatures = { constitution: { primary: 'linfática' } }
    const queries = SECTION_QUERY_TEMPLATES.biografia_temporal(dummyFeatures)
    expect(queries.length).toBe(4)
    expect(queries.some((q) => q.toLowerCase().includes('cronorichio'))).toBe(true)
    expect(queries.some((q) => q.toLowerCase().includes('lo rito'))).toBe(true)
    expect(queries.some((q) => q.toLowerCase().includes('jensen biographical'))).toBe(true)
    expect(queries.some((q) => q.toLowerCase().includes('brasileiro'))).toBe(true)
    // constitution.primary is injected into the constitution-anchored query
    expect(queries.some((q) => q.includes('linfática'))).toBe(true)
  })

  it('cada template em SECTION_QUERY_TEMPLATES retorna array com >= 1 query string', () => {
    const dummyFeatures = { constitution: { primary: 'linfática' } }
    for (const slug of REPORT_SECTIONS) {
      const template = SECTION_QUERY_TEMPLATES[slug]
      expect(template).toBeDefined()
      const queries = template!(dummyFeatures)
      expect(Array.isArray(queries)).toBe(true)
      expect(queries.length).toBeGreaterThanOrEqual(1)
      expect(queries.every((q) => typeof q === 'string' && q.length > 0)).toBe(true)
    }
  })
})
