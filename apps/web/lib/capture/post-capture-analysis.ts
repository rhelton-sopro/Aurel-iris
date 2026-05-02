/**
 * Análise leve pós-captura do JPEG salvo.
 *
 * NÃO bloqueia o fluxo — produz alertas sugestivos exibidos pela CapturePreview
 * para o usuário decidir refazer ou continuar.
 *
 * Critérios:
 * - Tamanho da íris (irisRadiusPx escalado para px reais do arquivo):
 *     <= 0px (não detectada) → alerta "Não foi possível detectar..." (score neutro 50%)
 *     < 300px                → alerta "Íris pequena — aproxime mais"
 *     300–600px              → aceitável (sem alerta)
 *     > 600px                → excelente (sem alerta)
 *
 * - Nitidez (Laplacian variance, calibrada pela resolução do original):
 *     largura > 2000px (câmera nativa)  → threshold 200
 *     largura ≤ 2000px (fallback canvas) → threshold 80
 *
 * Performance: ~30–60ms (Image.decode + downscale 512×512 + laplacianVariance)
 * em Android mid-tier.
 */

import { laplacianVariance } from './laplacian-variance'

const ANALYSIS_DIM = 512
/**
 * Resolução de referência do MediaPipe FaceLandmarker. O modelo opera sobre
 * uma representação interna ~512px e os landmarks retornam normalizados a
 * essa escala. Pra obter o raio em px reais do arquivo, multiplicamos pelo
 * fator naturalWidth / 512.
 */
const MEDIAPIPE_REFERENCE_DIM = 512
const IRIS_RADIUS_ALERT_PX = 300
const SHARPNESS_THRESHOLD_HIGH_RES = 200
const SHARPNESS_THRESHOLD_LOW_RES = 80
/** Largura em px acima da qual usamos o threshold "alta resolução". */
const HIGH_RES_WIDTH_BOUNDARY = 2000

/**
 * Escala o raio bruto detectado pelo MediaPipe (referência ~512px) para
 * pixels reais do arquivo (naturalWidth × naturalHeight). Quando o raw
 * é 0 (detecção falhou), retorna 0 sem escalar.
 *
 *   scaleFactor = naturalWidth / 512
 *   real = raw * scaleFactor
 */
export function scaleDetectedIrisRadius(rawRadius: number, naturalWidth: number): number {
  if (rawRadius <= 0 || naturalWidth <= 0) return 0
  return rawRadius * (naturalWidth / MEDIAPIPE_REFERENCE_DIM)
}

export interface PostCaptureAnalysis {
  /** Variância de Laplaciana medida no JPEG (downscale 512×512). */
  laplacianVariance: number
  /** Raio da íris ESCALADO para px reais do arquivo. 0 = MediaPipe não detectou. */
  irisRadiusPx: number
  /** Largura/altura reais do arquivo (naturalWidth/naturalHeight). */
  imageWidth: number
  imageHeight: number
  sharpnessThreshold: number
  sharpnessAlert: boolean
  /** Íris detectada mas abaixo do threshold (< 300px no escalado). */
  irisAlert: boolean
  /** MediaPipe não detectou íris alguma — score neutro, sem bloquear. */
  irisUndetectedAlert: boolean
  hasAlert: boolean
}

/**
 * @param blob JPEG original da câmera nativa (não recomprimido).
 * @param irisRadiusPx Raio da íris já ESCALADO para px reais do arquivo
 *                     (use `scaleDetectedIrisRadius` no caller, ou passe 0
 *                     quando a detecção MediaPipe falhou).
 */
export async function analyzeCapturedJpeg(
  blob: Blob,
  irisRadiusPx: number,
): Promise<PostCaptureAnalysis> {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url

  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    return makeResult(0, irisRadiusPx, 0, 0)
  }

  const imageWidth = img.naturalWidth
  const imageHeight = img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = ANALYSIS_DIM
  canvas.height = ANALYSIS_DIM
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    URL.revokeObjectURL(url)
    return makeResult(0, irisRadiusPx, imageWidth, imageHeight)
  }

  const minSrc = Math.min(imageWidth, imageHeight)
  const sx = (imageWidth - minSrc) / 2
  const sy = (imageHeight - minSrc) / 2
  ctx.drawImage(img, sx, sy, minSrc, minSrc, 0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  const imageData = ctx.getImageData(0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  URL.revokeObjectURL(url)

  const variance = laplacianVariance(imageData)
  return makeResult(variance, irisRadiusPx, imageWidth, imageHeight)
}

function makeResult(
  variance: number,
  irisRadiusPx: number,
  imageWidth: number,
  imageHeight: number,
): PostCaptureAnalysis {
  const sharpnessThreshold =
    imageWidth > HIGH_RES_WIDTH_BOUNDARY
      ? SHARPNESS_THRESHOLD_HIGH_RES
      : SHARPNESS_THRESHOLD_LOW_RES
  const sharpnessAlert = variance < sharpnessThreshold
  const irisUndetectedAlert = irisRadiusPx <= 0
  const irisAlert = irisRadiusPx > 0 && irisRadiusPx < IRIS_RADIUS_ALERT_PX
  return {
    laplacianVariance: variance,
    irisRadiusPx,
    imageWidth,
    imageHeight,
    sharpnessThreshold,
    sharpnessAlert,
    irisAlert,
    irisUndetectedAlert,
    hasAlert: sharpnessAlert || irisAlert || irisUndetectedAlert,
  }
}

export const POST_CAPTURE_DEFAULTS = {
  ANALYSIS_DIM,
  MEDIAPIPE_REFERENCE_DIM,
  IRIS_RADIUS_ALERT_PX,
  SHARPNESS_THRESHOLD_HIGH_RES,
  SHARPNESS_THRESHOLD_LOW_RES,
  HIGH_RES_WIDTH_BOUNDARY,
} as const
