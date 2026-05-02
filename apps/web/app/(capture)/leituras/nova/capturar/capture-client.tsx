'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { finalizeReadingAction } from '@/app/actions/readings'
import { AngleInterstitial, type InterstitialVariant } from '@/components/capture/AngleInterstitial'
import { CapturePreview } from '@/components/capture/CapturePreview'
import { CaptureProgress } from '@/components/capture/CaptureProgress'
import { compressFrameToJpeg } from '@/lib/capture/jpeg-compress'
import { cropBitmapAroundIris } from '@/lib/capture/iris-crop'
import { laplacianVariance, sharpnessScore } from '@/lib/capture/laplacian-variance'
import { analyzeCapturedJpeg, type PostCaptureAnalysis } from '@/lib/capture/post-capture-analysis'
import { uploadWithRetry } from '@/lib/capture/upload'
import { createClient } from '@/lib/supabase/client'
import { getIrisCenterPx, getIrisRadiusPx } from '@/lib/capture/iris-geometry'
import {
  SEQUENCE,
  getResumeSlotIndex,
  getSlotProgressLabel,
  type Slot,
} from '@/lib/capture/sequence'
import type { UseIrisDetectorResult } from '@/hooks/use-iris-detector'

const IrisDetector = dynamic(() => import('@/components/capture/IrisDetector'), {
  ssr: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ANALYSIS_DIM = 256
/** Razão alvo iris/min(W,H) que vale score 1.0 no termo de distância. */
const TARGET_IRIS_FRACTION = 0.20

interface OneShotResult {
  irisCenter: { x: number; y: number } | null
  irisRadius: number
  score: number
  irisFraction: number
  sharpness: number
}

/**
 * Roda detecção MediaPipe + Laplacian no bitmap recém-capturado e devolve um
 * score 0..1 que mistura "íris detectada e bem dimensionada" com "imagem nítida".
 *
 * Substitui o score acumulado do streaming (que não existe no fluxo de input
 * nativo). Fica disponível ao caller para alimentar pendingPreview.qualityScore
 * e ser exibido no badge da CapturePreview.
 */
function analyzeOneShot(
  bitmap: ImageBitmap,
  detector: UseIrisDetectorResult | null,
  eye: 'left' | 'right',
): OneShotResult {
  let irisCenter: { x: number; y: number } | null = null
  let irisRadius = 0
  if (detector?.ready) {
    const result = detector.detect(bitmap)
    const landmarks = result?.faceLandmarks?.[0] ?? null
    if (landmarks) {
      irisCenter = getIrisCenterPx(landmarks, eye, bitmap.width, bitmap.height)
      irisRadius = getIrisRadiusPx(landmarks, eye, bitmap.width, bitmap.height)
    }
  }

  // Sharpness: Laplacian num square 256×256 do centro do bitmap.
  let sharpness = 0
  const minDim = Math.min(bitmap.width, bitmap.height)
  if (minDim > 0) {
    const sx = (bitmap.width - minDim) / 2
    const sy = (bitmap.height - minDim) / 2
    const canvas = document.createElement('canvas')
    canvas.width = ANALYSIS_DIM
    canvas.height = ANALYSIS_DIM
    const ctx = canvas.getContext('2d', { alpha: false })
    if (ctx) {
      ctx.drawImage(bitmap, sx, sy, minDim, minDim, 0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
      const data = ctx.getImageData(0, 0, ANALYSIS_DIM, ANALYSIS_DIM)
      sharpness = sharpnessScore(laplacianVariance(data))
    }
  }

  const irisFraction = irisRadius > 0 && minDim > 0 ? irisRadius / minDim : 0
  const distanceComponent = Math.min(1, irisFraction / TARGET_IRIS_FRACTION)

  // Sem íris detectada: score baseado só em sharpness, com piso baixo.
  // Com íris: 60% distância + 40% nitidez.
  const score = irisCenter
    ? 0.60 * distanceComponent + 0.40 * sharpness
    : Math.max(0.20, sharpness * 0.5)

  return { irisCenter, irisRadius, score, irisFraction, sharpness }
}

function bitmapToFullCanvas(bitmap: ImageBitmap): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  return canvas
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'

interface CapturedSlot { eye: string; angle: string }

interface CaptureClientProps {
  readingId: string
  therapistId: string
  clientName: string
  capturedSlots: CapturedSlot[]
  resumeMode: boolean
}

interface PendingPreview {
  /** Blob do recortado, comprimido — usado pra preview e upload */
  croppedBlob: Blob
  /** Object URL do recortado para a tag <img> */
  imageUrl: string
  qualityScore: number
  croppedWidth: number
  croppedHeight: number
  slotIndex: number
  analysis: PostCaptureAnalysis | null
  /** Foto original (full frame) — sobe em paralelo ao recortado */
  originalBlob: Blob | null
  /** Raio da íris no JPEG recortado (passado pra analyzeCapturedJpeg) */
  irisRadiusInJpeg: number
}

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
  const supabase = React.useMemo(() => createClient(), [])
  const router = useRouter()

  const initialIndex = React.useMemo(() => {
    const idx = getResumeSlotIndex(initialCaptured)
    return idx === -1 ? SEQUENCE.length - 1 : idx
  }, [initialCaptured])

  const [slotIndex, setSlotIndex] = React.useState(initialIndex)
  const [phase, setPhase] = React.useState<Phase>('instruction')
  const [capturedCount, setCapturedCount] = React.useState(initialCaptured.length)
  const [pendingPreview, setPendingPreview] = React.useState<PendingPreview | null>(null)

  const detectorRef = React.useRef<UseIrisDetectorResult | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const slotAbortRefs = React.useRef<Map<number, AbortController>>(new Map())
  const uploadPromisesRef = React.useRef<Map<number, Promise<unknown>>>(new Map())
  const finalizingTriggeredRef = React.useRef(false)

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]

  const interstitialVariant: InterstitialVariant =
    capturedCount === 0 && slotIndex === 0
      ? 'first'
      : slotIndex === 3
        ? 'eye-transition'
        : 'mid-slot'

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const openCamera = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setPhase('analyzing')

    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createImageBitmap(file)
      const oneShot = analyzeOneShot(bitmap, detectorRef.current, slot.eye)

      // Crop centrado na íris quando detectada; senão usa frame inteiro.
      let cropCanvas: HTMLCanvasElement | null = null
      let irisRadiusInCrop = oneShot.irisRadius
      if (oneShot.irisCenter && oneShot.irisRadius > 0) {
        const cropResult = cropBitmapAroundIris(bitmap, oneShot.irisCenter, oneShot.irisRadius)
        if (cropResult) {
          cropCanvas = cropResult.canvas
          irisRadiusInCrop = cropResult.irisRadiusInCrop
        }
      }
      if (!cropCanvas) {
        cropCanvas = bitmapToFullCanvas(bitmap)
        irisRadiusInCrop = 0
      }
      if (!cropCanvas) {
        throw new Error('Falha ao montar canvas do crop')
      }

      const compressed = await compressFrameToJpeg(cropCanvas, cropCanvas.width, cropCanvas.height)
      const compressionScale = cropCanvas.width > 0
        ? compressed.width / cropCanvas.width
        : 1
      const irisRadiusInJpeg = irisRadiusInCrop * compressionScale

      const imageUrl = URL.createObjectURL(compressed.blob)
      const currentSlotIdx = slotIndex

      setPendingPreview({
        croppedBlob: compressed.blob,
        imageUrl,
        qualityScore: oneShot.score,
        croppedWidth: compressed.width,
        croppedHeight: compressed.height,
        slotIndex: currentSlotIdx,
        analysis: null,
        originalBlob: file,
        irisRadiusInJpeg,
      })
      setPhase('previewing')

      // Análise pós-captura (Laplacian + irisRatio). streamingScore=0 garante
      // que o caminho de bypass não é ativado — overlay aparece quando há alerta.
      void analyzeCapturedJpeg(
        compressed.blob,
        irisRadiusInJpeg,
        compressed.width,
        compressed.height,
        0,
      )
        .then((analysis) => {
          setPendingPreview(prev =>
            prev && prev.slotIndex === currentSlotIdx ? { ...prev, analysis } : prev,
          )
        })
        .catch(() => { /* best-effort */ })
    } catch (err) {
      console.error('[capture-client] file process error:', err)
      toast.error('Falha ao processar imagem. Tente novamente.')
      setPhase('instruction')
    } finally {
      bitmap?.close()
    }
  }, [slot.eye, slotIndex])

  const handleConfirm = React.useCallback(() => {
    const preview = pendingPreview
    if (!preview) return
    const currentSlotIdx = preview.slotIndex

    // Upload em background — recortado (sempre) + original (quando disponível).
    const previousAbort = slotAbortRefs.current.get(currentSlotIdx)
    if (previousAbort) previousAbort.abort()
    const ac = new AbortController()
    slotAbortRefs.current.set(currentSlotIdx, ac)

    const toastId = toast.loading(`Salvando imagem ${currentSlotIdx + 1}/6...`)

    const uploadP = uploadWithRetry({
      supabase,
      croppedBlob: preview.croppedBlob,
      croppedWidth: preview.croppedWidth,
      croppedHeight: preview.croppedHeight,
      originalBlob: preview.originalBlob ?? undefined,
      therapistId,
      readingId,
      eye: SEQUENCE[currentSlotIdx].eye,
      angle: SEQUENCE[currentSlotIdx].angle,
      qualityScore: preview.qualityScore,
      signal: ac.signal,
    })
    uploadPromisesRef.current.set(currentSlotIdx, uploadP)
    void uploadP
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
        toast.error(`Falha ao salvar imagem ${currentSlotIdx + 1}/6. Tente refazer.`, {
          id: toastId,
          duration: Infinity,
        })
      })

    // Avança o slot.
    URL.revokeObjectURL(preview.imageUrl)
    setPendingPreview(null)
    setCapturedCount(c => c + 1)

    const next = slotIndex + 1
    if (next >= SEQUENCE.length) {
      setPhase('finalizing')
    } else {
      setSlotIndex(next)
      setPhase('instruction')
    }
  }, [pendingPreview, slotIndex, supabase, therapistId, readingId])

  const handleRedo = React.useCallback(() => {
    if (pendingPreview?.imageUrl) URL.revokeObjectURL(pendingPreview.imageUrl)
    const previousAbort = slotAbortRefs.current.get(slotIndex)
    if (previousAbort) {
      previousAbort.abort()
      slotAbortRefs.current.delete(slotIndex)
    }
    setPendingPreview(null)
    setPhase('instruction')
    // Reabre câmera nativa imediatamente — pula a interstitial pra UX fluida.
    window.setTimeout(() => fileInputRef.current?.click(), 50)
  }, [pendingPreview, slotIndex])

  // Quando entra em 'finalizing': aguarda uploads pendentes, chama
  // finalizeReadingAction e redireciona pra /leituras.
  React.useEffect(() => {
    if (phase !== 'finalizing') return
    if (finalizingTriggeredRef.current) return
    finalizingTriggeredRef.current = true

    const run = async () => {
      const pending = Array.from(uploadPromisesRef.current.values())
      if (pending.length > 0) await Promise.allSettled(pending)
      const result = await finalizeReadingAction(readingId)
      if (result.error) {
        toast.error(`Falha ao finalizar leitura: ${result.error}`)
        finalizingTriggeredRef.current = false
        return
      }
      toast.success('Leitura registrada.')
      router.push('/leituras')
    }
    void run()
  }, [phase, readingId, router])

  React.useEffect(() => {
    const abortMap = slotAbortRefs.current
    return () => {
      abortMap.forEach(ac => ac.abort())
      abortMap.clear()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative flex-1 flex flex-col bg-background">
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 pt-[env(safe-area-inset-top)]">
        <span className="text-sm text-foreground/80 truncate max-w-[60%]">{clientName}</span>
        <Link
          href="/leituras"
          aria-label="Cancelar leitura"
          className="rounded-full bg-muted p-2 text-foreground"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      {phase === 'instruction' && (
        <>
          <div className="absolute left-0 right-0 top-[calc(env(safe-area-inset-top)+44px)] z-40 flex justify-center">
            <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />
          </div>
          <AngleInterstitial
            nextSlot={slot}
            slotIndex={slotIndex}
            variant={interstitialVariant}
            onProceed={openCamera}
          />
        </>
      )}

      {phase === 'analyzing' && (
        <div className="absolute inset-0 z-40 bg-background flex flex-col items-center justify-center gap-4 text-foreground">
          <div
            aria-hidden="true"
            className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary motion-safe:animate-spin"
          />
          <p className="text-sm text-muted-foreground">Analisando captura...</p>
        </div>
      )}

      {phase === 'previewing' && pendingPreview && (
        <CapturePreview
          imageUrl={pendingPreview.imageUrl}
          qualityScore={pendingPreview.qualityScore}
          analysis={pendingPreview.analysis}
          onRedo={handleRedo}
          onConfirm={handleConfirm}
        />
      )}

      {phase === 'finalizing' && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 text-foreground">
          <h1 className="text-xl font-semibold">{getSlotProgressLabel(SEQUENCE.length - 1)} imagens registradas</h1>
          <p className="text-sm text-muted-foreground">Finalizando leitura...</p>
        </div>
      )}

      {/* Hidden input — acionado por openCamera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
      />

      <IrisDetector onReady={(api) => { detectorRef.current = api }} />
    </div>
  )
}
