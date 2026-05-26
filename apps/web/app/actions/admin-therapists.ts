'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isFounderEmail } from '@/lib/auth/founder'

export interface DeleteTherapistResult {
  ok: boolean
  error?: string
}

export interface InviteTherapistResult {
  ok: boolean
  error?: string
  /** URL pra copiar e enviar via WhatsApp. Presente quando ok=true. */
  actionLink?: string
  /** new_invited = terapeuta nunca existiu; existing_magiclink = e-mail já cadastrado, link de re-entry. */
  userStatus?: 'new_invited' | 'existing_magiclink'
  /** E-mail normalizado (lowercase + trim) pra confirmar pro founder. */
  email?: string
}

/**
 * Gera link de cadastro/login pro founder copiar e enviar via WhatsApp.
 * Hand-held protocol da Fase 11 (D3): founder controla quando e como o
 * terapeuta recebe — sistema NÃO envia e-mail automático.
 *
 * - Tenta `type='invite'` primeiro (cria user + retorna URL).
 * - Se e-mail já existe, fallback pra `type='magiclink'` (login de 1× uso).
 *
 * `redirectTo` aponta pro /dashboard (NEXT_PUBLIC_SITE_URL/dashboard).
 */
export async function inviteTherapistAction(
  emailRaw: string,
): Promise<InviteTherapistResult> {
  // Founder gate (defense-in-depth — middleware + layout já bloqueiam).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const email = emailRaw.trim().toLowerCase()
  if (!email || !/.+@.+\..+/.test(email)) {
    return { ok: false, error: 'E-mail inválido.' }
  }
  if (isFounderEmail(email)) {
    return { ok: false, error: 'Não dá pra convidar o founder a si mesmo.' }
  }

  const service = createServiceClient()
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://iriscodex.com'
  const redirectTo = `${siteUrl}/dashboard`

  // 1ª tentativa: invite (novo user).
  const inviteRes = await service.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  })

  if (!inviteRes.error && inviteRes.data?.properties?.action_link) {
    const actionLink = inviteRes.data.properties.action_link
    console.log('[admin-therapists] INVITE_LINK_GENERATED', {
      targetEmail: email,
      userStatus: 'new_invited',
      by: user.email,
      at: new Date().toISOString(),
    })
    return {
      ok: true,
      actionLink,
      userStatus: 'new_invited',
      email,
    }
  }

  // 2ª tentativa: magiclink (user já existe).
  const errMsg = (inviteRes.error?.message ?? '').toLowerCase()
  const userExists =
    errMsg.includes('exists') ||
    errMsg.includes('already') ||
    errMsg.includes('registered')

  if (userExists) {
    const magicRes = await service.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })
    if (magicRes.error || !magicRes.data?.properties?.action_link) {
      return {
        ok: false,
        error: `Falha ao gerar magic link: ${magicRes.error?.message ?? 'sem URL'}`,
      }
    }
    console.log('[admin-therapists] MAGIC_LINK_GENERATED', {
      targetEmail: email,
      userStatus: 'existing_magiclink',
      by: user.email,
      at: new Date().toISOString(),
    })
    return {
      ok: true,
      actionLink: magicRes.data.properties.action_link,
      userStatus: 'existing_magiclink',
      email,
    }
  }

  return {
    ok: false,
    error: `Falha ao gerar invite: ${inviteRes.error?.message ?? 'erro desconhecido'}`,
  }
}

// Hard-delete de um terapeuta. Cascade do schema (0001) cuida de profiles →
// clients → readings → reading_images → reading_addons; consent log fica
// anonimizado (client_id → SET NULL). Storage `iris_captures/{therapist_id}/`
// não entra no cascade — limpo aqui explicitamente ANTES do auth.admin.deleteUser
// (preciso do id pra montar o prefix). calibration_annotations/diagnoses são
// ON DELETE RESTRICT — se o terapeuta tiver, o delete falha; trato com mensagem
// amigável (caso raro: só o founder cria essas entries).
export async function deleteTherapistAction(
  therapistId: string,
  confirmEmail: string,
): Promise<DeleteTherapistResult> {
  // Founder gate (defense-in-depth — middleware + layout já bloqueiam, mas
  // server actions precisam verificar independente).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return { ok: false, error: 'Não autorizado.' }
  }

  // Self-protection: founder não exclui a si mesmo.
  if (user.id === therapistId) {
    return { ok: false, error: 'Você não pode excluir a si mesmo.' }
  }

  const service = createServiceClient()

  // Resolve o email do alvo (pra match do confirm + cinto de segurança contra
  // o founder com uid distinto).
  const { data: target, error: getErr } =
    await service.auth.admin.getUserById(therapistId)
  if (getErr || !target?.user) {
    return { ok: false, error: 'Terapeuta não encontrado.' }
  }
  const targetEmail = target.user.email ?? ''

  if (isFounderEmail(targetEmail)) {
    return { ok: false, error: 'Não é possível excluir o founder.' }
  }

  if (confirmEmail.trim().toLowerCase() !== targetEmail.toLowerCase()) {
    return { ok: false, error: 'Email de confirmação não confere.' }
  }

  // Storage cleanup ANTES do auth delete. Lista recursiva via storage API
  // (sem cross-schema query — Database type só conhece `public`). Layout:
  // `{therapist_id}/{reading_id}/{eye}_{angle}.jpg` (2 níveis). Itens com
  // `id === null` no resultado do .list() são pseudo-pastas; com id são files.
  async function listAllFiles(prefix: string): Promise<string[]> {
    const { data, error } = await service.storage
      .from('iris_captures')
      .list(prefix, { limit: 1000 })
    if (error) throw new Error(error.message)
    if (!data) return []
    const out: string[] = []
    for (const item of data) {
      const full = `${prefix}/${item.name}`
      if (item.id === null) {
        // pseudo-pasta — recursão
        out.push(...(await listAllFiles(full)))
      } else {
        out.push(full)
      }
    }
    return out
  }

  let storageObjectsRemoved = 0
  try {
    const paths = await listAllFiles(therapistId)
    if (paths.length > 0) {
      const { error: removeErr } = await service.storage
        .from('iris_captures')
        .remove(paths)
      if (removeErr) {
        console.error('[admin-therapists] storage remove error:', removeErr)
        return {
          ok: false,
          error: `Falha ao remover fotos: ${removeErr.message}`,
        }
      }
      storageObjectsRemoved = paths.length
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[admin-therapists] storage list error:', msg)
    return {
      ok: false,
      error: `Falha ao listar fotos no storage: ${msg}`,
    }
  }

  // Auth delete → dispara o cascade. FK RESTRICT de calibration_* sobe como
  // erro aqui; mensagem amigável caso o (improvável) caso aconteça.
  const { error: deleteErr } = await service.auth.admin.deleteUser(therapistId)
  if (deleteErr) {
    console.error('[admin-therapists] auth delete error:', deleteErr)
    const msg = deleteErr.message || ''
    if (
      msg.toLowerCase().includes('foreign key') ||
      msg.toLowerCase().includes('restrict') ||
      msg.toLowerCase().includes('violates')
    ) {
      return {
        ok: false,
        error:
          'Terapeuta tem dados de calibração vinculados (annotations/diagnoses). Limpe a calibração primeiro.',
      }
    }
    return { ok: false, error: `Falha ao excluir: ${msg}` }
  }

  // Audit log (console; pode virar tabela depois se precisar).
  console.log('[admin-therapists] DELETED', {
    therapistId,
    targetEmail,
    storageObjectsRemoved,
    by: user.email,
    at: new Date().toISOString(),
  })

  revalidatePath('/admin/terapeutas')
  return { ok: true }
}
