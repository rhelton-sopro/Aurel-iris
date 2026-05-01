'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Zod v4: usar .min(1, msg) não { required_error: msg }
const clientSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório'),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['masculino', 'feminino', 'outro', 'não_informado']).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export type ClientFormState = {
  error?: Record<string, string[]> | string | null
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const supabase = await createClient()
  // SEMPRE verificar autenticação no Server Action (não depender só do middleware — T-02-06)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/login')
  }

  const parsed = clientSchema.safeParse({
    full_name: formData.get('full_name'),
    birth_date: formData.get('birth_date') || null,
    gender: formData.get('gender') || null,
    notes: formData.get('notes') || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('clients')
    .insert({ ...parsed.data, therapist_id: user.id })

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  redirect('/clientes')
}

export async function updateClientAction(
  clientId: string,
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const supabase = await createClient()
  // SEMPRE verificar autenticação no Server Action (T-02-06)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/login')
  }

  const parsed = clientSchema.safeParse({
    full_name: formData.get('full_name'),
    birth_date: formData.get('birth_date') || null,
    gender: formData.get('gender') || null,
    notes: formData.get('notes') || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // RLS garante que só o dono (therapist_id = auth.uid()) pode atualizar
  const { error } = await supabase
    .from('clients')
    .update(parsed.data)
    .eq('id', clientId)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${clientId}`)
  redirect(`/clientes/${clientId}`)
}

export async function deleteClientAction(clientId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  // SEMPRE verificar autenticação no Server Action (T-02-06)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/login')
  }

  // RLS garante que só o dono pode deletar; cascade apaga leituras e imagens
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return {}
}
