import { describe, expect, it, vi } from 'vitest'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import { claimDue } from '../publish'

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
