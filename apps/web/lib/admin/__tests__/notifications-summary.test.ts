import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 12 Plan 04 — Task 3 (IGPUB-06 + IGPUB-01/D-07): a central de notificações
// expõe falhas de publicação (social_posts status='erro') e o sinal de saúde do
// token do IG (app_settings.instagram_health.value.ok). Sucesso é silencioso
// (D-05) e cada fonte é best-effort (uma falha NUNCA quebra o /admin).
//
// supabase-js (service-role) e o IMAP são mockados → ZERO rede real. O `from`
// roteia por nome de tabela: social_posts devolve um count; app_settings devolve
// um value via maybeSingle. As demais tabelas devolvem defaults inertes.

// --- estado controlável pelos testes ---------------------------------------
const state = {
  // contagem por status pra social_posts ('erro' vs outros)
  socialPostsErrorCount: 0,
  // dispara erro na query de social_posts (best-effort path)
  socialPostsThrows: false,
  // valor cru de app_settings.instagram_health.value (null = flag ausente)
  instagramHealthValue: null as unknown,
}

// --- mock do service-role ---------------------------------------------------
// getAdminNotifications consulta várias tabelas; o `from` precisa rotear por
// nome. Cada builder é thenable (resolve { count } ou { data }) e encadeável.
vi.mock('@/lib/supabase/service', () => {
  function makeCountBuilder(resolve: () => { count: number; error: unknown }) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = chain
    builder.eq = chain
    builder.lt = chain
    builder.gte = chain
    builder.in = chain
    builder.order = chain
    builder.limit = chain
    // thenable: `await builder` resolve o count
    builder.then = (onFulfilled: (v: { count: number; error: unknown }) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled)
    return builder
  }

  function from(table: string) {
    if (table === 'social_posts') {
      return makeCountBuilder(() => {
        if (state.socialPostsThrows) throw new Error('boom social_posts')
        return { count: state.socialPostsErrorCount, error: null }
      })
    }
    if (table === 'app_settings') {
      const maybeSingle = vi.fn(async () => ({
        data: state.instagramHealthValue === null ? null : { value: state.instagramHealthValue },
        error: null,
      }))
      const eq = vi.fn(() => ({ maybeSingle }))
      const select = vi.fn(() => ({ eq }))
      return { select }
    }
    // demais tabelas (customer_credits, credit_transactions, audit_events):
    // defaults inertes — count 0, data vazio.
    return makeCountBuilder(() => ({ count: 0, error: null }))
  }

  return {
    createServiceClient: vi.fn(() => ({ from })),
  }
})

// IMAP mockado → sem TCP. Default 0 não-lidos.
vi.mock('@/lib/email/imap-client', () => ({
  getUnreadCount: vi.fn(async () => 0),
}))

// server-only é um no-op em test.
vi.mock('server-only', () => ({}))

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  state.socialPostsErrorCount = 0
  state.socialPostsThrows = false
  state.instagramHealthValue = null
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
  vi.clearAllMocks()
})

describe('getAdminNotifications — publishErrors (IGPUB-06, D-04)', () => {
  it('2 posts em status=erro → publishErrors === 2', async () => {
    state.socialPostsErrorCount = 2
    const { getAdminNotifications } = await import('../notifications-summary')

    const notif = await getAdminNotifications()

    expect(notif.publishErrors).toBe(2)
  })

  it("sucesso é silencioso: posts 'publicado' NÃO contam (só status=erro)", async () => {
    // o mock só conta o que cai no ramo erro; 'publicado' nunca incrementa.
    state.socialPostsErrorCount = 0
    const { getAdminNotifications } = await import('../notifications-summary')

    const notif = await getAdminNotifications()

    expect(notif.publishErrors).toBe(0)
  })

  it('best-effort: se a query de social_posts lança, publishErrors === 0 e nada quebra', async () => {
    state.socialPostsThrows = true
    const { getAdminNotifications } = await import('../notifications-summary')

    const notif = await getAdminNotifications()

    expect(notif.publishErrors).toBe(0)
    // o restante segue válido (não quebrou o /admin)
    expect(typeof notif.unreadEmails).toBe('number')
    expect(typeof notif.instagramAuthError).toBe('boolean')
  })
})

describe('getAdminNotifications — instagramAuthError (IGPUB-01, D-07)', () => {
  it('instagram_health.value = { ok: false } → instagramAuthError === true', async () => {
    state.instagramHealthValue = { ok: false }
    const { getAdminNotifications } = await import('../notifications-summary')

    const notif = await getAdminNotifications()

    expect(notif.instagramAuthError).toBe(true)
  })

  it('instagram_health = { ok: true } → instagramAuthError === false', async () => {
    state.instagramHealthValue = { ok: true }
    const { getAdminNotifications } = await import('../notifications-summary')

    const notif = await getAdminNotifications()

    expect(notif.instagramAuthError).toBe(false)
  })

  it('flag ausente (Plan 05 ainda não rodou) → instagramAuthError === false (não é regressão)', async () => {
    state.instagramHealthValue = null
    const { getAdminNotifications } = await import('../notifications-summary')

    const notif = await getAdminNotifications()

    expect(notif.instagramAuthError).toBe(false)
  })
})
