// audit-vocabulary:allowlist — este teste exemplifica termos proibidos para
// validar detecção runtime. Marker honra apps/web/scripts/audit-vocabulary.mjs.
// IMPLEMENTED BY: 07.4-04 (audit-v2.ts — extended vocab audit per D-VOC1/3)
// Plan 07.4-00 RED scaffold. Source: 07.4-VALIDATION.md, D-VOC1.
import { describe, it, expect } from 'vitest'

describe('lib/anthropic/audit-v2 (D-VOC1, D-VOC3) — Plan 07.4-04', () => {
  it('detects iridological jargon (constituição linfática)', () => {
    expect.fail('NOT IMPLEMENTED — Plan 07.4-04 (audit-v2.ts iridological pattern set)')
  })

  it('detects Sopro vocab (centelha divina)', () => {
    expect.fail('NOT IMPLEMENTED — Plan 07.4-04 (audit-v2.ts Sopro pattern set)')
  })

  it('does NOT trip on compound words (curadoria, naturocultura)', () => {
    expect.fail('NOT IMPLEMENTED — Plan 07.4-04 (word-boundary discipline)')
  })

  it('respects NEG_CONTEXT_RE for LGPD set (diagnostico in disclaimer not flagged)', () => {
    expect.fail('NOT IMPLEMENTED — Plan 07.4-04 (LGPD neg-context preserved)')
  })
})
