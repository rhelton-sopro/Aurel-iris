/**
 * Análise leve pós-captura do JPEG salvo.
 *
 * NÃO bloqueia o fluxo — produz alertas sugestivos exibidos pela CapturePreview
 * para o usuário decidir refazer ou continuar.
 *
 * Critérios:
 * - Tamanho da íris (escalado para px reais do arquivo, derivado da pupila):
 *     0px (não detectada) → alerta "Não foi possível detectar..." (score neutro 50%)
 *     < 300px             → alerta "Íris pequena — aproxime mais"
 *     300–600px           → aceitável (sem alerta)
 *     > 600px             → excelente (sem alerta)
 *
 * - Nitidez (Laplacian variance, calibrada pela resolução do original):
 *     largura > 2000px (câmera nativa)  → threshold 200
 *     largura ≤ 2000px (fallback canvas) → threshold 80
 *
 * Detecção: pupil-based (threshold de escuridão + connected components).
 * Substituiu MediaPipe FaceLandmarker, que falhava em íris claras.
 */

import { laplacianVariance } from './laplacian-variance'
import { detectPupilFromImageData, pupilToIrisRadius } from './pupil-detection'
import { detectCameraSource, type CameraDetectionResult } from './camera-detection'

const ANALYSIS_DIM = 512
const IRIS_RADIUS_ALERT_PX = 300
const SHARPNESS_THRESHOLD_HIGH_RES = 200
const SHARPNESS_THRESHOLD_LOW_RES = 80
const HIGH_RES_WIDTH_BOUNDARY = 2000

export interface PostCaptureAnalysis {
  laplacianVariance: number
  /** Raio da íris escalado para px reais do arquivo. 0 = pupila não detectada. */
  irisRadiusPx: number
  /** Largura/altura reais do arquivo (naturalWidth/naturalHeight). */
  imageWidth: number
  imageHeight: number
  sharpnessThreshold: number
  sharpnessAlert: boolean
  /** Pupila detectada mas íris (estimada) abaixo do threshold (< 300px no escalado). */
  irisAlert: boolean
  /** Pupila não detectada — score neutro, sem bloquear. */
  irisUndetectedAlert: boolean
  hasAlert: boolean
  /** Resultado da detecção de câmera de origem via EXIF. */
  cameraDetection: CameraDetectionResult
}

/**
 * @param blob JPEG original da câmera nativa (não recomprimido).
 *
 * Roda pupil detection + Laplacian variance no canvas de análise (512×512)
 * derivado de um center-crop quadrado do arquivo. Não recebe mais o raio
 * da íris como parâmetro — calcula tudo internamente.
 */
export async function analyzeCapturedJpeg(blob: Blob): Promise<PostCaptureAnalysis> {
  // Detecção de câmera roda em paralelo com decode do JPEG (uma lê EXIF, a
  // outra pixel data — não há contenção). exifr é resiliente a JPEG malformado:
  // catch interno em camera-detection retorna 'unknown' em qualquer falha.
  const cameraDetectionPromise = detectCameraSource(blob)

  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url

  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    const cameraDetection = await cameraDetectionPromise
    return makeResult(0, 0, 0, 0, cameraDetection)
  }

  const imageWidth = img.naturalWidth
  const imageHeight = img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = ANALYSIS_DIM
  canvas.height = ANALYSIS_DIM
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    URL.revokeObjectURL(url)
    const cameraDetection = await cameraDetectionPromise
    return makeResult(0, 0, imageWidth, imageHeight, cameraDetection)
  }

  // Center-crop quadrado do arquivo + downscale pra 512×512.
  const minSrc = Math.min(imageWidth, imageHeight)
  const sx = (imageWidth - minSrc) / 2
  const sy = (imageHeight - minSrc) / 2
  ctx.drawImage(img, sx, sy, minSrc, minSrc, 0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  const imageData = ctx.getImageData(0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  URL.revokeObjectURL(url)

  // Detecção da pupila no canvas + estimativa do raio da íris (proporção 3.5×).
  // Escala pra px reais do arquivo: o canvas representa um quadrado de lado
  // `minSrc` (em px do arquivo), redimensionado pra ANALYSIS_DIM. Razão de
  // escala = minSrc / ANALYSIS_DIM.
  const pupil = detectPupilFromImageData(imageData)
  const irisRadiusInCanvas = pupilToIrisRadius(pupil.pupilRadiusInCanvas)
  const canvasToFileScale = minSrc / ANALYSIS_DIM
  const irisRadiusPx = irisRadiusInCanvas * canvasToFileScale

  const variance = laplacianVariance(imageData)
  const cameraDetection = await cameraDetectionPromise
  return makeResult(variance, irisRadiusPx, imageWidth, imageHeight, cameraDetection)
}

function makeResult(
  variance: number,
  irisRadiusPx: number,
  imageWidth: number,
  imageHeight: number,
  cameraDetection: CameraDetectionResult,
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
    cameraDetection,
  }
}

export const POST_CAPTURE_DEFAULTS = {
  ANALYSIS_DIM,
  IRIS_RADIUS_ALERT_PX,
  SHARPNESS_THRESHOLD_HIGH_RES,
  SHARPNESS_THRESHOLD_LOW_RES,
  HIGH_RES_WIDTH_BOUNDARY,
} as const
