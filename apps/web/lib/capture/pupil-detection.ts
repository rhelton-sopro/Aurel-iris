/**
 * Detecção de pupila por threshold de luminância adaptativo (Otsu) +
 * connected components.
 *
 * Substitui MediaPipe FaceLandmarker (que falhava em íris claras). A pupila
 * é sempre escura relativa ao restante da imagem, mas o threshold absoluto
 * varia: pupila pode estar em luminância 20 (foto escura) ou 80 (foto bem
 * iluminada). Threshold fixo de 40 (versão anterior) falhava em ambos extremos.
 *
 * Otsu calcula o threshold ótimo por foto baseado no histograma — separa
 * as duas classes (pupila + sombras vs resto) maximizando a variância
 * inter-classe.
 *
 * Pipeline:
 *   1. Converter para escala de cinza + histograma
 *   2. Otsu → threshold adaptativo (clamped em [15, 90])
 *   3. Threshold + connected components (4-conn, iterative DFS)
 *   4. Filtrar por tamanho/forma/centralidade
 *   5. Raio da íris ≈ raio da pupila × 3.5 (proporção anatômica fixa)
 *
 * O caller ainda precisa escalar para naturalWidth do arquivo original.
 */

/** Razão anatômica fixa: raio da íris ≈ 3.5× raio da pupila. */
const PUPIL_TO_IRIS_RATIO = 3.5
/** Tamanhos mínimo/máximo do cluster em px (no canvas 512×512). */
const MIN_COMPONENT_SIZE = 50
const MAX_COMPONENT_SIZE = 8000
/** Aspect ratio mínimo (largura/altura) — pupila real é circular (~1.0).
    0.6 rejeita sombras alongadas / arestas de objetos não-redondos (UAT 03:
    foto de mesa estava sendo detectada com 0.4). */
const MIN_ASPECT = 0.6
/** Distância máxima do centro do canvas, em fração da largura. */
const MAX_CENTER_DISTANCE_FRAC = 0.4
/** Bounds para sanity-check do threshold Otsu (evita extremos absurdos). */
const OTSU_MIN_THRESHOLD = 15
const OTSU_MAX_THRESHOLD = 90
/** Diferença mínima de luminância média entre foreground (escuro) e background.
    Pupila real tem alto contraste (>=70). Cenas uniformes (mesa, parede) com
    sombras sutis têm contraste <30. UAT 03: foto de mesa marcava 100%. */
const PUPIL_MIN_CONTRAST = 30

export interface PupilDetection {
  /** Centro do cluster em px do canvas analisado. null se não detectado. */
  center: { x: number; y: number } | null
  /** Raio do cluster em px do canvas analisado. */
  pupilRadiusInCanvas: number
  /** Threshold Otsu efetivamente usado (após clamp). Útil para diagnóstico. */
  thresholdUsed: number
}

/**
 * Otsu's method: encontra o threshold que maximiza a variância inter-classe
 * no histograma de luminância. Adapta-se automaticamente à iluminação da foto.
 *
 * Histograma de 256 bins (uint8). Retorna threshold em [0, 255]. O caller
 * deve aplicar clamp em range razoável.
 */
export function computeOtsuThreshold(histogram: Uint32Array, totalPixels: number): number {
  // Soma total weighted (sum_i i * count_i)
  let sumTotal = 0
  for (let i = 0; i < 256; i++) sumTotal += i * histogram[i]

  let sumBackground = 0
  let weightBackground = 0
  let maxVariance = -1
  let bestThreshold = 0

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t]
    if (weightBackground === 0) continue
    const weightForeground = totalPixels - weightBackground
    if (weightForeground === 0) break

    sumBackground += t * histogram[t]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sumTotal - sumBackground) / weightForeground

    // Variância inter-classe (não normalizada — ok porque comparamos relativos).
    const diff = meanBackground - meanForeground
    const variance = weightBackground * weightForeground * diff * diff

    if (variance > maxVariance) {
      maxVariance = variance
      bestThreshold = t
    }
  }

  return bestThreshold
}

/**
 * Detecta a pupila no ImageData (esperado tipicamente 512×512). Retorna
 * `{ center: null, pupilRadiusInCanvas: 0 }` quando nenhum candidato passa
 * os filtros de tamanho/forma/posição.
 */
export function detectPupilFromImageData(imageData: ImageData): PupilDetection {
  const { data, width, height } = imageData
  const total = width * height

  // 1a. Histograma de luminância (uint8, 256 bins) + cache da luminância
  // por pixel para evitar recálculo. Y' = 0.299R + 0.587G + 0.114B.
  const histogram = new Uint32Array(256)
  const lumCache = new Uint8Array(total)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0
    lumCache[p] = lum
    histogram[lum]++
  }

  // 1b. Threshold adaptativo via Otsu, clamped para evitar extremos absurdos
  // (foto toda escura → Otsu pode picar threshold > 90; foto toda clara →
  // pode picar < 15). Os bounds garantem comportamento razoável em edge cases.
  const otsuRaw = computeOtsuThreshold(histogram, total)
  const threshold = Math.max(OTSU_MIN_THRESHOLD, Math.min(OTSU_MAX_THRESHOLD, otsuRaw))

  // 1c. Máscara binária usando o threshold computado. Convenção Otsu: threshold
  // é o ÚLTIMO valor da classe de fundo (escura), portanto inclusive (<=).
  // Computa também médias de luminância das 2 classes pra check de contraste.
  const dark = new Uint8Array(total)
  let darkSum = 0
  let darkCount = 0
  let brightSum = 0
  let brightCount = 0
  for (let p = 0; p < total; p++) {
    const l = lumCache[p]
    if (l <= threshold) {
      dark[p] = 1
      darkSum += l
      darkCount++
    } else {
      brightSum += l
      brightCount++
    }
  }

  // 1d. Contraste insuficiente entre fg/bg → cena sem pupila real (mesa, parede).
  // Pupila real tem alto contraste; sombras sutis em superfícies uniformes
  // têm contraste baixo. Falha rápida com diagnóstico.
  const meanDark = darkCount > 0 ? darkSum / darkCount : 0
  const meanBright = brightCount > 0 ? brightSum / brightCount : 255
  const contrast = meanBright - meanDark
  if (contrast < PUPIL_MIN_CONTRAST) {
    // eslint-disable-next-line no-console
    console.log('[pupil-detection] rejected: low contrast', {
      threshold,
      contrast: Math.round(contrast),
      darkCount,
      brightCount,
    })
    return { center: null, pupilRadiusInCanvas: 0, thresholdUsed: threshold }
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

  if (bestLbl === -1) {
    // eslint-disable-next-line no-console
    console.log('[pupil-detection] rejected: no candidate passed filters', {
      threshold,
      contrast: Math.round(contrast),
      componentsFound: nextLabel - 1,
    })
    return { center: null, pupilRadiusInCanvas: 0, thresholdUsed: threshold }
  }

  const size = sizes[bestLbl]
  const center = { x: sumX[bestLbl] / size, y: sumY[bestLbl] / size }
  // Raio = média entre half-width e half-height do bounding box.
  const radius = ((maxX[bestLbl] - minX[bestLbl]) + (maxY[bestLbl] - minY[bestLbl])) / 4
  // eslint-disable-next-line no-console
  console.log('[pupil-detection] success', {
    threshold,
    contrast: Math.round(contrast),
    radius: Math.round(radius),
    center: { x: Math.round(center.x), y: Math.round(center.y) },
    clusterSize: size,
  })
  return { center, pupilRadiusInCanvas: radius, thresholdUsed: threshold }
}

export function pupilToIrisRadius(pupilRadius: number): number {
  return pupilRadius * PUPIL_TO_IRIS_RATIO
}

export const PUPIL_DETECTION_DEFAULTS = {
  PUPIL_TO_IRIS_RATIO,
  MIN_COMPONENT_SIZE,
  MAX_COMPONENT_SIZE,
  MIN_ASPECT,
  MAX_CENTER_DISTANCE_FRAC,
  OTSU_MIN_THRESHOLD,
  OTSU_MAX_THRESHOLD,
  PUPIL_MIN_CONTRAST,
} as const
