// Phase 7.1 | Plan 07.1-03 — Founder identity check tests.
// Source: 07.1-03-PLAN Task 2 verification gate.
//
// Tests fail-closed semantics + case/whitespace handling. Mocks 'server-only'
// via vitest.config.ts shim already in place for lib/anthropic + lib/rag tests.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('lib/auth/founder', () => {
  const ORIGINAL_FOUNDER_EMAIL = process.env.FOUNDER_EMAIL

  beforeEach(() => {
    // Force fresh module load so FOUNDER_EMAIL constant picks up env changes.
    // Vitest caches module-level constants between tests; resetModules + dynamic
    // import re-evaluates the module body.
  })

  afterEach(() => {
    if (ORIGINAL_FOUNDER_EMAIL === undefined) delete process.env.FOUNDER_EMAIL
    else process.env.FOUNDER_EMAIL = ORIGINAL_FOUNDER_EMAIL
  })

  async function freshImport() {
    const { vi } = await import('vitest')
    vi.resetModules()
    return await import('../founder')
  }

  it('returns false when FOUNDER_EMAIL env is unset (fail-closed)', async () => {
    delete process.env.FOUNDER_EMAIL
    const { isFounderEmail } = await freshImport()
    expect(isFounderEmail('rhelton@gmail.com')).toBe(false)
    expect(isFounderEmail('anyone@anywhere.com')).toBe(false)
  })

  it('returns false when FOUNDER_EMAIL is empty string', async () => {
    process.env.FOUNDER_EMAIL = ''
    const { isFounderEmail } = await freshImport()
    expect(isFounderEmail('rhelton@gmail.com')).toBe(false)
  })

  it('returns true when email exactly matches FOUNDER_EMAIL', async () => {
    process.env.FOUNDER_EMAIL = 'rhelton@gmail.com'
    const { isFounderEmail } = await freshImport()
    expect(isFounderEmail('rhelton@gmail.com')).toBe(true)
  })

  it('returns false when email does not match', async () => {
    process.env.FOUNDER_EMAIL = 'rhelton@gmail.com'
    const { isFounderEmail } = await freshImport()
    expect(isFounderEmail('attacker@example.com')).toBe(false)
    expect(isFounderEmail('rhelton+evil@gmail.com')).toBe(false)
  })

  it('handles case differences (lowercase comparison)', async () => {
    process.env.FOUNDER_EMAIL = 'rhelton@gmail.com'
    const { isFounderEmail } = await freshImport()
    expect(isFounderEmail('Rhelton@Gmail.com')).toBe(true)
    expect(isFounderEmail('RHELTON@GMAIL.COM')).toBe(true)
  })

  it('handles whitespace (trim before compare)', async () => {
    process.env.FOUNDER_EMAIL = 'rhelton@gmail.com'
    const { isFounderEmail } = await freshImport()
    expect(isFounderEmail('  rhelton@gmail.com  ')).toBe(true)
  })

  it('returns false for null or undefined email', async () => {
    process.env.FOUNDER_EMAIL = 'rhelton@gmail.com'
    const { isFounderEmail } = await freshImport()
    expect(isFounderEmail(null)).toBe(false)
    expect(isFounderEmail(undefined)).toBe(false)
    expect(isFounderEmail('')).toBe(false)
  })

  it('handles whitespace in FOUNDER_EMAIL env value', async () => {
    process.env.FOUNDER_EMAIL = '  rhelton@gmail.com  '
    const { isFounderEmail } = await freshImport()
    expect(isFounderEmail('rhelton@gmail.com')).toBe(true)
  })
})
