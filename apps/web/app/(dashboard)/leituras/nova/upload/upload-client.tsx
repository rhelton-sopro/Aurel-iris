'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { finalizeReadingAction } from '@/app/actions/readings'
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
import type { QualityLevel } from '@/lib/capture/quality-scoring'
// Phase 4 -- novos imports
import { UploadDropzone } from '@/components/upload/UploadDropzone'
import { validateUploadFile } from '@/lib/upload/validate-file'
import { convertHeicToJpeg } from '@/lib/upload/heic-to-jpeg'

// ---------------------------------------------------------------------------
// Score do badge derivado da quality classificada pelo VLM (Fase 3 D-09).
// Mapeamento identico ao capture-client -- VLM gate reusado verbatim.
// Thresholds em quality-scoring.ts:levelFromScore:
//   < 0.40 -> ruim, < 0.75 -> regular, < 0.90 -> boa, >= 0.90 -> excelente
// ---------------------------------------------------------------------------
const QUALITY_TO_SCORE: Record<QualityLevel, number> = {
  ruim: 0.20,
  regular: 0.55,
  boa: 0.82,
  excelente: 0.95,
}

function computeQualityScore(analysis: PostCaptureAnalysis): number {
  return QUALITY_TO_SCORE[analysis.vlmValidation.quality]
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Phase = 'instruction' | 'analyzing' | 'previewing' | 'finalizing'

interface CapturedSlot { eye: string; angle: string }

interface UploadClientProps {
  readingId: string
  therapistId: string
  clientName: string
  capturedSlots: CapturedSlot[]
  resumeMode: boolean
}

interface PendingPreview {
  /** JPEG (potencialmente convertido de HEIC). Usado pra preview e upload. */
  blob: Blob
  imageUrl: string
  qualityScore: number
  width: number
  height: number
  slotIndex: number
  analysis: PostCaptureAnalysis
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Wizard de upload desktop. Clone funcional do capture-client (Fase 3) com
 * substituicoes cirurgicas:
 *   1. <input type="file" capture="environment"> -> UploadDropzone (drop + click).
 *   2. handleFileSelected (ChangeEvent) -> handleFileAccepted (File direto).
 *      Adicionado: validateUploadFile + convertHeicToJpeg.
 *   3. CapturePreview recebe mode="upload" (botao -> "Trocar arquivo").
 *   4. AngleInterstitial NAO e usado em upload (alert "Use a camera traseira" e
 *      mobile-only). Render direto: header inline + UploadDropzone visivel.
 *
 * Pipeline pos-arquivo identico a Fase 3:
 *   File -> validate (MIME/size) -> HEIC convert (se preciso) ->
 *   analyzeCapturedJpeg (VLM via /api/capture/validate) ->
 *   CapturePreview com badge -> Confirmar -> uploadWithRetry (background) ->
 *   proximo slot.
 *
 * CONTEXT D-09: VLM hard block reusado. CONTEXT D-13: upload roda em
 * background (Promise registrada em uploadPromisesRef); finalize aguarda
 * Promise.allSettled. CONTEXT D-14: X no header faz router.push('/leituras')
 * sem destruir reading (preserva rascunho).
 */
export function UploadClient({
  readingId,
  therapistId,
  clientName,
  capturedSlots: initialCaptured,
  resumeMode: _resumeMode,
}: UploadClientProps) {
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

  // Refs identicas ao capture-client. Sem fileInputRef -- UploadDropzone
  // expoe callback onFileAccepted e gerencia seu proprio input internamente.
  const slotAbortRefs = React.useRef<Map<number, AbortController>>(new Map())
  const uploadPromisesRef = React.useRef<Map<number, Promise<unknown>>>(new Map())
  const finalizingTriggeredRef = React.useRef(false)

  const slot: Slot = SEQUENCE[Math.min(slotIndex, SEQUENCE.length - 1)]

  // -------------------------------------------------------------------------
  // Handler de arquivo (substitui handleFileSelected do capture-client)
  // -------------------------------------------------------------------------
  const handleFileAccepted = React.useCallback(async (file: File) => {
    // 1) Validacao tecnica MIME + tamanho (CONTEXT D-10, D-12).
    const validation = validateUploadFile(file)
    if (!validation.ok) {
      toast.error(validation.error ?? 'Arquivo invalido')
      return
    }

    setPhase('analyzing')

    // 2) HEIC -> JPEG (CONTEXT D-11). validateUploadFile sinaliza
    //    needsHeicConversion=true quando MIME OU extensao indica HEIC/HEIF
    //    (defesa em profundidade -- alguns SOs omitem MIME pra .heic).
    let processedBlob: Blob = file
    if (validation.needsHeicConversion) {
      const toastId = toast.loading('Convertendo HEIC...')
      try {
        processedBlob = await convertHeicToJpeg(file)
        toast.dismiss(toastId)
      } catch (err) {
        console.error('[upload-client] HEIC convert error:', err)
        toast.dismiss(toastId)
        toast.error(
          'Nao consegui converter este HEIC. Exporte como JPEG do iPhone (Configuracoes -> Camera -> Formatos -> Mais Compativel) ou tente outra foto.',
        )
        setPhase('instruction')
        return
      }
    }

    const imageUrl = URL.createObjectURL(processedBlob)
    try {
      // 3) Pipeline VLM identico a Fase 3 (CONTEXT D-09).
      // analyzeCapturedJpeg roda EXIF detection (kind='unknown' em arquivos
      // sem EXIF -- esperado em fotos exportadas) e VLM via /api/capture/validate.
      // Sem bloqueio precoce de camera frontal aqui: terapeuta esta subindo
      // foto de camera profissional (nao selfie de iPhone).
      const analysis = await analyzeCapturedJpeg(processedBlob)

      const score = computeQualityScore(analysis)
      const currentSlotIdx = slotIndex

      setPendingPreview({
        blob: processedBlob,
        imageUrl,
        qualityScore: score,
        width: analysis.imageWidth,
        height: analysis.imageHeight,
        slotIndex: currentSlotIdx,
        analysis,
      })
      setPhase('previewing')
    } catch (err) {
      console.error('[upload-client] analyze error:', err)
      URL.revokeObjectURL(imageUrl)
      toast.error('Falha ao processar imagem. Tente novamente.')
      setPhase('instruction')
    }
  }, [slotIndex])

  // -------------------------------------------------------------------------
  // Upload (identico ao capture-client; CONTEXT D-13 background + D-07 upsert)
  // -------------------------------------------------------------------------
  const executeUpload = React.useCallback(() => {
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
        const diag = (err as Error)?.message ?? String(err)
        console.error(
          '[upload-client] upload error -- eye:',
          SEQUENCE[currentSlotIdx].eye,
          'angle:',
          SEQUENCE[currentSlotIdx].angle,
          'detail:',
          diag,
        )
        // DIAGNÓSTICO TEMPORÁRIO (2026-05-19): iPhone Chrome não tem devtools —
        // expõe a causa real do Supabase no toast. Reverter após diagnosticar.
        toast.error(`Falha ao salvar imagem ${currentSlotIdx + 1}/6: ${diag}`, {
          id: toastId,
          duration: Infinity,
        })
      })

    URL.revokeObjectURL(preview.imageUrl)
    setPendingPreview(null)
    setCapturedCount((c) => c + 1)

    const next = slotIndex + 1
    if (next >= SEQUENCE.length) {
      setPhase('finalizing')
    } else {
      setSlotIndex(next)
      setPhase('instruction')
    }
  }, [pendingPreview, slotIndex, supabase, therapistId, readingId])

  const handleConfirm = executeUpload

  const handleRedo = React.useCallback(() => {
    if (pendingPreview?.imageUrl) URL.revokeObjectURL(pendingPreview.imageUrl)
    const previousAbort = slotAbortRefs.current.get(slotIndex)
    if (previousAbort) {
      previousAbort.abort()
      slotAbortRefs.current.delete(slotIndex)
    }
    setPendingPreview(null)
    setPhase('instruction')
    // Sem setTimeout + click() -- UploadDropzone fica visivel na phase='instruction'
    // e o terapeuta arrasta/clica novamente.
  }, [pendingPreview, slotIndex])

  // -------------------------------------------------------------------------
  // useEffect de finalizacao (identico ao capture-client)
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    if (phase !== 'finalizing') return
    if (finalizingTriggeredRef.current) return
    finalizingTriggeredRef.current = true

    const run = async () => {
      // Aguarda TODOS os uploads completarem (storage + INSERT em
      // reading_images ja estao dentro do uploadCaptureImage). So depois
      // chama finalize + navega -- garante que /leituras vai ler a nova
      // leitura no SELECT.
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
      router.refresh()
    }
    void run()
  }, [phase, readingId, router])

  // -------------------------------------------------------------------------
  // Cleanup de AbortControllers (identico ao capture-client)
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    const abortMap = slotAbortRefs.current
    return () => {
      abortMap.forEach((ac) => ac.abort())
      abortMap.clear()
    }
  }, [])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  // Labels neutras de eye/angle (a copia "Use a camera traseira" do
  // AngleInterstitial e mobile-only -- nao se aplica a fotos ja tiradas).
  const eyeLabel = slot.eye === 'left' ? 'ESQUERDO' : 'DIREITO'
  const angleLabel =
    slot.angle === 'frontal' ? 'Frente' : slot.angle === 'lateral' ? 'Direita' : 'Esquerda'
  const slotHeading = `Foto ${slotIndex + 1} de ${SEQUENCE.length} -- Olho ${eyeLabel} . ${angleLabel}`

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Header com nome do cliente + X (CONTEXT D-14: X preserva rascunho) */}
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm text-foreground/80 truncate max-w-[60%]">{clientName}</span>
        <Link
          href="/leituras"
          aria-label="Cancelar leitura"
          className="rounded-full bg-muted p-2 text-foreground"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center gap-6 px-4 py-8">
        {/* Progress chip -- sempre visivel, fundo escuro vem do CaptureProgress */}
        <CaptureProgress currentIndex={slotIndex} capturedCount={capturedCount} />

        {phase === 'instruction' && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center space-y-2">
              <h1 className="text-xl font-semibold">{slotHeading}</h1>
            </div>
            <UploadDropzone
              onFileAccepted={handleFileAccepted}
              slotLabel={`Foto ${slotIndex + 1} de ${SEQUENCE.length}`}
            />
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="flex flex-col items-center justify-center gap-4 text-foreground py-12">
            <div
              aria-hidden="true"
              className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary motion-safe:animate-spin"
            />
            <p className="text-sm text-muted-foreground">Analisando imagem...</p>
          </div>
        )}

        {phase === 'previewing' && pendingPreview && (
          <div className="w-full max-w-2xl">
            <CapturePreview
              imageUrl={pendingPreview.imageUrl}
              qualityScore={pendingPreview.qualityScore}
              analysis={pendingPreview.analysis}
              onRedo={handleRedo}
              onConfirm={handleConfirm}
              mode="upload"
            />
          </div>
        )}

        {phase === 'finalizing' && (
          <div className="flex flex-col items-center justify-center gap-4 text-foreground py-12">
            <h1 className="text-xl font-semibold">
              {getSlotProgressLabel(SEQUENCE.length - 1)} imagens registradas
            </h1>
            <p className="text-sm text-muted-foreground">Finalizando leitura...</p>
          </div>
        )}
      </div>
    </div>
  )
}
