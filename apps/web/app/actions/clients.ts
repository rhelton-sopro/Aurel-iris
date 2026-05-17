'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { MIN_AGE, isAdult } from '@/lib/gates/profile-completeness'

// Zod v4: .min(1, msg). Regra de obrigatórios + maioridade vem da FONTE
// ÚNICA (lib/gates/profile-completeness) — Zod e o gate não divergem.
const clientSchema = z
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
  })
  .refine((d) => isAdult(d.birth_date) === true, {
    path: ['birth_date'],
    message: `É necessário ter ${MIN_AGE} anos ou mais.`,
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
    birth_date: formData.get('birth_date'),
    biological_sex: formData.get('biological_sex'),
    email: formData.get('email'),
    phone: formData.get('phone'),
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
    birth_date: formData.get('birth_date'),
    biological_sex: formData.get('biological_sex'),
    email: formData.get('email'),
    phone: formData.get('phone'),
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

/**
 * Exclusão LGPD-completa do cliente (direito à eliminação, LGPD art. 18).
 *
 * Cascade do banco apaga LINHAS (readings, reading_images via FK ON DELETE
 * CASCADE de 0001) mas NÃO apaga blobs do Storage nem PII em tabelas sem
 * FK-cascade. NÃO existe email_verifications (cortada no MVP). Por isso:
 *   1. auth + OWNERSHIP (RLS) — gate antes de qualquer op service-role.
 *   2. lista storage_path + canonical_storage_path das imagens do cliente.
 *   3. remove blobs biométricos (best-effort — não bloqueia a eliminação).
 *   4. service-role: anonimiza client_consents (ip/user_agent → NULL) ANTES
 *      do delete (RLS não tem UPDATE p/ terapeuta — append-only).
 *   5. service-role: zera report_generations.client_id (sem FK, founder-RLS).
 *   6. delete clients (RLS reforça ownership) → cascade readings +
 *      reading_images; client_consents.client_id → NULL (FK SET NULL 0020)
 *      preserva a prova jurídica anonimizada (art. 16).
 */
export async function deleteClientAction(
  clientId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    redirect('/login')
  }

  // (1) Ownership provado com o client do usuário (RLS) ANTES de service-role.
  const { data: owned, error: ownErr } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle()
  if (ownErr) return { error: ownErr.message }
  if (!owned) return { error: 'Cliente não encontrado.' }

  // (2) storage_path + canonical_storage_path de todas as imagens (RLS filtra).
  const { data: readingsRows } = await supabase
    .from('readings')
    .select('id, reading_images(storage_path, canonical_storage_path)')
    .eq('client_id', clientId)

  const paths: string[] = []
  for (const r of Array.isArray(readingsRows) ? readingsRows : []) {
    const imgs = (r as { reading_images?: unknown }).reading_images
    for (const img of Array.isArray(imgs) ? imgs : []) {
      const p = img as {
        storage_path?: string | null
        canonical_storage_path?: string | null
      }
      if (p.storage_path) paths.push(p.storage_path)
      if (p.canonical_storage_path) paths.push(p.canonical_storage_path)
    }
  }

  // (3) Remove blobs biométricos (best-effort — não bloqueia a eliminação).
  if (paths.length > 0) {
    const { error: rmErr } = await supabase.storage
      .from('iris-captures')
      .remove(paths)
    if (rmErr) {
      console.error(
        `[deleteClient] storage remove falhou client=${clientId} n=${paths.length}: ${rmErr.message}`,
      )
    }
  }

  // (4)+(5) Anonimização — service-role (RLS bloqueia p/ terapeuta).
  // Best-effort: FK ON DELETE SET NULL é a rede de segurança do desvínculo.
  const service = createServiceClient()

  const { error: consentErr } = await service
    .from('client_consents')
    .update({ ip: null, user_agent: null })
    .eq('client_id', clientId)
  if (consentErr) {
    console.error(
      `[deleteClient] anon client_consents falhou client=${clientId}: ${consentErr.message}`,
    )
  }

  const { error: genErr } = await service
    .from('report_generations')
    .update({ client_id: null })
    .eq('client_id', clientId)
  if (genErr) {
    console.error(
      `[deleteClient] report_generations.client_id null falhou client=${clientId}: ${genErr.message}`,
    )
  }

  // (6) Delete (RLS reforça ownership) → cascade readings + reading_images.
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return {}
}
