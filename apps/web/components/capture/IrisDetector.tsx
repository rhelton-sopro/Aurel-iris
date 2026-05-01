'use client'

import * as React from 'react'
import { useIrisDetector, type UseIrisDetectorResult } from '@/hooks/use-iris-detector'

interface IrisDetectorProps {
  onReady?: (api: UseIrisDetectorResult) => void
}

/**
 * Wrapper invisible que hospeda useIrisDetector e expõe a API via callback.
 * Usado via next/dynamic({ ssr: false }) em capture-client para garantir que
 * o bundle de @mediapipe/tasks-vision seja code-split fora do (dashboard).
 *
 * Não renderiza UI próprio — apenas roda os efeitos do hook.
 */
export default function IrisDetector({ onReady }: IrisDetectorProps) {
  const api = useIrisDetector()
  React.useEffect(() => {
    if (api.ready && onReady) {
      onReady(api)
    }
  }, [api, api.ready, onReady])
  return null
}
