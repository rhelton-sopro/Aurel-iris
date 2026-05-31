import { timingSafeEqual } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import {
  expireOldCredits,
  expireOldTrials,
  reconcileOrphanedConsumes,
  releaseExpiredReservations,
  sendExpirationWarnings,
} from '@/lib/billing/cron-jobs'

export const runtime = 'nodejs'
export const maxDuration = 60 // bem abaixo do limite PRO (800s); jobs são bounded

/**
 * Vercel Cron daily — schedule '0 5 * * *' (05:00 UTC = 02:00 BRT).
 *
 * O Vercel Cron injeta automaticamente `Authorization: Bearer ${CRON_SECRET}`.
 * Sem o bearer correto → 401 (T-08-13-01: anti-spoofing).
 *
 * Roda os 4 jobs em sequência. Cada job é idempotente + bounded; um .catch por
 * job garante que falha de um NÃO aborta os demais (T-08-13-02).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // CR-02: fail-CLOSED + constant-time. Espelha o padrão timing-safe de
  // lib/asaas/webhook-auth.ts:
  //   1. CRON_SECRET ausente/vazio → 401 (NUNCA aceitar "Bearer undefined").
  //   2. Comparação via crypto.timingSafeEqual (sem short-circuit que vaza
  //      length/prefix do secret).
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron-daily] AUTH_REJECTED — CRON_SECRET não configurado')
    return NextResponse.json({ error: 'misconfigured' }, { status: 401 })
  }
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/, '') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn('[cron-daily] AUTH_REJECTED')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results = {
    reservations: await releaseExpiredReservations().catch((err) => ({
      released: 0,
      errors: 1,
      error: String(err),
    })),
    credits: await expireOldCredits().catch((err) => ({
      expired: 0,
      error: String(err),
    })),
    trials: await expireOldTrials().catch((err) => ({
      ended: 0,
      error: String(err),
    })),
    warnings: await sendExpirationWarnings().catch((err) => ({
      sent: 0,
      skipped: 0,
      error: String(err),
    })),
    orphan_consumes: await reconcileOrphanedConsumes().catch((err) => ({
      consumed: 0,
      errors: 1,
      error: String(err),
    })),
  }

  console.info(`[cron-daily] BATCH_COMPLETE ${JSON.stringify(results)}`)
  return NextResponse.json({ ok: true, ...results })
}
