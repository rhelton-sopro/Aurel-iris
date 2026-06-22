'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isFounderEmail } from '@/lib/auth/founder'
import { publishPost } from '@/lib/instagram/publish'
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

/**
 * "Publicar agora" (D-08): força a publicação imediata reusando o MESMO núcleo do
 * cron (`publishPost`). Founder-gated; roda no contexto autenticado do founder
 * (NÃO usa CRON_SECRET). Valida o id como uuid antes de chamar (RESEARCH §V5).
 */
export async function publishNowAction(id: string): Promise<ActionResult> {
  const denied = await requireFounder()
  if (denied) return denied
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: 'Post inválido.' }
  }
  const result = await publishPost(id)
  revalidatePath(PAINEL_PATH)
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

/**
 * Marca um post como publicado MANUALMENTE (→ `publicado`), SEM chamar a API do
 * Instagram. Para quando o founder posta na mão pelo app do IG e só quer registrar
 * no painel. Grava `published_at`; não toca em ig_permalink/ig_media_id (não houve
 * publicação via API). Founder-gated.
 */
export async function markAsPostedAction(id: string): Promise<ActionResult> {
  return patch(id, {
    status: 'publicado',
    published_at: new Date().toISOString(),
  })
}

/**
 * Reenfileira um post que falhou (D-04, IGPUB-06): de `erro` → `agendado`,
 * zerando `publish_attempts` e limpando `publish_error` para que o próximo
 * sweep do cron (ou "publicar agora") possa tentar de novo do zero.
 * Founder-gated. Só age sobre posts em `erro` (não reseta tentativas de outros estados).
 */
export async function reenqueuePostAction(id: string): Promise<ActionResult> {
  const denied = await requireFounder()
  if (denied) return denied
  if (!id) return { ok: false, error: 'Post inválido.' }

  const service = createServiceClient()
  const { error } = await service
    .from('social_posts')
    .update({
      status: 'agendado',
      publish_attempts: 0,
      publish_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'erro')
  if (error) return { ok: false, error: error.message }

  revalidatePath(PAINEL_PATH)
  return { ok: true }
}
