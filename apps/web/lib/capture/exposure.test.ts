import { describe, it, expect } from 'vitest'
import { exposureScore, getExposureDirection, reflexInCenter } from './exposure'

function uniform(w: number, h: number, gray: number): ImageData {
  const arr = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = gray; arr[i + 1] = gray; arr[i + 2] = gray; arr[i + 3] = 255
  }
  return new ImageData(arr, w, h)
}

describe('exposureScore', () => {
  it('mid gray → high score', () => {
    expect(exposureScore(uniform(16, 16, 128))).toBeGreaterThan(0.9)
  })
  it('all black → low score', () => {
    expect(exposureScore(uniform(16, 16, 0))).toBe(0)
  })
  it('all white → low score', () => {
    expect(exposureScore(uniform(16, 16, 255))).toBe(0)
  })
})

describe('getExposureDirection', () => {
  it('all dark → low', () => expect(getExposureDirection(uniform(16, 16, 5))).toBe('low'))
  it('all bright → high', () => expect(getExposureDirection(uniform(16, 16, 250))).toBe('high'))
  it('mid → ok', () => expect(getExposureDirection(uniform(16, 16, 128))).toBe('ok'))
})

describe('reflexInCenter', () => {
  it('saturated patch in center → true', () => {
    const img = uniform(32, 32, 128)
    // Pintar quadrado saturado 6x6 no centro
    for (let y = 13; y < 19; y++) {
      for (let x = 13; x < 19; x++) {
        const i = (y * 32 + x) * 4
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255
      }
    }
    expect(reflexInCenter(img, { x: 16, y: 16 }, 10)).toBe(true)
  })
  it('uniform mid → false', () => {
    expect(reflexInCenter(uniform(32, 32, 128), { x: 16, y: 16 }, 10)).toBe(false)
  })
})
