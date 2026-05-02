/**
 * Captura de foto em alta resolução.
 *
 * - **ImageCapture API** (Chrome/Android, Edge): `imageCapture.takePhoto()`
 *   produz Blob na resolução máxima do sensor — pode ser maior do que o
 *   stream (ex: 4K stream + 12MP photo).
 * - **Fallback canvas** (iOS Safari etc.): drawImage do `<video>` em canvas
 *   dimensionado pelo `videoTrack.getSettings()` — captura na resolução real
 *   do stream (não do elemento renderizado em CSS).
 *
 * Usado pelo capture-client para o JPEG "original" salvo no Supabase Storage.
 * O JPEG recortado vem desse mesmo blob via `cropBlobAroundIris`.
 */

const CANVAS_FALLBACK_QUALITY = 0.95

export interface PhotoResult {
  blob: Blob
  width: number
  height: number
  /**
   * Razão entre dimensões da foto e dimensões do video stream.
   * Usado para escalar coordenadas da íris (computadas em coords do video)
   * para o sistema de coords da foto. Quando ImageCapture e stream têm
   * aspect ratios divergentes, scaleX e scaleY podem diferir.
   */
  scaleX: number
  scaleY: number
  /** 'image-capture' | 'canvas' — para telemetria */
  source: 'image-capture' | 'canvas'
}

/**
 * @param video Elemento <video> com srcObject = MediaStream ativo.
 */
export async function takePhotoBlob(video: HTMLVideoElement): Promise<PhotoResult> {
  const stream = video.srcObject as MediaStream | null
  const track = stream?.getVideoTracks()[0] ?? null
  const videoW = video.videoWidth
  const videoH = video.videoHeight

  // 1. Tentar ImageCapture (suportado em Chrome/Android, Edge — não em iOS Safari).
  if (track && typeof window !== 'undefined' && 'ImageCapture' in window) {
    try {
      const ICCtor = (window as unknown as { ImageCapture: new (track: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture
      const ic = new ICCtor(track)
      const blob = await ic.takePhoto()
      // Decodifica para descobrir as dimensões reais do photo (PhotoCapabilities
      // mente em alguns devices; ler do bitmap é a fonte da verdade).
      const bitmap = await createImageBitmap(blob)
      const photoW = bitmap.width
      const photoH = bitmap.height
      bitmap.close()
      const scaleX = videoW > 0 ? photoW / videoW : 1
      const scaleY = videoH > 0 ? photoH / videoH : 1
      return { blob, width: photoW, height: photoH, scaleX, scaleY, source: 'image-capture' }
    } catch {
      // Cai para o fallback canvas — alguns devices listam ImageCapture mas falham
      // em takePhoto (ex: track stopped, pending operation, etc.).
    }
  }

  // 2. Fallback canvas — usa dimensões do track (resolução real do stream).
  const settings = track?.getSettings()
  const w = settings?.width ?? videoW
  const h = settings?.height ?? videoH
  if (w <= 0 || h <= 0) {
    throw new Error('[take-photo] dimensões do stream inválidas')
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    throw new Error('[take-photo] canvas 2d context indisponível')
  }
  ctx.drawImage(video, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', CANVAS_FALLBACK_QUALITY)
  })
  if (!blob) {
    throw new Error('[take-photo] toBlob retornou null')
  }

  return {
    blob,
    width: w,
    height: h,
    scaleX: 1,
    scaleY: 1,
    source: 'canvas',
  }
}
