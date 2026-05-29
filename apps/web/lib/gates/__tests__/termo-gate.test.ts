import { beforeEach, describe, expect, it, vi } from 'vitest'

const selectChain = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() }
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => selectChain }),
  }),
}))

import { assertClientTermoSigned } from '../termo-gate'

describe('assertClientTermoSigned', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // mockReturnThis precisa ser reaplicado após clearAllMocks
    selectChain.eq.mockReturnThis()
  })

  it('returns ok when consent_last_at is present', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: { consent_last_at: '2026-05-27T10:00:00Z', consent_current_version: 'v1' },
      error: null,
    })
    const r = await assertClientTermoSigned('c1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.signed_at).toBe('2026-05-27T10:00:00Z')
      expect(r.term_version).toBe('v1')
    }
  })

  it('returns termo_missing when consent_last_at is null', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: { consent_last_at: null, consent_current_version: null },
      error: null,
    })
    const r = await assertClientTermoSigned('c1')
    expect(r).toEqual({ ok: false, reason: 'termo_missing' })
  })

  it('returns client_not_found when row absent', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const r = await assertClientTermoSigned('c1')
    expect(r).toEqual({ ok: false, reason: 'client_not_found' })
  })

  it('returns db_error when SELECT throws', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'rls denied' } })
    const r = await assertClientTermoSigned('c1')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('db_error')
      expect(r.detail).toBe('rls denied')
    }
  })
})
