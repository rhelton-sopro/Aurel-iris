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
 * Retry resiliente p/ rede móvel ruim (2026-06-24). Cliente da Alessandra:
 * fotos 4K cruas (vários MB) caíam em 4G e só 3 de 6 chegavam. Sem comprimir
 * o arquivo (decisão do founder: manter 4K pela qualidade da íris), a defesa
 * é tentar mais vezes com backoff EXPONENCIAL + jitter (em vez de 2 fixas/
 * 800ms), o que reabsorve a maioria dos blips transitórios.
 *
 * 4 tentativas, delays ~600ms, 1.2s, 2.4s (×2 a cada falha) + jitter de até
 * 400ms pra não sincronizar várias fotos retentando ao mesmo tempo. O blob 4K
 * NÃO é recompactado entre tentativas (mesmo Blob reusado). AbortError (refazer
 * foto / sair) interrompe na hora sem retentar.
 *
 * Camada complementar (não está aqui): "block & retry" no fim da captura
 * (capture-client) garante que, mesmo se as 4 tentativas falharem, o cliente
 * é OBRIGADO a refazer as fotos faltantes antes de concluir — nada incompleto
 * passa. Próximo lever de confiabilidade (se ainda houver falha): upload
 * resumível TUS do Supabase.
 */
export async function uploadInvite(args: InviteUploadArgs): Promise<InviteUploadResult> {
  const MAX_ATTEMPTS = 4
  const BASE_DELAY_MS = 600
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
        const backoff = BASE_DELAY_MS * 2 ** (attempt - 1)
        const jitter = Math.floor(Math.random() * 400)
        await new Promise(r => setTimeout(r, backoff + jitter))
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
