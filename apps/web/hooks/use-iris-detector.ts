'use client'

import * as React from 'react'
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision'

const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/face_landmarker.task'

/** Inputs aceitos pelo FaceLandmarker em runningMode='IMAGE'. */
export type IrisDetectorInput =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | ImageData

export interface UseIrisDetectorResult {
  ready: boolean
  error: Error | null
  /**
   * Detecção single-shot em uma imagem estática (foto vinda do input nativo
   * de câmera). Retorna null se o detector ainda não está pronto ou falhou.
   */
  detect: (input: IrisDetectorInput) => FaceLandmarkerResult | null
}

/**
 * Carrega o FaceLandmarker do MediaPipe em runningMode='IMAGE'. Usado para
 * detecção single-shot de íris em fotos capturadas pelo input nativo da
 * câmera (substitui o uso anterior em streaming de vídeo).
 *
 * O detector e seus assets (~6MB) são carregados uma vez ao montar e
 * reutilizados para todas as 6 capturas da sequência.
 */
export function useIrisDetector(): UseIrisDetectorResult {
  const landmarkerRef = React.useRef<FaceLandmarker | null>(null)
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_PATH,
            // Tenta GPU; fallback automático para CPU se WebGL indisponível
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
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

  const detect = React.useCallback((input: IrisDetectorInput): FaceLandmarkerResult | null => {
    const lm = landmarkerRef.current
    if (!lm) return null
    try {
      return lm.detect(input)
    } catch {
      return null
    }
  }, [])

  return { ready, error, detect }
}
