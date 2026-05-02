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
 * Faz snapshot do frame atual do vídeo e devolve um canvas quadrado centrado
 * na íris. Quando o crop encosta na borda do vídeo, é clampado e perde
 * quadratura — não invalida (a íris ainda fica visível, apenas off-center).
 *
 * Retorna `null` se o vídeo não estiver pronto, se o canvas 2D context não
 * estiver disponível, ou se o crop resultante for de área zero.
 *
 * Quando `irisCenterPx`/`irisRadiusPx` não estão disponíveis (gate deveria ter
 * bloqueado, mas por segurança), faz snapshot do frame inteiro.
 */
export function snapshotAndCropAroundIris(
  video: HTMLVideoElement,
  irisCenterPx: { x: number; y: number } | null,
  irisRadiusPx: number,
): HTMLCanvasElement | null {
  const videoW = video.videoWidth
  const videoH = video.videoHeight
  if (videoW <= 0 || videoH <= 0) return null

  let x = 0
  let y = 0
  let w = videoW
  let h = videoH

  if (irisCenterPx && irisRadiusPx > 0) {
    const side = CROP_SIDE_FACTOR * irisRadiusPx
    x = Math.round(irisCenterPx.x - side / 2)
    y = Math.round(irisCenterPx.y - side / 2)
    w = Math.round(side)
    h = Math.round(side)
    // Clamp aos limites do vídeo
    if (x < 0) { w += x; x = 0 }
    if (y < 0) { h += y; y = 0 }
    if (x + w > videoW) w = videoW - x
    if (y + h > videoH) h = videoH - y
  }

  if (w <= 0 || h <= 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return null
  ctx.drawImage(video, x, y, w, h, 0, 0, w, h)
  return canvas
}

export const IRIS_CROP_DEFAULTS = {
  CROP_SIDE_FACTOR,
} as const
