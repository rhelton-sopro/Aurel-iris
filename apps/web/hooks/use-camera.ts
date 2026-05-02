'use client'

import * as React from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'streaming' | 'denied' | 'error'
export type CameraErrorType =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'AbortError'
  | 'SecurityError'
  | 'UnknownError'

export interface UseCameraOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Iniciar getUserMedia automaticamente no mount. Default true. */
  autoStart?: boolean
}

export interface UseCameraResult {
  status: CameraStatus
  errorType: CameraErrorType | null
  error: Error | null
  stream: MediaStream | null
  start: () => Promise<void>
  stop: () => void
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    // 'ideal' (não 'exact') — em desktop sem câmera traseira, 'exact' joga OverconstrainedError direto
    facingMode: { ideal: 'environment' },
    // 4K ideal: dobra/quadruplica a resolução vs. 1080p anterior, melhorando
    // a qualidade da íris no JPEG salvo. Phones que não suportam 4K caem
    // automaticamente para a melhor resolução disponível.
    width: { ideal: 3840 },
    height: { ideal: 2160 },
  },
  audio: false,
}

function classifyError(err: unknown): CameraErrorType {
  if (typeof err === 'object' && err !== null && 'name' in err) {
    const name = (err as { name: string }).name
    if (
      name === 'NotAllowedError' ||
      name === 'NotFoundError' ||
      name === 'NotReadableError' ||
      name === 'OverconstrainedError' ||
      name === 'AbortError' ||
      name === 'SecurityError'
    ) {
      return name
    }
  }
  return 'UnknownError'
}

export function useCamera({ videoRef, autoStart = true }: UseCameraOptions): UseCameraResult {
  const [status, setStatus] = React.useState<CameraStatus>('idle')
  const [errorType, setErrorType] = React.useState<CameraErrorType | null>(null)
  const [error, setError] = React.useState<Error | null>(null)
  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  const stop = React.useCallback(() => {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStream(null)
    setStatus('idle')
  }, [videoRef])

  const start = React.useCallback(async () => {
    // Re-entrante: derruba stream anterior antes de pedir um novo
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStatus('requesting')
    setError(null)
    setErrorType(null)
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('Câmera não suportada neste navegador'), { name: 'NotFoundError' })
      }
      const s = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      streamRef.current = s
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        // iOS quirk: precisa play() explícito mesmo com autoPlay
        try { await videoRef.current.play() } catch { /* ignore — autoplay deveria cobrir */ }
      }
      setStatus('streaming')
    } catch (e) {
      const t = classifyError(e)
      setErrorType(t)
      setError(e as Error)
      setStatus(t === 'NotAllowedError' ? 'denied' : 'error')
    }
  }, [videoRef])

  // Auto-start no mount + cleanup em unmount
  React.useEffect(() => {
    if (autoStart) {
      void start()
    }
    return () => { stop() }
    // start/stop são useCallbacks estáveis (deps já cobertas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // iOS Safari: stream pausa em background tab — re-play() ao voltar
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && streamRef.current && videoRef.current) {
        videoRef.current.play().catch(() => { /* ignore */ })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [videoRef])

  return { status, errorType, error, stream, start, stop }
}
