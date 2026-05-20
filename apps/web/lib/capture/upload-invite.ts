/**
 * Client-side helper que faz upload de uma foto via API token-authed
 * (/api/convite/[token]/upload). Mesma assinatura conceitual de
 * uploadCaptureImage/uploadWithRetry — capture-client troca de uma p/
 * outra via prop `inviteToken`.
 *
 * Não usa supabase client (não há sessão no path público). multipart/
 * form-data com blob + metadata. API faz upload service-role.
 *
 * AbortSignal igual ao da rota authed: se signal.aborted, lança
 * AbortError antes do fetch.
 */

import type { Eye } from './iris-geometry'
import type { Angle } from './sequence'

export interface InviteUploadArgs {
  /** JPEG original (4K). */
  blob: Blob
  width: number
  height: number
  readingId: string
  eye: Eye
  angle: Angle
  qualityScore: number
  inviteToken: string
  signal?: AbortSignal
}

export interface InviteUploadResult {
  path: string
}

/**
 * 1 tentativa + 1 retry no fail geral (matches uploadWithRetry maxAttempts=2),
 * SEM re-subir o blob 4K no retry interno do server (server faz seu próprio
 * retry de DB insert internamente como uploadCaptureImage faz no path authed).
 */
export async function uploadInvite(args: InviteUploadArgs): Promise<InviteUploadResult> {
  const MAX_ATTEMPTS = 2
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (args.signal?.aborted) {
      throw new DOMException('Upload abortado', 'AbortError')
    }
    try {
      return await uploadOnce(args)
    } catch (e) {
      const err = e as Error
      lastError = err
      if (err.name === 'AbortError') throw err
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 800))
      }
    }
  }
  throw lastError ?? new Error('[upload-invite] desconhecido')
}

async function uploadOnce(args: InviteUploadArgs): Promise<InviteUploadResult> {
  const form = new FormData()
  form.append('blob', args.blob, 'capture.jpg')
  form.append('reading_id', args.readingId)
  form.append('eye', args.eye)
  form.append('angle', args.angle)
  form.append('width', String(args.width))
  form.append('height', String(args.height))
  form.append('quality_score', String(args.qualityScore))

  const res = await fetch(`/api/convite/${encodeURIComponent(args.inviteToken)}/upload`, {
    method: 'POST',
    body: form,
    signal: args.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[upload-invite] HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as InviteUploadResult
}

/** Finalize via API token-authed. Marca token used_at e retorna. */
export async function finalizeInvite(
  inviteToken: string,
  readingId: string,
  clientId: string,
): Promise<void> {
  const res = await fetch(`/api/convite/${encodeURIComponent(inviteToken)}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reading_id: readingId, client_id: clientId }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[finalize-invite] HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
}
