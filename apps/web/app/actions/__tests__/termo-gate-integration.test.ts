import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock chains (espelham builders thenable do Supabase usados em readings.ts) ──
const getUserMock = vi.fn()
const selectChain = {
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
}
const insertChain = { select: vi.fn().mockReturnThis(), single: vi.fn() }
// delete().eq('id').eq('therapist_id') é AWAITED — chain thenable que resolve
// { error: null }. eq sempre retorna o próprio chain.
const deleteChain = {
  eq: vi.fn().mockReturnThis(),
  then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => selectChain,
      insert: () => insertChain,
      delete: () => deleteChain,
    }),
  }),
}))

// redirect lança throw (como o Next real) — capturamos pra assertar destino.
class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Gate + dependências do credit path mockadas.
vi.mock('@/lib/gates/termo-gate', () => ({
  assertClientTermoSigned: vi.fn(),
}))
vi.mock('@/lib/gates/client-gates', () => ({
  resolveClientGate: () => ({ status: 'ok' }),
}))
vi.mock('@/lib/billing/credits', () => ({
  reserveCreditForReading: vi.fn(),
}))
vi.mock('@/lib/audit/log', () => ({ logAuditEvent: vi.fn() }))

import { createReadingAction } from '../readings'
import { assertClientTermoSigned } from '@/lib/gates/termo-gate'
import { reserveCreditForReading } from '@/lib/billing/credits'

const CLIENT_ID = '11111111-1111-4111-8111-111111111111'

function buildFormData(): FormData {
  const fd = new FormData()
  fd.set('client_id', CLIENT_ID)
  fd.set('method', 'mobile_camera')
  return fd
}

describe('createReadingAction — termo gate (BILLING-03 / LGPD-01 D-19)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectChain.eq.mockReturnThis()
    insertChain.select.mockReturnThis()
    deleteChain.eq.mockReturnThis()
    getUserMock.mockResolvedValue({
      data: { user: { id: 'therapist-1', email: 't@x.com' } },
      error: null,
    })
    // completeness gate carrega o client (dados completos → resolveClientGate ok)
    selectChain.maybeSingle.mockResolvedValue({
      data: {
        id: CLIENT_ID,
        full_name: 'Maria',
        birth_date: '1990-01-01',
        biological_sex: 'feminino',
        email: 'm@x.com',
        phone: '11999999999',
      },
      error: null,
    })
  })

  it('blocks when client termo not signed (antes de reservar crédito)', async () => {
    vi.mocked(assertClientTermoSigned).mockResolvedValueOnce({
      ok: false,
      reason: 'termo_missing',
    })

    const r = await createReadingAction({}, buildFormData())

    expect(typeof r.error).toBe('string')
    expect(r.error).toContain('Termo de Consentimento')
    expect(r.error).toContain('/termo')
    // Gate ANTES do credit gate: reserveCreditForReading nunca é chamado.
    expect(reserveCreditForReading).not.toHaveBeenCalled()
  })

  it('returns "Cliente não encontrado" quando gate reporta client_not_found', async () => {
    vi.mocked(assertClientTermoSigned).mockResolvedValueOnce({
      ok: false,
      reason: 'client_not_found',
    })

    const r = await createReadingAction({}, buildFormData())
    expect(r.error).toBe('Cliente não encontrado.')
    expect(reserveCreditForReading).not.toHaveBeenCalled()
  })

  it('termo assinado → cria reading e redireciona pra captura, SEM reservar crédito (gate migrou pra geração)', async () => {
    vi.mocked(assertClientTermoSigned).mockResolvedValueOnce({
      ok: true,
      signed_at: '2026-05-27T10:00:00Z',
      term_version: 'v1',
    })
    // INSERT reading → retorna id
    insertChain.single.mockResolvedValueOnce({
      data: { id: 'reading-1' },
      error: null,
    })

    // Fase 8 redesign (consume-na-geração): createReadingAction NÃO reserva mais
    // crédito. Termo OK → cria reading → redirect pra captura (o redirect mockado
    // lança 'REDIRECT:<path>'). O gate de crédito vive no /analyze, não aqui.
    await expect(createReadingAction({}, buildFormData())).rejects.toThrow(
      /REDIRECT:\/leituras\/nova\/capturar\?reading=reading-1/,
    )
    expect(reserveCreditForReading).not.toHaveBeenCalled()
  })
})
