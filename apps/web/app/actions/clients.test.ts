import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`NEXT_REDIRECT:${p}`)
  }),
}))

// Chain mock: métodos encadeáveis retornam o próprio chain; chain é
// "thenable" (resolve `terminal`) p/ cobrir `await ...select().eq()`,
// `await ...update().eq()`, `await ...delete().eq()`; maybeSingle() resolve
// `maybeSingle`.
type Resolved = { terminal?: unknown; maybeSingle?: unknown }
function chain(resolved: Resolved): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  c.select = vi.fn(() => c)
  c.update = vi.fn(() => c)
  c.delete = vi.fn(() => c)
  c.eq = vi.fn(() => c)
  c.maybeSingle = vi.fn(() =>
    Promise.resolve(resolved.maybeSingle ?? { data: null, error: null }),
  )
  c.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    Promise.resolve(resolved.terminal ?? { data: [], error: null }).then(onF, onR)
  return c
}

const remove = vi.fn(async () => ({ error: null }) as { error: unknown })
const userFrom = vi.fn()
const serviceFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: (t: string) => userFrom(t),
    storage: { from: () => ({ remove }) },
  })),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: (t: string) => serviceFrom(t) })),
}))

import { deleteClientAction } from './clients'

const CLIENT = 'client-1'

beforeEach(() => {
  vi.clearAllMocks()
  remove.mockResolvedValue({ error: null })
})
afterEach(() => vi.restoreAllMocks())

function wireOwned(ownerFound: boolean) {
  userFrom.mockImplementation((t: string) => {
    if (t === 'clients')
      return chain({
        maybeSingle: { data: ownerFound ? { id: CLIENT } : null, error: null },
        terminal: { error: null },
      })
    if (t === 'readings')
      return chain({
        terminal: {
          data: [
            {
              id: 'r1',
              reading_images: [
                {
                  storage_path: 'u/r1/a.jpg',
                  canonical_storage_path: 'u/r1/a-c.jpg',
                },
                { storage_path: 'u/r1/b.jpg', canonical_storage_path: null },
              ],
            },
          ],
          error: null,
        },
      })
    return chain({})
  })
  serviceFrom.mockImplementation(() => chain({ terminal: { error: null } }))
}

describe('deleteClientAction — eliminação LGPD-completa (6 passos)', () => {
  it('aborta se não for dono (RLS nulo) — nenhuma op service-role/storage', async () => {
    wireOwned(false)
    const res = await deleteClientAction(CLIENT)
    expect(res.error).toBe('Cliente não encontrado.')
    expect(remove).not.toHaveBeenCalled()
    expect(serviceFrom).not.toHaveBeenCalled()
  })

  it('happy path: remove storage_path + canonical, anonimiza, zera gen, deleta', async () => {
    wireOwned(true)
    const res = await deleteClientAction(CLIENT)
    expect(res).toEqual({})
    expect(remove).toHaveBeenCalledWith([
      'u/r1/a.jpg',
      'u/r1/a-c.jpg',
      'u/r1/b.jpg',
    ])
    expect(serviceFrom).toHaveBeenCalledWith('client_consents')
    expect(serviceFrom).toHaveBeenCalledWith('report_generations')
  })

  it('storage falha → segue (best-effort, eliminação acontece)', async () => {
    wireOwned(true)
    remove.mockResolvedValue({ error: { message: 'storage down' } })
    const res = await deleteClientAction(CLIENT)
    expect(res).toEqual({})
    expect(serviceFrom).toHaveBeenCalled()
  })

  it('anonimização falha → segue (FK SET NULL é a rede; delete acontece)', async () => {
    wireOwned(true)
    serviceFrom.mockImplementation(() =>
      chain({ terminal: { error: { message: 'rls' } } }),
    )
    const res = await deleteClientAction(CLIENT)
    expect(res).toEqual({})
  })

  it('delete final falha → retorna erro', async () => {
    userFrom.mockImplementation((t: string) => {
      if (t === 'clients')
        return chain({
          maybeSingle: { data: { id: CLIENT }, error: null },
          terminal: { error: { message: 'delete boom' } },
        })
      if (t === 'readings')
        return chain({ terminal: { data: [], error: null } })
      return chain({})
    })
    serviceFrom.mockImplementation(() => chain({ terminal: { error: null } }))
    const res = await deleteClientAction(CLIENT)
    expect(res.error).toBe('delete boom')
  })
})
