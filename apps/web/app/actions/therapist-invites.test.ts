import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// ─── vi.hoisted: factories para mocks ────────────────────────────────────────
const {
  mockGetUser,
  mockUpdate,
  mockEq,
  mockIs,
  mockMaybeSingle,
  mockFrom,
  mockServiceFrom,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
  const mockIs = vi.fn(() => ({ select: mockSelect }))
  const mockEq = vi.fn(() => ({ is: mockIs }))
  const mockUpdate = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ update: mockUpdate }))

  const mockGetUser = vi.fn()
  const mockServiceFrom = mockFrom

  return {
    mockGetUser,
    mockUpdate,
    mockEq,
    mockIs,
    mockMaybeSingle,
    mockFrom,
    mockServiceFrom,
  }
})

// ─── Mock: @/lib/supabase/server (client autenticado — apenas auth.getUser) ──
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

// ─── Mock: @/lib/supabase/service (service role — bypassa RLS) ───────────────
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}))

import { markTherapistInviteUsedAction } from './therapist-invites'

afterEach(() => {
  vi.clearAllMocks()
})

describe('markTherapistInviteUsedAction', () => {
  it('Test 1: sem sessão → { ok:false, error:"Unauthenticated" }', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const result = await markTherapistInviteUsedAction('some-token-id')

    expect(result).toEqual({ ok: false, error: 'Unauthenticated' })
  })

  it('Test 2: tokenId vazio → { ok:false, error:"Token ausente." }', async () => {
    // Não chega a verificar sessão — retorno antecipado
    const result = await markTherapistInviteUsedAction('')

    expect(result).toEqual({ ok: false, error: 'Token ausente.' })
  })

  it('Test 3: token inexistente → UPDATE retorna 0 rows → { ok:false, error:"Convite não encontrado ou já usado." }', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await markTherapistInviteUsedAction('non-existent-token')

    expect(result).toEqual({ ok: false, error: 'Convite não encontrado ou já usado.' })
  })

  it('Test 4: token já usado (used_at non-NULL) → UPDATE WHERE used_at IS NULL não afeta row → { ok:false, error:"Convite não encontrado ou já usado." }', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } })
    // Idempotência: .is('used_at', null) filtra — se já usado, retorna null
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await markTherapistInviteUsedAction('already-used-token')

    expect(result).toEqual({ ok: false, error: 'Convite não encontrado ou já usado.' })
  })

  it('Test 5: happy path → UPDATE OK → { ok:true }', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } })
    mockMaybeSingle.mockResolvedValueOnce({ data: { token: 'valid-token' }, error: null })

    const result = await markTherapistInviteUsedAction('valid-token')

    expect(result).toEqual({ ok: true })
    // Confirma que o chain de mocks foi chamado com os parâmetros corretos
    expect(mockServiceFrom).toHaveBeenCalledWith('therapist_invites')
    expect(mockEq).toHaveBeenCalledWith('token', 'valid-token')
    expect(mockIs).toHaveBeenCalledWith('used_at', null)
  })

  it('Test 6: DB error → { ok:false, error:msg }', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } })

    const result = await markTherapistInviteUsedAction('some-token')

    expect(result).toEqual({ ok: false, error: 'connection refused' })
  })
})
