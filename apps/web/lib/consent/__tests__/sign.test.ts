import { beforeEach, describe, expect, it, vi } from 'vitest'

const selectChain = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() }
const insertChain = { select: vi.fn().mockReturnThis(), single: vi.fn() }
const insertSpy = vi.fn(() => insertChain)

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => selectChain, insert: insertSpy }),
  }),
}))

import { signBiometricTerm, sanitizeInet } from '../sign'

describe('sanitizeInet (WR-02)', () => {
  it('aceita IPv4 válido', () => {
    expect(sanitizeInet('189.40.12.3')).toBe('189.40.12.3')
  })

  it('rejeita octeto > 255 → null', () => {
    expect(sanitizeInet('999.1.1.1')).toBeNull()
  })

  it('rejeita token não-IP (ex. "unknown") → null', () => {
    expect(sanitizeInet('unknown')).toBeNull()
  })

  it('rejeita IPv6 com zone id (%) → null', () => {
    expect(sanitizeInet('fe80::1%eth0')).toBeNull()
  })

  it('aceita IPv6 simples', () => {
    expect(sanitizeInet('2001:db8::1')).toBe('2001:db8::1')
  })

  it('null/empty → null', () => {
    expect(sanitizeInet(null)).toBeNull()
    expect(sanitizeInet('')).toBeNull()
    expect(sanitizeInet('   ')).toBeNull()
  })

  it('trim antes de validar', () => {
    expect(sanitizeInet('  189.40.12.3  ')).toBe('189.40.12.3')
  })
})

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

  it('WR-02: IP malformado NÃO bloqueia — insere com ip=null', async () => {
    selectChain.maybeSingle.mockResolvedValueOnce({
      data: { version: 'v1', content_sha256: 'abc' },
      error: null,
    })
    insertChain.single.mockResolvedValueOnce({
      data: { id: 'consent-2' },
      error: null,
    })
    const r = await signBiometricTerm({
      client_id: 'c1',
      reading_id: 'r1',
      consent_channel: 'remote_link',
      ip: 'unknown', // x-forwarded-for ruim
    })
    expect(r.ok).toBe(true)
    const insertedRow = insertSpy.mock.calls[0]?.[0] as { ip: string | null }
    expect(insertedRow.ip).toBeNull()
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
