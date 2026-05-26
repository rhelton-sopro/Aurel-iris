import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ─── vi.hoisted: factories para mocks ────────────────────────────────────────
const {
  mockGetUser,
  mockListUsers,
  mockInsert,
  mockSingle,
  mockFrom,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ single: mockSingle }))
  const mockInsert = vi.fn(() => ({ select: mockSelect }))
  const mockFrom = vi.fn(() => ({ insert: mockInsert }))
  const mockListUsers = vi.fn()
  const mockGetUser = vi.fn()

  return {
    mockGetUser,
    mockListUsers,
    mockInsert,
    mockSelect,
    mockSingle,
    mockFrom,
  }
})

// ─── Mock: @/lib/supabase/server (client autenticado — apenas auth.getUser) ──
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

// ─── Mock: @/lib/supabase/service (service role — from + auth.admin) ─────────
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    auth: {
      admin: {
        listUsers: mockListUsers,
      },
    },
  })),
}))

// ─── Mock: @/lib/auth/founder ─────────────────────────────────────────────────
vi.mock('@/lib/auth/founder', () => ({
  isFounderEmail: (email: string | null | undefined) => {
    if (!email) return false
    return email.toLowerCase().trim() === 'founder@iriscodex.com'
  },
}))

// ─── Import SUT (após mocks) ──────────────────────────────────────────────────
import { inviteTherapistAction } from './admin-therapists'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const founderUser = { id: 'founder-uuid', email: 'founder@iriscodex.com' }
const newTherapistEmail = 'newtherapist@example.com'
const TOKEN = 'fake-uuid-token'
const SITE_URL = 'https://iriscodex.com'

beforeEach(() => {
  vi.clearAllMocks()
  // Garante que process.env.NEXT_PUBLIC_SITE_URL existe em todos os tests
  process.env.NEXT_PUBLIC_SITE_URL = SITE_URL
})
afterEach(() => vi.restoreAllMocks())

// ─── Helpers de setup ─────────────────────────────────────────────────────────
function setupFounderSession() {
  mockGetUser.mockResolvedValue({
    data: { user: founderUser },
    error: null,
  })
}

function setupListUsersEmpty() {
  mockListUsers.mockResolvedValue({
    data: { users: [], total: 0, nextPage: null, lastPage: 1 },
    error: null,
  })
}

function setupInsertOk() {
  mockSingle.mockResolvedValue({
    data: { token: TOKEN },
    error: null,
  })
}

// ─── Suíte ───────────────────────────────────────────────────────────────────
describe('inviteTherapistAction', () => {
  it('Test 1: não-founder recebe { ok:false, error:"Não autorizado." }', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'random-uuid', email: 'random@example.com' } },
      error: null,
    })

    const result = await inviteTherapistAction(newTherapistEmail)

    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
    // Nenhum INSERT deve ter ocorrido
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('Test 2: email inválido recebe { ok:false, error:"E-mail inválido." }', async () => {
    setupFounderSession()

    const result = await inviteTherapistAction('not-an-email')

    expect(result).toEqual({ ok: false, error: 'E-mail inválido.' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('Test 3: founder próprio email recebe { ok:false, error:"Não dá pra convidar o founder a si mesmo." }', async () => {
    setupFounderSession()

    const result = await inviteTherapistAction('founder@iriscodex.com')

    expect(result).toEqual({
      ok: false,
      error: 'Não dá pra convidar o founder a si mesmo.',
    })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('Test 4: email já em auth.users → { ok:false, error:"E-mail já cadastrado como terapeuta neste sistema." } e NÃO chama insert()', async () => {
    setupFounderSession()
    // Simula auth.users contendo o email alvo
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'existing-uuid', email: newTherapistEmail },
        ],
        total: 1,
        nextPage: null,
        lastPage: 1,
      },
      error: null,
    })

    const result = await inviteTherapistAction(newTherapistEmail)

    expect(result).toEqual({
      ok: false,
      error: 'E-mail já cadastrado como terapeuta neste sistema.',
    })
    // D-DUPE: NÃO deve prosseguir para INSERT
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('Test 5: email novo + INSERT OK → { ok:true, actionLink, userStatus:"new_invited", email }', async () => {
    setupFounderSession()
    setupListUsersEmpty()
    setupInsertOk()

    const result = await inviteTherapistAction(newTherapistEmail)

    expect(result).toEqual({
      ok: true,
      actionLink: `${SITE_URL}/convite-terapeuta/${TOKEN}`,
      userStatus: 'new_invited',
      email: newTherapistEmail,
    })
    // Deve ter chamado insert em therapist_invites
    expect(mockFrom).toHaveBeenCalledWith('therapist_invites')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: newTherapistEmail,
        invited_by: founderUser.id,
      }),
    )
  })

  it('Test 6: email novo + INSERT falha → { ok:false, error:"Falha ao criar convite: ..." }', async () => {
    setupFounderSession()
    setupListUsersEmpty()
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'db constraint violation' },
    })

    const result = await inviteTherapistAction(newTherapistEmail)

    expect(result).toEqual({
      ok: false,
      error: 'Falha ao criar convite: db constraint violation',
    })
  })

  it('Test 7: listUsers faz matching case-insensitive (uppercase email no auth.users deve bloquear lowercase no input)', async () => {
    setupFounderSession()
    // auth.users contém email com maiúsculas
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'existing-uuid', email: 'NewTherapist@Example.COM' },
        ],
        total: 1,
        nextPage: null,
        lastPage: 1,
      },
      error: null,
    })

    // Input em lowercase deve ser bloqueado pelo D-DUPE (compare case-insensitive)
    const result = await inviteTherapistAction('newtherapist@example.com')

    expect(result).toEqual({
      ok: false,
      error: 'E-mail já cadastrado como terapeuta neste sistema.',
    })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('Test 8: lista truncada (total > 1000) retorna erro explícito em vez de falso-negativo silencioso', async () => {
    setupFounderSession()
    // Simula > 1000 usuários: total=1001 mas users[] tem só 1000 itens — não contém o email
    mockListUsers.mockResolvedValue({
      data: {
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: `uuid-${i}`,
          email: `user${i}@example.com`,
        })),
        total: 1001,
        nextPage: 2,
        lastPage: 2,
      },
      error: null,
    })

    const result = await inviteTherapistAction(newTherapistEmail)

    expect(result).toEqual({
      ok: false,
      error: 'Não foi possível validar o e-mail: base de usuários muito grande. Contate o suporte.',
    })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
