/**
 * Análise leve pós-captura do JPEG salvo.
 *
 * NÃO bloqueia o fluxo — produz alertas sugestivos exibidos pela CapturePreview
 * para o usuário decidir refazer ou continuar.
 *
 * Critérios:
 * - Tamanho da íris (px absolutos no original):
 *     < 300px         → alerta "Íris pequena — aproxime mais"
 *     300–600px       → aceitável (sem alerta)
 *     > 600px         → excelente (sem alerta)
 *
 * - Nitidez (Laplacian variance, calibrada pela resolução do original):
 *     largura > 2000px (câmera nativa)  → threshold 200
 *     largura ≤ 2000px (fallback canvas) → threshold 80
 *
 * Performance: ~30–60ms (createImageBitmap + downscale 512×512 + laplacianVariance)
 * em Android mid-tier.
 */

import { laplacianVariance } from './laplacian-variance'

const ANALYSIS_DIM = 512
const IRIS_RADIUS_ALERT_PX = 300
const SHARPNESS_THRESHOLD_HIGH_RES = 200
const SHARPNESS_THRESHOLD_LOW_RES = 80
/** Largura da imagem em pixels acima da qual usamos o threshold "alta resolução". */
const HIGH_RES_WIDTH_BOUNDARY = 2000

export interface PostCaptureAnalysis {
  /** Variância de Laplaciana medida no JPEG (downscale 512×512). */
  laplacianVariance: number
  /** Raio da íris no JPEG original, em pixels absolutos. */
  irisRadiusPx: number
  /** Largura/altura da imagem original (não downscale). */
  imageWidth: number
  imageHeight: number
  /** Threshold de nitidez aplicado (80 ou 200, depende da resolução). */
  sharpnessThreshold: number
  sharpnessAlert: boolean
  irisAlert: boolean
  hasAlert: boolean
}

/**
 * @param blob JPEG original da câmera nativa (não recomprimido).
 * @param irisRadiusPx Raio da íris em pixels do JPEG original (vem do
 *                     getIrisRadiusPx + bitmap dimensions).
 */
export async function analyzeCapturedJpeg(
  blob: Blob,
  irisRadiusPx: number,
): Promise<PostCaptureAnalysis> {
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return makeResult(0, irisRadiusPx, 0, 0)
  }

  const imageWidth = bitmap.width
  const imageHeight = bitmap.height

  const canvas = document.createElement('canvas')
  canvas.width = ANALYSIS_DIM
  canvas.height = ANALYSIS_DIM
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    bitmap.close()
    return makeResult(0, irisRadiusPx, imageWidth, imageHeight)
  }

  // Center crop quadrado + downscale para 512×512
  const minSrc = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - minSrc) / 2
  const sy = (bitmap.height - minSrc) / 2
  ctx.drawImage(bitmap, sx, sy, minSrc, minSrc, 0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  const imageData = ctx.getImageData(0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  bitmap.close()

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
  const irisAlert = irisRadiusPx < IRIS_RADIUS_ALERT_PX
  return {
    laplacianVariance: variance,
    irisRadiusPx,
    imageWidth,
    imageHeight,
    sharpnessThreshold,
    sharpnessAlert,
    irisAlert,
    hasAlert: sharpnessAlert || irisAlert,
  }
}

export const POST_CAPTURE_DEFAULTS = {
  ANALYSIS_DIM,
  IRIS_RADIUS_ALERT_PX,
  SHARPNESS_THRESHOLD_HIGH_RES,
  SHARPNESS_THRESHOLD_LOW_RES,
  HIGH_RES_WIDTH_BOUNDARY,
} as const
