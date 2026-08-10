import { beforeEach, describe, expect, it, vi } from 'vitest'

// O Stage 1 automático (founder 2026-08-10, caso Melissa): roda o exame no fim da
// captura pra leitura parar de morrer quando o cron apaga as fotos em 24h.
// O que estes testes seguram: não rodar duas vezes (custa API), não quebrar sem
// fotos, e NUNCA encostar em crédito ou em analysis_started_at — que são da geração
// do relatório, não do exame.

const runStage1Scan = vi.fn()
const prepareDirectImages = vi.fn()
const canonicalizeReading = vi.fn()
const rpc = vi.fn()
const tabelasLidas: string[] = []

vi.mock('@/lib/anthropic/stage1-scan', () => ({
  runStage1Scan: (...a: unknown[]) => runStage1Scan(...a),
}))
vi.mock('@/lib/anthropic/prepare-direct-images', () => ({
  prepareDirectImages: (...a: unknown[]) => prepareDirectImages(...a),
}))
vi.mock('@/lib/canonicalize', () => ({
  canonicalizeReading: (...a: unknown[]) => canonicalizeReading(...a),
}))

let findingExistente: { id: string } | null = null
const READING = {
  id: 'r1',
  therapist_id: 't1',
  canonical_metadata: { ok: true },
  client: { full_name: 'Melissa Silva', birth_date: '1980-01-01' },
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: (...a: unknown[]) => rpc(...a),
    from: (tabela: string) => {
      tabelasLidas.push(tabela)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is', 'update', 'insert']) chain[m] = () => chain
      chain.maybeSingle = () =>
        Promise.resolve({
          data: tabela === 'report_findings' ? findingExistente : READING,
          error: null,
        })
      return chain
    },
  }),
}))

import { ensureStage1 } from '../auto-stage1'

const STAGE1_OK = {
  validation_status: 'valid',
  exame: { campos: [] },
  raw_output: '<xml/>',
  prompt_version: 'v1',
  prompt_sha: 'abc',
  method_version: '0.2.1',
  model: 'claude-sonnet-4-6',
  tokens_in: 100,
  tokens_out: 50,
  cost_usd: 0.1,
  latency_ms: 1000,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  tabelasLidas.length = 0
  findingExistente = null
  rpc.mockResolvedValue({ error: null })
  prepareDirectImages.mockResolvedValue({ ok: true, images: [{ eye: 'left' }], fallbackCount: 0 })
  runStage1Scan.mockResolvedValue(STAGE1_OK)
})

describe('ensureStage1', () => {
  it('roda o exame e persiste quando a leitura ainda não tem', async () => {
    const r = await ensureStage1('r1')

    expect(r).toEqual({ ok: true })
    expect(runStage1Scan).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith(
      'persist_report_findings_versioned',
      expect.objectContaining({ p_reading_id: 'r1', p_therapist_id: 't1' }),
    )
  })

  it('NÃO roda de novo se a leitura já tem exame corrente', async () => {
    // Os dois caminhos de finalize (auto no 6º upload e manual) podem chamar isto.
    // Rodar duas vezes gastaria uma chamada de API à toa em cada captura.
    findingExistente = { id: 'f1' }

    const r = await ensureStage1('r1')

    expect(r).toEqual({ ok: true, skipped: 'ja_tem_exame' })
    expect(runStage1Scan).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sem fotos, sai limpo em vez de estourar', async () => {
    prepareDirectImages.mockResolvedValue({ ok: false, reason: 'no_images' })

    const r = await ensureStage1('r1')

    expect(r).toEqual({ ok: true, skipped: 'sem_fotos' })
    expect(runStage1Scan).not.toHaveBeenCalled()
  })

  it('falha do Stage 1 não derruba a captura — devolve erro, não lança', async () => {
    runStage1Scan.mockRejectedValue(new Error('anthropic 529'))

    await expect(ensureStage1('r1')).resolves.toEqual({ ok: false, erro: 'anthropic 529' })
  })

  it('não encosta em crédito nem em analysis_started_at', async () => {
    await ensureStage1('r1')

    // Crédito é debitado na GERAÇÃO do relatório. E analysis_started_at faz a UI
    // dizer "analisando" — mentira, aqui só o exame rodou.
    expect(tabelasLidas).not.toContain('customer_credits')
    expect(tabelasLidas).not.toContain('credit_transactions')
    expect(tabelasLidas).not.toContain('trial_status')
    expect(rpc).not.toHaveBeenCalledWith(
      expect.stringContaining('reserve'),
      expect.anything(),
    )
  })
})
