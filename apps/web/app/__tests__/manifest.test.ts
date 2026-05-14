// audit-vocabulary:allowlist — this test references both old + new brand names
// to assert the rebrand happened correctly. Allowlist marker prevents the audit
// gate from tripping on the historical "Aurel" reference in this test file.
//
// Phase 7.4 | Plan 07.4-09 | Decisions: D-BR2 | Source: 07.4-VALIDATION.md
import { describe, it, expect } from 'vitest'
import manifest from '../manifest'

describe('app/manifest — Iris Codex rebrand (D-BR2) — Plan 07.4-09', () => {
  const m = manifest()

  it('name is "Iris Codex"', () => {
    expect(m.name).toBe('Iris Codex')
  })

  it('short_name is "Iris Codex"', () => {
    expect(m.short_name).toBe('Iris Codex')
  })

  it('description does not contain "Aurel"', () => {
    expect(m.description).toBeDefined()
    expect(m.description).not.toContain('Aurel')
    expect(m.description).not.toMatch(/aurel/i)
  })

  it('description is the founder-approved tagline "A íris como mapa do ser."', () => {
    expect(m.description).toBe('A íris como mapa do ser.')
  })

  it('start_url preserved', () => {
    expect(m.start_url).toBe('/dashboard')
  })
})
