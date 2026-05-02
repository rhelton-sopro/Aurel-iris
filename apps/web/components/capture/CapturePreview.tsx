'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  type QualityLevel,
  levelFromScore,
  LEVEL_BG_CLASS,
  LEVEL_TEXT_CLASS,
  LEVEL_LABEL,
} from '@/lib/capture/quality-scoring'

interface CapturePreviewProps {
  /** URL (object URL) do blob capturado */
  imageUrl: string
  qualityScore: number
  /** Callback quando usuário tocar para refazer (tap-to-redo D-09) */
  onRedo: () => void
  /** Callback quando 2s passarem sem tap */
  onTimeout: () => void
  durationMs?: number
}

const DEFAULT_DURATION = 2000

/**
 * Preview passivo pós-captura (D-09):
 * - Exibe foto 2s com countdown circular canto inferior direito
 * - Badge de qualidade canto superior esquerdo
 * - Tap na tela → onRedo (cancela upload e volta para streaming)
 * - Timeout → onTimeout (avança para próximo slot)
 *
 * T-03-07-03: não exibe storage_path nem therapistId em nenhuma UI.
 */
export function CapturePreview({
  imageUrl,
  qualityScore,
  onRedo,
  onTimeout,
  durationMs = DEFAULT_DURATION,
}: CapturePreviewProps) {
  const level: QualityLevel = levelFromScore(qualityScore)
  const [progress, setProgress] = React.useState(0)
  const startedAtRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    startedAtRef.current = performance.now()
    const timeout = window.setTimeout(onTimeout, durationMs)
    let raf: number | null = null

    const tick = () => {
      if (!startedAtRef.current) return
      const elapsed = performance.now() - startedAtRef.current
      setProgress(Math.min(1, elapsed / durationMs))
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.clearTimeout(timeout)
      if (raf != null) cancelAnimationFrame(raf)
    }
  }, [durationMs, onTimeout])

  const circumference = 2 * Math.PI * 14 // r=14 → C ≈ 87.96
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <button
      type="button"
      onClick={onRedo}
      aria-label="Tocar para refazer esta foto"
      className="absolute inset-0 z-40 flex items-center justify-center bg-black motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Foto capturada"
        className="max-w-full max-h-full object-contain"
      />

      {/* Badge de qualidade no canto superior esquerdo (UI-SPEC §CapturePreview) */}
      <Badge
        variant="outline"
        className={`absolute top-[calc(env(safe-area-inset-top)+12px)] left-3 ${LEVEL_BG_CLASS[level]} ${LEVEL_TEXT_CLASS[level]} border-0`}
      >
        {LEVEL_LABEL[level]}
      </Badge>

      {/* Tap area indicador centro — instrução discreta */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="flex flex-col items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-6 py-3">
          <RefreshCw className="h-5 w-5 text-white" />
          <span className="text-xs text-white">Tocar para refazer</span>
        </div>
      </div>

      {/* Countdown circular canto inferior direito */}
      <svg
        aria-hidden="true"
        viewBox="0 0 36 36"
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+12px)] right-3 h-9 w-9"
      >
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
    </button>
  )
}
