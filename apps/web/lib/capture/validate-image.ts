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

import type { QualityLevel } from './quality-scoring'

const VALIDATION_DIM = 512
const REQUEST_TIMEOUT_MS = 5000

export type ValidationReason =
  | 'olho_detectado'
  | 'sem_olho'
  | 'dois_olhos'
  | 'muito_longe'
  | 'borrado'
  | 'reflexo_total'
  | 'olho_fechado'

/** Reasons que BLOQUEIAM o botão Confirmar (sem chance de continuar).
    UAT 03 round 11: dois_olhos adicionado — captura é por olho individual.
    Phase 07.1.6 prep (2026-05-11): borrado + reflexo_total promovidos de
    soft-warning a hard-block — fotos sem fibras contáveis OU com reflexo
    cobrindo a íris destroem análise iridológica downstream (parser produz
    lixo, classifier produz lixo); melhor pedir refazer do que processar
    pixel-soup.
    2026-05-19 (founder): 'muito_longe' REBAIXADO a soft-warning — fotos
    boas estavam sendo recusadas por distância. Continua mostrando a
    mensagem, mas "Confirmar" fica habilitado (terapeuta decide). Borrão
    segue hard-block e foi endurecido no prompt do VLM. */
export const BLOCKING_REASONS: readonly string[] = [
  'sem_olho',
  'dois_olhos',
  'olho_fechado',
  'borrado',
  'reflexo_total',
]

export interface ValidationResult {
  /** Classificação do VLM. quality='ruim' = rejeição. */
  quality: QualityLevel
  reason: ValidationReason | string
  /** Marca o resultado quando veio de fallback (rede/timeout/erro), não do VLM. */
  source: 'vlm' | 'fallback'
  /** Erro humano-legível quando source='fallback'. */
  error?: string
}

/** Helper: VLM rejeitou (quality='ruim'). */
export function isVlmRejection(result: ValidationResult): boolean {
  return result.source === 'vlm' && result.quality === 'ruim'
}

/** Helper: VLM rejeitou com razão que impede o usuário de avançar. */
export function isBlockingRejection(result: ValidationResult): boolean {
  return isVlmRejection(result) && BLOCKING_REASONS.includes(result.reason)
}

/**
 * Resize aspect-preserving do blob original. NÃO corta nada — a foto inteira
 * vai pro VLM. Maior dimensão vira VALIDATION_DIM (512), menor é proporcional.
 *
 * Exemplo: 4032×3024 (4:3) → 512×384 (~196k px, ~262 tokens — vs ~349 tokens
 * do center-crop 512×512 anterior). Economia de ~25% em image tokens.
 *
 * Resultado é base64 sem prefixo `data:image/...`.
 *
 * NOTA: o blob ORIGINAL 4K que vai pro Supabase Storage (uploadWithRetry) é
 * outro objeto, não é tocado aqui. Esta função só prepara o que vai pro VLM.
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

  const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
  // Não up-scale: se imagem já é menor que VALIDATION_DIM, mantém como está.
  const scale = longEdge > VALIDATION_DIM ? VALIDATION_DIM / longEdge : 1
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    URL.revokeObjectURL(url)
    throw new Error('canvas 2d context unavailable')
  }
  ctx.drawImage(img, 0, 0, w, h)
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
 *
 * @param inviteToken opcional — quando presente, o body inclui o token
 *  para o endpoint /api/capture/validate aceitar como auth alternativo
 *  (path público /convite/[token]/capturar não tem sessão Supabase).
 */
export async function validateImageWithClaude(
  blob: Blob,
  inviteToken?: string,
): Promise<ValidationResult> {
  // Fallback graceful em qualquer falha de rede/timeout/parse: assume 'boa'
  // (não 'excelente' — não temos base pra afirmar isso) e não bloqueia o
  // terapeuta. Source='fallback' sinaliza no debug overlay que não houve
  // validação real.
  const fallback = (error: string): ValidationResult => ({
    quality: 'boa',
    reason: 'olho_detectado',
    source: 'fallback',
    error,
  })

  let imageBase64: string
  try {
    imageBase64 = await resizeBlobToBase64(blob)
  } catch (err) {
    return fallback(`resize failed: ${(err as Error).message}`)
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch('/api/capture/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteToken ? { imageBase64, inviteToken } : { imageBase64 }),
      signal: controller.signal,
    })
    window.clearTimeout(timeoutId)

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`)
      return fallback(`api error: ${res.status} ${errText.slice(0, 100)}`)
    }

    const data = (await res.json()) as { quality?: unknown; reason?: unknown }
    if (typeof data.quality !== 'string' || typeof data.reason !== 'string') {
      return fallback('invalid response shape')
    }
    return {
      quality: data.quality as QualityLevel,
      reason: data.reason,
      source: 'vlm',
    }
  } catch (err) {
    window.clearTimeout(timeoutId)
    const isAbort = (err as Error)?.name === 'AbortError'
    return fallback(isAbort ? 'timeout' : `network: ${(err as Error).message}`)
  }
}
