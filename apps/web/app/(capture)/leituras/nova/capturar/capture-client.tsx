'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { finalizeReadingAction } from '@/app/actions/readings'
import { AngleInterstitial } from '@/components/capture/AngleInterstitial'
import { CapturePreview } from '@/components/capture/CapturePreview'
import { CaptureProgress } from '@/components/capture/CaptureProgress'
import {
  analyzeCapturedJpeg,
  type PostCaptureAnalysis,
} from '@/lib/capture/post-capture-analysis'
import { uploadWithRetry } from '@/lib/capture/upload'
import { createClient } from '@/lib/supabase/client'
import {
  SEQUENCE,
  getResumeSlotIndex,
  getSlotProgressLabel,
  type Slot,
} from '@/lib/capture/sequence'

// ---------------------------------------------------------------------------
// Score do badge derivado APENAS do irisRadiusPx (já escalado pra px reais
// pelo analyzeCapturedJpeg). Sharpness aparece via alerta da análise.
// ---------------------------------------------------------------------------

const IRIS_EXCELLENT_PX = 600
const IRIS_ACCEPTABLE_PX = 300
/**
 * Score quando a pupila não foi detectada. Neutro (50%) — sinaliza problema
 * de enquadramento via overlay sem rebaixar a percepção do usuário injustamente.
 */
const NO_IRIS_FALLBACK_SCORE = 0.50

function irisSizeScore(irisRadiusPx: number): number {
  if (irisRadiusPx <= 0) return NO_IRIS_FALLBACK_SCORE
  if (irisRadiusPx >= IRIS_EXCELLENT_PX) return 1.0
  if (irisRadiusPx >= IRIS_ACCEPTABLE_PX) {
    return 0.5 + 0.5 * ((irisRadiusPx - IRIS_ACCEPTABLE_PX) / (IRIS_EXCELLENT_PX - IRIS_ACCEPTABLE_PX))
  }
  return 0.5 * (irisRadiusPx / IRIS_ACCEPTABLE_PX)
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
  /** JPEG ORIGINAL da câmera nativa, sem recompressão. Usado pra preview e upload. */
  blob: Blob
  imageUrl: string
  qualityScore: number
  /** Dimensões reais do JPEG original. */
  width: number
  height: number
  slotIndex: number
  analysis: PostCaptureAnalysis
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

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const slotAbortRefs = React.useRef<Map<number, AbortController>>(new Map())
  const uploadPromisesRef = React.useRef<Map<number, Promise<unknown>>>(new Map())
  const finalizingTriggeredRef = React.useRef(false)

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]

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

    const imageUrl = URL.createObjectURL(file)
    try {
      // Análise faz tudo: decode + pupil detection + Laplacian + dims reais.
      // O irisRadiusPx vem ESCALADO pra px reais (sem necessidade de detecção
      // adicional aqui no client).
      const analysis = await analyzeCapturedJpeg(file)
      const score = irisSizeScore(analysis.irisRadiusPx)
      const currentSlotIdx = slotIndex

      setPendingPreview({
        blob: file,
        imageUrl,
        qualityScore: score,
        width: analysis.imageWidth,
        height: analysis.imageHeight,
        slotIndex: currentSlotIdx,
        analysis,
      })
      setPhase('previewing')
    } catch (err) {
      console.error('[capture-client] analyze error:', err)
      URL.revokeObjectURL(imageUrl)
      toast.error('Falha ao processar imagem. Tente novamente.')
      setPhase('instruction')
    }
  }, [slotIndex])

  const handleConfirm = React.useCallback(() => {
    const preview = pendingPreview
    if (!preview) return
    const currentSlotIdx = preview.slotIndex

    const previousAbort = slotAbortRefs.current.get(currentSlotIdx)
    if (previousAbort) previousAbort.abort()
    const ac = new AbortController()
    slotAbortRefs.current.set(currentSlotIdx, ac)

    const toastId = toast.loading(`Salvando imagem ${currentSlotIdx + 1}/6...`)

    const uploadP = uploadWithRetry({
      supabase,
      blob: preview.blob,
      width: preview.width,
      height: preview.height,
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
    window.setTimeout(() => fileInputRef.current?.click(), 50)
  }, [pendingPreview, slotIndex])

  React.useEffect(() => {
    if (phase !== 'finalizing') return
    if (finalizingTriggeredRef.current) return
    finalizingTriggeredRef.current = true

    const run = async () => {
      // Aguarda TODOS os uploads completarem (storage + INSERT em reading_images
      // já estão dentro do uploadCaptureImage). Só depois chama finalize +
      // navega — garante que /leituras vai ler a nova leitura no SELECT.
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
      // router.refresh() invalida o RSC cache do client; sem isso uma navegação
      // soft pode renderizar /leituras com a lista pré-captura.
      router.refresh()
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
      {/* Tip de iluminação fixa em TODAS as telas de captura. */}
      <div
        role="note"
        className="absolute top-0 left-0 right-0 z-[60] pt-[env(safe-area-inset-top)] bg-amber-500/95 backdrop-blur-sm border-b border-amber-700/30"
      >
        <p className="px-4 py-1.5 text-xs font-medium text-amber-950 text-center">
          Mantenha a luz de frente ou lateral — nunca atrás do paciente
        </p>
      </div>

      <header className="absolute top-[calc(env(safe-area-inset-top)+30px)] left-0 right-0 z-[55] flex items-center justify-between px-4 py-2">
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
          <div className="absolute left-0 right-0 top-[calc(env(safe-area-inset-top)+88px)] z-[58] flex justify-center">
            <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />
          </div>
          <AngleInterstitial
            nextSlot={slot}
            slotIndex={slotIndex}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}
