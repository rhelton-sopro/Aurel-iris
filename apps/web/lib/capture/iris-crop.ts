/**
 * Crop centrado na íris para captura iridológica.
 *
 * Após o usuário disparar a captura, a imagem salva no Storage e exibida em
 * preview é um quadrado centrado na íris detectada — não o rosto inteiro.
 * Lado do crop = 2.5 × diâmetro da íris = 5 × raio. Inclui região periférica
 * suficiente para iridologia (esclera, eyelid próximo) sem dados sensíveis
 * extras (privacidade) e já no formato esperado pelo pipeline Modal da Fase 5.
 */

const CROP_SIDE_FACTOR = 5

/**
 * Crop centrado na íris em um ImageBitmap já decodificado.
 *
 * Usado pelo capture-client (input nativo): o bitmap é decodificado uma vez
 * para rodar a detecção MediaPipe e reutilizado aqui para o crop, evitando
 * a 2ª decodificação que `cropBlobAroundIris` exigiria.
 *
 * NÃO chama `bitmap.close()` — o caller é dono do ciclo de vida do bitmap.
 */
export function cropBitmapAroundIris(
  bitmap: ImageBitmap,
  irisCenterPx: { x: number; y: number },
  irisRadiusPx: number,
): { canvas: HTMLCanvasElement; irisRadiusInCrop: number } | null {
  if (irisRadiusPx <= 0 || bitmap.width <= 0 || bitmap.height <= 0) return null

  const side = CROP_SIDE_FACTOR * irisRadiusPx
  let x = Math.round(irisCenterPx.x - side / 2)
  let y = Math.round(irisCenterPx.y - side / 2)
  let w = Math.round(side)
  let h = Math.round(side)
  if (x < 0) { w += x; x = 0 }
  if (y < 0) { h += y; y = 0 }
  if (x + w > bitmap.width) w = bitmap.width - x
  if (y + h > bitmap.height) h = bitmap.height - y

  if (w <= 0 || h <= 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return null
  ctx.drawImage(bitmap, x, y, w, h, 0, 0, w, h)
  return { canvas, irisRadiusInCrop: irisRadiusPx }
}

/**
 * Crop centrado na íris em um Blob. Mantido para callers que ainda não
 * decodificaram o blob; quando o bitmap já está disponível, prefira
 * `cropBitmapAroundIris` (sem 2ª decodificação).
 */
export async function cropBlobAroundIris(
  blob: Blob,
  blobW: number,
  blobH: number,
  irisCenterPx: { x: number; y: number },
  irisRadiusPx: number,
): Promise<{ canvas: HTMLCanvasElement; irisRadiusInCrop: number } | null> {
  if (irisRadiusPx <= 0 || blobW <= 0 || blobH <= 0) return null
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return null
  }
  const result = cropBitmapAroundIris(bitmap, irisCenterPx, irisRadiusPx)
  bitmap.close()
  return result
}

export const IRIS_CROP_DEFAULTS = {
  CROP_SIDE_FACTOR,
} as const
