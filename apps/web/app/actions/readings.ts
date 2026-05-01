'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  createReadingSchema,
  readingIdSchema,
} from './readings.schemas'

export type { ReadingFormState, DraftReading } from './readings.schemas'

/**
 * Cria um reading com status='pending', capture_method='mobile_camera'.
 * CONTEXT D-08: criação acontece ANTES da 1ª foto, para que reading_id
 * vire parte do storage_path desde o início (D-storage).
 *
 * Ao concluir, redireciona para /leituras/nova/capturar?reading=<id>
 * (rota implementada no plan 03-04).
 */
export async function createReadingAction(
  _prevState: ReadingFormState,
  formData: FormData
): Promise<ReadingFormState> {
  const supabase = await createClient()
  // SEMPRE verificar autenticação no Server Action (não depender só do middleware — T-02-06)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    redirect('/login')
  }

  const parsed = createReadingSchema.safeParse({
    client_id: formData.get('client_id'),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // RLS de clients (Fase 1 D-12) impede inserir reading apontando para client de outro terapeuta:
  // o INSERT abaixo só sucede se o client_id pertencer ao auth.uid() — caso contrário, FK constraint
  // ou RLS bloqueiam. therapist_id é definido server-side a partir de user.id (defesa em profundidade).
  const { data: reading, error } = await supabase
    .from('readings')
    .insert({
      client_id: parsed.data.client_id,
      therapist_id: user.id,
      status: 'pending',
      capture_method: 'mobile_camera',
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/leituras')
  // redirect lança throw — não retorna; tipo de retorno explícito mantido para clareza.
  redirect(`/leituras/nova/capturar?reading=${reading.id}`)
}

/**
 * Marca finalização do fluxo de captura. Nesta fase, status permanece 'pending'.
 * A transição 'pending' → 'processing' é responsabilidade da Fase 5 (Modal pipeline).
 */
export async function finalizeReadingAction(
  readingId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    redirect('/login')
  }

  const parsed = readingIdSchema.safeParse({ reading_id: readingId })
  if (!parsed.success) {
    return { error: 'reading_id inválido' }
  }

  // Fase 5: muda status para 'processing' aqui e dispara triggerVisionPipeline(reading_id).
  // Nesta fase apenas confirmamos a sessão e revalidamos os caches relevantes.
  revalidatePath('/leituras')
  revalidatePath(`/leituras/${parsed.data.reading_id}`)
  return {}
}

/**
 * Descarta um reading rascunho:
 *   1) Lista storage_paths via reading_images (RLS filtra para apenas próprios)
 *   2) Remove os blobs do bucket iris-captures (RLS de storage também valida)
 *   3) Deleta reading row — cascade apaga reading_images do banco
 *
 * CRÍTICO: cascade do banco NÃO apaga arquivos do Storage. Sem o passo 2,
 * blobs órfãos consomem cota.
 */
export async function discardReadingAction(
  readingId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    redirect('/login')
  }

  const parsed = readingIdSchema.safeParse({ reading_id: readingId })
  if (!parsed.success) {
    return { error: 'reading_id inválido' }
  }

  // 1) Listar storage_paths antes do delete (RLS de reading_images filtra para apenas próprios)
  const { data: images } = await supabase
    .from('reading_images')
    .select('storage_path')
    .eq('reading_id', parsed.data.reading_id)

  // 2) Remover blobs (best-effort: erro aqui não bloqueia o delete do reading row)
  if (images && images.length > 0) {
    const paths = images.map((i) => i.storage_path)
    await supabase.storage.from('iris-captures').remove(paths)
  }

  // 3) RLS garante ownership; cascade apaga reading_images
  const { error } = await supabase
    .from('readings')
    .delete()
    .eq('id', parsed.data.reading_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/leituras')
  return {}
}


/**
 * Retorna o rascunho mais recente do terapeuta (CONTEXT D-12 — recovery banner).
 * Critério: status='pending' AND count(reading_images) < 6.
 * Usa nested resource expansion do PostgREST para count.
 */
export async function getDraftReading(): Promise<DraftReading | null> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return null

  const { data: pending } = await supabase
    .from('readings')
    .select(`
      id,
      created_at,
      client_id,
      client:clients(full_name),
      reading_images(count)
    `)
    .eq('therapist_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!pending) return null

  for (const r of pending) {
    const captured = (r.reading_images?.[0]?.count as number | undefined) ?? 0
    if (captured < 6) {
      // O nested client retorna { full_name: string } | { full_name: string }[] dependendo
      // da forma da relação; tratar ambos.
      const clientObj = Array.isArray(r.client) ? r.client[0] : r.client
      return {
        id: r.id,
        created_at: r.created_at ?? '',
        client_id: r.client_id,
        client_name: clientObj?.full_name ?? 'Cliente',
        imagesCaptured: captured,
      }
    }
  }
  return null
}
