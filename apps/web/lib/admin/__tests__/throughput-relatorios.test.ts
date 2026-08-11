import { describe, expect, it, vi } from 'vitest'

/**
 * "Relatórios gerados" ≠ "capturas iniciadas" (founder, 2026-08-10).
 *
 * O painel somava toda leitura CRIADA numa coluna só. Uma leitura nasce quando
 * alguém abre a tela de captura, então uma terapeuta nova aparecia com "4 leituras"
 * e nenhuma compra — e a conclusão natural era furo na cobrança. Eram 3 tentativas
 * abandonadas (0, 0 e 1 foto) e 1 relatório, esse pago pela trial. Desde 01/07, 28%
 * do número exibido nunca virou relatório.
 *
 * Estes testes seguram a separação: o que consome crédito é relatório gerado.
 */
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (tabela: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'gte', 'lte', 'eq']) chain[m] = () => chain
      chain.then = (onF: (v: unknown) => unknown) =>
        Promise.resolve({
          data: tabela === 'readings' ? LEITURAS : [],
          error: null,
        }).then(onF)
      return chain
    },
  }),
}))

import { fetchThroughput } from '../reports'

const T = 'terapeuta-1'
let LEITURAS: unknown[] = []

function leitura(over: Record<string, unknown> = {}) {
  return {
    therapist_id: T,
    status: 'pending',
    is_delivered: false,
    created_at: '2026-08-10T18:13:00Z',
    regeneration_count: 0,
    vision_features: null,
    report_generated: null,
    report_emocional: null,
    ...over,
  }
}

const RANGE = { from: '2026-08-01', to: '2026-08-31' }
const TERAPEUTAS = new Map([[T, { full_name: 'Carolina Agante', email: 'c@x.com' }]])

describe('throughput — relatórios gerados x capturas iniciadas', () => {
  it('o caso real: 3 tentativas abandonadas + 1 relatório = 1 gerado, 4 capturas', async () => {
    LEITURAS = [
      leitura(),
      leitura(),
      leitura(),
      leitura({ status: 'ready', report_emocional: '# Mapa do Ser' }),
    ]

    const { rows } = await fetchThroughput(RANGE, TERAPEUTAS as never)

    expect(rows[0].reports_generated).toBe(1) // o que consome crédito
    expect(rows[0].readings_total).toBe(4) // a tentativa
  })

  it('conta o Dossiê também — relatório é Mapa do Ser OU Dossiê', async () => {
    LEITURAS = [leitura({ status: 'ready', report_generated: { secao1: 'texto' } })]

    const { rows } = await fetchThroughput(RANGE, TERAPEUTAS as never)

    expect(rows[0].reports_generated).toBe(1)
  })

  it('report_generated vazio ({}) não é relatório', async () => {
    // O resto do sistema trata objeto vazio como "não gerou"; aqui tem que bater.
    LEITURAS = [leitura({ status: 'ready', report_generated: {} })]

    const { rows } = await fetchThroughput(RANGE, TERAPEUTAS as never)

    expect(rows[0].reports_generated).toBe(0)
    expect(rows[0].readings_total).toBe(1)
  })

  it('ordena por relatório gerado, não por tentativa', async () => {
    const T2 = 'terapeuta-2'
    LEITURAS = [
      // quem só abriu a tela 5 vezes
      ...Array.from({ length: 5 }, () => leitura()),
      // quem gerou 2 relatórios de verdade
      leitura({ therapist_id: T2, status: 'ready', report_emocional: '#' }),
      leitura({ therapist_id: T2, status: 'ready', report_emocional: '#' }),
    ]
    const mapa = new Map([
      [T, { full_name: 'Só tentou', email: 'a@x.com' }],
      [T2, { full_name: 'Trabalhou', email: 'b@x.com' }],
    ])

    const { rows } = await fetchThroughput(RANGE, mapa as never)

    expect(rows[0].full_name).toBe('Trabalhou')
  })
})
