/**
 * Variância de Laplaciana — métrica clássica de blur detection.
 * Algoritmo: convolução manual 3×3 com kernel [[0,1,0],[1,-4,1],[0,1,0]] em grayscale,
 * variância dos valores resultantes.
 * Performance: ~3-5ms em 256×256 no main thread mid-tier (RESEARCH).
 *
 * Limiar SPEC §4.1: variance > 100 = nítido. Esta lib normaliza para 0..1 com
 * `sharpnessScore` usando 200 como ponto de saturação (excellent).
 */
export function laplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData
  if (width < 3 || height < 3) return 0

  // Grayscale (Rec. 601 luma)
  const gray = new Float32Array(width * height)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  let sum = 0
  let sumSq = 0
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const lap =
        4 * gray[idx]
        - gray[idx - 1] - gray[idx + 1]
        - gray[idx - width] - gray[idx + width]
      sum += lap
      sumSq += lap * lap
      count++
    }
  }
  if (count === 0) return 0
  const mean = sum / count
  return Math.max(0, sumSq / count - mean * mean)
}

/**
 * Normaliza variance → 0..1.
 * Calibrado para câmera mobile real (iPhone/Android rear cam com JPEG decode):
 *   variance < 40  → desfocado (score < 0.5)
 *   variance >= 80 → nítido o suficiente (score = 1.0)
 * Câmeras DSLR/lab atingem variance >200; mobile comprimido tipicamente 30–80.
 */
export function sharpnessScore(variance: number): number {
  return Math.max(0, Math.min(1, variance / 80))
}
