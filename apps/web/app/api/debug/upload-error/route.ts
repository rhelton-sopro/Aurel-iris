// DIAGNÓSTICO TEMPORÁRIO (2026-05-19). Beacon fire-and-forget: o catch de
// upload (capture-client/upload-client) manda aqui o erro REAL do Supabase
// pro servidor — assim a causa aparece nos logs do Vercel sem depender do
// founder transcrever um toast no iPhone. Remover junto com os toasts de
// diagnóstico quando a falha de "salvar imagem" estiver resolvida.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Auth gate: só terapeuta logado (evita beacon aberto/abuso).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = { parseError: true }
  }

  const ua = request.headers.get('user-agent') ?? 'n/a'
  console.error(
    '[upload-beacon]',
    JSON.stringify({ userId: user.id, ua, ...(body as Record<string, unknown>) }),
  )

  return NextResponse.json({ ok: true })
}
