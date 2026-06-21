'use server'
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { getSupportEmailBody, setSeen, deleteEmail } from '@/lib/email/imap-client'
import type { SupportEmailBody } from '@/lib/email/types'

async function assertFounder(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user && isFounderEmail(user.email)
}

export type FetchBodyResult =
  | { ok: true; body: SupportEmailBody | null }
  | { ok: false; error: string }

/** Busca o corpo (+ anexos) de um email. Marca como lido ao abrir. Founder-only. */
export async function fetchSupportEmailBody(
  mailbox: string,
  uid: number,
): Promise<FetchBodyResult> {
  if (!(await assertFounder())) return { ok: false, error: 'Não autorizado.' }
  try {
    const body = await getSupportEmailBody(mailbox, uid)
    // marca lido ao abrir (best-effort)
    void setSeen(mailbox, uid, true).catch(() => {})
    return { ok: true, body }
  } catch (err) {
    console.error('[admin/suporte] fetch body:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Falha ao buscar o email.' }
  }
}

/** Marca lido / não-lido. Founder-only. */
export async function markEmailSeen(
  mailbox: string,
  uid: number,
  seen: boolean,
): Promise<{ ok: boolean }> {
  if (!(await assertFounder())) return { ok: false }
  return { ok: await setSeen(mailbox, uid, seen) }
}

/** Move pra Lixeira (ou apaga se já na Lixeira). Founder-only. */
export async function deleteEmailAction(
  mailbox: string,
  uid: number,
): Promise<{ ok: boolean }> {
  if (!(await assertFounder())) return { ok: false }
  return { ok: await deleteEmail(mailbox, uid) }
}
