'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdult, MIN_AGE } from '@/lib/gates/profile-completeness'
import {
  generateToken,
  validateToken,
  buildInviteUrl,
} from '@/lib/invite/tokens'

// ── Action 1: TERAPEUTA gera token ─────────────────────────────────────

export interface CreateInviteResult {
  url?: string
  expires_at?: string
  error?: string
}

/**
 * Terapeuta gera um convite single-use. clientId opcional:
 *   - null → cliente NOVO (form de cadastro inline em /convite/[token])
 *   - uuid → cliente JÁ CADASTRADO (skip cadastro, vai direto pra captura
 *     com re-consent 'reconfirm_device' + channel 'remote_link')
 *
 * notifyOnCapture (v2.9.0): se true (default), terapeuta recebe email
 * quando cliente completar as 6 fotos. Persistido na coluna
 * notify_on_capture_complete do token (migration 0034) — lido pelo
 * notify-therapist-capture-complete.ts pra decidir disparo.
 *
 * Validações server-side:
 *   - sessão obrigatória (auth.uid())
 *   - se clientId preenchido: RLS valida ownership do cliente
 *   - default expires_at = now + 7 dias (DB default)
 */
export async function createInviteTokenAction(
  clientId: string | null,
  notifyOnCapture: boolean = true,
): Promise<CreateInviteResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return { error: 'Não autenticado.' }
  }

  // Se clientId preenchido, valida ownership via RLS (SELECT — RLS de
  // clients limita ao therapist_id = auth.uid()).
  if (clientId) {
    const { data: owned, error: ownErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle()
    if (ownErr || !owned) {
      return { error: 'Cliente não encontrado ou sem permissão.' }
    }
  }

  // TERMO_GATE_BYPASS — BILLING-03 + LGPD-01 (D-19) — Decisão A+ (founder 2026-05-28).
  // O gate de termo biométrico NÃO é aplicado aqui (na criação do link de
  // convite). Razão: o consentimento biométrico pertence ao CLIENTE e é
  // assinado por ele NO PONTO DE CAPTURA do fluxo remote_link
  // (/convite/[token]/capturar), via passo de termo que precede a captura das
  // fotos (signInviteTermAction + consent_channel='remote_link'). Gatear na
  // geração do link forçaria o terapeuta a assinar pelo cliente — errado.
  // D-19 fala "antes de INICIAR captura", e a captura efetiva acontece no
  // /convite/[token]/capturar, não na geração do link.
  //
  // Onde o gate de termo VIVE de fato:
  //   - office_handoff: createReadingAction → assertClientTermoSigned (08-15 task 2)
  //   - remote_link:    /convite/[token]/capturar → passo de termo bloqueante
  //                     ANTES do CaptureClient (08-15 A+); cliente assina via
  //                     signInviteTermAction (app/actions/invite-consent.ts).
  //
  // Insert via session client (RLS policy aceita therapist_id = auth.uid()).
  // therapist_id é setado server-side a partir de user.id — não confia em
  // input do cliente.
  const token = generateToken()
  const service = createServiceClient()
  const { data, error } = await service
    .from('client_invite_tokens' as never)
    .insert({
      token,
      therapist_id: user.id,
      client_id: clientId,
      notify_on_capture_complete: notifyOnCapture,
    } as never)
    .select('expires_at')
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Falha ao gerar convite.' }
  }

  revalidatePath('/clientes')
  return {
    url: buildInviteUrl(token),
    expires_at: (data as { expires_at: string }).expires_at,
  }
}

// ── Action 2: PÚBLICO completa cadastro do cliente novo ────────────────

const newClientSchema = z
  .object({
    full_name: z.string().min(1, 'Nome é obrigatório'),
    birth_date: z.string().min(1, 'Data de nascimento é obrigatória'),
    biological_sex: z.enum(['feminino', 'masculino']),
    email: z
      .string()
      .min(1, 'E-mail é obrigatório')
      .refine((v) => /.+@.+\..+/.test(v), 'E-mail inválido'),
    phone: z.string().min(1, 'Telefone é obrigatório'),
    notes: z.string().max(2000).optional().nullable(),
    consent_accepted: z.boolean().refine((v) => v === true, 'Aceite o termo'),
  })
  .refine((d) => isAdult(d.birth_date) === true, {
    path: ['birth_date'],
    message: `É necessário ter ${MIN_AGE} anos ou mais.`,
  })

export type CompleteInviteFormState = {
  error?: Record<string, string[]> | string | null
}

/**
 * Path PÚBLICO — chamado de /convite/[token]/page.tsx pelo cliente sem
 * sessão. Valida o token (NÃO marca used_at — isso só na finalize da
 * captura), cria o client com therapist_id derivado do token, persiste
 * o consent ('initial' + 'remote_link'), e redireciona pra captura.
 *
 * NÃO valida sessão Supabase — token é o auth aqui. Service-role faz
 * tudo bypassando RLS.
 */
export async function completeInviteNewClientAction(
  token: string,
  _prevState: CompleteInviteFormState,
  formData: FormData,
): Promise<CompleteInviteFormState> {
  const validation = await validateToken(token)
  if (validation.status !== 'ok') {
    return { error: 'Convite inválido ou expirado.' }
  }
  // Se token já vinha com client_id, este endpoint é o errado (cliente
  // existente vai direto pra captura — não cadastra de novo).
  if (validation.token.client_id) {
    return { error: 'Este convite é para um cliente já cadastrado.' }
  }

  const parsed = newClientSchema.safeParse({
    full_name: formData.get('full_name'),
    birth_date: formData.get('birth_date'),
    biological_sex: formData.get('biological_sex'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    notes: formData.get('notes') || null,
    consent_accepted: formData.get('consent_accepted') === 'true',
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const service = createServiceClient()

  // 1. Cria o client com therapist_id do token (service-role; RLS bypassed).
  const { data: client, error: clientErr } = await service
    .from('clients')
    .insert({
      therapist_id: validation.token.therapist_id,
      full_name: parsed.data.full_name,
      birth_date: parsed.data.birth_date,
      biological_sex: parsed.data.biological_sex,
      email: parsed.data.email,
      phone: parsed.data.phone,
      notes: parsed.data.notes ?? null,
    })
    .select('id')
    .single()
  if (clientErr || !client) {
    return { error: clientErr?.message ?? 'Falha ao criar cliente.' }
  }

  // 2. Vincula client_id ao token. Sem isto, re-entrada do cliente
  //    (network drop mid-captura) cai no form de cadastro outra vez
  //    porque /convite/[token]/page.tsx checa validation.token.client_id
  //    pra decidir entre "Olá, X — começar leitura" e "form de cadastro".
  //    Guard idempotente (is null) evita race entre 2 submits paralelos.
  //    NÃO marca used_at — single-use é queimado só na finalize.
  await service
    .from('client_invite_tokens' as never)
    .update({ client_id: client.id } as never)
    .eq('id', validation.token.id)
    .is('client_id', null)

  // 3. Persiste consent — 'initial' + channel 'remote_link'. Termo vigente
  //    vem de consent_terms.is_current=true (0020). Se ainda não houver
  //    termo vigente (env não-semeado), o consent log entra sem term_version
  //    e o gate de produção falha — aceita risco no beta.
  const { data: currentTerm } = await service
    .from('consent_terms' as never)
    .select('version')
    .eq('is_current', true)
    .maybeSingle<{ version: string }>()
  if (currentTerm?.version) {
    await service.from('client_consents' as never).insert({
      client_id: client.id,
      term_version: currentTerm.version,
      event_type: 'initial',
      consent_channel: 'remote_link',
    } as never)
  }

  // 4. Redireciona pra captura (token segue na URL — auth pública).
  redirect(`/convite/${token}/capturar?client=${client.id}`)
}
