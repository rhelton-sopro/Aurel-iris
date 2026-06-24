/**
 * Status público de reading via convite. Usado pelo client durante o
 * finalize pra confirmar quantas fotos chegaram ao server ANTES de
 * mostrar erros — supprime falsos positivos quando network blip no
 * response do upload mascara um POST que server-side completou.
 *
 * GET /api/convite/[token]/status?reading_id=X
 *   → { count: number, status: 'pending'|'ready'|'edited' }
 *
 * Validação:
 *   - Token DEVE existir (mas pode estar already_used — o cliente quer
 *     ler estado mesmo após auto-finalize ter queimado o token)
 *   - reading_id DEVE pertencer ao therapist do token
 *   - Sem session — service-role + token-auth (igual /upload e /finalize)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const readingId = request.nextUrl.searchParams.get('reading_id')

  if (!readingId || !/^[0-9a-f-]{36}$/i.test(readingId)) {
    return NextResponse.json({ error: 'reading_id inválido' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: tokenRow } = await service
    .from('client_invite_tokens' as never)
    .select('therapist_id')
    .eq('token', token)
    .maybeSingle<{ therapist_id: string }>()

  if (!tokenRow) {
    return NextResponse.json({ error: 'token não encontrado' }, { status: 404 })
  }

  const { data: reading } = await service
    .from('readings')
    .select('id, therapist_id, status')
    .eq('id', readingId)
    .maybeSingle()

  if (!reading || reading.therapist_id !== tokenRow.therapist_id) {
    return NextResponse.json({ error: 'reading não pertence ao convite' }, { status: 403 })
  }

  // 2026-06-24: além do count, devolve QUAIS slots (eye/angle) chegaram —
  // o client usa pra computar as fotos faltantes e guiar o "refazer na hora"
  // quando count<6 (em vez de mandar o cliente pra /obrigada achando que
  // terminou). count derivado do length pra ficar 1 query só.
  const { data: rows } = await service
    .from('reading_images')
    .select('eye, angle')
    .eq('reading_id', readingId)

  return NextResponse.json({
    count: rows?.length ?? 0,
    slots: (rows ?? []).map(r => ({ eye: r.eye, angle: r.angle })),
    status: reading.status,
  })
}
