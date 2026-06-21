import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 12 Plan 05 — Task 6 (T-12-16): o cron horário de publicação rejeita
// fail-closed qualquer requisição sem o Bearer CRON_SECRET correto (401,
// timing-safe), e só no caminho feliz chama publishDuePosts(). publishDuePosts é
// mockado → ZERO rede/DB real.

vi.mock('@/lib/instagram/publish', () => ({
  publishDuePosts: vi.fn(async () => ({
    published: 0,
    retried: 0,
    failed: 0,
    errors: 0,
  })),
}))

import * as publish from '@/lib/instagram/publish'

import { GET } from '../instagram-publish/route'

function makeReq(token?: string): Parameters<typeof GET>[0] {
  return new Request('https://test/api/cron/instagram-publish', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/instagram-publish — auth gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'sekret'
  })

  it('401 quando o header Authorization está ausente', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    expect(publish.publishDuePosts).not.toHaveBeenCalled()
  })

  it('401 quando o Bearer está errado', async () => {
    const res = await GET(makeReq('wrong'))
    expect(res.status).toBe(401)
    expect(publish.publishDuePosts).not.toHaveBeenCalled()
  })

  it('401 (misconfigured) e SEM worker quando CRON_SECRET está ausente', async () => {
    delete process.env.CRON_SECRET
    // ataque fail-open clássico: mandar literalmente "undefined".
    const res = await GET(makeReq('undefined'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('misconfigured')
    expect(publish.publishDuePosts).not.toHaveBeenCalled()
  })

  it('200 e chama publishDuePosts 1× quando o Bearer está correto', async () => {
    const res = await GET(makeReq('sekret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(publish.publishDuePosts).toHaveBeenCalledOnce()
  })
})
