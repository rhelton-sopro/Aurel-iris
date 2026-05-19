'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { buildSpecialties, phoneIsValidBR, MAX_SPECIALTIES } from '@/lib/profile/fields'
import { TOS_VERSION } from '@/lib/consent/tos'
import { MIN_AGE, isAdult } from '@/lib/gates/profile-completeness'

// 'use server': SÓ funções async exportadas. Schema/tipos ficam internos
// (export viraria stub RPC no bundle client — feedback use-server-export).
export async function completeProfileAction(input: {
  phone: string
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
      specialties: finalSpecialties,
      tos_accepted_at: new Date().toISOString(),
      tos_version: TOS_VERSION,
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'Não foi possível salvar agora. Tente novamente.' }
  }

  redirect('/dashboard')
}

// Autoexame (Cluster 2c): o terapeuta como examinado. Singleton por
// terapeuta via find-or-create (clients.is_self=true) — sem migração extra.
// Identidade vem do profile; pede só o mínimo clínico (DOB + sexo). Cai no
// fluxo normal de /leituras/nova → cap de 2 leituras inalterado.
export async function startSelfExamAction(input: {
  birth_date: string
  biological_sex: 'feminino' | 'masculino'
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

  redirect(`/leituras/nova?cliente=${clientId}`)
}
