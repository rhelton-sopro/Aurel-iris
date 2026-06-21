import { describe, expect, it, vi } from 'vitest'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

// Env de runtime lidas no top-level de publish.ts (hoisted antes dos imports ESM).
vi.hoisted(() => {
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '17841400000000000'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://iriscodex.com'
})

// O consumer de varredura (publishDuePosts) cria seu próprio service-role via
// createServiceClient — controlamos o que reap + claim_due devolvem por chamada,
// e mockamos getValidToken + fetch + server-only para um caminho de sucesso seco.
const sweepClaimResults: Array<{ data: unknown; error: { message: string } | null }> = []

vi.mock('@/lib/supabase/service', () => {
  const makeClient = () => ({
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'reap_stuck_publishing') return { data: 0, error: null }
      if (fn === 'claim_due_social_posts') {
        return sweepClaimResults.shift() ?? { data: [], error: null }
      }
      return { data: [], error: null }
    }),
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  })
  return { createServiceClient: vi.fn(makeClient) }
})

vi.mock('@/lib/instagram/token', () => ({ getValidToken: vi.fn(async () => 'TKN') }))
vi.mock('server-only', () => ({}))

import { claimDue, publishDuePosts } from '../publish'

// Fase 12 Plan 01 — Task 3 (Wave 0 contract da idempotência do claim, IGPUB-02).
//
// A RPC `claim_due_social_posts` (migration 0049) é o portão de idempotência: o
// claim atômico (`update ... where status='agendado' ... for update skip locked
// returning *`) garante que dois cron runs sobrepostos NUNCA reivindiquem a mesma
// row, e que um post `publicado` JAMAIS seja re-reivindicado (não casa o WHERE).
//
// supabase-js é mockado (sem rede): testamos o CONTRATO consumido por
// publishDuePosts (Plan 03, Wave 2). O Plan 03 estende este arquivo com os casos
// substantivos do pipeline completo; aqui já gravamos os 2 casos de idempotência.

/**
 * Stub de service-role cujo `.rpc('claim_due_social_posts', ...)` resolve, na
 * ordem das chamadas, com os valores de `rpcResults`. Simula a concorrência:
 * a 1ª passada reivindica linhas, a 2ª recebe [] porque o status já mudou.
 */
function makeServiceStub(
  rpcResults: Array<{ data: unknown; error: { message: string } | null }>,
) {
  const rpc = vi.fn()
  for (const r of rpcResults) rpc.mockResolvedValueOnce(r)
  // default para chamadas extras
  rpc.mockResolvedValue({ data: [], error: null })
  return { rpc } as unknown as SupabaseClient<Database>
}

describe('claimDue (idempotência do claim — IGPUB-02)', () => {
  it('reivindica 2 na 1ª passada e 0 na 2ª (concorrência: status já mudou)', async () => {
    const row = (id: string) => ({
      id,
      status: 'publicando',
      format: 'post',
      caption: '',
    })
    const service = makeServiceStub([
      { data: [row('a'), row('b')], error: null }, // 1ª passada: 2 reivindicados
      { data: [], error: null }, //                  2ª passada: nada (já em publicando)
    ])

    const first = await claimDue(service, 10)
    expect(first).toHaveLength(2)
    expect(first.map((p) => p.id)).toEqual(['a', 'b'])

    const second = await claimDue(service, 10)
    expect(second).toHaveLength(0)

    // chamou a RPC certa, com o cap p_limit
    expect((service.rpc as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'claim_due_social_posts',
      { p_limit: 10 },
    )
  })

  it('nunca devolve um post já publicado (a RPC só casa status=agendado)', async () => {
    // O stub espelha o banco: o WHERE status='agendado' filtra publicados FORA do
    // retorno. Mesmo que exista um post 'publicado' no banco, ele jamais aparece
    // no array do claim → o consumidor nunca tenta re-publicá-lo.
    const service = makeServiceStub([{ data: [], error: null }])

    const claimed = await claimDue(service, 10)
    expect(claimed).toHaveLength(0)
    expect(claimed.some((p) => p.status === 'publicado')).toBe(false)
  })

  it('propaga erro da RPC como exceção (caller decide o que fazer)', async () => {
    const service = makeServiceStub([
      { data: null, error: { message: 'boom' } },
    ])
    await expect(claimDue(service, 5)).rejects.toThrow(/boom/)
  })
})

describe('publishDuePosts (idempotência ponta-a-ponta — IGPUB-02)', () => {
  it('processa exatamente 2 posts na 1ª varredura e 0 na 2ª (status já mudou)', async () => {
    const postRow = (id: string) => ({
      id,
      format: 'post',
      status: 'publicando',
      caption: '',
      media: { kind: 'post', image: `/${id}.png` },
      publish_attempts: 1,
    })

    // mock fetch: container → media_publish → permalink (sucesso seco)
    let fetchCalls = 0
    const fetchFn = vi.fn(async (url: string) => {
      fetchCalls += 1
      const id = `MEDIA_${fetchCalls}`
      if (String(url).includes('/media_publish')) {
        return { ok: true, status: 200, json: async () => ({ id }) } as unknown as Response
      }
      if (String(url).includes('/media')) {
        return { ok: true, status: 200, json: async () => ({ id }) } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id, permalink: 'https://instagr.am/p/x' }),
      } as unknown as Response
    })
    // @ts-expect-error mock global fetch
    global.fetch = fetchFn

    // 1ª varredura reivindica 2; 2ª recebe [] (concorrência: status já mudou).
    sweepClaimResults.length = 0
    sweepClaimResults.push({ data: [postRow('a'), postRow('b')], error: null })
    sweepClaimResults.push({ data: [], error: null })

    const first = await publishDuePosts()
    expect(first.published).toBe(2)

    const second = await publishDuePosts()
    expect(second.published).toBe(0)
    expect(second.retried).toBe(0)
    expect(second.failed).toBe(0)

    vi.restoreAllMocks()
  })

  it('um post publicado nunca chega ao consumidor (a RPC só casa status=agendado)', async () => {
    // a RPC já filtra publicados FORA do retorno → o consumer recebe [] e não publica.
    sweepClaimResults.length = 0
    sweepClaimResults.push({ data: [], error: null })
    const r = await publishDuePosts()
    expect(r.published).toBe(0)
    expect(r.failed).toBe(0)
  })
})
