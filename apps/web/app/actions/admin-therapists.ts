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
  /** new_invited = token gerado em therapist_invites. */
  userStatus?: 'new_invited'
  /** E-mail normalizado (lowercase + trim) pra confirmar pro founder. */
  email?: string
}

export interface GrantCreditsResult {
  ok: boolean
  error?: string
  /** Nº de leituras creditadas (quando ok=true). */
  leituras?: number
  /** Validade do pacote (ISO, quando ok=true). */
  expiresAt?: string
}

/**
 * Crédito MANUAL de leituras pelo founder (stopgap: pagamento via link
 * InfinitePay enquanto o cartão do Asaas está sob análise do Validador de
 * Segurança — chamado #1285903). Espelha o que o webhook PAYMENT_CONFIRMED faria:
 * cria UMA row em customer_credits status='active' + lança no ledger, com
 * purchase_date=agora e expires_at=agora+12 meses (D-03). Versão UI do script
 * scripts/grant-credits.mjs.
 */
export async function grantCreditsAction(
  therapistId: string,
  sku: string,
  infinitepayRef: string,
): Promise<GrantCreditsResult> {
  // Founder gate (defense-in-depth — middleware + layout já bloqueiam).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return { ok: false, error: 'Não autorizado.' }
  }

  if (!therapistId) return { ok: false, error: 'Terapeuta inválido.' }
  const skuClean = (sku ?? '').trim()
  if (!skuClean) return { ok: false, error: 'Selecione um pacote.' }
  const ref = (infinitepayRef ?? '').trim().slice(0, 120)

  const service = createServiceClient()

  // Alvo existe? (cinto de segurança contra id inválido)
  const { data: target, error: tErr } =
    await service.auth.admin.getUserById(therapistId)
  if (tErr || !target?.user) {
    return { ok: false, error: 'Terapeuta não encontrado.' }
  }

  // Pacote (preço/leituras vêm do DB — nunca do client) + package_id NOT NULL.
  const { data: pkg, error: pkgErr } = await service
    .from('credit_packages')
    .select('id, sku, name, leituras_count, price_brl')
    .eq('sku', skuClean)
    .maybeSingle()
  if (pkgErr) return { ok: false, error: 'Erro ao buscar pacote.' }
  if (!pkg) return { ok: false, error: 'Pacote não encontrado.' }

  // Datas: compra agora, validade 12 meses (D-03).
  const now = new Date()
  const expires = new Date(now)
  expires.setMonth(expires.getMonth() + 12)
  const expiresISO = expires.toISOString()

  // INSERT customer_credits ativo — espelha o webhook PAYMENT_CONFIRMED.
  const { data: credit, error: insErr } = await service
    .from('customer_credits')
    .insert({
      user_id: therapistId,
      package_id: pkg.id,
      leituras_purchased: pkg.leituras_count,
      leituras_remaining: pkg.leituras_count,
      leituras_reserved: 0,
      purchase_date: now.toISOString(),
      expires_at: expiresISO,
      status: 'active',
      asaas_payment_status: 'MANUAL_INFINITEPAY',
      paid_brl: pkg.price_brl, // grant manual = preço de tabela (receita/reembolso)
    })
    .select('id')
    .single()
  if (insErr || !credit) {
    return { ok: false, error: `Falha ao creditar: ${insErr?.message ?? '—'}` }
  }

  // Ledger (registro financeiro).
  const note = `InfinitePay manual grant${ref ? ` ref=${ref}` : ''} — pacote ${pkg.sku}, ${pkg.leituras_count} leituras (admin/terapeutas)`
  const { error: txErr } = await service.from('credit_transactions').insert({
    user_id: therapistId,
    credit_id: credit.id,
    type: 'purchase',
    amount: pkg.leituras_count,
    notes: note,
  })
  if (txErr) {
    console.error('[admin-therapists] grant ledger failed:', txErr.message)
  }

  console.log('[admin-therapists] MANUAL_GRANT', {
    therapistId,
    targetEmail: target.user.email,
    sku: pkg.sku,
    leituras: pkg.leituras_count,
    ref: ref || null,
    credit_id: credit.id,
    by: user.email,
    at: now.toISOString(),
  })

  revalidatePath('/admin/terapeutas')
  return { ok: true, leituras: pkg.leituras_count, expiresAt: expiresISO }
}

/**
 * Gera link de cadastro pro founder copiar e enviar via WhatsApp.
 * Hand-held protocol da Fase 11 + signup fix da Fase 11.1 (2026-05-26).
 *
 * Fluxo:
 * 1. Founder gate via isFounderEmail.
 * 2. Email normalize + validate.
 * 3. D-DUPE: check auth.users — bloqueia se já existe.
 * 4. INSERT em therapist_invites (token gerado pelo DB, expires_at default 7d).
 * 5. Retorna actionLink = ${siteUrl}/convite-terapeuta/${token}.
 *
 * Diferente da Fase 11 11-01: NÃO usa supabase.auth.admin.generateLink (que
 * causava bug PKCE com /dashboard como redirectTo). O novo flow vai pra
 * /convite-terapeuta/[token] que renderiza signup form com email
 * pré-preenchido + OTP no submit.
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

  // D-DUPE: bloqueia se email já em auth.users.
  // listUsers com perPage:1000 + verificação de total — aborta explicitamente
  // se houver mais de 1000 usuários para evitar falso-negativo silencioso.
  const { data: usersList, error: listErr } =
    await service.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) {
    return {
      ok: false,
      error: `Falha ao validar e-mail: ${listErr.message}`,
    }
  }
  if ((usersList as { total?: number }).total !== undefined &&
      (usersList as { total?: number }).total! > 1000) {
    // Segurança: se auth.users ultrapassou 1000 registros, a lista está
    // truncada e o D-DUPE não pode ser confiável. Aborta com erro explícito
    // em vez de continuar com verificação incompleta.
    return {
      ok: false,
      error: 'Não foi possível validar o e-mail: base de usuários muito grande. Contate o suporte.',
    }
  }
  const exists = (usersList?.users ?? []).some(
    (u) => (u.email ?? '').toLowerCase() === email,
  )
  if (exists) {
    return {
      ok: false,
      error: 'E-mail já cadastrado como terapeuta neste sistema.',
    }
  }

  // INSERT em therapist_invites — token gerado pelo DB.
  const { data: invite, error: insertErr } = await service
    .from('therapist_invites')
    .insert({
      email,
      invited_by: user.id,
    })
    .select('token')
    .single()

  if (insertErr || !invite) {
    return {
      ok: false,
      error: `Falha ao criar convite: ${insertErr?.message ?? 'sem token'}`,
    }
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://iriscodex.com'
  const actionLink = `${siteUrl}/convite-terapeuta/${invite.token}`

  console.log('[admin-therapists] INVITE_TOKEN_GENERATED', {
    targetEmail: email,
    tokenPrefix: invite.token.slice(0, 8), // debug correlation only — never full token
    userStatus: 'new_invited',
    by: user.email,
    at: new Date().toISOString(),
  })

  revalidatePath('/admin/terapeutas')
  return {
    ok: true,
    actionLink,
    userStatus: 'new_invited',
    email,
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
