import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compressFrameToJpeg, COMPRESS_DEFAULTS } from './jpeg-compress'

describe('compressFrameToJpeg', () => {
  let mockCanvas: HTMLCanvasElement
  let mockCtx: CanvasRenderingContext2D
  const mockBlob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' })

  beforeEach(() => {
    mockCtx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi.fn((cb: BlobCallback) => {
        cb(mockBlob)
      }),
    } as unknown as HTMLCanvasElement
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas
      return document.createElement(tag)
    })
  })

  it('uses MAX_DIMENSION=2048 and QUALITY=0.85', () => {
    expect(COMPRESS_DEFAULTS.MAX_DIMENSION).toBe(2048)
    expect(COMPRESS_DEFAULTS.JPEG_QUALITY).toBe(0.85)
  })

  it('does not upscale when source <= 2048', async () => {
    const fakeVideo = {} as HTMLVideoElement
    const r = await compressFrameToJpeg(fakeVideo, 1920, 1080)
    expect(r.width).toBe(1920)
    expect(r.height).toBe(1080)
    expect(mockCanvas.width).toBe(1920)
    expect(mockCanvas.height).toBe(1080)
  })

  it('downscales 4096x2048 → 2048x1024 (preserves aspect)', async () => {
    const fakeVideo = {} as HTMLVideoElement
    const r = await compressFrameToJpeg(fakeVideo, 4096, 2048)
    expect(r.width).toBe(2048)
    expect(r.height).toBe(1024)
  })

  it('does not upscale portrait 1080x1920 (both dims < 2048)', async () => {
    const fakeVideo = {} as HTMLVideoElement
    const r = await compressFrameToJpeg(fakeVideo, 1080, 1920)
    // max(1080,1920) = 1920 < 2048 → sem downscale
    expect(r.width).toBe(1080)
    expect(r.height).toBe(1920)
  })

  it('downscales portrait 2160x3840 → 1080x1920 (preserves aspect)', async () => {
    const fakeVideo = {} as HTMLVideoElement
    const r = await compressFrameToJpeg(fakeVideo, 2160, 3840)
    // max(2160,3840) = 3840 > 2048 → ratio = 2048/3840 ≈ 0.5333
    expect(r.width).toBe(Math.round(2160 * 2048 / 3840))
    expect(r.height).toBe(2048)
  })

  it('calls toBlob with image/jpeg and quality 0.85', async () => {
    const fakeVideo = {} as HTMLVideoElement
    await compressFrameToJpeg(fakeVideo, 800, 600)
    expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85)
  })

  it('throws when toBlob returns null', async () => {
    mockCanvas.toBlob = vi.fn((cb: BlobCallback) => cb(null))
    const fakeVideo = {} as HTMLVideoElement
    await expect(compressFrameToJpeg(fakeVideo, 800, 600)).rejects.toThrow(/null/)
  })

  it('throws on invalid dimensions', async () => {
    await expect(compressFrameToJpeg({} as HTMLVideoElement, 0, 600)).rejects.toThrow(/positivos/)
  })

  it('returns blob from toBlob', async () => {
    const fakeVideo = {} as HTMLVideoElement
    const r = await compressFrameToJpeg(fakeVideo, 800, 600)
    expect(r.blob).toBe(mockBlob)
  })
})
