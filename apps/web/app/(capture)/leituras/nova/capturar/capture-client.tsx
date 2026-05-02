'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { CameraView } from '@/components/capture/CameraView'
import { QualityIndicator } from '@/components/capture/QualityIndicator'
import { CaptureProgress } from '@/components/capture/CaptureProgress'
import { AngleOverlay } from '@/components/capture/AngleOverlay'
import { AngleInterstitial } from '@/components/capture/AngleInterstitial'
import { CapturePreview } from '@/components/capture/CapturePreview'
import { GuideCircle } from '@/components/capture/GuideCircle'
import { EyeAngleLabel } from '@/components/capture/EyeAngleLabel'
import {
  computeQualityCheck,
  overallScore,
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
import { getIrisRadiusPx } from '@/lib/capture/iris-geometry'
import { getExposureDirection } from '@/lib/capture/exposure'
import { compressFrameToJpeg } from '@/lib/capture/jpeg-compress'
import { analyzeCapturedJpeg, type PostCaptureAnalysis } from '@/lib/capture/post-capture-analysis'
import { uploadWithRetry } from '@/lib/capture/upload'
import { createClient } from '@/lib/supabase/client'
import type { UseIrisDetectorResult } from '@/hooks/use-iris-detector'
import { useStableQualityGate } from '@/hooks/use-quality-score'

const IrisDetector = dynamic(() => import('@/components/capture/IrisDetector'), {
  ssr: false,
})

// ---------------------------------------------------------------------------
// Critérios de bloqueio (avaliados em ordem de prioridade)
// ---------------------------------------------------------------------------

/**
 * Círculo guia desenhado em 60vmin de diâmetro → raio = 30vmin = 30% do
 * min(viewportW, viewportH). Sob `object-cover`, o min do viewport mapeia 1:1
 * para o min(videoW, videoH), então o raio do guia em pixels do vídeo é
 * `min(videoW, videoH) * 0.30`.
 */
const GUIDE_RADIUS_FRAC_OF_MIN_DIM = 0.30

/** Íris deve preencher pelo menos 40% do raio do círculo guia. */
const MIN_IRIS_FILL_FACTOR = 0.40

/** Score de nitidez mínimo (sharpnessScore = variance/80; 0.15 ≈ variance 12 = claramente borrado). */
const SHARPNESS_BLOCK_THRESHOLD = 0.15

type BlockingReason = 'distance' | 'exposure' | 'sharpness' | null

function computeBlockingReason(
  check: QualityCheck | null,
  irisFillRatio: number,
  exposureDir: 'low' | 'high' | 'ok',
): BlockingReason {
  if (!check || !check.irisDetected || irisFillRatio < MIN_IRIS_FILL_FACTOR) return 'distance'
  if (exposureDir === 'low') return 'exposure'
  if (check.sharpness < SHARPNESS_BLOCK_THRESHOLD) return 'sharpness'
  return null
}

const BLOCKING_LABEL: Record<NonNullable<BlockingReason>, string> = {
  distance: 'Aproxime mais — cubra pelo menos 40% do guia',
  exposure: 'Ambiente muito escuro — procure mais luz',
  sharpness: 'Imagem borrada — segure firme o celular',
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface CapturedSlot { eye: string; angle: string }

interface CaptureClientProps {
  readingId: string
  therapistId: string
  clientName: string
  capturedSlots: CapturedSlot[]
  resumeMode: boolean
}

interface PendingPreview {
  blob: Blob
  imageUrl: string
  qualityScore: number
  width: number
  height: number
  slotIndex: number
  /** null enquanto a análise pós-captura ainda não retornou */
  analysis: PostCaptureAnalysis | null
}

const ANALYSIS_W = 256
const ANALYSIS_H = 256
const PREVIEW_MS = 2000

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

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

  // Critérios de bloqueio
  const [irisFillRatio, setIrisFillRatio] = React.useState(0)
  const [exposureDir, setExposureDir] = React.useState<'low' | 'high' | 'ok'>('ok')

  // Mantém o raio da íris em px do frame original (usado pela análise pós-captura)
  const lastIrisRadiusPxRef = React.useRef(0)

  const slotAbortRefs = React.useRef<Map<number, AbortController>>(new Map())

  // Ref síncrono para blockingReason — evita closure stale no captureGate callback
  const blockingRef = React.useRef<BlockingReason>('distance')

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]

  // ---------------------------------------------------------------------------
  // Loop de inferência por frame
  // ---------------------------------------------------------------------------
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

          // Raio da íris em pixels reais do frame; comparado contra o raio do
          // círculo guia projetado em pixels do vídeo (sob object-cover).
          const videoW = video.videoWidth
          const videoH = video.videoHeight
          const irisRadiusPx = landmarks && c.irisDetected
            ? getIrisRadiusPx(landmarks, slot.eye, videoW, videoH)
            : 0
          lastIrisRadiusPxRef.current = irisRadiusPx
          const guideRadiusPx = Math.min(videoW, videoH) * GUIDE_RADIUS_FRAC_OF_MIN_DIM
          const ratio = guideRadiusPx > 0 ? irisRadiusPx / guideRadiusPx : 0
          setIrisFillRatio(ratio)

          // Direção da exposição para critério de iluminação
          setExposureDir(getExposureDirection(imageData))
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

  // Blocking reason derivado — mantém ref síncrono atualizado
  const blockingReason = React.useMemo(
    () => computeBlockingReason(check, irisFillRatio, exposureDir),
    [check, irisFillRatio, exposureDir],
  )
  React.useEffect(() => { blockingRef.current = blockingReason }, [blockingReason])

  // ---------------------------------------------------------------------------
  // Captura
  // ---------------------------------------------------------------------------
  const captureCurrentFrame = React.useCallback(async () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

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
    const irisRadiusPxAtCapture = lastIrisRadiusPxRef.current
    const videoW = video.videoWidth

    setPendingPreview({
      blob: compressed.blob,
      imageUrl,
      qualityScore: currentScore,
      width: compressed.width,
      height: compressed.height,
      slotIndex: currentSlotIdx,
      analysis: null,
    })
    setPhase('previewing')

    // Análise pós-captura (best-effort, em paralelo com upload).
    // Quando hasAlert=true, CapturePreview suspende auto-timeout e mostra
    // botões "Refazer" / "Continuar assim".
    void analyzeCapturedJpeg(
      compressed.blob,
      irisRadiusPxAtCapture,
      compressed.width,
      compressed.height,
      videoW,
    )
      .then((analysis) => {
        setPendingPreview(prev =>
          prev && prev.slotIndex === currentSlotIdx
            ? { ...prev, analysis }
            : prev,
        )
      })
      .catch(() => {
        // Análise é best-effort; falha não atrapalha o fluxo
      })

    const previousAbort = slotAbortRefs.current.get(currentSlotIdx)
    if (previousAbort) previousAbort.abort()
    const ac = new AbortController()
    slotAbortRefs.current.set(currentSlotIdx, ac)

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
        console.error('[capture-client] upload error — eye:', SEQUENCE[currentSlotIdx].eye, 'angle:', SEQUENCE[currentSlotIdx].angle)
        toast.error(`Falha ao salvar imagem ${currentSlotIdx + 1}/6. Toque para tentar novamente.`, {
          id: toastId,
          duration: Infinity,
        })
      })
  }, [slotIndex, score, supabase, therapistId, readingId, slot.eye, slot.angle])

  const advanceToNextSlot = React.useCallback(() => {
    if (pendingPreview?.imageUrl) URL.revokeObjectURL(pendingPreview.imageUrl)
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

  const redoCurrent = React.useCallback(() => {
    const previousAbort = slotAbortRefs.current.get(slotIndex)
    if (previousAbort) {
      previousAbort.abort()
      slotAbortRefs.current.delete(slotIndex)
    }
    if (pendingPreview?.imageUrl) URL.revokeObjectURL(pendingPreview.imageUrl)
    setPendingPreview(null)
    setPhase('streaming')
    captureGate.reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIndex, pendingPreview])

  // Auto-trigger — verifica critérios de bloqueio antes de disparar
  const captureGate = useStableQualityGate(score, () => {
    if (phase !== 'streaming') return
    if (blockingRef.current !== null) return
    void captureCurrentFrame()
  })

  React.useEffect(() => {
    if (phase !== 'overlay') return
    const id = window.setTimeout(() => {
      setPhase('streaming')
      captureGate.reset()
    }, 2500)
    return () => window.clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  React.useEffect(() => {
    if (phase === 'interstitial' || phase === 'previewing' || phase === 'finalizing') {
      captureGate.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  React.useEffect(() => {
    const abortMap = slotAbortRefs.current
    return () => {
      abortMap.forEach(ac => ac.abort())
      abortMap.clear()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Botão de captura
  // ---------------------------------------------------------------------------
  const buttonLabel = blockingReason !== null
    ? BLOCKING_LABEL[blockingReason]
    : `Pronto · ${Math.round(score * 100)}%`

  const handleManualCapture = React.useCallback(() => {
    if (phase !== 'streaming' || blockingRef.current !== null) return
    void captureCurrentFrame()
  }, [phase, captureCurrentFrame])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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

      {/* Círculo guia grande — sempre visível durante streaming */}
      {phase === 'streaming' && <GuideCircle score={score} />}

      {phase === 'streaming' && (
        <>
          {/* Chip persistente eye/angle + QualityIndicator + progress */}
          <div className="absolute left-0 right-0 z-20 pt-[calc(env(safe-area-inset-top)+44px)] flex flex-col items-center gap-3">
            <EyeAngleLabel slot={slot} currentIndex={slotIndex} />
            <QualityIndicator score={score} />
            <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />
          </div>

          {/* Botão de captura — desabilitado quando critérios não satisfeitos */}
          <div className="absolute left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-20 flex justify-center px-6">
            <button
              type="button"
              onClick={handleManualCapture}
              disabled={blockingReason !== null}
              aria-label={blockingReason !== null ? buttonLabel : 'Capturar foto'}
              className={[
                'w-full max-w-xs rounded-full py-3 px-5 text-sm font-medium text-center transition-all duration-200',
                blockingReason !== null
                  ? 'bg-black/50 text-white/55 backdrop-blur-sm cursor-not-allowed'
                  : 'bg-white text-black shadow-lg active:scale-95',
              ].join(' ')}
            >
              {buttonLabel}
            </button>
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
          analysis={pendingPreview.analysis}
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
