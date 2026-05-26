import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// supabase mock factory com vi.hoisted (pattern Plan 06-11)
const { mockGetUser, mockUpdate, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn()
  const mockUpdate = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ update: mockUpdate }))
  const mockGetUser = vi.fn()

  return { mockGetUser, mockUpdate, mockEq, mockFrom }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}))

import { dismissOnboardingAction } from './onboarding'
import { revalidatePath } from 'next/cache'

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => vi.restoreAllMocks())

describe('dismissOnboardingAction', () => {
  it('Test 1: retorna {ok:false, error:"Unauthenticated"} quando sem sessão', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await dismissOnboardingAction()

    expect(result).toEqual({ ok: false, error: 'Unauthenticated' })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('Test 2: chama supabase.from("profiles").update({onboarding_dismissed_at}).eq("id", user.id) exatamente 1x', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc' } },
      error: null,
    })
    mockEq.mockResolvedValue({ error: null })

    await dismissOnboardingAction()

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ onboarding_dismissed_at: expect.any(String) }),
    )
    expect(mockEq).toHaveBeenCalledTimes(1)
    expect(mockEq).toHaveBeenCalledWith('id', 'user-abc')
  })

  it('Test 3: retorna {ok:true} e chama revalidatePath("/dashboard") 1x quando update OK', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc' } },
      error: null,
    })
    mockEq.mockResolvedValue({ error: null })

    const result = await dismissOnboardingAction()

    expect(result).toEqual({ ok: true })
    expect(revalidatePath).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('Test 4: retorna {ok:false, error:string} e NÃO chama revalidatePath quando update DB falha', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc' } },
      error: null,
    })
    mockEq.mockResolvedValue({ error: { message: 'db error' } })

    const result = await dismissOnboardingAction()

    expect(result).toEqual({ ok: false, error: 'db error' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('Test 5: timestamp passado pro update é ISO-8601 válido com sufixo Z', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc' } },
      error: null,
    })
    mockEq.mockResolvedValue({ error: null })

    await dismissOnboardingAction()

    const callArg = mockUpdate.mock.calls[0][0] as { onboarding_dismissed_at: string }
    const ts = callArg.onboarding_dismissed_at
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
    // Deve ser parseable como Data válida
    expect(() => new Date(ts)).not.toThrow()
    expect(new Date(ts).toISOString()).toBe(ts)
  })
})
