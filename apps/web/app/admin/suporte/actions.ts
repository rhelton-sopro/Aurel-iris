'use server'
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import {
  getSupportEmailBody,
  setSeen,
  deleteEmail,
  setSeenMany,
  deleteMany,
} from '@/lib/email/imap-client'
import {
  sendSupportEmail,
  sendBulkSupportEmail,
  type BulkRecipient,
} from '@/lib/email/smtp-client'
import { parseEnderecos } from '@/lib/email/enderecos'
import { createServiceClient } from '@/lib/supabase/service'
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

/** Marca vários como lido/não-lido. Founder-only. */
export async function markSeenBatchAction(
  mailbox: string,
  uids: number[],
  seen: boolean,
): Promise<{ ok: boolean }> {
  if (!(await assertFounder())) return { ok: false }
  return { ok: await setSeenMany(mailbox, uids, seen) }
}

/** Exclui vários (move pra Lixeira). Founder-only. */
export async function deleteBatchAction(
  mailbox: string,
  uids: number[],
): Promise<{ ok: boolean }> {
  if (!(await assertFounder())) return { ok: false }
  return { ok: await deleteMany(mailbox, uids) }
}

export interface SendEmailActionInput {
  to: string
  subject: string
  text: string
  html?: string
  inReplyTo?: string | null
  references?: string | null
}

/** Envia um email de suporte@ (compor/responder/encaminhar). Founder-only. */
export async function sendEmailAction(
  input: SendEmailActionInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await assertFounder())) return { ok: false, error: 'Não autorizado.' }
  const to = input.to?.trim()
  const subject = input.subject?.trim()
  if (!to || !subject || !input.text?.trim()) {
    return { ok: false, error: 'Preencha destinatário, assunto e mensagem.' }
  }
  const { validos, invalidos } = parseEnderecos(to)
  if (invalidos.length) {
    return { ok: false, error: `Endereço inválido: ${invalidos.join(', ')}` }
  }
  // Mais de um endereço não passa por aqui: a tela manda esse caso para o
  // envio em massa, que dispara UMA mensagem por pessoa. Juntar todo mundo no
  // mesmo "Para" mostraria o endereço de cada um para todos os outros.
  if (validos.length !== 1) {
    return { ok: false, error: 'Destinatário inválido.' }
  }
  return sendSupportEmail({
    to: validos[0],
    subject,
    text: input.text,
    html: input.html,
    inReplyTo: input.inReplyTo,
    references: input.references,
  })
}

// ============================================================================
// ENVIO EM MASSA PARA TERAPEUTAS (24/08)
//
// ⭐ DECISÃO DO FOUNDER: a caixinha lista os TERAPEUTAS (os clientes dele), e
// NÃO os clientes dos terapeutas. Os clientes entregaram os dados ao terapeuta
// deles, não ao Iris Codex — escrever direto para eles é risco de LGPD e
// atropela a relação do terapeuta com a própria clientela.
// ⛔ Não estender esta lista para a tabela `clients` sem decisão nova dele.
// ============================================================================

export interface TherapistRecipient {
  id: string
  name: string
  email: string
}

/** Lista os terapeutas que podem receber um disparo. Founder-only. */
export async function listTherapistRecipients(): Promise<
  { ok: true; therapists: TherapistRecipient[] } | { ok: false; error: string }
> {
  if (!(await assertFounder())) return { ok: false, error: 'Não autorizado.' }
  try {
    const service = createServiceClient()
    const [profilesRes, usersRes] = await Promise.all([
      service.from('profiles').select('id, full_name'),
      service.auth.admin.listUsers({ perPage: 1000 }),
    ])
    if (profilesRes.error) throw profilesRes.error
    const emailById = new Map(
      (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? '']),
    )
    const therapists = (profilesRes.data ?? [])
      .map((p) => ({
        id: p.id as string,
        name: ((p.full_name as string | null) ?? '').trim(),
        email: emailById.get(p.id as string) ?? '',
      }))
      // sem e-mail não há como enviar: fica fora da lista em vez de aparecer
      // selecionável e falhar calado na hora do disparo.
      .filter((t) => t.email)
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR'))
    return { ok: true, therapists }
  } catch (err) {
    console.error('[admin/suporte] listar terapeutas:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Falha ao carregar a lista de terapeutas.' }
  }
}

export interface SendBulkActionInput {
  /** IDs dos terapeutas escolhidos na caixinha. */
  therapistIds: string[]
  /** Endereço avulso digitado no campo "Para" (opcional). */
  extraTo?: string
  subject: string
  text: string
  html?: string
}

export interface SendBulkActionResult {
  ok: boolean
  sent: number
  failed: { email: string; error: string }[]
  error?: string
}

/**
 * Dispara UM e-mail separado por pessoa. Founder-only.
 *
 * ⚠️ O e-mail de cada terapeuta é resolvido AQUI, a partir do id — a tela nunca
 * manda endereço. Assim o nome usado no {nome} é sempre o do cadastro, e a
 * lista não pode ser trocada por outra no caminho.
 */
export async function sendBulkEmailAction(
  input: SendBulkActionInput,
): Promise<SendBulkActionResult> {
  if (!(await assertFounder())) return { ok: false, sent: 0, failed: [], error: 'Não autorizado.' }

  const subject = input.subject?.trim()
  if (!subject || !input.text?.trim()) {
    return { ok: false, sent: 0, failed: [], error: 'Preencha assunto e mensagem.' }
  }

  const listed = await listTherapistRecipients()
  if (!listed.ok) return { ok: false, sent: 0, failed: [], error: listed.error }

  const escolhidos = new Set(input.therapistIds ?? [])
  const recipients: BulkRecipient[] = listed.therapists
    .filter((t) => escolhidos.has(t.id))
    .map((t) => ({ email: t.email, name: t.name }))

  // Campo "Para": um ou vários endereços avulsos, separados por ; ou , (ver
  // lib/email/enderecos.ts). Quem já está na caixinha não entra de novo.
  const { validos, invalidos } = parseEnderecos(input.extraTo)
  if (invalidos.length) {
    return {
      ok: false,
      sent: 0,
      failed: [],
      error: `Endereço avulso inválido: ${invalidos.join(', ')}`,
    }
  }
  for (const extra of validos) {
    if (!recipients.some((r) => r.email.toLowerCase() === extra.toLowerCase())) {
      recipients.push({ email: extra, name: null })
    }
  }

  if (!recipients.length) {
    return { ok: false, sent: 0, failed: [], error: 'Escolha pelo menos um destinatário.' }
  }

  return sendBulkSupportEmail({
    recipients,
    subject,
    text: input.text,
    html: input.html,
  })
}
