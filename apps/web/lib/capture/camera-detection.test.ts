import { describe, expect, it, vi, beforeEach } from 'vitest'
import { detectCameraSource } from './camera-detection'

vi.mock('exifr', () => ({
  default: {
    parse: vi.fn(),
  },
}))

import exifr from 'exifr'

describe('detectCameraSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detecta iPhone front camera via LensModel', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      LensModel: 'iPhone 15 Pro front camera 2.69mm f/1.9',
      LensMake: 'Apple',
    })
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'front', source: 'exif' })
  })

  it('detecta iPhone back camera via LensModel', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      LensModel: 'iPhone 15 Pro back triple camera 6.86mm f/1.78',
      LensMake: 'Apple',
    })
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'rear', source: 'exif' })
  })

  it('detecta selfie genérica (Android Samsung)', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      LensModel: 'Selfie Camera',
    })
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'front', source: 'exif' })
  })

  it('detecta câmera ultra-wide como traseira', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      LensModel: 'iPhone 14 ultra wide camera 1.57mm f/2.4',
    })
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'rear', source: 'exif' })
  })

  it('retorna unknown/exif-missing quando exifr retorna null', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce(undefined as unknown as Record<string, unknown>)
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'unknown', source: 'exif-missing' })
  })

  it('retorna unknown/exif-missing quando LensModel/LensMake estão vazios', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      LensModel: '',
      LensMake: '',
    })
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'unknown', source: 'exif-missing' })
  })

  it('retorna unknown/exif-ambiguous quando lens não tem termos discrimináveis', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      LensModel: 'Generic Camera Module v2',
    })
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'unknown', source: 'exif-ambiguous' })
  })

  it('retorna unknown/exif-missing quando exifr lança exception', async () => {
    vi.mocked(exifr.parse).mockRejectedValueOnce(new Error('Invalid JPEG'))
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'unknown', source: 'exif-missing' })
  })

  it('precedência: front ganha quando ambos os patterns casam (defesa em profundidade)', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      LensModel: 'front back hybrid lens',
    })
    const result = await detectCameraSource(new Blob())
    expect(result).toEqual({ kind: 'front', source: 'exif' })
  })

  it('"infrared" não é classificado como front (boundary check)', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({
      LensModel: 'TrueDepth infrared sensor',
    })
    const result = await detectCameraSource(new Blob())
    expect(result.kind).toBe('unknown')
  })
})
