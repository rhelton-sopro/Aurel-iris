import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 12 Plan 03 — Task 2 (IGPUB-03/04/05/06 + D-03): o pipeline de publicação
// com o Graph fetch TODO mockado (zero rede).
//
// Mockamos:
//   - @/lib/supabase/service  → service-role stub: .rpc(claim_one/reap) + .from().update().eq()
//   - @/lib/instagram/token   → getValidToken() = 'TKN'
//   - global.fetch            → roteado por URL/params (container/poll/publish/permalink)
//   - server-only             → no-op fora do RSC
//
// As env de runtime precisam existir ANTES do import do módulo (são lidas em
// top-level): INSTAGRAM_BUSINESS_ACCOUNT_ID + NEXT_PUBLIC_SITE_URL.

// As env de runtime são lidas no top-level do módulo `publish.ts`. Como o ESM
// içа os `import` acima de qualquer statement, setamos as env num bloco hoisted
// que o vitest executa ANTES dos imports.
vi.hoisted(() => {
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '17841400000000000'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://iriscodex.com'
})

// --- captura dos UPDATEs no banco -------------------------------------------
// Cada .from('social_posts').update(payload).eq('id', id) empilha o payload aqui.
interface CapturedUpdate {
  payload: Record<string, unknown>
  id: string
}
const updates: CapturedUpdate[] = []

// Controla o que claim_one / reap devolvem por teste.
const rpcResults = new Map<string, { data: unknown; error: { message: string } | null }>()

vi.mock('@/lib/supabase/service', () => {
  const makeClient = () => ({
    rpc: vi.fn(async (fn: string) => {
      return (
        rpcResults.get(fn) ?? { data: fn === 'reap_stuck_publishing' ? 0 : [], error: null }
      )
    }),
    from: vi.fn(() => ({
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn(async (_col: string, id: string) => {
          updates.push({ payload, id })
          return { error: null }
        }),
      })),
    })),
  })
  return { createServiceClient: vi.fn(makeClient) }
})

vi.mock('@/lib/instagram/token', () => ({
  getValidToken: vi.fn(async () => 'TKN'),
}))

vi.mock('server-only', () => ({}))

import type { SocialPost } from '@/lib/admin/social-posts'

import { publishPost } from '../publish'

// --- helpers ----------------------------------------------------------------
function jsonRes(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

/** Empilha respostas de fetch na ordem; default = container genérico. */
function makeFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return handler(url, init)
  })
  // @ts-expect-error mock global fetch
  global.fetch = fn
  return calls
}

/** Lê os params de um POST x-www-form-urlencoded do mock fetch. */
function bodyParams(init?: RequestInit): URLSearchParams {
  return new URLSearchParams((init?.body as string) ?? '')
}

const VALID_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function claimReturns(post: Partial<SocialPost>) {
  rpcResults.set('claim_one_social_post', {
    data: [
      {
        id: VALID_ID,
        format: 'post',
        status: 'publicando',
        caption: '',
        media: {},
        publish_attempts: 1,
        ...post,
      },
    ],
    error: null,
  })
}

beforeEach(() => {
  updates.length = 0
  rpcResults.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('publishPost — pipeline de publicação (Graph mockado)', () => {
  it('IGPUB-03 carrossel: 3 child containers na ordem → parent CAROUSEL → media_publish', async () => {
    claimReturns({
      format: 'carrossel',
      caption: 'capa\n#iris',
      media: { kind: 'carrossel', slides: ['/a.png', '/b.png', '/c.png'] },
    })

    let childCount = 0
    const childIds: string[] = []
    const calls = makeFetch((url, init) => {
      const params = bodyParams(init)
      if (url.includes('/media_publish')) return jsonRes({ id: 'MEDIA_1' })
      if (url.includes('/media') && init?.method === 'POST') {
        if (params.get('is_carousel_item') === 'true') {
          const id = `CHILD_${++childCount}`
          childIds.push(id)
          return jsonRes({ id })
        }
        // parent CAROUSEL
        return jsonRes({ id: 'PARENT_1' })
      }
      // GET permalink
      return jsonRes({ id: 'MEDIA_1', permalink: 'https://instagr.am/p/1' })
    })

    const r = await publishPost(VALID_ID)
    expect(r.ok).toBe(true)

    // 3 child POSTs com is_carousel_item=true
    const childPosts = calls.filter(
      (c) => c.init?.method === 'POST' && bodyParams(c.init).get('is_carousel_item') === 'true',
    )
    expect(childPosts).toHaveLength(3)
    expect(childPosts.map((c) => bodyParams(c.init).get('image_url'))).toEqual([
      'https://iriscodex.com/a.png',
      'https://iriscodex.com/b.png',
      'https://iriscodex.com/c.png',
    ])

    // parent CAROUSEL com children NA ORDEM
    const parent = calls.find(
      (c) => c.init?.method === 'POST' && bodyParams(c.init).get('media_type') === 'CAROUSEL',
    )
    expect(parent).toBeDefined()
    expect(bodyParams(parent!.init).get('children')).toBe(childIds.join(','))

    // media_publish chamado uma vez
    expect(calls.filter((c) => c.url.includes('/media_publish'))).toHaveLength(1)
  })

  it('IGPUB-04 reel: só publica APÓS status_code=FINISHED (não publica em IN_PROGRESS)', async () => {
    vi.useFakeTimers()
    claimReturns({
      format: 'reel',
      caption: 'reel cap',
      media: { kind: 'reel', video: '/reel.mp4' },
    })

    let pollCount = 0
    const calls = makeFetch((url) => {
      if (url.includes('/media_publish')) return jsonRes({ id: 'MEDIA_REEL' })
      if (url.includes('status_code')) {
        pollCount += 1
        return jsonRes({ status_code: pollCount === 1 ? 'IN_PROGRESS' : 'FINISHED' })
      }
      if (url.includes('/media')) return jsonRes({ id: 'REEL_CONTAINER' })
      return jsonRes({ id: 'MEDIA_REEL', permalink: 'https://instagr.am/reel/1' })
    })

    const p = publishPost(VALID_ID)
    // avança os timers do poll (8s interval)
    await vi.advanceTimersByTimeAsync(10_000)
    const r = await p
    vi.useRealTimers()

    // enquanto IN_PROGRESS, media_publish NÃO pode ter sido chamado
    const publishOrder = calls.findIndex((c) => c.url.includes('/media_publish'))
    const firstFinishedOrder = calls.findIndex((c) => c.url.includes('status_code'))
    expect(publishOrder).toBeGreaterThan(firstFinishedOrder)
    expect(pollCount).toBe(2)
    expect(r.ok).toBe(true)
  })

  it('IGPUB-04 reel ERROR: status_code=ERROR → status final "erro", nunca "publicado"', async () => {
    claimReturns({
      format: 'reel',
      caption: 'reel ruim',
      media: { kind: 'reel', video: '/bad.mp4' },
      publish_attempts: 1,
    })
    makeFetch((url) => {
      if (url.includes('/media_publish')) return jsonRes({ id: 'X' })
      if (url.includes('status_code')) return jsonRes({ status_code: 'ERROR' })
      if (url.includes('/media')) return jsonRes({ id: 'C1' })
      return jsonRes({ id: 'X' })
    })

    const r = await publishPost(VALID_ID)
    expect(r.ok).toBe(false)
    const last = updates.at(-1)!
    expect(last.payload.status).toBe('erro')
    expect(last.payload.publish_error).toBeTruthy()
    // nunca gravou publicado
    expect(updates.some((u) => u.payload.status === 'publicado')).toBe(false)
  })

  it('IGPUB-05 caption: o container parent leva a caption do post', async () => {
    claimReturns({
      format: 'post',
      caption: 'minha legenda #saude',
      media: { kind: 'post', image: '/x.png' },
    })
    const calls = makeFetch((url) => {
      if (url.includes('/media_publish')) return jsonRes({ id: 'M' })
      if (url.includes('/media')) return jsonRes({ id: 'CONT' })
      return jsonRes({ id: 'M', permalink: 'https://instagr.am/p/x' })
    })

    await publishPost(VALID_ID)
    const container = calls.find(
      (c) => c.init?.method === 'POST' && c.url.includes('/media'),
    )
    expect(bodyParams(container!.init).get('caption')).toBe('minha legenda #saude')
  })

  it('IGPUB-06 sucesso: grava ig_media_id + ig_permalink + status publicado', async () => {
    claimReturns({
      format: 'post',
      caption: 'ok',
      media: { kind: 'post', image: '/ok.png' },
    })
    makeFetch((url) => {
      if (url.includes('/media_publish')) return jsonRes({ id: 'MEDIA_OK' })
      if (url.includes('/media')) return jsonRes({ id: 'CONT_OK' })
      return jsonRes({ id: 'MEDIA_OK', permalink: 'https://instagr.am/p/ok' })
    })

    const r = await publishPost(VALID_ID)
    expect(r.ok).toBe(true)
    expect(r.mediaId).toBe('MEDIA_OK')
    expect(r.permalink).toBe('https://instagr.am/p/ok')

    const success = updates.find((u) => u.payload.status === 'publicado')!
    expect(success).toBeDefined()
    expect(success.payload.ig_media_id).toBe('MEDIA_OK')
    expect(success.payload.ig_permalink).toBe('https://instagr.am/p/ok')
  })

  it('D-03 retryável: code 9007 + publish_attempts<3 → status volta a "agendado"', async () => {
    claimReturns({
      format: 'post',
      caption: 'r',
      media: { kind: 'post', image: '/r.png' },
      publish_attempts: 1,
    })
    makeFetch((url) => {
      // o POST do container falha com code 9007 (mídia ainda processando)
      if (url.includes('/media')) {
        return jsonRes({ error: { code: 9007, message: 'media not ready' } }, false, 400)
      }
      return jsonRes({ id: 'X' })
    })

    const r = await publishPost(VALID_ID)
    expect(r.ok).toBe(false)
    expect(r.retried).toBe(true)
    const last = updates.at(-1)!
    expect(last.payload.status).toBe('agendado')
    expect(updates.some((u) => u.payload.status === 'publicado')).toBe(false)
    expect(updates.some((u) => u.payload.status === 'erro')).toBe(false)
  })

  it('D-03 permanente: code 24 → status "erro" + motivo', async () => {
    claimReturns({
      format: 'post',
      caption: 'p',
      media: { kind: 'post', image: '/p.png' },
      publish_attempts: 1,
    })
    makeFetch((url) => {
      if (url.includes('/media')) {
        return jsonRes({ error: { code: 24, message: 'permission denied' } }, false, 400)
      }
      return jsonRes({ id: 'X' })
    })

    const r = await publishPost(VALID_ID)
    expect(r.ok).toBe(false)
    const last = updates.at(-1)!
    expect(last.payload.status).toBe('erro')
    expect(last.payload.publish_error).toContain('permission denied')
  })

  it('D-03 esgotado: erro retryável mas publish_attempts=3 → status "erro"', async () => {
    claimReturns({
      format: 'post',
      caption: 'e',
      media: { kind: 'post', image: '/e.png' },
      publish_attempts: 3,
    })
    makeFetch((url) => {
      if (url.includes('/media')) {
        return jsonRes({ error: { code: 9007, message: 'still processing' } }, false, 400)
      }
      return jsonRes({ id: 'X' })
    })

    const r = await publishPost(VALID_ID)
    expect(r.ok).toBe(false)
    expect(r.retried).toBeFalsy()
    const last = updates.at(-1)!
    expect(last.payload.status).toBe('erro')
  })

  it('id inválido → não-publicável sem tocar a rede', async () => {
    const fetchSpy = makeFetch(() => jsonRes({}))
    const r = await publishPost('não-é-uuid')
    expect(r.ok).toBe(false)
    expect(fetchSpy).toHaveLength(0)
  })

  it('claim devolve 0 rows → não-publicável (já publicado ou em andamento)', async () => {
    rpcResults.set('claim_one_social_post', { data: [], error: null })
    const r = await publishPost(VALID_ID)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/não-publicável/)
  })
})
