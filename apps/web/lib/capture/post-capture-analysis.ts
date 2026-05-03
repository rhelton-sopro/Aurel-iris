/**
 * Análise leve pós-captura do JPEG salvo.
 *
 * NÃO bloqueia o fluxo — produz alertas sugestivos exibidos pela CapturePreview
 * para o usuário decidir refazer ou continuar.
 *
 * Critérios:
 *
 * - Validação VLM (Claude Haiku 4.5 server-side):
 *     Decide se a foto contém um olho humano com íris adequada pra análise
 *     iridológica. Substitui pupil detection pixel-based (5 rondas de UAT
 *     comprovaram que era frágil — falsos positivos em mesa, falsos
 *     negativos em íris claras). Latência ~500ms-1s, fallback graceful
 *     em erro de rede.
 *
 * - Nitidez (Laplacian variance, calibrada pela resolução do original):
 *     largura > 2000px (câmera nativa)  → threshold 200
 *     largura ≤ 2000px (fallback canvas) → threshold 80
 *
 * Histórico (UAT 03):
 *   - 499e95d: pupil detection substitui MediaPipe FaceLandmarker
 *   - 7db1918: Otsu adaptativo (round 4)
 *   - c15aa7b: contraste mínimo + aspect mais estrito (round 5)
 *   - 32c19b3: debug overlay pra device sem console (round 6)
 *   - <este>: pupil detection removida; VLM via /api/capture/validate
 */

import { laplacianVariance } from './laplacian-variance'
import { detectCameraSource, type CameraDetectionResult } from './camera-detection'
import { validateImageWithClaude, type ValidationResult } from './validate-image'

const ANALYSIS_DIM = 512
const SHARPNESS_THRESHOLD_HIGH_RES = 200
const SHARPNESS_THRESHOLD_LOW_RES = 80
const HIGH_RES_WIDTH_BOUNDARY = 2000

export interface PostCaptureAnalysis {
  laplacianVariance: number
  /** Largura/altura reais do arquivo (naturalWidth/naturalHeight). */
  imageWidth: number
  imageHeight: number
  sharpnessThreshold: number
  sharpnessAlert: boolean
  /** VLM rejeitou a foto (sem olho, muito longe, etc.). */
  vlmInvalidAlert: boolean
  hasAlert: boolean
  /** Resultado da detecção de câmera de origem via EXIF. */
  cameraDetection: CameraDetectionResult
  /** Resultado da validação VLM (com fallback graceful em erro de rede). */
  vlmValidation: ValidationResult
}

/**
 * @param blob JPEG original da câmera nativa (não recomprimido).
 *
 * Pipeline em paralelo:
 *  - decode + Laplacian variance (browser, ~50ms)
 *  - EXIF camera detection (browser, ~10ms)
 *  - VLM validation (server roundtrip, ~500ms-1s)
 */
export async function analyzeCapturedJpeg(blob: Blob): Promise<PostCaptureAnalysis> {
  // Disparam em paralelo. validateImageWithClaude faz seu próprio resize.
  const cameraDetectionPromise = detectCameraSource(blob)
  const vlmValidationPromise = validateImageWithClaude(blob)

  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url

  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    const cameraDetection = await cameraDetectionPromise
    const vlmValidation = await vlmValidationPromise
    return makeResult(0, 0, 0, cameraDetection, vlmValidation)
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
    const vlmValidation = await vlmValidationPromise
    return makeResult(0, imageWidth, imageHeight, cameraDetection, vlmValidation)
  }

  // Center-crop quadrado do arquivo + downscale pra 512×512 (apenas pra
  // Laplacian — VLM faz seu próprio resize internamente).
  const minSrc = Math.min(imageWidth, imageHeight)
  const sx = (imageWidth - minSrc) / 2
  const sy = (imageHeight - minSrc) / 2
  ctx.drawImage(img, sx, sy, minSrc, minSrc, 0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  const imageData = ctx.getImageData(0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
  URL.revokeObjectURL(url)

  const variance = laplacianVariance(imageData)
  const cameraDetection = await cameraDetectionPromise
  const vlmValidation = await vlmValidationPromise
  return makeResult(variance, imageWidth, imageHeight, cameraDetection, vlmValidation)
}

function makeResult(
  variance: number,
  imageWidth: number,
  imageHeight: number,
  cameraDetection: CameraDetectionResult,
  vlmValidation: ValidationResult,
): PostCaptureAnalysis {
  const sharpnessThreshold =
    imageWidth > HIGH_RES_WIDTH_BOUNDARY
      ? SHARPNESS_THRESHOLD_HIGH_RES
      : SHARPNESS_THRESHOLD_LOW_RES
  const sharpnessAlert = variance < sharpnessThreshold
  const vlmInvalidAlert = !vlmValidation.valid
  return {
    laplacianVariance: variance,
    imageWidth,
    imageHeight,
    sharpnessThreshold,
    sharpnessAlert,
    vlmInvalidAlert,
    hasAlert: sharpnessAlert || vlmInvalidAlert,
    cameraDetection,
    vlmValidation,
  }
}

export const POST_CAPTURE_DEFAULTS = {
  ANALYSIS_DIM,
  SHARPNESS_THRESHOLD_HIGH_RES,
  SHARPNESS_THRESHOLD_LOW_RES,
  HIGH_RES_WIDTH_BOUNDARY,
} as const
