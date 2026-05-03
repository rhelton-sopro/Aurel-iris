import { describe, expect, it } from 'vitest'
import { computeOtsuThreshold, detectPupilFromImageData, PUPIL_DETECTION_DEFAULTS } from './pupil-detection'

describe('computeOtsuThreshold', () => {
  it('encontra threshold separando os 2 clusters em histograma bimodal claro', () => {
    // Histograma bimodal: pico em 25..35 (escuro) + pico em 195..205 (claro).
    // Otsu retorna o último valor do cluster escuro (convenção: pixels <=t são classe A).
    const histogram = new Uint32Array(256)
    for (let i = 25; i <= 35; i++) histogram[i] = 100
    for (let i = 195; i <= 205; i++) histogram[i] = 1000
    const total = 100 * 11 + 1000 * 11
    const t = computeOtsuThreshold(histogram, total)
    // Threshold deve cair entre o último elemento do cluster escuro (35) e
    // o primeiro do cluster claro (195) — qualquer valor nesse range separa.
    expect(t).toBeGreaterThanOrEqual(35)
    expect(t).toBeLessThan(195)
  })

  it('retorna 0 para histograma vazio', () => {
    const histogram = new Uint32Array(256)
    const t = computeOtsuThreshold(histogram, 0)
    expect(t).toBe(0)
  })

  it('retorna 0 quando todos os pixels têm a mesma luminância (sem 2 classes)', () => {
    const histogram = new Uint32Array(256)
    histogram[100] = 1000
    const t = computeOtsuThreshold(histogram, 1000)
    // Sem variância inter-classe possível — bestThreshold permanece em 0.
    expect(t).toBe(0)
  })

  it('encontra threshold em histograma balanceado (clusters de tamanho similar)', () => {
    // Otsu funciona melhor com classes razoavelmente balanceadas. Pupila +
    // sombras como ~10% dos pixels é típico em close de olho. Resto bem claro.
    const histogram = new Uint32Array(256)
    for (let i = 30; i <= 50; i++) histogram[i] = 100   // ~2100 pixels escuros
    for (let i = 150; i <= 200; i++) histogram[i] = 80  // ~4080 pixels claros
    const total = 100 * 21 + 80 * 51
    const t = computeOtsuThreshold(histogram, total)
    // Threshold cai entre os dois clusters.
    expect(t).toBeGreaterThanOrEqual(50)
    expect(t).toBeLessThan(150)
  })
})

describe('detectPupilFromImageData', () => {
  function makeCanvas(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): ImageData {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const [r, g, b] = paint(x, y)
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
      }
    }
    return new ImageData(data, width, height)
  }

  it('detecta pupila circular no centro de imagem clara (caso típico)', () => {
    const W = 128
    const H = 128
    const cx = 64
    const cy = 64
    const r = 12
    const imageData = makeCanvas(W, H, (x, y) => {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 <= r * r) return [10, 10, 10] // pupila super escura
      return [200, 180, 150] // sclera/iris/skin claros
    })
    const result = detectPupilFromImageData(imageData)
    expect(result.center).not.toBeNull()
    expect(result.center!.x).toBeCloseTo(cx, 0)
    expect(result.center!.y).toBeCloseTo(cy, 0)
    expect(result.pupilRadiusInCanvas).toBeGreaterThan(8)
    expect(result.pupilRadiusInCanvas).toBeLessThan(20)
  })

  it('detecta pupila quando luminância é alta — foto bem iluminada (Otsu adapta)', () => {
    // Cenário que falhava com threshold fixo de 40: pupila em luminância 70,
    // resto da imagem em 180+. Threshold fixo não pegaria; Otsu pega.
    const W = 128
    const H = 128
    const imageData = makeCanvas(W, H, (x, y) => {
      const dx = x - 64
      const dy = y - 64
      const d2 = dx * dx + dy * dy
      if (d2 <= 100) return [70, 70, 70] // pupila em luminância 70 (era invisível pro threshold=40)
      return [200, 180, 160] // resto bem iluminado
    })
    const result = detectPupilFromImageData(imageData)
    expect(result.center).not.toBeNull()
    expect(result.thresholdUsed).toBeGreaterThanOrEqual(70)
    expect(result.thresholdUsed).toBeLessThanOrEqual(PUPIL_DETECTION_DEFAULTS.OTSU_MAX_THRESHOLD)
  })

  it('retorna null quando imagem não tem pupila (foto de cena clara uniforme)', () => {
    // Imagem totalmente clara — Otsu vai picar threshold absurdo, clamp evita
    // detectar ruído como pupila.
    const W = 128
    const H = 128
    const imageData = makeCanvas(W, H, () => [200, 200, 200])
    const result = detectPupilFromImageData(imageData)
    expect(result.center).toBeNull()
    expect(result.pupilRadiusInCanvas).toBe(0)
  })

  it('reporta thresholdUsed para diagnóstico', () => {
    const W = 64
    const H = 64
    const imageData = makeCanvas(W, H, (x, y) => {
      if ((x - 32) ** 2 + (y - 32) ** 2 <= 49) return [20, 20, 20]
      return [180, 180, 180]
    })
    const result = detectPupilFromImageData(imageData)
    expect(result.thresholdUsed).toBeGreaterThanOrEqual(PUPIL_DETECTION_DEFAULTS.OTSU_MIN_THRESHOLD)
    expect(result.thresholdUsed).toBeLessThanOrEqual(PUPIL_DETECTION_DEFAULTS.OTSU_MAX_THRESHOLD)
  })
})
