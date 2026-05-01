'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { X } from 'lucide-react'
import { CameraView } from '@/components/capture/CameraView'
import { QualityIndicator } from '@/components/capture/QualityIndicator'
import { LiveFeedbackMessage } from '@/components/capture/LiveFeedbackMessage'
import {
  computeQualityCheck,
  overallScore,
  dominantFailure,
  feedbackMessage,
  type QualityCheck,
  type Eye,
} from '@/lib/capture/quality-scoring'
import type { UseIrisDetectorResult } from '@/hooks/use-iris-detector'
import { useStableQualityGate } from '@/hooks/use-quality-score'

const IrisDetector = dynamic(() => import('@/components/capture/IrisDetector'), {
  ssr: false,
})

interface CapturedSlot { eye: string; angle: string }

interface CaptureClientProps {
  readingId: string
  therapistId: string
  clientName: string
  capturedSlots: CapturedSlot[]
  resumeMode: boolean
}

const ANALYSIS_W = 256
const ANALYSIS_H = 256

export function CaptureClient({ readingId, therapistId: _therapistId, clientName, capturedSlots: _capturedSlots, resumeMode: _resumeMode }: CaptureClientProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const analysisCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const detectorRef = React.useRef<UseIrisDetectorResult | null>(null)

  const [score, setScore] = React.useState(0)
  const [check, setCheck] = React.useState<QualityCheck | null>(null)

  // Slot fixo nesta fase — sequence machine virá em 03-06
  const currentEye: Eye = 'right'

  // Loop de inferência por frame
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let handle: number | null = null
    const supportsRVFC = typeof (HTMLVideoElement.prototype as unknown as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function'

    const tick = (now: number) => {
      const det = detectorRef.current
      if (det?.ready && video.readyState >= 2) {
        const result = det.detect(video, now)
        const landmarks = result?.faceLandmarks?.[0] ?? null
        // Recortar janela 256×256 centrada — usa canvas auxiliar
        if (!analysisCanvasRef.current) {
          analysisCanvasRef.current = document.createElement('canvas')
          analysisCanvasRef.current.width = ANALYSIS_W
          analysisCanvasRef.current.height = ANALYSIS_H
        }
        const canvas = analysisCanvasRef.current
        const ctx = canvas.getContext('2d', { alpha: false })
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          // Crop centralizado para downscale 256x256 — perde aspect mas é aceitável para análise
          const minDim = Math.min(video.videoWidth, video.videoHeight)
          const sx = (video.videoWidth - minDim) / 2
          const sy = (video.videoHeight - minDim) / 2
          ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, ANALYSIS_W, ANALYSIS_H)
          const imageData = ctx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H)
          const c = computeQualityCheck(landmarks, currentEye, imageData, ANALYSIS_W, ANALYSIS_H)
          setCheck(c)
          setScore(overallScore(c))
        }
      }
      if (supportsRVFC) {
        handle = (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: (now: number) => void) => number }).requestVideoFrameCallback(tick)
      } else {
        handle = requestAnimationFrame(tick)
      }
    }
    if (supportsRVFC) {
      handle = (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: (now: number) => void) => number }).requestVideoFrameCallback(tick)
    } else {
      handle = requestAnimationFrame(tick)
    }
    return () => {
      if (handle == null) return
      if (supportsRVFC && 'cancelVideoFrameCallback' in video) {
        ;(video as HTMLVideoElement & { cancelVideoFrameCallback: (id: number) => void }).cancelVideoFrameCallback(handle)
      } else {
        cancelAnimationFrame(handle)
      }
    }
  }, [currentEye])

  // Auto-capture stub — em 03-07 vai chamar Canvas.toBlob + upload
  useStableQualityGate(score, () => {
    console.log(`[capture-client] auto-trigger ready for slot ${currentEye}/frontal — captura real virá no plan 03-07`)
  })

  // Mensagem dominante
  const message = check ? feedbackMessage(dominantFailure(check)) : 'Aguarde — preparando câmera...'

  return (
    <div className="relative flex-1 flex flex-col">
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 pt-[env(safe-area-inset-top)]">
        <span className="text-sm text-white/80">{clientName}</span>
        <Link
          href="/leituras"
          aria-label="Cancelar leitura"
          className="rounded-full bg-black/50 backdrop-blur-sm p-2 text-white"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      <CameraView videoRef={videoRef} />

      {/* Barra de qualidade no topo, abaixo da safe-area */}
      <div className="absolute left-0 right-0 z-20 pt-[calc(env(safe-area-inset-top)+44px)]">
        <QualityIndicator score={score} />
      </div>

      {/* Live feedback no centro inferior */}
      <div className="absolute left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-20 flex justify-center px-4">
        <LiveFeedbackMessage message={message} />
      </div>

      {/* Lazy-loaded MediaPipe — não renderiza UI; expõe API via callback */}
      <IrisDetector
        onReady={(api) => {
          detectorRef.current = api
        }}
      />

      {/* Debug stub — remover quando 03-06 montar state machine */}
      <div className="absolute bottom-2 right-2 z-10 px-2 py-1 rounded bg-black/40 text-[10px] text-white/60">
        {readingId.slice(0, 8)} • {currentEye} • {(score * 100).toFixed(0)}%
      </div>
    </div>
  )
}
