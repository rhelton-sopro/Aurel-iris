import { beforeEach, describe, expect, it, vi } from 'vitest'

const selectChain = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() }
const insertChain = { select: vi.fn().mockReturnThis(), single: vi.fn() }

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => selectChain, insert: () => insertChain }),
  }),
}))

import { signBiometricTerm } from '../sign'

describe('signBiometricTerm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads current term + inserts client_consents', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: { version: 'v1', content_sha256: 'abc' },
      error: null,
    })
    insertChain.single.mockResolvedValueOnce({
      data: { id: 'consent-1' },
      error: null,
    })
    const r = await signBiometricTerm({
      client_id: 'c1',
      reading_id: 'r1',
      consent_channel: 'remote_link',
      ip: '1.2.3.4',
      user_agent: 'Mozilla',
      cpf_titular: '12345678909',
    })
    expect(r).toEqual({ ok: true, consent_id: 'consent-1', term_version: 'v1' })
  })

  it('fails when no current term', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const r = await signBiometricTerm({
      client_id: 'c1',
      reading_id: 'r1',
      consent_channel: 'remote_link',
    })
    expect(r).toEqual({ ok: false, error: 'no_current_term' })
  })

  it('fails when client_consents INSERT errors', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: { version: 'v1', content_sha256: 'abc' },
      error: null,
    })
    insertChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'FK violation' },
    })
    const r = await signBiometricTerm({
      client_id: 'c1',
      reading_id: 'r1',
      consent_channel: 'remote_link',
    })
    expect(r.ok).toBe(false)
  })
})
