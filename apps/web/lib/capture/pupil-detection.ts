/**
 * Detecção de pupila por threshold de luminância + connected components.
 *
 * Substitui MediaPipe FaceLandmarker (que falha em íris claras — verde, azul,
 * cinza). A pupila é sempre escura independente da cor da íris, e detectável
 * por um classificador clássico simples sobre o canvas 512×512 do análise:
 *
 *   1. Converter para escala de cinza
 *   2. Threshold: luminância < 40 → candidatos
 *   3. Encontrar maior cluster aproximadamente circular próximo do centro
 *   4. Raio da íris ≈ raio da pupila × 3.5 (proporção anatômica fixa)
 *
 * O caller ainda precisa escalar para naturalWidth do arquivo original.
 */

const LUMINANCE_THRESHOLD = 40
/** Razão anatômica fixa: raio da íris ≈ 3.5× raio da pupila. */
const PUPIL_TO_IRIS_RATIO = 3.5
/** Tamanhos mínimo/máximo do cluster em px (no canvas 512×512). */
const MIN_COMPONENT_SIZE = 50
const MAX_COMPONENT_SIZE = 8000
/** Aspect ratio mínimo (largura/altura) para considerar circular. */
const MIN_ASPECT = 0.4
/** Distância máxima do centro do canvas, em fração da largura. */
const MAX_CENTER_DISTANCE_FRAC = 0.4

export interface PupilDetection {
  /** Centro do cluster em px do canvas analisado. null se não detectado. */
  center: { x: number; y: number } | null
  /** Raio do cluster em px do canvas analisado. */
  pupilRadiusInCanvas: number
}

/**
 * Detecta a pupila no ImageData (esperado tipicamente 512×512). Retorna
 * `{ center: null, pupilRadiusInCanvas: 0 }` quando nenhum candidato passa
 * os filtros de tamanho/forma/posição.
 */
export function detectPupilFromImageData(imageData: ImageData): PupilDetection {
  const { data, width, height } = imageData
  const total = width * height

  // 1. Threshold para máscara binária de pixels escuros.
  const dark = new Uint8Array(total)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (lum < LUMINANCE_THRESHOLD) dark[p] = 1
  }

  // 2. Connected components (4-connected, iterative DFS).
  const labels = new Int32Array(total)
  const sizes: number[] = [0]
  const sumX: number[] = [0]
  const sumY: number[] = [0]
  const minX: number[] = [0]
  const maxX: number[] = [0]
  const minY: number[] = [0]
  const maxY: number[] = [0]
  let nextLabel = 1
  const stack: number[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!dark[idx] || labels[idx] !== 0) continue

      const lbl = nextLabel++
      sizes.push(0)
      sumX.push(0); sumY.push(0)
      minX.push(x); maxX.push(x); minY.push(y); maxY.push(y)

      stack.length = 0
      stack.push(idx)
      labels[idx] = lbl

      while (stack.length > 0) {
        const cur = stack.pop()!
        const cy = (cur / width) | 0
        const cx = cur - cy * width
        sizes[lbl]++
        sumX[lbl] += cx
        sumY[lbl] += cy
        if (cx < minX[lbl]) minX[lbl] = cx
        else if (cx > maxX[lbl]) maxX[lbl] = cx
        if (cy < minY[lbl]) minY[lbl] = cy
        else if (cy > maxY[lbl]) maxY[lbl] = cy

        // Vizinhos 4-connected
        if (cx > 0) {
          const n = cur - 1
          if (dark[n] && labels[n] === 0) { labels[n] = lbl; stack.push(n) }
        }
        if (cx < width - 1) {
          const n = cur + 1
          if (dark[n] && labels[n] === 0) { labels[n] = lbl; stack.push(n) }
        }
        if (cy > 0) {
          const n = cur - width
          if (dark[n] && labels[n] === 0) { labels[n] = lbl; stack.push(n) }
        }
        if (cy < height - 1) {
          const n = cur + width
          if (dark[n] && labels[n] === 0) { labels[n] = lbl; stack.push(n) }
        }
      }
    }
  }

  // 3. Filtra + ranqueia componentes (preferência: circular, central, tamanho razoável).
  const cx0 = width / 2
  const cy0 = height / 2
  const maxDist = width * MAX_CENTER_DISTANCE_FRAC
  let bestScore = -Infinity
  let bestLbl = -1

  for (let lbl = 1; lbl < nextLabel; lbl++) {
    const size = sizes[lbl]
    if (size < MIN_COMPONENT_SIZE || size > MAX_COMPONENT_SIZE) continue
    const compW = maxX[lbl] - minX[lbl] + 1
    const compH = maxY[lbl] - minY[lbl] + 1
    const aspect = Math.min(compW, compH) / Math.max(compW, compH)
    if (aspect < MIN_ASPECT) continue
    const compCx = sumX[lbl] / size
    const compCy = sumY[lbl] / size
    const dist = Math.hypot(compCx - cx0, compCy - cy0)
    if (dist > maxDist) continue

    const aspectScore = aspect
    const centerScore = 1 - dist / maxDist
    const sizeScore = Math.min(1, size / 1000)
    const score = aspectScore * 0.4 + centerScore * 0.4 + sizeScore * 0.2
    if (score > bestScore) {
      bestScore = score
      bestLbl = lbl
    }
  }

  if (bestLbl === -1) return { center: null, pupilRadiusInCanvas: 0 }

  const size = sizes[bestLbl]
  const center = { x: sumX[bestLbl] / size, y: sumY[bestLbl] / size }
  // Raio = média entre half-width e half-height do bounding box.
  const radius = ((maxX[bestLbl] - minX[bestLbl]) + (maxY[bestLbl] - minY[bestLbl])) / 4
  return { center, pupilRadiusInCanvas: radius }
}

export function pupilToIrisRadius(pupilRadius: number): number {
  return pupilRadius * PUPIL_TO_IRIS_RATIO
}

export const PUPIL_DETECTION_DEFAULTS = {
  LUMINANCE_THRESHOLD,
  PUPIL_TO_IRIS_RATIO,
  MIN_COMPONENT_SIZE,
  MAX_COMPONENT_SIZE,
  MIN_ASPECT,
  MAX_CENTER_DISTANCE_FRAC,
} as const
