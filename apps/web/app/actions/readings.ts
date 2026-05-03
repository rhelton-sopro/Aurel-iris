'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  createReadingSchema,
  readingIdSchema,
  CAPTURE_METHODS,
  type CaptureMethod,
  type ReadingFormState,
  type DraftReading,
} from './readings.schemas'

// CONTEXT D-04 (Fase 4): types/database.ts tipa capture_method como string|null
// (Supabase nao captura o CHECK constraint do enum). Narrow seguro: valida contra
// CAPTURE_METHODS e cai em 'mobile_camera' se vier valor inesperado (defesa em
// profundidade — em prod o CHECK do banco impede valores fora da whitelist).
function narrowCaptureMethod(value: string | null | undefined): CaptureMethod {
  return value && (CAPTURE_METHODS as readonly string[]).includes(value)
    ? (value as CaptureMethod)
    : 'mobile_camera'
}

export type { ReadingFormState, DraftReading } from './readings.schemas'

/**
 * Cria um reading com status='pending' e capture_method derivado do FormData.
 * CONTEXT D-08: criação acontece ANTES da 1ª foto, para que reading_id
 * vire parte do storage_path desde o início (D-storage).
 *
 * CONTEXT D-03 (Fase 4): aceita campo `method` no FormData (hidden input ou
 * value de submit-button) ∈ {'mobile_camera', 'desktop_upload'}. Default
 * 'mobile_camera' (no schema) garante compat retroativa com chamadas Fase 3
 * que não enviam o campo. Imutabilidade no draft (D-04) é responsabilidade
 * do page.tsx do upload (guard se reading.capture_method !== 'desktop_upload').
 *
 * Ao concluir, redireciona condicionalmente:
 *   - method='mobile_camera' → /leituras/nova/capturar?reading=<id> (Fase 3, plan 03-04)
 *   - method='desktop_upload' → /leituras/nova/upload?reading=<id> (Fase 4, plan 04-05)
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

  // CONTEXT D-03: lê method do FormData. `formData.get` retorna null quando
  // ausente; passar `undefined` ativa o default do Zod (`.default('mobile_camera')`).
  // Tampering (T-04-02-01) é mitigado pelo z.enum — valor fora da whitelist
  // faz safeParse falhar e retorna error sem inserir.
  const rawMethod = formData.get('method')
  const parsed = createReadingSchema.safeParse({
    client_id: formData.get('client_id'),
    method: rawMethod ?? undefined,
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
      // CONTEXT D-03: capture_method vem do schema validado (não mais hardcoded).
      capture_method: parsed.data.method,
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/leituras')
  // CONTEXT D-03: routing por método. Desktop -> /upload, mobile (default) -> /capturar.
  // redirect lança throw — não retorna; tipo de retorno explícito mantido para clareza.
  const destination = parsed.data.method === 'desktop_upload'
    ? `/leituras/nova/upload?reading=${reading.id}`
    : `/leituras/nova/capturar?reading=${reading.id}`
  redirect(destination)
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
 * Persiste as reading_images após upload do cliente para o Storage.
 * Usa upsert em (reading_id, eye, angle) para suportar retake sem duplicar linhas.
 */
export async function saveReadingImagesAction(
  readingId: string,
  images: { eye: string; angle: string; storagePath: string; qualityScore: number; width: number; height: number }[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const parsed = readingIdSchema.safeParse({ reading_id: readingId })
  if (!parsed.success) return { error: 'reading_id inválido' }

  const rows = images.map(img => ({
    reading_id: parsed.data.reading_id,
    eye: img.eye,
    angle: img.angle,
    storage_path: img.storagePath,
    quality_score: img.qualityScore,
    width: img.width,
    height: img.height,
  }))

  const { error } = await supabase
    .from('reading_images')
    .upsert(rows, { onConflict: 'reading_id,eye,angle' })

  if (error) return { error: error.message }

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
 * Apaga readings com 0/6 imagens criados há mais de 1 hora (do terapeuta atual).
 * Chamado no carregamento de /leituras para garbage-collect rascunhos abandonados
 * antes da 1ª foto. Não toca em readings com pelo menos 1 imagem capturada.
 *
 * Não emite revalidatePath nem redirect — apenas limpeza silenciosa.
 */
export async function cleanupStaleEmptyReadingsAction(): Promise<{ deleted: number }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return { deleted: 0 }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: stale } = await supabase
    .from('readings')
    .select('id, reading_images(count)')
    .eq('therapist_id', user.id)
    .eq('status', 'pending')
    .lt('created_at', oneHourAgo)

  if (!stale || stale.length === 0) return { deleted: 0 }

  const idsToDelete = stale
    .filter((r) => {
      const count = (r.reading_images?.[0]?.count as number | undefined) ?? 0
      return count === 0
    })
    .map((r) => r.id)

  if (idsToDelete.length === 0) return { deleted: 0 }

  const { error } = await supabase.from('readings').delete().in('id', idsToDelete)
  if (error) {
    // Best-effort: log e segue. Falha não deve quebrar a página.
    console.warn('[cleanupStaleEmptyReadings] erro:', error.message)
    return { deleted: 0 }
  }

  return { deleted: idsToDelete.length }
}

/**
 * Retorna o rascunho mais recente do terapeuta (CONTEXT D-12 — recovery banner).
 * Critério: status='pending' AND count(reading_images) < 6.
 * Usa nested resource expansion do PostgREST para count.
 *
 * CONTEXT D-15 (Fase 4): retorna `capture_method` no payload — consumido pelo
 * RecoveryBanner (Fase 9) para rotear "Continuar" para /upload?reading=&resume=true
 * (desktop) ou /capturar?reading=&resume=true (mobile).
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
      capture_method,
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
        // CONTEXT D-15: RecoveryBanner usa capture_method para rotear /upload vs /capturar.
        // narrowCaptureMethod garante o tipo CaptureMethod (DB pode retornar string|null).
        capture_method: narrowCaptureMethod(r.capture_method),
      }
    }
  }
  return null
}
