// GET /admin/suporte/anexo?mailbox=&uid=&index= — baixa um anexo da caixa de
// suporte (IMAP). Founder-only. runtime nodejs (IMAP abre TCP).
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { getAttachment } from '@/lib/email/imap-client'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return new NextResponse('Não encontrado', { status: 404 })
  }

  const url = new URL(request.url)
  const mailbox = url.searchParams.get('mailbox') || 'INBOX'
  const uid = Number(url.searchParams.get('uid'))
  const index = Number(url.searchParams.get('index'))
  if (!uid || Number.isNaN(index)) {
    return new NextResponse('Parâmetros inválidos', { status: 400 })
  }

  const att = await getAttachment(mailbox, uid, index)
  if (!att) return new NextResponse('Anexo não encontrado', { status: 404 })

  return new NextResponse(new Uint8Array(att.content), {
    headers: {
      'Content-Type': att.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename)}"`,
    },
  })
}
