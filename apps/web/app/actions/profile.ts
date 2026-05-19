'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { buildSpecialties, phoneIsValidBR, MAX_SPECIALTIES } from '@/lib/profile/fields'
import { TOS_VERSION } from '@/lib/consent/tos'

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
