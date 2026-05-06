// scripts/audit-vocabulary-db.test.mjs
// W6 — unit test for the word-boundary narrowing in audit-vocabulary-db.mjs.
//
// Pure logic mirror of `termHitsTags` in audit-vocabulary-db.mjs. Keeping it
// inline here makes the test self-contained — the real script imports against
// Supabase, so we test the regex behavior here without spinning up a DB client.
// This pins parity with audit_vocabulary.py / audit-vocabulary.mjs (both use
// \b...\b) so a `naturocultura` tag does NOT trigger a false positive on `cura`,
// while `diagnóstico precoce` correctly triggers on `diagnóstico`.
//
// Run via: node --test apps/web/scripts/audit-vocabulary-db.test.mjs
//
// Phase: 06-rag-ingestao | Plan: 06-12 | Decisions: W6

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function termHitsTags(term, tags) {
  const re = new RegExp('\\b' + escapeRegex(term) + '\\b', 'i')
  return Array.isArray(tags) && tags.some((t) => re.test(String(t)))
}

describe('audit-vocabulary-db word-boundary narrowing (W6)', () => {
  it('does NOT match "naturocultura" against \\bcura\\b', () => {
    assert.equal(termHitsTags('cura', ['naturocultura']), false)
  })
  it('DOES match "diagnóstico precoce" against \\bdiagnóstico\\b', () => {
    assert.equal(termHitsTags('diagnóstico', ['diagnóstico precoce']), true)
  })
  it('DOES match "tratamento" against \\btratamento\\b', () => {
    assert.equal(termHitsTags('tratamento', ['tratamento']), true)
  })
  it('does NOT match "curandeiro" against \\bcura\\b', () => {
    assert.equal(termHitsTags('cura', ['curandeiro']), false)
  })
  it('handles case-insensitive boundary: "Diagnóstico" matches \\bdiagnóstico\\b', () => {
    assert.equal(termHitsTags('diagnóstico', ['Diagnóstico clínico']), true)
  })
})
