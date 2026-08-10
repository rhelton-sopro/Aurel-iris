import { beforeEach, describe, expect, it, vi } from 'vitest'

// O relógio das 24h passou a contar da ÚLTIMA FOTO (founder, 2026-08-10). Antes
// contava de readings.created_at — quando o cliente ABRE o link. Quem começava e
// demorava a terminar perdia janela sem saber: abrir hoje, tirar 3 fotos e voltar
// depois de amanhã significava achar as 3 primeiras já apagadas.
//
// O que estes testes seguram, nos DOIS sentidos: foto recente NÃO é apagada, foto
// velha É — e leitura sem foto registrada continua sendo purgada, senão voltam as
// fotos eternas no storage (que foi o motivo de o cron ser dirigido por readings).

const purgeIrisPhotos = vi.fn()
vi.mock('@/lib/capture/delete-iris-photos', () => ({
  purgeIrisPhotos: (...a: unknown[]) => purgeIrisPhotos(...a),
}))

let readingsAntigas: Array<{ id: string }> = []
let ultimaFotoPorLeitura: Record<string, string | null> = {}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (tabela: string) => {
      const chain: Record<string, unknown> = {}
      let readingId = ''
      for (const m of ['select', 'lt', 'is', 'not', 'order', 'limit']) chain[m] = () => chain
      chain.eq = (_col: string, v: string) => {
        readingId = v
        return chain
      }
      chain.maybeSingle = () =>
        Promise.resolve({
          data: ultimaFotoPorLeitura[readingId]
            ? { created_at: ultimaFotoPorLeitura[readingId] }
            : null,
          error: null,
        })
      chain.then = (onF: (v: unknown) => unknown) =>
        Promise.resolve({
          data: tabela === 'readings' ? readingsAntigas : [],
          error: null,
        }).then(onF)
      return chain
    },
  }),
}))

import { purgeExpiredIrisPhotos } from '../iris-photo-ttl'

const HORAS = (n: number) => new Date(Date.now() - n * 3600_000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  purgeIrisPhotos.mockResolvedValue({ ok: true, skipped: false })
  readingsAntigas = [{ id: 'r1' }]
  ultimaFotoPorLeitura = {}
})

describe('TTL da foto — relógio a partir da última foto', () => {
  it('NÃO apaga quando a última foto tem menos de 24h, mesmo com a leitura velha', async () => {
    // O caso real: abriu o link anteontem, terminou de fotografar há 2 horas.
    ultimaFotoPorLeitura = { r1: HORAS(2) }

    const r = await purgeExpiredIrisPhotos()

    expect(purgeIrisPhotos).not.toHaveBeenCalled()
    expect(r.ttl_purged).toBe(0)
  })

  it('apaga quando a última foto passou das 24h', async () => {
    ultimaFotoPorLeitura = { r1: HORAS(25) }

    const r = await purgeExpiredIrisPhotos()

    expect(purgeIrisPhotos).toHaveBeenCalledWith(expect.anything(), 'r1', 'ttl_24h')
    expect(r.ttl_purged).toBe(1)
  })

  it('leitura sem foto registrada continua sendo purgada (nada de foto eterna no storage)', async () => {
    ultimaFotoPorLeitura = {} // nenhuma row em reading_images

    const r = await purgeExpiredIrisPhotos()

    expect(purgeIrisPhotos).toHaveBeenCalledWith(expect.anything(), 'r1', 'ttl_24h')
    expect(r.ttl_purged).toBe(1)
  })
})
