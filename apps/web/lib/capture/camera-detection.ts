/**
 * Detecção da câmera de origem (frontal vs traseira) via EXIF.
 *
 * iPhone (primary device de teste): grava `LensModel` discriminável
 * (ex.: "iPhone 15 Pro back triple camera 6.86mm f/1.78" vs
 * "iPhone 15 Pro front camera 2.69mm f/1.9"). Detecção ~100%.
 *
 * Android: confiabilidade varia por fabricante. EXIF pode vir vazio
 * (Chrome às vezes strip metadata na compressão automática) ou
 * sem campos discrimináveis. Cai em `unknown` → confirmação UX no
 * caller (capture-client) cobre o caso.
 *
 * Sem fonte detectável NÃO significa erro — significa "não conseguimos
 * decidir, peça ao usuário".
 */

import exifr from 'exifr'

export type CameraDetectionResult =
  | { kind: 'rear'; source: 'exif' }
  | { kind: 'front'; source: 'exif' }
  | { kind: 'unknown'; source: 'exif-missing' | 'exif-ambiguous' }

// Tokens que indicam câmera frontal/selfie em LensModel/LensMake.
// \b força match em palavra inteira pra evitar capturar "infrared" como "front".
const FRONT_PATTERNS = /\b(front|selfie|facetime|user)\b/i

// Tokens que indicam câmera traseira/world-facing.
// 'wide', 'telephoto', 'ultra wide' são lentes traseiras em smartphones modernos.
const REAR_PATTERNS = /\b(back|rear|wide|telephoto|ultra ?wide|world)\b/i

interface MinimalExif {
  LensModel?: unknown
  LensMake?: unknown
}

export async function detectCameraSource(blob: Blob): Promise<CameraDetectionResult> {
  let exif: MinimalExif | undefined
  let exifError: unknown = null
  try {
    // Pick array pattern: pede só os 2 campos necessários — leve e tipado.
    exif = (await exifr.parse(blob, ['LensModel', 'LensMake'])) as
      | MinimalExif
      | undefined
  } catch (err) {
    exifError = err
  }

  // Logging diagnóstico (temporário) pra investigar UAT issue: iOS pode estar
  // strippando EXIF na captura via <input capture="environment">. Permite ver
  // no console o que efetivamente foi lido.
  // eslint-disable-next-line no-console
  console.log('[camera-detection] exif read:', {
    error: exifError,
    raw: exif,
    blobSize: blob.size,
    blobType: blob.type,
  })

  if (exifError) {
    return { kind: 'unknown', source: 'exif-missing' }
  }

  if (!exif) {
    return { kind: 'unknown', source: 'exif-missing' }
  }

  const lensModel = typeof exif.LensModel === 'string' ? exif.LensModel : ''
  const lensMake = typeof exif.LensMake === 'string' ? exif.LensMake : ''
  const combined = `${lensMake} ${lensModel}`.trim()

  if (!combined) {
    return { kind: 'unknown', source: 'exif-missing' }
  }

  // Front tem precedência: se ambos casarem (improvável), tratamos como front
  // por segurança — falso positivo de "rejeitar foto válida" é menos pior que
  // falso negativo de "aceitar selfie".
  if (FRONT_PATTERNS.test(combined)) {
    return { kind: 'front', source: 'exif' }
  }
  if (REAR_PATTERNS.test(combined)) {
    return { kind: 'rear', source: 'exif' }
  }

  return { kind: 'unknown', source: 'exif-ambiguous' }
}
