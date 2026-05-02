/**
 * Análise leve pós-captura do JPEG salvo.
 *
 * NÃO bloqueia o fluxo — produz alertas sugestivos exibidos pela CapturePreview
 * para o usuário decidir refazer ou continuar.
 *
 * Hierarquia de fontes:
 * 1. Score do streaming (MediaPipe em tempo real) é a fonte primária. Se o score
 *    final do streaming foi ≥ STREAMING_BYPASS_THRESHOLD, a captura é considerada
 *    boa e o overlay é suprimido — o frame inteiro já foi avaliado on-device.
 * 2. Laplacian variance + tamanho da íris no JPEG são checagens secundárias,
 *    aplicadas apenas quando o score do streaming indica qualidade incerta.
 *
 * Critérios secundários:
 * - Nitidez: variância de Laplaciana < 80 → alerta de imagem pouco nítida
 * - Tamanho da íris: raio da íris no JPEG / min(jpegW,jpegH) < 0.15 → alerta
 *
 * Performance: ~30–60ms em JPEGs > 1024px (createImageBitmap + downscale 512×512
 * + laplacianVariance) em Android mid-tier; pulado quando streamingScore alto.
 */

import { laplacianVariance } from './laplacian-variance'

const ANALYSIS_DIM = 512
const SHARPNESS_ALERT_THRESHOLD = 80
const IRIS_RATIO_ALERT_THRESHOLD = 0.15
/**
 * Score do streaming ≥ este limiar suprime totalmente o overlay pós-captura.
 * Mesmo valor de SCORE_BYPASS_THRESHOLD em capture-client (Boa/Excelente).
 */
const STREAMING_BYPASS_THRESHOLD = 0.70

export interface PostCaptureAnalysis {
  /** Variância de Laplaciana medida no JPEG (downscale 512×512). 0 quando suprimido. */
  laplacianVariance: number
  /** Raio da íris no JPEG / min(jpegW, jpegH). */
  irisRatio: number
  /** Score do streaming no momento da captura (informativo). */
  streamingScore: number
  sharpnessAlert: boolean
  irisAlert: boolean
  hasAlert: boolean
}

/**
 * @param blob JPEG comprimido pelo `compressFrameToJpeg`.
 * @param irisRadiusInJpeg Raio da íris já em pixels do JPEG salvo (calculado
 *                         pelo caller a partir do raio em px do vídeo + ratio
 *                         de compressão / crop).
 * @param jpegW Largura do JPEG salvo.
 * @param jpegH Altura do JPEG salvo.
 * @param streamingScore Score do streaming MediaPipe no momento da captura.
 *                       Quando ≥ 0.70, o overlay é suprimido.
 */
export async function analyzeCapturedJpeg(
  blob: Blob,
  irisRadiusInJpeg: number,
  jpegW: number,
  jpegH: number,
  streamingScore: number,
): Promise<PostCaptureAnalysis> {
  const jpegMinDim = Math.min(jpegW, jpegH)
  const irisRatio = jpegMinDim > 0 ? irisRadiusInJpeg / jpegMinDim : 0

  // Score alto bypassa Laplacian — frame inteiro já avaliado em tempo real
  if (streamingScore >= STREAMING_BYPASS_THRESHOLD) {
    return {
      laplacianVariance: 0,
      irisRatio,
      streamingScore,
      sharpnessAlert: false,
      irisAlert: false,
      hasAlert: false,
    }
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return makeResult(0, irisRatio, streamingScore)
  }

  const canvas = document.createElement('canvas')
  canvas.width = ANALYSIS_DIM
  canvas.height = ANALYSIS_DIM
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    bitmap.close()
    return makeResult(0, irisRatio, streamingScore)
  }

  // Center crop quadrado + downscale para 512×512
  const minSrc = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - minSrc) / 2
  const sy = (bitmap.height - minSrc) / 2
  ctx.drawImage(bitmap, sx, sy, minSrc, minSrc, 0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  const imageData = ctx.getImageData(0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  bitmap.close()

  const variance = laplacianVariance(imageData)
  return makeResult(variance, irisRatio, streamingScore)
}

function makeResult(
  variance: number,
  irisRatio: number,
  streamingScore: number,
): PostCaptureAnalysis {
  const sharpnessAlert = variance < SHARPNESS_ALERT_THRESHOLD
  const irisAlert = irisRatio < IRIS_RATIO_ALERT_THRESHOLD
  return {
    laplacianVariance: variance,
    irisRatio,
    streamingScore,
    sharpnessAlert,
    irisAlert,
    hasAlert: sharpnessAlert || irisAlert,
  }
}

export const POST_CAPTURE_DEFAULTS = {
  ANALYSIS_DIM,
  SHARPNESS_ALERT_THRESHOLD,
  IRIS_RATIO_ALERT_THRESHOLD,
  STREAMING_BYPASS_THRESHOLD,
} as const
