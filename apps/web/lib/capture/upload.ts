import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Eye } from './iris-geometry'
import type { Angle } from './sequence'
import { buildCroppedStoragePath, buildOriginalStoragePath } from './storage-path'

const BUCKET = 'iris-captures'

export interface UploadArgs {
  supabase: SupabaseClient<Database>
  /** JPEG do recorte centrado na íris (consumido pela UI/preview). */
  croppedBlob: Blob
  /** Dimensões do JPEG recortado (já após compressão). */
  croppedWidth: number
  croppedHeight: number
  /**
   * JPEG original em alta resolução (consumido pelo pipeline Modal da Fase 5).
   * Quando ausente, faz upload apenas do recortado — fallback para devices que
   * falharem em ImageCapture / takePhotoBlob.
   */
  originalBlob?: Blob
  therapistId: string
  readingId: string
  eye: Eye
  angle: Angle
  qualityScore: number
  /**
   * AbortSignal para cancelar uploads concorrentes (tap-to-redo — T-03-07-02).
   * Quando signal.aborted=true, lança AbortError imediatamente.
   */
  signal?: AbortSignal
}

export interface UploadResult {
  croppedPath: string
  originalPath: string | null
}

/**
 * Sobe os dois blobs ao Storage (recortado + original quando disponível) em
 * paralelo e insere/atualiza reading_images com path do RECORTADO.
 *
 * RLS:
 *  - storage.objects: folder[1] = auth.uid() (bucket iris-captures, migration 0004)
 *  - reading_images: reading.therapist_id = auth.uid()
 *
 * Convenção: reading_images.storage_path = path do recortado. O path do
 * original é descoberto trocando "/recortadas/" por "/originais/".
 *
 * T-03-07-01: paths incluem therapistId + readingId → RLS folder-based bloqueia cross-tenant.
 * T-03-07-02: AbortController por slot cancela upload obsoleto em tap-to-redo.
 * T-03-07-03: storage_path não aparece em toasts/logs UI — apenas slot.eye/slot.angle.
 */
export async function uploadCaptureImage(args: UploadArgs): Promise<UploadResult> {
  const {
    supabase,
    croppedBlob,
    croppedWidth,
    croppedHeight,
    originalBlob,
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

  const croppedPath = buildCroppedStoragePath(therapistId, readingId, eye, angle)
  const originalPath = originalBlob
    ? buildOriginalStoragePath(therapistId, readingId, eye, angle)
    : null

  const uploads: Promise<{ error: { message: string } | null }>[] = [
    supabase.storage.from(BUCKET).upload(croppedPath, croppedBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    }),
  ]
  if (originalBlob && originalPath) {
    uploads.push(
      supabase.storage.from(BUCKET).upload(originalPath, originalBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      })
    )
  }

  const results = await Promise.all(uploads)

  if (signal?.aborted) {
    throw new DOMException('Upload abortado', 'AbortError')
  }

  const croppedErr = results[0]?.error
  if (croppedErr) {
    throw new Error(`[upload] storage recortado falhou: ${croppedErr.message}`)
  }
  // Original é best-effort — falha não bloqueia (UI usa o recortado).
  const originalErr = results[1]?.error
  if (originalErr) {
    console.warn('[upload] storage original falhou:', originalErr.message)
  }

  // Insert/update reading_images (upsert pelo UNIQUE reading_id+eye+angle — migration 0004)
  const { error: dbError } = await supabase
    .from('reading_images')
    .upsert(
      {
        reading_id: readingId,
        eye,
        angle,
        storage_path: croppedPath,
        quality_score: qualityScore,
        width: croppedWidth,
        height: croppedHeight,
      },
      { onConflict: 'reading_id,eye,angle' }
    )

  if (dbError) {
    throw new Error(`[upload] insert reading_images falhou: ${dbError.message}`)
  }

  return {
    croppedPath,
    originalPath: originalErr ? null : originalPath,
  }
}

/**
 * Wrapper com retry exponencial (CONTEXT: 2 tentativas com backoff 1s, 2s).
 * Não faz retry em AbortError (tap-to-redo cancela intencionalmente).
 *
 * T-03-07-04: toast persistente quando todos os retries falham (tratado no caller).
 */
export async function uploadWithRetry(
  args: UploadArgs,
  maxAttempts = 2
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
      // AbortError não deve ser retentado — é intencional (tap-to-redo)
      if (err.name === 'AbortError') throw err
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
    }
  }
  throw lastError ?? new Error('[upload] desconhecido')
}
