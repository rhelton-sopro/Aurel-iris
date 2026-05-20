/**
 * Análise leve pós-captura do JPEG salvo.
 *
 * NÃO bloqueia o fluxo — produz alertas sugestivos exibidos pela CapturePreview
 * para o usuário decidir refazer ou continuar.
 *
 * Pipeline atual (UAT 03 round 8):
 *
 * - Validação VLM (Claude Haiku 4.5 server-side):
 *     Decide se a foto contém um olho humano com íris adequada pra análise
 *     iridológica. Único critério de qualidade — também avalia nitidez via
 *     reason='borrado' (substituiu Laplacian variance, que era sinal duplicado
 *     e ocasionalmente conflitante com o veredito do VLM).
 *
 * - Detecção de câmera origem (EXIF):
 *     Roda em paralelo. kind='front' → bloqueio precoce (toast + reject).
 *
 * Histórico:
 *   - rounds 1-5 (499e95d → c15aa7b): pupil detection pixel-based — descartada
 *   - round 6 (16a3f18): VLM substitui pupil detection
 *   - round 7 (55b2380): hierarquia de blocking por reason
 *   - round 8 (este): muito_longe vira blocking + Laplacian removido
 */

import { detectCameraSource, type CameraDetectionResult } from './camera-detection'
import { validateImageWithClaude, type ValidationResult } from './validate-image'

export interface PostCaptureAnalysis {
  /** Largura/altura reais do arquivo (naturalWidth/naturalHeight). */
  imageWidth: number
  imageHeight: number
  /** VLM rejeitou a foto (sem_olho, muito_longe, etc.). */
  vlmInvalidAlert: boolean
  hasAlert: boolean
  /** Resultado da detecção de câmera de origem via EXIF. */
  cameraDetection: CameraDetectionResult
  /** Resultado da validação VLM (com fallback graceful em erro de rede). */
  vlmValidation: ValidationResult
}

/**
 * @param blob JPEG original da câmera nativa (não recomprimido).
 * @param inviteToken opcional — repassado p/ validateImageWithClaude. Quando
 *   presente, o endpoint /api/capture/validate aceita token em vez de sessão
 *   (path público /convite/[token]/capturar).
 *
 * Pipeline em paralelo:
 *  - decode (browser, ~50ms — só pra obter naturalWidth/Height)
 *  - EXIF camera detection (browser, ~10ms)
 *  - VLM validation (server roundtrip, ~500ms-1s)
 */
export async function analyzeCapturedJpeg(
  blob: Blob,
  inviteToken?: string,
): Promise<PostCaptureAnalysis> {
  // Disparam em paralelo. validateImageWithClaude faz seu próprio resize.
  const cameraDetectionPromise = detectCameraSource(blob)
  const vlmValidationPromise = validateImageWithClaude(blob, inviteToken)

  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url

  let imageWidth = 0
  let imageHeight = 0
  try {
    await img.decode()
    imageWidth = img.naturalWidth
    imageHeight = img.naturalHeight
  } catch {
    // Continua mesmo se decode falhar — VLM pode ter sucesso, e dimensões
    // ficam como 0/0 (não são gate de qualidade após esta refatoração).
  } finally {
    URL.revokeObjectURL(url)
  }

  const cameraDetection = await cameraDetectionPromise
  const vlmValidation = await vlmValidationPromise
  const vlmInvalidAlert = vlmValidation.quality === 'ruim'

  return {
    imageWidth,
    imageHeight,
    vlmInvalidAlert,
    hasAlert: vlmInvalidAlert,
    cameraDetection,
    vlmValidation,
  }
}
