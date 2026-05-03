/**
 * Validação de foto de íris via Claude Haiku 4.5 (server-side).
 *
 * Em vez de pixel-based pupil detection (que falhou em 5 rondas de UAT),
 * delega o gate de qualidade pra um VLM. Trade-offs documentados no UAT 03:
 * latência 500ms-1s, custo ~$0.00043/foto, requer rede.
 *
 * Pipeline:
 *   1. Resize do JPEG original (4K) pra 512×512 via canvas (economiza tokens)
 *   2. Converte canvas pra base64
 *   3. POST pro endpoint /api/capture/validate (route handler server-side
 *      mantém ANTHROPIC_API_KEY fora do bundle)
 *   4. Timeout 5s — failure mode é fallback pra valid:true (graceful)
 */

const VALIDATION_DIM = 512
const REQUEST_TIMEOUT_MS = 5000

export type ValidationReason =
  | 'olho_detectado'
  | 'sem_olho'
  | 'muito_longe'
  | 'borrado'
  | 'reflexo_total'
  | 'olho_fechado'

/** Reasons que BLOQUEIAM o botão Confirmar (sem chance de continuar). */
export const BLOCKING_REASONS: readonly string[] = ['sem_olho', 'olho_fechado']

export interface ValidationResult {
  valid: boolean
  reason: ValidationReason | string
  /** Marca o resultado quando veio de fallback (rede/timeout/erro), não do VLM. */
  source: 'vlm' | 'fallback'
  /** Erro humano-legível quando source='fallback'. */
  error?: string
}

/** Helper: VLM rejeitou com razão que impede o usuário de avançar. */
export function isBlockingRejection(result: ValidationResult): boolean {
  return result.source === 'vlm' && !result.valid && BLOCKING_REASONS.includes(result.reason)
}

/**
 * Resize do blob original pra 512×512 (center-crop quadrado + downscale).
 * Resultado é base64 sem prefixo `data:image/...`.
 */
async function resizeBlobToBase64(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch (err) {
    URL.revokeObjectURL(url)
    throw new Error(`decode failed: ${(err as Error).message}`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = VALIDATION_DIM
  canvas.height = VALIDATION_DIM
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    URL.revokeObjectURL(url)
    throw new Error('canvas 2d context unavailable')
  }

  // Center-crop quadrado + downscale pra 512×512.
  const minSrc = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - minSrc) / 2
  const sy = (img.naturalHeight - minSrc) / 2
  ctx.drawImage(img, sx, sy, minSrc, minSrc, 0, 0, VALIDATION_DIM, VALIDATION_DIM)
  URL.revokeObjectURL(url)

  // canvas.toDataURL retorna 'data:image/jpeg;base64,...' — extrai só o base64.
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  const commaIdx = dataUrl.indexOf(',')
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
}

/**
 * Valida se a foto contém um olho humano com íris visível adequada para
 * análise iridológica. Retorna fallback graceful (valid:true) em caso de
 * erro de rede/timeout — não bloqueia o terapeuta.
 */
export async function validateImageWithClaude(blob: Blob): Promise<ValidationResult> {
  let imageBase64: string
  try {
    imageBase64 = await resizeBlobToBase64(blob)
  } catch (err) {
    return {
      valid: true,
      reason: 'outro',
      source: 'fallback',
      error: `resize failed: ${(err as Error).message}`,
    }
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch('/api/capture/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    })
    window.clearTimeout(timeoutId)

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`)
      return {
        valid: true,
        reason: 'outro',
        source: 'fallback',
        error: `api error: ${res.status} ${errText.slice(0, 100)}`,
      }
    }

    const data = (await res.json()) as { valid?: unknown; reason?: unknown }
    if (typeof data.valid !== 'boolean' || typeof data.reason !== 'string') {
      return {
        valid: true,
        reason: 'outro',
        source: 'fallback',
        error: 'invalid response shape',
      }
    }
    return { valid: data.valid, reason: data.reason, source: 'vlm' }
  } catch (err) {
    window.clearTimeout(timeoutId)
    const isAbort = (err as Error)?.name === 'AbortError'
    return {
      valid: true,
      reason: 'outro',
      source: 'fallback',
      error: isAbort ? 'timeout' : `network: ${(err as Error).message}`,
    }
  }
}
