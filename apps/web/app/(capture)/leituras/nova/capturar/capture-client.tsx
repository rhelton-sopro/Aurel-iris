'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  EYE_LABEL,
  ANGLE_LABEL,
  type Slot,
  type SlotPhase,
  getResumeSlotIndex,
  isOuterEyeTransition,
} from '@/lib/capture/sequence'
import { getIrisCenter, getIrisRadius } from '@/lib/capture/iris-geometry'
import type { UseIrisDetectorResult } from '@/hooks/use-iris-detector'
import { createClient } from '@/lib/supabase/client'
import { saveReadingImagesAction } from '@/app/actions/readings'

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
/** Score mínimo para o botão ficar verde ("pronto para capturar") */
const CAPTURE_READY_SCORE = 0.65

function dataURLToBlob(dataURL: string): Blob {
  const [header, b64] = dataURL.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export function CaptureClient({
  readingId,
  therapistId,
  clientName,
  capturedSlots: initialCaptured,
  resumeMode: _resumeMode,
}: CaptureClientProps) {
  const router = useRouter()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const analysisCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const detectorRef = React.useRef<UseIrisDetectorResult | null>(null)
  const irisHoldRef = React.useRef<{ cx: number; cy: number; r: number; expiresAt: number } | null>(null)
  // Full-res captures para upload (não precisam de re-render)
  const captureDataURLs = React.useRef<({ url: string; width: number; height: number } | null)[]>(
    Array(SEQUENCE.length).fill(null)
  )

  const initialIndex = React.useMemo(() => {
    const idx = getResumeSlotIndex(initialCaptured)
    return idx === -1 ? SEQUENCE.length - 1 : idx
  }, [initialCaptured])

  const [slotIndex, setSlotIndex] = React.useState(initialIndex)
  const [phase, setPhase] = React.useState<SlotPhase>(() => {
    if (initialIndex >= 3 && initialCaptured.every(c => c.eye !== 'left')) {
      return 'interstitial'
    }
    return 'streaming'
  })
  const [capturedCount, setCapturedCount] = React.useState(initialCaptured.length)
  const [score, setScore] = React.useState(0)
  const [check, setCheck] = React.useState<QualityCheck | null>(null)
  const [irisPos, setIrisPos] = React.useState<{ cx: number; cy: number; r: number } | null>(null)

  // Thumbnails e scores dos 6 slots para a tela de revisão
  const [thumbs, setThumbs] = React.useState<(string | null)[]>(() => Array(SEQUENCE.length).fill(null))
  const [thumbScores, setThumbScores] = React.useState<number[]>(() => Array(SEQUENCE.length).fill(0))
  const [lastThumb, setLastThumb] = React.useState<string | null>(null)
  const [flashActive, setFlashActive] = React.useState(false)
  const [retakeMode, setRetakeMode] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]

  // Loop de inferência por frame — apenas durante streaming e overlay
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
          // Mantém posição 500ms após perder landmarks (câmera muito próxima)
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

  // Avança para o próximo slot
  const advanceToNextSlot = React.useCallback(() => {
    const next = slotIndex + 1
    if (next >= SEQUENCE.length) {
      setCapturedCount(c => c + 1)
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

  const advanceRef = React.useRef(advanceToNextSlot)
  React.useEffect(() => { advanceRef.current = advanceToNextSlot }, [advanceToNextSlot])

  // Captura manual — único modo de captura
  const handleCapture = React.useCallback(() => {
    if (phase !== 'streaming') return
    const thumb = analysisCanvasRef.current?.toDataURL('image/jpeg', 0.7) ?? null
    const capturedScore = score
    const capturedIdx = slotIndex

    if (thumb) {
      setThumbs(prev => { const n = [...prev]; n[capturedIdx] = thumb; return n })
      setLastThumb(thumb)
    }
    setThumbScores(prev => { const n = [...prev]; n[capturedIdx] = capturedScore; return n })

    // Captura full-res para upload (máx 1920px no lado maior)
    const vid = videoRef.current
    if (vid && vid.videoWidth > 0) {
      const maxDim = 1920
      const sc = Math.min(1, maxDim / Math.max(vid.videoWidth, vid.videoHeight))
      const fc = document.createElement('canvas')
      fc.width = Math.round(vid.videoWidth * sc)
      fc.height = Math.round(vid.videoHeight * sc)
      fc.getContext('2d')?.drawImage(vid, 0, 0, fc.width, fc.height)
      captureDataURLs.current[capturedIdx] = {
        url: fc.toDataURL('image/jpeg', 0.85),
        width: fc.width,
        height: fc.height,
      }
    }

    // Flash visual + haptic feedback
    setFlashActive(true)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100)
    window.setTimeout(() => setFlashActive(false), 300)

    if (retakeMode) {
      setRetakeMode(false)
      setPhase('finalizing')
    } else {
      advanceRef.current()
    }
  }, [phase, score, slotIndex, retakeMode])

  // Overlay entre ângulos: 2.5s depois volta para streaming
  React.useEffect(() => {
    if (phase !== 'overlay') return
    const id = window.setTimeout(() => setPhase('streaming'), 2500)
    return () => window.clearTimeout(id)
  }, [phase])

  // Retake: volta para o slot N em modo retake
  const handleRetake = React.useCallback((idx: number) => {
    setSlotIndex(idx)
    setRetakeMode(true)
    setPhase('streaming')
  }, [])

  // Upload das 6 fotos e persistência no banco
  const handleConfirm = React.useCallback(async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const supabase = createClient()
      const imageRows: { eye: string; angle: string; storagePath: string; qualityScore: number; width: number; height: number }[] = []

      for (let i = 0; i < SEQUENCE.length; i++) {
        const cap = captureDataURLs.current[i]
        if (!cap) continue
        const s = SEQUENCE[i]
        const storagePath = `${therapistId}/${readingId}/${s.eye}_${s.angle}.jpg`
        const blob = dataURLToBlob(cap.url)
        const { error } = await supabase.storage
          .from('iris-captures')
          .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true })
        if (error) { setSubmitError(error.message); setSubmitting(false); return }
        imageRows.push({ eye: s.eye, angle: s.angle, storagePath, qualityScore: thumbScores[i], width: cap.width, height: cap.height })
      }

      const result = await saveReadingImagesAction(readingId, imageRows)
      if (result.error) { setSubmitError(result.error); setSubmitting(false); return }
      router.push('/leituras')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Erro inesperado')
      setSubmitting(false)
    }
  }, [readingId, therapistId, thumbScores])

  const message = check ? feedbackMessage(dominantFailure(check)) : 'Aguarde — preparando câmera...'
  const captureReady = score >= CAPTURE_READY_SCORE

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

      {/* Iris guide — cor alinhada ao CAPTURE_READY_SCORE */}
      {phase !== 'interstitial' && phase !== 'finalizing' && (
        irisPos != null ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-full border-2 transition-colors duration-300 ${
              score < 0.40
                ? 'border-red-500'
                : score < CAPTURE_READY_SCORE
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

      {/* QualityIndicator + CaptureProgress no topo */}
      {phase !== 'interstitial' && phase !== 'finalizing' && (
        <div className="absolute left-0 right-0 z-20 pt-[calc(env(safe-area-inset-top)+44px)] flex flex-col items-center gap-3">
          <QualityIndicator score={score} />
          <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />
        </div>
      )}

      {/* AngleOverlay entre ângulos do mesmo olho */}
      {phase === 'overlay' && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+120px)] left-1/2 -translate-x-1/2 z-25 max-w-[90%]">
          <AngleOverlay slot={slot} resetKey={`${slot.eye}_${slot.angle}`} />
        </div>
      )}

      {/* LiveFeedbackMessage — sempre visível durante streaming */}
      {phase === 'streaming' && (
        <div className="absolute left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+128px)] z-20 flex justify-center px-4">
          <LiveFeedbackMessage message={message} />
        </div>
      )}

      {/* Botão de captura manual — verde pulsando quando pronto */}
      {phase === 'streaming' && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        >
          <button
            type="button"
            onClick={handleCapture}
            aria-label="Capturar foto"
            className={`rounded-full border-4 w-20 h-20 flex items-center justify-center text-white text-xs font-semibold text-center leading-tight transition-colors duration-300 ${
              captureReady
                ? 'bg-emerald-500/90 border-white shadow-lg shadow-emerald-500/40 animate-pulse'
                : 'bg-white/20 border-white/50'
            }`}
          >
            {captureReady ? 'Pronto!' : 'Capturar'}
          </button>
        </div>
      )}

      {/* Flash de captura — 300ms */}
      {flashActive && (
        <div className="pointer-events-none absolute inset-0 z-40 bg-white/70" />
      )}

      {/* Thumbnail da última captura — canto inferior esquerdo */}
      {lastThumb && phase !== 'interstitial' && phase !== 'finalizing' && (
        <div
          className="absolute z-20 rounded-lg overflow-hidden border-2 border-white/60 shadow-lg"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
            left: 16,
            width: 56,
            height: 56,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lastThumb} alt="Última captura" className="w-full h-full object-cover" />
        </div>
      )}

      {/* AngleInterstitial fullscreen — transição entre olhos */}
      {phase === 'interstitial' && (
        <AngleInterstitial
          nextSlot={slot}
          onProceed={() => setPhase('streaming')}
        />
      )}

      {/* Revisão pós-captura: grid 2×3 das 6 fotos com scores */}
      {phase === 'finalizing' && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col text-foreground">
          <header className="px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 border-b">
            <h1 className="text-lg font-semibold">
              {retakeMode ? 'Refazendo foto' : 'Revisar capturas'}
            </h1>
          </header>

          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              {SEQUENCE.map((s, idx) => {
                const thumb = thumbs[idx]
                const sc = thumbScores[idx]
                const isRuim = sc < 0.40
                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={`${EYE_LABEL[s.eye]} ${ANGLE_LABEL[s.angle]}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                      )}
                      <span className={`absolute top-1.5 right-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isRuim ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                      }`}>
                        {Math.round(sc * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-xs text-muted-foreground capitalize">
                        {EYE_LABEL[s.eye]} · {ANGLE_LABEL[s.angle]}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRetake(idx)}
                        className="text-xs font-medium text-primary"
                      >
                        Refazer
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] border-t space-y-2">
            {thumbScores.some(sc => sc < 0.40) && (
              <p className="text-xs text-center text-destructive">
                {thumbScores.filter(sc => sc < 0.40).length} foto(s) com qualidade ruim — considere refazer
              </p>
            )}
            {submitError && (
              <p className="text-xs text-center text-destructive">{submitError}</p>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-60"
            >
              {submitting ? 'Enviando...' : 'Confirmar e enviar'}
            </button>
          </div>
        </div>
      )}

      {/* Lazy MediaPipe */}
      <IrisDetector
        onReady={(api) => {
          detectorRef.current = api
        }}
      />

      {/* Debug — remove em 03-08 */}
      <div className="absolute bottom-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-white/50">
        {phase}{retakeMode ? '(retake)' : ''} • {slotIndex + 1}/6 • {(score * 100).toFixed(0)}%
        {process.env.NODE_ENV !== 'production' && ` • ${readingId.slice(0, 8)}`}
      </div>
    </div>
  )
}
