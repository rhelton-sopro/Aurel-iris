import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Eye } from './iris-geometry'
import type { Angle } from './sequence'
import { buildOriginalStoragePath } from './storage-path'

const BUCKET = 'iris-captures'

export interface UploadArgs {
  supabase: SupabaseClient<Database>
  /** JPEG original da câmera nativa, sem recompressão mobile. */
  blob: Blob
  /** Largura/altura em pixels do JPEG original. */
  width: number
  height: number
  therapistId: string
  readingId: string
  eye: Eye
  angle: Angle
  qualityScore: number
  /**
   * AbortSignal para cancelar uploads obsoletos (Refazer cancela o slot atual).
   * Quando signal.aborted=true, lança AbortError imediatamente.
   */
  signal?: AbortSignal
}

export interface UploadResult {
  path: string
}

/**
 * Sobe o JPEG original ao Storage e insere/atualiza reading_images via upsert
 * por (reading_id, eye, angle).
 *
 * RLS:
 *  - storage.objects: folder[1] = auth.uid() (bucket iris-captures, migration 0004)
 *  - reading_images: reading.therapist_id = auth.uid()
 *
 * Convenção: storage_path em reading_images aponta para o ORIGINAL sob
 * `{therapist}/{reading}/originais/{eye}_{angle}.jpg`. O crop iridológico
 * é feito pelo pipeline Modal da Fase 5 (não no mobile) — recompressão JPEG
 * client-side degrada a imagem 4K e é inaceitável para iridologia.
 *
 * T-03-07-01: path inclui therapistId + readingId → RLS folder-based bloqueia cross-tenant.
 * T-03-07-02: AbortController por slot cancela upload obsoleto em redo.
 * T-03-07-03: storage_path não aparece em toasts/logs UI — apenas slot.eye/slot.angle.
 */
export async function uploadCaptureImage(args: UploadArgs): Promise<UploadResult> {
  const {
    supabase,
    blob,
    width,
    height,
    therapistId,
    readingId,
    eye,
    angle,
    qualityScore,
    signal,
  } = args

  if (signal?.aborted) {
    throw new DOMException('Upload abortado', 'AbortError')
  }

  const path = buildOriginalStoragePath(therapistId, readingId, eye, angle)

  const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })

  if (signal?.aborted) {
    throw new DOMException('Upload abortado', 'AbortError')
  }
  if (storageError) {
    throw new Error(`[upload] storage falhou: ${storageError.message}`)
  }

  const { error: dbError } = await supabase.from('reading_images').upsert(
    {
      reading_id: readingId,
      eye,
      angle,
      storage_path: path,
      quality_score: qualityScore,
      width,
      height,
    },
    { onConflict: 'reading_id,eye,angle' },
  )

  if (dbError) {
    throw new Error(`[upload] insert reading_images falhou: ${dbError.message}`)
  }

  return { path }
}

/**
 * Wrapper com retry exponencial (CONTEXT: 2 tentativas com backoff 1s, 2s).
 * Não faz retry em AbortError (intencional via signal).
 */
export async function uploadWithRetry(
  args: UploadArgs,
  maxAttempts = 2,
): Promise<UploadResult> {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (args.signal?.aborted) {
      throw new DOMException('Upload abortado', 'AbortError')
    }
    try {
      return await uploadCaptureImage(args)
    } catch (e) {
      const err = e as Error
      lastError = err
      if (err.name === 'AbortError') throw err
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
    }
  }
  throw lastError ?? new Error('[upload] desconhecido')
}
