'use client'

import * as React from 'react'
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision'

const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/face_landmarker.task'

export interface UseIrisDetectorResult {
  ready: boolean
  error: Error | null
  /**
   * Inferência por frame. Retorna null se detector ainda não está pronto ou falhou.
   * timestampMs deve ser monotônico (use performance.now()).
   */
  detect: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerResult | null
}

export function useIrisDetector(): UseIrisDetectorResult {
  const landmarkerRef = React.useRef<FaceLandmarker | null>(null)
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Lazy de fato: import do pacote acontece aqui (não top-level)
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_PATH,
            // Tenta GPU; fallback automático para CPU se WebGL indisponível
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setReady(true)
      } catch (e) {
        if (!cancelled) {
          setError(e as Error)
        }
      }
    })()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  const detect = React.useCallback((video: HTMLVideoElement, timestampMs: number): FaceLandmarkerResult | null => {
    const lm = landmarkerRef.current
    if (!lm) return null
    try {
      return lm.detectForVideo(video, timestampMs)
    } catch {
      return null
    }
  }, [])

  return { ready, error, detect }
}
