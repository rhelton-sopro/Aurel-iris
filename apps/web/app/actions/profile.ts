'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'

import { buildSpecialties, phoneIsValidBR, MAX_SPECIALTIES } from '@/lib/profile/fields'
import { TOS_VERSION } from '@/lib/consent/tos'
import { MIN_AGE, isAdult } from '@/lib/gates/profile-completeness'
import { isValidCpf, cpfDigits } from '@/lib/auth/cpf'
import { signBiometricTerm } from '@/lib/consent/sign'
import { logAuditEvent } from '@/lib/audit/log'

// 'use server': SÓ funções async exportadas. Schema/tipos ficam internos
// (export viraria stub RPC no bundle client — feedback use-server-export).
export async function completeProfileAction(input: {
  phone: string
  cpf: string
  specialties: string[]
  otherText: string
  tosAccepted: boolean
}): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  // SEMPRE reautenticar no server action (não confiar só no middleware).
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const schema = z.object({
    phone: z.string().refine(phoneIsValidBR, 'Telefone inválido (DDD + número)'),
    cpf: z.string().refine((v) => isValidCpf(v), 'CPF inválido'),
    specialties: z
      .array(z.string())
      .min(1, 'Selecione ao menos 1 especialidade')
      .max(MAX_SPECIALTIES, `No máximo ${MAX_SPECIALTIES} especialidades`),
    otherText: z.string(),
    tosAccepted: z
      .boolean()
      .refine((v) => v === true, 'É necessário aceitar os Termos e a Política'),
  })

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const finalSpecialties = buildSpecialties(
    parsed.data.specialties,
    parsed.data.otherText,
  )
  if (finalSpecialties.length < 1) {
    return { error: 'Informe ao menos uma especialidade válida.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      phone: parsed.data.phone,
      cpf: cpfDigits(parsed.data.cpf), // sempre dígitos (D-12)
      specialties: finalSpecialties,
      tos_accepted_at: new Date().toISOString(),
      tos_version: TOS_VERSION,
    })
    .eq('id', user.id)

  if (error) {
    // 23505 UNIQUE violation — CPF já cadastrado (anti-fraud trial D-12).
    // Distingue CPF de outras colisões para mensagem humana.
    if ((error as { code?: string }).code === '23505') {
      const msg = error.message?.toLowerCase() ?? ''
      if (msg.includes('cpf') || msg.includes('profiles_cpf_unique')) {
        return { error: 'Já existe cadastro com este CPF. Faça login.' }
      }
      return { error: 'Dados duplicados detectados. Faça login se já possui conta.' }
    }
    return { error: 'Não foi possível salvar agora. Tente novamente.' }
  }

  redirect('/dashboard')
}

// Edição básica de perfil (founder 2026-05-30): terapeuta re-edita nome +
// telefone via /perfil/editar (menu do avatar). CPF/especialidades NÃO entram
// aqui — CPF já foi pro Asaas como customer (mudar dessincroniza), e o escopo
// pedido foi o mínimo. Diferente de completeProfileAction (gate de onboarding).
export async function updateProfileBasicAction(input: {
  fullName: string
  phone: string
}): Promise<{ error?: string; ok?: true }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const schema = z.object({
    fullName: z.string().trim().min(2, 'Nome muito curto').max(120, 'Nome muito longo'),
    phone: z.string().refine(phoneIsValidBR, 'Telefone inválido (DDD + número)'),
  })

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'Não foi possível salvar agora. Tente novamente.' }
  }

  return { ok: true }
}

// Autoexame (Cluster 2c): o terapeuta como examinado. Singleton por
// terapeuta via find-or-create (clients.is_self=true) — sem migração extra.
// Identidade vem do profile; pede só o mínimo clínico (DOB + sexo). Cai no
// fluxo normal de /leituras/nova → cap de 2 leituras inalterado.
export async function startSelfExamAction(input: {
  birth_date: string
  biological_sex: 'feminino' | 'masculino'
  /** LGPD-01: aceite EXPLÍCITO e destacado da captura biométrica da PRÓPRIA íris.
   *  Consentimento específico (não diluído no ToS do signup) — founder 2026-05-31. */
  consent_accepted: boolean
}): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const schema = z
    .object({
      birth_date: z.string().min(1, 'Data de nascimento é obrigatória'),
      biological_sex: z.enum(['feminino', 'masculino']),
      consent_accepted: z.boolean().refine((v) => v === true, {
        message: 'É necessário autorizar a captura da sua íris para continuar.',
      }),
    })
    .refine((d) => isAdult(d.birth_date) === true, {
      path: ['birth_date'],
      message: `É necessário ter ${MIN_AGE} anos ou mais.`,
    })

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  const identity = {
    full_name: profile?.full_name ?? 'Meu exame',
    email: user.email ?? null,
    phone: profile?.phone ?? null,
  }

  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('therapist_id', user.id)
    .eq('is_self', true)
    .maybeSingle()

  let clientId: string
  if (existing?.id) {
    const { error } = await supabase
      .from('clients')
      .update({
        ...identity,
        birth_date: parsed.data.birth_date,
        biological_sex: parsed.data.biological_sex,
      })
      .eq('id', existing.id)
    if (error) return { error: 'Não foi possível salvar. Tente novamente.' }
    clientId = existing.id
  } else {
    const { data: ins, error } = await supabase
      .from('clients')
      .insert({
        therapist_id: user.id,
        is_self: true,
        ...identity,
        birth_date: parsed.data.birth_date,
        biological_sex: parsed.data.biological_sex,
      })
      .select('id')
      .single()
    if (error || !ins) return { error: 'Não foi possível criar. Tente novamente.' }
    clientId = ins.id
  }

  // LGPD-01: registra o consentimento biométrico EXPLÍCITO do titular (o próprio
  // terapeuta). Mesma trilha do termo de cliente — INSERT append-only em
  // client_consents + current-pointer em clients + logAuditEvent — pelo canal
  // 'therapist_created'. Sem PDF Gotenberg: a linha de aceite destacada na UI +
  // IP/UA/timestamp na trilha são a evidência (titular consentindo do próprio
  // dado). Isso faz assertClientTermoSigned aprovar a self-client na criação da
  // leitura (senão o autoexame travaria no termo-gate).
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
  const ua = h.get('user-agent') ?? null

  const sign = await signBiometricTerm({
    client_id: clientId,
    reading_id: null,
    consent_channel: 'therapist_created',
    ip,
    user_agent: ua,
  })
  if (!sign.ok) {
    return {
      error: 'Não foi possível registrar a autorização. Tente novamente.',
    }
  }

  const service = createServiceClient()
  await service
    .from('clients')
    .update({
      consent_current_version: sign.term_version,
      consent_last_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .eq('therapist_id', user.id) // defensivo

  await logAuditEvent({
    event_type: 'consent.term_signed',
    actor_user_id: user.id,
    actor_email: user.email,
    target_type: 'consent',
    target_id: sign.consent_id,
    metadata: {
      client_id: clientId,
      reading_id: null,
      term_version: sign.term_version,
      consent_channel: 'therapist_created',
      ip,
      is_self: true,
    },
  })

  redirect(`/leituras/nova?cliente=${clientId}`)
}
