import { describe, it, expect } from 'vitest'
import { laplacianVariance, sharpnessScore } from './laplacian-variance'

function uniformImage(w: number, h: number, gray: number): ImageData {
  const arr = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = gray
    arr[i + 1] = gray
    arr[i + 2] = gray
    arr[i + 3] = 255
  }
  return new ImageData(arr, w, h)
}

function checkerboard(w: number, h: number): ImageData {
  const arr = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const v = (x + y) % 2 === 0 ? 255 : 0
      arr[i] = v
      arr[i + 1] = v
      arr[i + 2] = v
      arr[i + 3] = 255
    }
  }
  return new ImageData(arr, w, h)
}

describe('laplacianVariance', () => {
  it('uniform image → variance ≈ 0', () => {
    const v = laplacianVariance(uniformImage(16, 16, 128))
    expect(v).toBeCloseTo(0, 5)
  })
  it('checkerboard → variance > 0', () => {
    const v = laplacianVariance(checkerboard(16, 16))
    expect(v).toBeGreaterThan(0)
  })
  it('image too small → 0', () => {
    expect(laplacianVariance(uniformImage(2, 2, 128))).toBe(0)
  })
})

describe('sharpnessScore', () => {
  it('variance 0 → 0', () => expect(sharpnessScore(0)).toBe(0))
  it('variance 200 → 1', () => expect(sharpnessScore(200)).toBe(1))
  it('variance 100 → 0.5', () => expect(sharpnessScore(100)).toBe(0.5))
  it('variance 1000 → clamped to 1', () => expect(sharpnessScore(1000)).toBe(1))
})
