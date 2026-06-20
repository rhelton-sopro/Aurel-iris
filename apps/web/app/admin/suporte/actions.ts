'use server'
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { getSupportEmailBody } from '@/lib/email/imap-client'
import type { SupportEmailBody } from '@/lib/email/types'

export type FetchBodyResult =
  | { ok: true; body: SupportEmailBody | null }
  | { ok: false; error: string }

/** Busca o corpo de um email da caixa de suporte. Founder-only (gate próprio). */
export async function fetchSupportEmailBody(uid: number): Promise<FetchBodyResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return { ok: false, error: 'Não autorizado.' }
  }
  try {
    const body = await getSupportEmailBody(uid)
    return { ok: true, body }
  } catch (err) {
    console.error(
      '[admin/suporte] fetch body failed:',
      err instanceof Error ? err.message : err,
    )
    return { ok: false, error: 'Falha ao buscar o email.' }
  }
}
