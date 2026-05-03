/**
 * Análise leve pós-captura do JPEG salvo.
 *
 * NÃO bloqueia o fluxo — produz alertas sugestivos exibidos pela CapturePreview
 * para o usuário decidir refazer ou continuar.
 *
 * Critérios:
 *
 * - Pupil detection roda em todas as resoluções (canvas 512×512 sempre).
 *     irisRadiusPx é estimado da pupila e escalado para px reais do arquivo.
 *
 * - Score / alertas baseados em irisRadiusPx:
 *     0px (não detectada) → alerta "Não foi possível detectar..." (score 50%)
 *                            Caso típico: foto de rosto inteiro / sem olho no frame
 *     < IRIS_RADIUS_ALERT_PX → alerta "Íris pequena — aproxime mais" (score < 1)
 *     ≥ IRIS_RADIUS_ALERT_PX → score 1.0 (sem alerta), considerado tamanho ok
 *
 *     Decisão de domínio (UAT 03): se a íris foi detectada em tamanho aceitável,
 *     é suficiente — não cobramos "excelência" via threshold separado. Detection
 *     correta + tamanho razoável basta para análise iridológica.
 *
 * - Nitidez (Laplacian variance, calibrada pela resolução do original):
 *     largura > 2000px (câmera nativa)  → threshold 200
 *     largura ≤ 2000px (fallback canvas) → threshold 80
 *
 * Histórico: pupil detection substituiu MediaPipe FaceLandmarker (commit 499e95d).
 * Houve uma tentativa de bypass em alta resolução (278369d, revertida em 90a59b7+
 * — bypass era lenient demais, deixava passar fotos de rosto inteiro).
 */

import { laplacianVariance } from './laplacian-variance'
import {
  detectPupilFromImageData,
  pupilToIrisRadius,
  type PupilDetection,
} from './pupil-detection'
import { detectCameraSource, type CameraDetectionResult } from './camera-detection'

const ANALYSIS_DIM = 512
/** Threshold para alerta "íris pequena". Reduzido de 300 → 200 (UAT 03 round 5
    feedback: critério estava rigoroso demais, gerando false negatives em
    fotos boas). Pupila correspondente: 200/3.5 ≈ 57px no arquivo. */
const IRIS_RADIUS_ALERT_PX = 200
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
  /** Diagnóstico do detector de pupila — exposto pro debug overlay no preview. */
  pupilDebug: PupilDetection['debug']
  /** Threshold Otsu efetivamente usado (após clamp). */
  pupilThreshold: number
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

  // Default debug pra paths de early-exit (decode falhou, sem ctx).
  const fallbackPupilDebug: PupilDetection['debug'] = {
    status: 'no_candidate',
    contrast: 0,
    componentsFound: 0,
  }

  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    const cameraDetection = await cameraDetectionPromise
    return makeResult(0, 0, 0, 0, cameraDetection, fallbackPupilDebug, 0)
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
    return makeResult(0, 0, imageWidth, imageHeight, cameraDetection, fallbackPupilDebug, 0)
  }

  // Center-crop quadrado do arquivo + downscale pra 512×512.
  const minSrc = Math.min(imageWidth, imageHeight)
  const sx = (imageWidth - minSrc) / 2
  const sy = (imageHeight - minSrc) / 2
  ctx.drawImage(img, sx, sy, minSrc, minSrc, 0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  const imageData = ctx.getImageData(0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  URL.revokeObjectURL(url)

  // Pupil detection no canvas + estimativa do raio da íris (proporção 3.5×).
  // Escala pra px reais do arquivo: o canvas representa um quadrado de lado
  // `minSrc` (em px do arquivo), redimensionado pra ANALYSIS_DIM. Razão de
  // escala = minSrc / ANALYSIS_DIM.
  const pupil = detectPupilFromImageData(imageData)
  const irisRadiusInCanvas = pupilToIrisRadius(pupil.pupilRadiusInCanvas)
  const canvasToFileScale = minSrc / ANALYSIS_DIM
  const irisRadiusPx = irisRadiusInCanvas * canvasToFileScale

  const variance = laplacianVariance(imageData)
  const cameraDetection = await cameraDetectionPromise
  return makeResult(
    variance,
    irisRadiusPx,
    imageWidth,
    imageHeight,
    cameraDetection,
    pupil.debug,
    pupil.thresholdUsed,
  )
}

function makeResult(
  variance: number,
  irisRadiusPx: number,
  imageWidth: number,
  imageHeight: number,
  cameraDetection: CameraDetectionResult,
  pupilDebug: PupilDetection['debug'],
  pupilThreshold: number,
): PostCaptureAnalysis {
  const sharpnessThreshold =
    imageWidth > HIGH_RES_WIDTH_BOUNDARY
      ? SHARPNESS_THRESHOLD_HIGH_RES
      : SHARPNESS_THRESHOLD_LOW_RES
  const sharpnessAlert = variance < sharpnessThreshold
  // irisUndetectedAlert SÓ dispara com dupla evidência: pupila não detectada
  // E foto borrada. Foto nítida sem detecção é provavelmente caso edge do
  // detector (íris clara extrema, reflexo); confiamos na visão do usuário.
  // Foto borrada E sem detecção é quase certamente foto ruim — alerta vale.
  const irisUndetectedAlert = irisRadiusPx <= 0 && sharpnessAlert
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
    pupilDebug,
    pupilThreshold,
  }
}

export const POST_CAPTURE_DEFAULTS = {
  ANALYSIS_DIM,
  IRIS_RADIUS_ALERT_PX,
  SHARPNESS_THRESHOLD_HIGH_RES,
  SHARPNESS_THRESHOLD_LOW_RES,
  HIGH_RES_WIDTH_BOUNDARY,
} as const
