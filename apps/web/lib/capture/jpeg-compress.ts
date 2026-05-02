/**
 * D-16: Compressão JPEG client-side com qualidade 0.85 e lado maior limitado
 * a 2048px (mantém aspect ratio). Alvo: ~500KB por foto.
 *
 * IMPORTANTE: usa document.createElement('canvas') — NÃO OffscreenCanvas
 * (iOS Safari < 17 não suporta OffscreenCanvas). RESEARCH Pitfall §iOS Safari.
 */

const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.85

export interface CompressedFrame {
  blob: Blob
  width: number
  height: number
}

/**
 * Comprime um frame de vídeo/canvas em JPEG qualidade 0.85,
 * com lado maior limitado a 2048px (downscale-only, mantém aspect ratio).
 */
export async function compressFrameToJpeg(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  sourceWidth: number,
  sourceHeight: number
): Promise<CompressedFrame> {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('[jpeg-compress] sourceWidth/sourceHeight devem ser positivos')
  }

  // 1. Calcular dimensões alvo mantendo aspect ratio (downscale-only)
  const maxSide = Math.max(sourceWidth, sourceHeight)
  let targetW = sourceWidth
  let targetH = sourceHeight
  if (maxSide > MAX_DIMENSION) {
    const ratio = MAX_DIMENSION / maxSide
    targetW = Math.round(sourceWidth * ratio)
    targetH = Math.round(sourceHeight * ratio)
  }

  // 2. Render no canvas (não OffscreenCanvas — iOS Safari < 17)
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    throw new Error('[jpeg-compress] canvas 2d context indisponível')
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH)

  // 3. Comprimir via canvas.toBlob (assíncrono)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
  })

  if (!blob) {
    throw new Error('[jpeg-compress] canvas.toBlob retornou null')
  }

  return { blob, width: targetW, height: targetH }
}

export const COMPRESS_DEFAULTS = {
  MAX_DIMENSION,
  JPEG_QUALITY,
} as const
