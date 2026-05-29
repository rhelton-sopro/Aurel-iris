import { NextResponse, type NextRequest } from 'next/server'

import {
  expireOldCredits,
  expireOldTrials,
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
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
  }

  console.info(`[cron-daily] BATCH_COMPLETE ${JSON.stringify(results)}`)
  return NextResponse.json({ ok: true, ...results })
}
