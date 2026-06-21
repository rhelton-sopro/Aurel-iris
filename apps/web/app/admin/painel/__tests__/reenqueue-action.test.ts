import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 12 Plan 05 — Task 5 (D-04, IGPUB-06): reenqueuePostAction reseta um post
// em status='erro' de volta para 'agendado' (zera publish_attempts + limpa
// publish_error), founder-gated, com guarda dupla .eq(id).eq(status='erro').
//
// supabase-js (server + service-role), o gate founder, o núcleo de publicação e
// next/cache são mockados → ZERO rede/DB real. O builder do service-role captura
// o payload do UPDATE e a sequência de .eq para asserção.

const UUID = '11111111-2222-3333-4444-555555555555'

// --- estado controlável pelos testes --------------------------------------
const state = {
  isFounder: true,
  // payload capturado do .update(...)
  updatePayload: null as Record<string, unknown> | null,
  // pares capturados de .eq(col, val) na ordem
  eqCalls: [] as Array<[string, unknown]>,
  // erro devolvido pelo último .eq (encerra a cadeia)
  updateError: null as { message: string } | null,
}

function resetState() {
  state.isFounder = true
  state.updatePayload = null
  state.eqCalls = []
  state.updateError = null
}

// --- mock do gate founder ---------------------------------------------------
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { email: 'founder@test.com' } },
      })),
    },
  })),
}))

vi.mock('@/lib/auth/founder', () => ({
  isFounderEmail: vi.fn(() => state.isFounder),
}))

// --- mock do service-role ---------------------------------------------------
// .from('social_posts').update(payload).eq(id).eq(status,'erro') — o 2º .eq
// resolve a cadeia (thenable) devolvendo { error }.
vi.mock('@/lib/supabase/service', () => {
  function makeChain() {
    const result = { error: state.updateError }
    const chain: Record<string, unknown> = {}
    chain.update = (payload: Record<string, unknown>) => {
      state.updatePayload = payload
      return chain
    }
    chain.eq = (col: string, val: unknown) => {
      state.eqCalls.push([col, val])
      // thenable só quando os dois .eq já rodaram (id + status)
      return state.eqCalls.length >= 2
        ? Promise.resolve(result)
        : (chain as unknown)
    }
    return chain
  }
  return {
    createServiceClient: vi.fn(() => ({ from: vi.fn(() => makeChain()) })),
  }
})

// núcleo de publicação importado pelo módulo de actions — mock inerte.
vi.mock('@/lib/instagram/publish', () => ({
  publishPost: vi.fn(async () => ({ ok: true })),
}))

// next/cache + server-only no-op em test.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('server-only', () => ({}))

beforeEach(() => {
  resetState()
  vi.clearAllMocks()
})

describe('reenqueuePostAction (D-04, IGPUB-06)', () => {
  it('reset: erro → agendado, publish_attempts=0, publish_error=null', async () => {
    const { reenqueuePostAction } = await import('../actions')

    const res = await reenqueuePostAction(UUID)

    expect(res.ok).toBe(true)
    expect(state.updatePayload).toMatchObject({
      status: 'agendado',
      publish_attempts: 0,
      publish_error: null,
    })
  })

  it("guarda de estado: há DOIS .eq e o 2º é ('status', 'erro')", async () => {
    const { reenqueuePostAction } = await import('../actions')

    await reenqueuePostAction(UUID)

    expect(state.eqCalls).toHaveLength(2)
    expect(state.eqCalls[0]).toEqual(['id', UUID])
    expect(state.eqCalls[1]).toEqual(['status', 'erro'])
  })

  it('não-founder: bloqueado, UPDATE NÃO é chamado', async () => {
    state.isFounder = false
    const { reenqueuePostAction } = await import('../actions')

    const res = await reenqueuePostAction(UUID)

    expect(res.ok).toBe(false)
    expect(state.updatePayload).toBeNull()
    expect(state.eqCalls).toHaveLength(0)
  })

  it('id vazio: rejeita sem UPDATE', async () => {
    const { reenqueuePostAction } = await import('../actions')

    const res = await reenqueuePostAction('')

    expect(res.ok).toBe(false)
    expect(state.updatePayload).toBeNull()
  })
})
