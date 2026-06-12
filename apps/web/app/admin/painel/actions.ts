'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isFounderEmail } from '@/lib/auth/founder'
import type { ActionResult } from '@/lib/admin/social-posts'

// Server actions da fila de aprovação de conteúdo (/admin/painel). Migration 0045.
// Todas gateiam founder (defense-in-depth — middleware + layout já bloqueiam) e
// mutam via service-role (a tabela tem RLS founder-only; service bypassa).
// Nota: 'use server' só exporta funções async — o tipo ActionResult vive em
// lib/admin/social-posts.ts (regra de higiene do projeto).

const PAINEL_PATH = '/admin/painel'

/** Gate founder compartilhado. Retorna null se autorizado, ou o erro. */
async function requireFounder(): Promise<ActionResult | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return { ok: false, error: 'Não autorizado.' }
  }
  return null
}

async function patch(
  id: string,
  fields: Record<string, unknown>,
): Promise<ActionResult> {
  const denied = await requireFounder()
  if (denied) return denied
  if (!id) return { ok: false, error: 'Post inválido.' }

  const service = createServiceClient()
  const { error } = await service
    .from('social_posts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(PAINEL_PATH)
  return { ok: true }
}

/** Aprova um post (pendente → aprovado). Comentário opcional do founder. */
export async function approvePostAction(
  id: string,
  comment?: string,
): Promise<ActionResult> {
  const fields: Record<string, unknown> = { status: 'aprovado' }
  const c = comment?.trim()
  if (c) fields.comment = c
  return patch(id, fields)
}

/** Reprova um post (→ reprovado). */
export async function rejectPostAction(id: string): Promise<ActionResult> {
  return patch(id, { status: 'reprovado' })
}

/** Devolve um post pra fila de pendentes. */
export async function backToPendingAction(id: string): Promise<ActionResult> {
  return patch(id, { status: 'pendente', scheduled_at: null })
}

/** Agenda um post (→ agendado) num horário ISO. */
export async function schedulePostAction(
  id: string,
  scheduledAtISO: string,
): Promise<ActionResult> {
  const when = new Date(scheduledAtISO)
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: 'Data inválida.' }
  }
  return patch(id, { status: 'agendado', scheduled_at: when.toISOString() })
}

/** Edita a legenda de um post. */
export async function editCaptionAction(
  id: string,
  caption: string,
): Promise<ActionResult> {
  return patch(id, { caption: caption ?? '' })
}

/** Salva um comentário/nota do founder no post (sem mudar status). */
export async function commentPostAction(
  id: string,
  comment: string,
): Promise<ActionResult> {
  return patch(id, { comment: comment?.trim() || null })
}
