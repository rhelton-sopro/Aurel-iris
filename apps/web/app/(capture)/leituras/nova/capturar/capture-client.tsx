'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { CameraView } from '@/components/capture/CameraView'
import { QualityIndicator } from '@/components/capture/QualityIndicator'
import { LiveFeedbackMessage } from '@/components/capture/LiveFeedbackMessage'
import { CaptureProgress } from '@/components/capture/CaptureProgress'
import { AngleOverlay } from '@/components/capture/AngleOverlay'
import { AngleInterstitial } from '@/components/capture/AngleInterstitial'
import { CapturePreview } from '@/components/capture/CapturePreview'
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
  getSlotProgressLabel,
} from '@/lib/capture/sequence'
import { compressFrameToJpeg } from '@/lib/capture/jpeg-compress'
import { uploadWithRetry } from '@/lib/capture/upload'
import { createClient } from '@/lib/supabase/client'
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
const PREVIEW_MS = 2000

interface PendingPreview {
  blob: Blob
  imageUrl: string
  qualityScore: number
  width: number
  height: number
  slotIndex: number
}

export function CaptureClient({
  readingId,
  therapistId,
  clientName,
  capturedSlots: initialCaptured,
  resumeMode: _resumeMode,
}: CaptureClientProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const analysisCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const detectorRef = React.useRef<UseIrisDetectorResult | null>(null)

  // Cliente Supabase browser (memoized)
  const supabase = React.useMemo(() => createClient(), [])

  const initialIndex = React.useMemo(() => {
    const idx = getResumeSlotIndex(initialCaptured)
    return idx === -1 ? SEQUENCE.length - 1 : idx
  }, [initialCaptured])

  const [slotIndex, setSlotIndex] = React.useState(initialIndex)
  const [phase, setPhase] = React.useState<SlotPhase>(() => {
    if (initialIndex >= 3 && initialCaptured.every(c => c.eye !== 'left')) return 'interstitial'
    return 'streaming'
  })
  const [capturedCount, setCapturedCount] = React.useState(initialCaptured.length)
  const [score, setScore] = React.useState(0)
  const [check, setCheck] = React.useState<QualityCheck | null>(null)
  const [pendingPreview, setPendingPreview] = React.useState<PendingPreview | null>(null)

  /**
   * AbortController por slot — permite cancelar upload anterior em tap-to-redo.
   * T-03-07-02: cada slot tem seu AbortController; novo upload aborta o anterior.
   */
  const slotAbortRefs = React.useRef<Map<number, AbortController>>(new Map())

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]

  // Loop de inferência por frame — apenas durante streaming
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (phase !== 'streaming') return

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
      handle = supportsRVFC && videoEx.requestVideoFrameCallback
        ? videoEx.requestVideoFrameCallback(tick)
        : requestAnimationFrame(tick)
    }
    const videoEx = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number) => void) => number
      cancelVideoFrameCallback?: (id: number) => void
    }
    handle = supportsRVFC && videoEx.requestVideoFrameCallback
      ? videoEx.requestVideoFrameCallback(tick)
      : requestAnimationFrame(tick)
    return () => {
      if (handle == null) return
      if (supportsRVFC && videoEx.cancelVideoFrameCallback) videoEx.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [phase, slot.eye])

  /**
   * Captura frame atual do <video>, comprime, mostra preview, sobe em background.
   * D-09: Upload NÃO bloqueia transição para próximo slot.
   * T-03-07-03: toast mostra apenas '{N}/6' — sem storage_path ou therapistId.
   */
  const captureCurrentFrame = React.useCallback(async () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    // 1. Comprimir frame
    let compressed
    try {
      compressed = await compressFrameToJpeg(video, video.videoWidth, video.videoHeight)
    } catch {
      console.error('[capture-client] compress error — eye:', slot.eye, 'angle:', slot.angle)
      toast.error('Falha ao processar imagem. Tente novamente.')
      return
    }

    const imageUrl = URL.createObjectURL(compressed.blob)
    const currentSlotIdx = slotIndex
    const currentScore = score

    // 2. Mostrar preview imediato — não bloqueia
    setPendingPreview({
      blob: compressed.blob,
      imageUrl,
      qualityScore: currentScore,
      width: compressed.width,
      height: compressed.height,
      slotIndex: currentSlotIdx,
    })
    setPhase('previewing')

    // 3. Cancelar upload anterior do MESMO slot (race em tap-to-redo — T-03-07-02)
    const previousAbort = slotAbortRefs.current.get(currentSlotIdx)
    if (previousAbort) previousAbort.abort()
    const ac = new AbortController()
    slotAbortRefs.current.set(currentSlotIdx, ac)

    // T-03-07-03: toast mostra apenas 'N/6' — sem paths ou IDs
    const toastId = toast.loading(`Salvando imagem ${currentSlotIdx + 1}/6...`)

    void uploadWithRetry({
      supabase,
      blob: compressed.blob,
      therapistId,
      readingId,
      eye: SEQUENCE[currentSlotIdx].eye,
      angle: SEQUENCE[currentSlotIdx].angle,
      qualityScore: currentScore,
      width: compressed.width,
      height: compressed.height,
      signal: ac.signal,
    })
      .then(() => {
        if (ac.signal.aborted) return
        toast.success('Imagem salva.', { id: toastId, duration: 2000 })
        slotAbortRefs.current.delete(currentSlotIdx)
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') {
          toast.dismiss(toastId)
          return
        }
        // T-03-07-03: log apenas eye/angle, sem storage_path
        console.error('[capture-client] upload error — eye:', SEQUENCE[currentSlotIdx].eye, 'angle:', SEQUENCE[currentSlotIdx].angle)
        // T-03-07-04: toast persistente com CTA para retry manual
        toast.error(`Falha ao salvar imagem ${currentSlotIdx + 1}/6. Toque para tentar novamente.`, {
          id: toastId,
          duration: Infinity,
        })
      })
  }, [slotIndex, score, supabase, therapistId, readingId, slot.eye, slot.angle])

  /**
   * Avança para o próximo slot — chamado após preview timeout (sem tap-to-redo).
   */
  const advanceToNextSlot = React.useCallback(() => {
    if (pendingPreview?.imageUrl) {
      URL.revokeObjectURL(pendingPreview.imageUrl)
    }
    setPendingPreview(null)
    setCapturedCount(c => c + 1)

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
  }, [slotIndex, pendingPreview])

  /**
   * Tap-to-redo durante preview: cancela upload do slot atual, libera URL,
   * volta para streaming sem incrementar capturedCount.
   * T-03-07-02: AbortController cancela upload obsoleto.
   */
  const redoCurrent = React.useCallback(() => {
    const previousAbort = slotAbortRefs.current.get(slotIndex)
    if (previousAbort) {
      previousAbort.abort()
      slotAbortRefs.current.delete(slotIndex)
    }
    if (pendingPreview?.imageUrl) {
      URL.revokeObjectURL(pendingPreview.imageUrl)
    }
    setPendingPreview(null)
    setPhase('streaming')
    captureGate.reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIndex, pendingPreview])

  // Auto-trigger real — gate dispara captureCurrentFrame
  const captureGate = useStableQualityGate(score, () => {
    if (phase !== 'streaming') return
    void captureCurrentFrame()
  })

  // Quando entra em 'overlay', auto-volta para 'streaming' após 2.5s
  React.useEffect(() => {
    if (phase !== 'overlay') return
    const id = window.setTimeout(() => {
      setPhase('streaming')
      captureGate.reset()
    }, 2500)
    return () => window.clearTimeout(id)
  // captureGate.reset é estável (useCallback no hook), ok no dep array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Reset gate ao entrar em fases não-streaming
  React.useEffect(() => {
    if (phase === 'interstitial' || phase === 'previewing' || phase === 'finalizing') {
      captureGate.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Cleanup em unmount: revoga URLs pendentes + aborta todos os uploads
  React.useEffect(() => {
    const abortMap = slotAbortRefs.current
    return () => {
      abortMap.forEach(ac => ac.abort())
      abortMap.clear()
    }
  }, [])

  const message = check ? feedbackMessage(dominantFailure(check)) : 'Aguarde — preparando câmera...'

  return (
    <div className="relative flex-1 flex flex-col">
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

      {phase === 'streaming' && (
        <>
          <div className="absolute left-0 right-0 z-20 pt-[calc(env(safe-area-inset-top)+44px)] flex flex-col items-center gap-3">
            <QualityIndicator score={score} />
            <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />
          </div>
          <div className="absolute left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-20 flex justify-center px-4">
            <LiveFeedbackMessage message={message} />
          </div>
        </>
      )}

      {phase === 'overlay' && (
        <>
          <div className="absolute left-0 right-0 z-20 pt-[calc(env(safe-area-inset-top)+44px)] flex flex-col items-center gap-3">
            <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />
          </div>
          <div className="absolute top-[calc(env(safe-area-inset-top)+120px)] left-1/2 -translate-x-1/2 z-25 max-w-[90%]">
            <AngleOverlay slot={slot} resetKey={`${slot.eye}_${slot.angle}`} />
          </div>
        </>
      )}

      {phase === 'previewing' && pendingPreview && (
        <CapturePreview
          imageUrl={pendingPreview.imageUrl}
          qualityScore={pendingPreview.qualityScore}
          onRedo={redoCurrent}
          onTimeout={advanceToNextSlot}
          durationMs={PREVIEW_MS}
        />
      )}

      {phase === 'interstitial' && (
        <AngleInterstitial
          nextSlot={slot}
          onProceed={() => {
            setPhase('streaming')
            captureGate.reset()
          }}
        />
      )}

      {phase === 'finalizing' && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 text-foreground">
          <h1 className="text-xl font-semibold">{getSlotProgressLabel(SEQUENCE.length - 1)} imagens registradas</h1>
          <p className="text-sm text-muted-foreground">Finalizando leitura...</p>
        </div>
      )}

      <IrisDetector
        onReady={(api) => { detectorRef.current = api }}
      />
    </div>
  )
}
