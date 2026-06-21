import { timingSafeEqual } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { publishDuePosts } from '@/lib/instagram/publish'

export const runtime = 'nodejs'
export const maxDuration = 300 // poll do reel é bounded internamente; PRO permite até 800s.

/**
 * Vercel Cron horário — schedule '0 * * * *' (de hora em hora).
 *
 * Varre os posts `agendado` vencidos e publica no Instagram via
 * `publishDuePosts()` (núcleo idempotente — claim atômico, IGPUB-02). Um post
 * agendado vencido é publicado SEM ninguém clicar.
 *
 * Mesmo gate anti-spoofing do /api/cron/daily e /api/cron/photo-ttl: o Vercel
 * injeta `Authorization: Bearer ${CRON_SECRET}`; sem o bearer correto → 401
 * (fail-closed + comparação timing-safe). NUNCA loga o token (publish.ts cuida).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron-instagram-publish] AUTH_REJECTED — CRON_SECRET não configurado')
    return NextResponse.json({ error: 'misconfigured' }, { status: 401 })
  }
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/, '') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn('[cron-instagram-publish] AUTH_REJECTED')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await publishDuePosts().catch((err) => ({
    published: 0,
    retried: 0,
    failed: 0,
    errors: 1,
    error: String(err),
  }))

  console.info(`[cron-instagram-publish] SWEEP_COMPLETE ${JSON.stringify(result)}`)
  return NextResponse.json({ ok: true, ...result })
}
