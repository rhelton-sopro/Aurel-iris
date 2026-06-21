import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 12 Plan 02 — Task 2 (IGPUB-01): refresh com buffer de 10d + health-check
// não-silencioso + token nunca vaza em logs.
//
// supabase-js (service-role) e global.fetch são mockados → ZERO rede real. O
// `app_settings` é um stub que casa o contrato read(maybeSingle)/upsert(onConflict).

// --- mock do service-role ---------------------------------------------------
// O módulo usa createServiceClient() de @/lib/supabase/service e o casta para um
// cliente untyped. Mockamos a fábrica e controlamos o que read/upsert devolvem.

const readValue = { current: null as unknown }
const upsertSpy = vi.fn()

vi.mock('@/lib/supabase/service', () => {
  const maybeSingle = vi.fn(async () => ({ data: { value: readValue.current }, error: null }))
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const upsert = vi.fn(async (...args: unknown[]) => {
    upsertSpy(...args)
    return { error: null }
  })
  const from = vi.fn(() => ({ select, upsert }))
  return {
    createServiceClient: vi.fn(() => ({ from })),
  }
})

// server-only é um no-op em test; o stub evita o throw fora do RSC.
vi.mock('server-only', () => ({}))

const ACCESS_TOKEN = 'OLD_SECRET_TOKEN_abc123'

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()
}

function setStoredToken(expiresInDays: number, accessToken = ACCESS_TOKEN) {
  readValue.current = {
    access_token: accessToken,
    expires_at: isoInDays(expiresInDays),
    obtained_at: isoInDays(-50),
    last_refresh_at: null,
  }
}

let fetchSpy: ReturnType<typeof vi.fn>
let errorSpy: ReturnType<typeof vi.spyOn>
let infoSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  readValue.current = null
  upsertSpy.mockClear()
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  errorSpy.mockRestore()
  infoSpy.mockRestore()
})

describe('refreshInstagramTokenIfNeeded (IGPUB-01 — refresh só <10d)', () => {
  it('token a 30 dias → { refreshed: false } e NÃO chama fetch', async () => {
    setStoredToken(30)
    const { refreshInstagramTokenIfNeeded } = await import('../token')

    const result = await refreshInstagramTokenIfNeeded()

    expect(result).toEqual({ refreshed: false })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('token a 5 dias → chama fetch(ig_refresh_token), faz upsert, { refreshed: true }', async () => {
    setStoredToken(5)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'NEW_TOKEN', expires_in: 5183944 }),
    })
    const { refreshInstagramTokenIfNeeded } = await import('../token')

    const result = await refreshInstagramTokenIfNeeded()

    expect(result).toEqual({ refreshed: true })
    // chamou o endpoint de refresh com o grant correto
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0])
    expect(calledUrl).toContain('refresh_access_token')
    expect(calledUrl).toContain('ig_refresh_token')
    expect(calledUrl).toContain('graph.instagram.com')
    // gravou o novo token + novo expires_at
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    const payload = upsertSpy.mock.calls[0]?.[0] as {
      key: string
      value: { access_token: string; expires_at: string; last_refresh_at: string | null }
    }
    expect(payload.key).toBe('instagram_token')
    expect(payload.value.access_token).toBe('NEW_TOKEN')
    expect(new Date(payload.value.expires_at).getTime()).toBeGreaterThan(Date.now())
    expect(payload.value.last_refresh_at).not.toBeNull()
  })

  it('sem token configurado → { refreshed: false, error } sem chamar fetch', async () => {
    readValue.current = null
    const { refreshInstagramTokenIfNeeded } = await import('../token')

    const result = await refreshInstagramTokenIfNeeded()

    expect(result.refreshed).toBe(false)
    expect(result.error).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('instagramHealthCheck (IGPUB-01 — falha não-silenciosa)', () => {
  it('GET /me 200 com id → { ok: true }', async () => {
    setStoredToken(30)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: '123' }),
    })
    const { instagramHealthCheck } = await import('../token')

    const result = await instagramHealthCheck()

    expect(result).toEqual({ ok: true })
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('fields=id')
  })

  it('GET /me 400 { error: { code: 190 } } → { ok: false } (detectado)', async () => {
    setStoredToken(30)
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 190, message: 'token inválido' } }),
    })
    const { instagramHealthCheck } = await import('../token')

    const result = await instagramHealthCheck()

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('segurança — o access_token nunca vaza em logs (T-12-04)', () => {
  it('mesmo em falha de refresh, nenhuma string logada contém o access_token', async () => {
    setStoredToken(5)
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 190, message: 'erro de refresh' } }),
    })
    const { refreshInstagramTokenIfNeeded } = await import('../token')

    await refreshInstagramTokenIfNeeded()

    const allLogged = [...errorSpy.mock.calls, ...infoSpy.mock.calls]
      .flat()
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' | ')
    expect(allLogged).not.toContain(ACCESS_TOKEN)
  })

  it('em falha de health-check, nenhuma string logada contém o access_token', async () => {
    setStoredToken(30)
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 190, message: 'sessão expirada' } }),
    })
    const { instagramHealthCheck } = await import('../token')

    await instagramHealthCheck()

    const allLogged = [...errorSpy.mock.calls, ...infoSpy.mock.calls]
      .flat()
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' | ')
    expect(allLogged).not.toContain(ACCESS_TOKEN)
  })
})
