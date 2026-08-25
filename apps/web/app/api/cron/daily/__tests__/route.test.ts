import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ⚠️ Esta lista precisa ter TODOS os trabalhos que a rota chama.
 *
 * O robô diário ganhou dois trabalhos novos (a reconciliação de créditos órfãos
 * e a renovação do token do Instagram) e esta imitação continuou declarando os
 * quatro originais. O teste então quebrava dizendo "não existe essa função" — e
 * o que ele deixou de vigiar nesse meio-tempo foi justamente o que importa: que
 * um trabalho falhando não derrube os outros cinco.
 */
vi.mock('@/lib/billing/cron-jobs', () => ({
  releaseExpiredReservations: vi.fn(),
  expireOldCredits: vi.fn(),
  expireOldTrials: vi.fn(),
  sendExpirationWarnings: vi.fn(),
  reconcileOrphanedConsumes: vi.fn(),
}))

vi.mock('@/lib/instagram/token', () => ({
  refreshAndHealthcheckInstagram: vi.fn(),
}))

import * as jobs from '@/lib/billing/cron-jobs'
import { refreshAndHealthcheckInstagram } from '@/lib/instagram/token'

import { GET } from '../route'

function makeReq(token?: string): Parameters<typeof GET>[0] {
  return new Request('https://test/api/cron/daily', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/daily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron_secret_x'
  })

  it('401 quando auth ausente', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('401 quando bearer errado', async () => {
    const res = await GET(makeReq('wrong'))
    expect(res.status).toBe(401)
  })

  it('CR-02: 401 fail-closed quando CRON_SECRET ausente (NÃO aceita "Bearer undefined")', async () => {
    delete process.env.CRON_SECRET
    // Ataque clássico fail-open: enviar literalmente "undefined" como secret.
    const res = await GET(makeReq('undefined'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('misconfigured')
    // Nenhum job deve rodar com env ausente.
    expect(jobs.releaseExpiredReservations).not.toHaveBeenCalled()
  })

  it('CR-02: 401 fail-closed quando CRON_SECRET vazio', async () => {
    process.env.CRON_SECRET = ''
    const res = await GET(makeReq(''))
    expect(res.status).toBe(401)
    expect(jobs.releaseExpiredReservations).not.toHaveBeenCalled()
  })

  it('CR-02: 401 quando bearer tem comprimento diferente (constant-time path)', async () => {
    // prefixo correto mas comprimento diferente — o branch length-mismatch
    // do timing-safe compare deve rejeitar sem vazar.
    const res = await GET(makeReq('cron_secret_x_extra'))
    expect(res.status).toBe(401)
  })

  it('200 roda os 6 jobs em sequência', async () => {
    vi.mocked(jobs.releaseExpiredReservations).mockResolvedValue({
      released: 2,
      errors: 0,
    })
    vi.mocked(jobs.expireOldCredits).mockResolvedValue({ expired: 1 })
    vi.mocked(jobs.expireOldTrials).mockResolvedValue({ ended: 0 })
    vi.mocked(jobs.sendExpirationWarnings).mockResolvedValue({
      sent: 3,
      skipped: 1,
    })
    vi.mocked(jobs.reconcileOrphanedConsumes).mockResolvedValue({
      consumed: 0,
      errors: 0,
    })
    vi.mocked(refreshAndHealthcheckInstagram).mockResolvedValue({
      refreshed: false,
      healthy: true,
    })

    const res = await GET(makeReq('cron_secret_x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reservations.released).toBe(2)
    expect(body.credits.expired).toBe(1)
    expect(body.warnings.sent).toBe(3)

    expect(jobs.releaseExpiredReservations).toHaveBeenCalledOnce()
    expect(jobs.expireOldCredits).toHaveBeenCalledOnce()
    expect(jobs.expireOldTrials).toHaveBeenCalledOnce()
    expect(jobs.sendExpirationWarnings).toHaveBeenCalledOnce()
    expect(jobs.reconcileOrphanedConsumes).toHaveBeenCalledOnce()
    expect(refreshAndHealthcheckInstagram).toHaveBeenCalledOnce()
  })

  it('continua os outros jobs quando um lança', async () => {
    vi.mocked(jobs.releaseExpiredReservations).mockRejectedValue(
      new Error('boom'),
    )
    vi.mocked(jobs.expireOldCredits).mockResolvedValue({ expired: 1 })
    vi.mocked(jobs.expireOldTrials).mockResolvedValue({ ended: 0 })
    vi.mocked(jobs.sendExpirationWarnings).mockResolvedValue({
      sent: 0,
      skipped: 0,
    })
    vi.mocked(jobs.reconcileOrphanedConsumes).mockResolvedValue({
      consumed: 0,
      errors: 0,
    })
    vi.mocked(refreshAndHealthcheckInstagram).mockResolvedValue({
      refreshed: false,
      healthy: true,
    })

    const res = await GET(makeReq('cron_secret_x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reservations.errors).toBe(1)
    expect(body.credits.expired).toBe(1)
    // ⭐ E os DOIS trabalhos novos seguem rodando mesmo com o primeiro caído —
    // é esta a garantia que o teste existe pra dar.
    expect(jobs.reconcileOrphanedConsumes).toHaveBeenCalledOnce()
    expect(refreshAndHealthcheckInstagram).toHaveBeenCalledOnce()
  })
})
