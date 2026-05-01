'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

interface CapturedSlot {
  eye: string
  angle: string
}

interface CaptureClientProps {
  readingId: string
  therapistId: string
  clientName: string
  capturedSlots: CapturedSlot[]
  resumeMode: boolean
}

export function CaptureClient({
  readingId,
  therapistId: _therapistId,
  clientName,
  capturedSlots: _capturedSlots,
  resumeMode: _resumeMode,
}: CaptureClientProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Header com botão cancelar (D-13: cancelar preserva rascunho) */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pt-[env(safe-area-inset-top)]">
        <span className="text-sm text-white/80">{clientName}</span>
        <Link
          href="/leituras"
          aria-label="Cancelar leitura"
          className="rounded-full bg-black/50 backdrop-blur-sm p-2 text-white"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      {/* Camera viewfinder — componente CameraView será integrado após Task 3.
          Em 03-05/06 receberá QualityIndicator, LiveFeedbackMessage, CaptureProgress,
          AngleOverlay etc. Por ora exibe placeholder de câmera. */}
      <div className="relative flex-1 w-full bg-black overflow-hidden flex items-center justify-center">
        {/* Placeholder: CameraView é criado no Task 3 deste plan */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Visualização da câmera traseira"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay circular guia — UI-SPEC: borda branca/80, sem fill */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="aspect-square w-[60vmin] max-w-[360px] rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      </div>

      {/* Hint para desenvolvimento — remover quando state machine 03-06 estiver pronta */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-xs text-white/80">
        Reading {readingId.slice(0, 8)} — captura ativa em fases seguintes
      </div>
    </div>
  )
}
