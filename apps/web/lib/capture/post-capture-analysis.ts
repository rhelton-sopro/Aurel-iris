/**
 * Análise leve pós-captura do JPEG salvo.
 *
 * NÃO bloqueia o fluxo — produz alertas sugestivos exibidos pela CapturePreview
 * para o usuário decidir refazer ou continuar.
 *
 * Critérios:
 * - Nitidez: variância de Laplaciana < 80 → alerta de imagem pouco nítida
 * - Tamanho da íris: raio da íris no JPEG / min(jpegW,jpegH) < 0.15 → alerta
 *
 * Performance: ~30–60ms em 2048×2048 (createImageBitmap + downscale 512×512 +
 * laplacianVariance) em Android mid-tier.
 */

import { laplacianVariance } from './laplacian-variance'

const ANALYSIS_DIM = 512
const SHARPNESS_ALERT_THRESHOLD = 80
const IRIS_RATIO_ALERT_THRESHOLD = 0.15

export interface PostCaptureAnalysis {
  /** Variância de Laplaciana medida no JPEG comprimido (downscale 512×512) */
  laplacianVariance: number
  /** Raio da íris no JPEG / min(jpegW, jpegH) */
  irisRatio: number
  sharpnessAlert: boolean
  irisAlert: boolean
  hasAlert: boolean
}

/**
 * @param blob JPEG comprimido pelo `compressFrameToJpeg`
 * @param irisRadiusPxInVideo Raio da íris no frame de vídeo (px reais).
 *                             Vem do `getIrisRadiusPx` no momento da captura.
 * @param jpegW Largura do JPEG salvo (compressed.width)
 * @param jpegH Altura do JPEG salvo (compressed.height)
 * @param videoW Largura original do vídeo (a compressão preserva aspect ratio,
 *               então o fator de escala em Y é igual ao em X — só precisamos um)
 */
export async function analyzeCapturedJpeg(
  blob: Blob,
  irisRadiusPxInVideo: number,
  jpegW: number,
  jpegH: number,
  videoW: number,
): Promise<PostCaptureAnalysis> {
  const scale = videoW > 0 ? jpegW / videoW : 1
  const irisRadiusInJpeg = irisRadiusPxInVideo * scale
  const jpegMinDim = Math.min(jpegW, jpegH)
  const irisRatio = jpegMinDim > 0 ? irisRadiusInJpeg / jpegMinDim : 0

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return makeResult(0, irisRatio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = ANALYSIS_DIM
  canvas.height = ANALYSIS_DIM
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    bitmap.close()
    return makeResult(0, irisRatio)
  }

  // Center crop quadrado + downscale para 512×512
  const minSrc = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - minSrc) / 2
  const sy = (bitmap.height - minSrc) / 2
  ctx.drawImage(bitmap, sx, sy, minSrc, minSrc, 0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  const imageData = ctx.getImageData(0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  bitmap.close()

  const variance = laplacianVariance(imageData)
  return makeResult(variance, irisRatio)
}

function makeResult(variance: number, irisRatio: number): PostCaptureAnalysis {
  const sharpnessAlert = variance < SHARPNESS_ALERT_THRESHOLD
  const irisAlert = irisRatio < IRIS_RATIO_ALERT_THRESHOLD
  return {
    laplacianVariance: variance,
    irisRatio,
    sharpnessAlert,
    irisAlert,
    hasAlert: sharpnessAlert || irisAlert,
  }
}

export const POST_CAPTURE_DEFAULTS = {
  ANALYSIS_DIM,
  SHARPNESS_ALERT_THRESHOLD,
  IRIS_RATIO_ALERT_THRESHOLD,
} as const
