export interface Point {
  x: number
  y: number
}

/**
 * Score de exposição (0..1) baseado em proporção de pixels saturados/escuros.
 * Aceita até 5% de pixels saturados/escuros como normal; pune linearmente acima.
 * Acima de 30% de qualquer extremo → score=0.
 */
export function exposureScore(imageData: ImageData): number {
  const { data } = imageData
  let bright = 0
  let dark = 0
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (lum > 235) bright++
    else if (lum < 25) dark++
    total++
  }
  if (total === 0) return 0
  const over = bright / total
  const under = dark / total
  if (over > 0.30) return 0
  if (under > 0.30) return 0
  const overPenalty = Math.max(0, over - 0.05) * 2
  const underPenalty = Math.max(0, under - 0.05) * 2
  return Math.max(0, 1 - overPenalty - underPenalty)
}

export function getExposureDirection(imageData: ImageData): 'low' | 'high' | 'ok' {
  const { data } = imageData
  let bright = 0
  let dark = 0
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (lum > 235) bright++
    else if (lum < 25) dark++
    total++
  }
  if (total === 0) return 'ok'
  if (bright / total > 0.20) return 'high'
  if (dark / total > 0.20) return 'low'
  return 'ok'
}

/**
 * Reflexo especular no centro da íris.
 * Procura pixels saturados (lum > 240) numa janela ~30% do raio da íris ao redor do centro.
 */
export function reflexInCenter(
  imageData: ImageData,
  center: Point,
  radiusPx: number
): boolean {
  const { data, width, height } = imageData
  const r = Math.max(2, Math.floor(radiusPx * 0.3))
  const cx = Math.round(center.x)
  const cy = Math.round(center.y)
  let saturated = 0
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy
    if (y < 0 || y >= height) continue
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx
      if (x < 0 || x >= width) continue
      const idx = (y * width + x) * 4
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      if (lum > 240) saturated++
    }
  }
  return saturated > 5
}
