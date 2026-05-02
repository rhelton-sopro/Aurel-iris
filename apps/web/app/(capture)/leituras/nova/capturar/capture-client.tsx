'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { X } from 'lucide-react'
import { CameraView } from '@/components/capture/CameraView'
import { QualityIndicator } from '@/components/capture/QualityIndicator'
import { LiveFeedbackMessage } from '@/components/capture/LiveFeedbackMessage'
import { CaptureProgress } from '@/components/capture/CaptureProgress'
import { AngleOverlay } from '@/components/capture/AngleOverlay'
import { AngleInterstitial } from '@/components/capture/AngleInterstitial'
import {
  computeQualityCheck,
  overallScore,
  dominantFailure,
  feedbackMessage,
  type QualityCheck,
} from '@/lib/capture/quality-scoring'
import {
  SEQUENCE,
  type Slot,
  type SlotPhase,
  getResumeSlotIndex,
  isOuterEyeTransition,
} from '@/lib/capture/sequence'
import { getIrisCenter, getIrisRadius } from '@/lib/capture/iris-geometry'
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

export function CaptureClient({
  readingId,
  therapistId: _therapistId,
  clientName,
  capturedSlots: initialCaptured,
  resumeMode: _resumeMode,
}: CaptureClientProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const analysisCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const detectorRef = React.useRef<UseIrisDetectorResult | null>(null)
  // Mantém última posição conhecida da íris por 500ms após perda de landmarks
  const irisHoldRef = React.useRef<{ cx: number; cy: number; r: number; expiresAt: number } | null>(null)

  // Inicializa slotIndex baseado no que já foi capturado (D-12 + resume)
  const initialIndex = React.useMemo(() => {
    const idx = getResumeSlotIndex(initialCaptured)
    return idx === -1 ? SEQUENCE.length - 1 : idx
  }, [initialCaptured])

  const [slotIndex, setSlotIndex] = React.useState(initialIndex)
  const [phase, setPhase] = React.useState<SlotPhase>(() => {
    // Se for resume cruzando para o olho esquerdo, começar com interstitial
    if (initialIndex >= 3 && initialCaptured.every(c => c.eye !== 'left')) {
      return 'interstitial'
    }
    return 'streaming'
  })
  const [capturedCount, setCapturedCount] = React.useState(initialCaptured.length)
  const [score, setScore] = React.useState(0)
  const [check, setCheck] = React.useState<QualityCheck | null>(null)
  const [irisPos, setIrisPos] = React.useState<{ cx: number; cy: number; r: number } | null>(null)
  const [lastThumb, setLastThumb] = React.useState<string | null>(null)
  const [reviewThumb, setReviewThumb] = React.useState<string | null>(null)

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]

  // Loop de inferência por frame — só roda quando phase é streaming ou overlay
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (phase !== 'streaming' && phase !== 'overlay') return

    let handle: number | null = null
    const proto = HTMLVideoElement.prototype as unknown as {
      requestVideoFrameCallback?: (cb: (now: number) => void) => number
      cancelVideoFrameCallback?: (id: number) => void
    }
    const supportsRVFC = typeof proto.requestVideoFrameCallback === 'function'

    const tick = (now: number) => {
      const det = detectorRef.current
      if (det?.ready && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const result = det.detect(video, now)
        const landmarks = result?.faceLandmarks?.[0] ?? null

        // Iris overlay — mapeia coordenadas normalizadas para pixels considerando object-cover
        const lm = landmarks ?? []
        const irisCenter = getIrisCenter(lm, slot.eye)
        const irisRaw = irisCenter ? getIrisRadius(lm, slot.eye) : 0
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
        if (irisCenter && irisRaw > 0 && video.offsetWidth > 0) {
          const cW = video.offsetWidth
          const cH = video.offsetHeight
          const vW = video.videoWidth
          const vH = video.videoHeight
          const scale = Math.max(cW / vW, cH / vH)
          const newPos = {
            cx: (cW - vW * scale) / 2 + irisCenter.x * vW * scale,
            cy: (cH - vH * scale) / 2 + irisCenter.y * vH * scale,
            r: irisRaw * vW * scale,
          }
          irisHoldRef.current = { ...newPos, expiresAt: nowMs + 500 }
          setIrisPos(newPos)
        } else {
          // Mantém última posição por 500ms (câmera muito próxima perde landmarks)
          const held = irisHoldRef.current
          if (held && nowMs < held.expiresAt) {
            setIrisPos({ cx: held.cx, cy: held.cy, r: held.r })
          } else {
            irisHoldRef.current = null
            setIrisPos(null)
          }
        }

        if (!analysisCanvasRef.current) {
          analysisCanvasRef.current = document.createElement('canvas')
          analysisCanvasRef.current.width = ANALYSIS_W
          analysisCanvasRef.current.height = ANALYSIS_H
        }
        const canvas = analysisCanvasRef.current
        const ctx = canvas.getContext('2d', { alpha: false })
        if (ctx) {
          const minDim = Math.min(video.videoWidth, video.videoHeight)
          const sx = (video.videoWidth - minDim) / 2
          const sy = (video.videoHeight - minDim) / 2
          ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, ANALYSIS_W, ANALYSIS_H)
          const imageData = ctx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H)
          const c = computeQualityCheck(landmarks, slot.eye, imageData, ANALYSIS_W, ANALYSIS_H)
          setCheck(c)
          setScore(overallScore(c))
        }
      }
      const videoEx = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: (now: number) => void) => number
      }
      if (supportsRVFC && videoEx.requestVideoFrameCallback) {
        handle = videoEx.requestVideoFrameCallback(tick)
      } else {
        handle = requestAnimationFrame(tick)
      }
    }
    const videoEx = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number) => void) => number
      cancelVideoFrameCallback?: (id: number) => void
    }
    if (supportsRVFC && videoEx.requestVideoFrameCallback) {
      handle = videoEx.requestVideoFrameCallback(tick)
    } else {
      handle = requestAnimationFrame(tick)
    }
    return () => {
      if (handle == null) return
      if (supportsRVFC && videoEx.cancelVideoFrameCallback) {
        videoEx.cancelVideoFrameCallback(handle)
      } else {
        cancelAnimationFrame(handle)
      }
    }
  }, [phase, slot.eye])

  // Avança para o próximo slot após review
  const advanceToNextSlot = React.useCallback(() => {
    const next = slotIndex + 1
    if (next >= SEQUENCE.length) {
      setPhase('finalizing')
      return
    }
    if (isOuterEyeTransition(slotIndex, next)) {
      setPhase('interstitial')
    } else {
      setPhase('overlay')
    }
    setSlotIndex(next)
    setCapturedCount(c => c + 1)
  }, [slotIndex])

  // Ref estável para advanceToNextSlot — usado dentro de timeouts
  const advanceRef = React.useRef(advanceToNextSlot)
  React.useEffect(() => { advanceRef.current = advanceToNextSlot }, [advanceToNextSlot])

  // Captura um frame e entra na fase de revisão visual
  const handleCapture = React.useCallback(() => {
    if (phase !== 'streaming') return
    const thumb = analysisCanvasRef.current?.toDataURL('image/jpeg', 0.7) ?? null
    setLastThumb(thumb)
    setReviewThumb(thumb)
    setPhase('reviewing')
  }, [phase])

  const captureGate = useStableQualityGate(score, handleCapture)

  // reviewing: exibe foto por 1.5s, depois avança para próximo slot
  React.useEffect(() => {
    if (phase !== 'reviewing') return
    captureGate.reset()
    const id = window.setTimeout(() => {
      setReviewThumb(null)
      advanceRef.current()
    }, 1500)
    return () => window.clearTimeout(id)
  }, [phase, captureGate])

  // Quando entra em 'overlay', auto-volta para 'streaming' após 2.5s + reset gate
  React.useEffect(() => {
    if (phase !== 'overlay') return
    const id = window.setTimeout(() => {
      setPhase('streaming')
      captureGate.reset()
    }, 2500)
    return () => window.clearTimeout(id)
  }, [phase, captureGate])

  // Reset gate quando entra em interstitial ou finalizing
  React.useEffect(() => {
    if (phase === 'interstitial' || phase === 'finalizing') {
      captureGate.reset()
    }
  }, [phase, captureGate])

  const message = check ? feedbackMessage(dominantFailure(check)) : 'Aguarde — preparando câmera...'

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 pt-[env(safe-area-inset-top)]">
        <span className="text-sm text-white/80 truncate max-w-[60%]">{clientName}</span>
        <Link
          href="/leituras"
          aria-label="Cancelar leitura"
          className="rounded-full bg-black/50 backdrop-blur-sm p-2 text-white"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      <CameraView videoRef={videoRef} />

      {/* Iris guide — segue a íris detectada; cor varia com o score */}
      {phase !== 'interstitial' && phase !== 'finalizing' && phase !== 'reviewing' && (
        irisPos != null ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-full border-2 transition-colors duration-300 ${
              score < 0.40
                ? 'border-red-500'
                : score < 0.75
                ? 'border-amber-400'
                : 'border-emerald-500'
            }`}
            style={{
              width: irisPos.r * 2,
              height: irisPos.r * 2,
              left: irisPos.cx - irisPos.r,
              top: irisPos.cy - irisPos.r,
              zIndex: 15,
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 15 }}
          >
            <div className="aspect-square w-[60vmin] max-w-[360px] rounded-full border-2 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )
      )}

      {/* QualityIndicator + CaptureProgress no topo (ocultos durante interstitial, reviewing e finalizing) */}
      {phase !== 'interstitial' && phase !== 'finalizing' && phase !== 'reviewing' && (
        <div className="absolute left-0 right-0 z-20 pt-[calc(env(safe-area-inset-top)+44px)] flex flex-col items-center gap-3">
          <QualityIndicator score={score} />
          <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />
        </div>
      )}

      {/* AngleOverlay quando phase==='overlay' */}
      {phase === 'overlay' && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+120px)] left-1/2 -translate-x-1/2 z-25 max-w-[90%]">
          <AngleOverlay slot={slot} resetKey={`${slot.eye}_${slot.angle}`} />
        </div>
      )}

      {/* LiveFeedbackMessage no centro-inferior (apenas durante streaming) */}
      {phase === 'streaming' && (
        <div className="absolute left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-20 flex justify-center px-4">
          <LiveFeedbackMessage message={message} />
        </div>
      )}

      {/* AngleInterstitial fullscreen — transição de olho (T-03-06-03: gate suspenso) */}
      {phase === 'interstitial' && (
        <AngleInterstitial
          nextSlot={slot}
          onProceed={() => {
            setPhase('streaming')
            captureGate.reset()
          }}
        />
      )}

      {/* Finalizing stub — 03-08 substitui com finalizeReadingAction + redirect */}
      {phase === 'finalizing' && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 text-foreground">
          <h1 className="text-xl font-semibold">6 de 6 imagens registradas</h1>
          <p className="text-sm text-muted-foreground">Finalizando leitura...</p>
        </div>
      )}

      {/* Botão manual — fallback se auto-trigger não disparar */}
      {phase === 'streaming' && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
          <button
            type="button"
            onClick={handleCapture}
            className="rounded-full bg-white/25 backdrop-blur-sm border-2 border-white/60 w-20 h-20 flex items-center justify-center text-white text-xs font-semibold text-center leading-tight"
          >
            Capturar agora
          </button>
        </div>
      )}

      {/* Reviewing: foto capturada em tela cheia por 1.5s */}
      {phase === 'reviewing' && reviewThumb && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reviewThumb} alt="Foto capturada" className="flex-1 object-contain" />
          <div className="flex justify-center pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
            <span className="text-white/80 text-sm bg-white/15 rounded-full px-5 py-1.5">
              Registrado — avançando...
            </span>
          </div>
        </div>
      )}

      {/* Thumbnail da última captura — canto inferior esquerdo */}
      {lastThumb && phase !== 'interstitial' && phase !== 'finalizing' && phase !== 'reviewing' && (
        <div
          className="absolute z-20 rounded-lg overflow-hidden border-2 border-white/60 shadow-lg"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 20px)',
            left: 16,
            width: 56,
            height: 56,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lastThumb} alt="Última captura" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Lazy MediaPipe — não renderiza UI; expõe API via callback */}
      <IrisDetector
        onReady={(api) => {
          detectorRef.current = api
        }}
      />

      {/* Debug — remove em 03-08 */}
      <div className="absolute bottom-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-white/50">
        {phase} • {slotIndex + 1}/6 • {(score * 100).toFixed(0)}%
        {process.env.NODE_ENV !== 'production' && ` • ${readingId.slice(0, 8)}`}
      </div>
    </div>
  )
}
