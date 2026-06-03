import { timingSafeEqual } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { purgeExpiredIrisPhotos } from '@/lib/capture/iris-photo-ttl'

export const runtime = 'nodejs'
export const maxDuration = 120 // sweep bounded; abaixo do teto PRO (800s)

/**
 * Vercel Cron horário — schedule '0 * * * *' (de hora em hora).
 *
 * Apaga as fotos da íris vencidas (TTL 24h) + catch-up de relatórios completos
 * cuja deleção síncrona na geração falhou. Honra a promessa pública "a foto é
 * apagada em no máximo 24h" (LP + FAQ).
 *
 * Mesmo gate anti-spoofing do /api/cron/daily: o Vercel injeta
 * `Authorization: Bearer ${CRON_SECRET}`; sem o bearer correto → 401
 * (fail-closed + comparação timing-safe).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron-photo-ttl] AUTH_REJECTED — CRON_SECRET não configurado')
    return NextResponse.json({ error: 'misconfigured' }, { status: 401 })
  }
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/, '') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn('[cron-photo-ttl] AUTH_REJECTED')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await purgeExpiredIrisPhotos().catch((err) => ({
    ttl_purged: 0,
    catchup_purged: 0,
    errors: 1,
    error: String(err),
  }))

  console.info(`[cron-photo-ttl] SWEEP_COMPLETE ${JSON.stringify(result)}`)
  return NextResponse.json({ ok: true, ...result })
}
