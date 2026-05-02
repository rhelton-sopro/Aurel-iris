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
import type { PostCaptureAnalysis } from '@/lib/capture/post-capture-analysis'

interface CapturePreviewProps {
  /** URL (object URL) do blob capturado */
  imageUrl: string
  qualityScore: number
  /** Callback quando usuário tocar para refazer (tap-to-redo D-09) */
  onRedo: () => void
  /** Callback quando 2s passarem sem tap, ou ao tocar "Continuar assim" no alerta */
  onTimeout: () => void
  durationMs?: number
  /**
   * Resultado da análise pós-captura. Quando `hasAlert=true`, a preview
   * troca para modo alerta (sem auto-timeout, com botões explícitos).
   * `null` = análise ainda em andamento ou não disponível → comportamento padrão.
   */
  analysis?: PostCaptureAnalysis | null
}

const DEFAULT_DURATION = 2000

/**
 * Preview pós-captura (D-09):
 * - Modo padrão: 2s preview com countdown + tap-to-redo
 * - Modo alerta (analysis.hasAlert=true): suspende auto-timeout, mostra
 *   "Refazer" (primário) + "Continuar assim" (secundário, texto menor).
 *   NÃO bloqueia — usuário decide.
 */
export function CapturePreview({
  imageUrl,
  qualityScore,
  onRedo,
  onTimeout,
  durationMs = DEFAULT_DURATION,
  analysis,
}: CapturePreviewProps) {
  const level: QualityLevel = levelFromScore(qualityScore)
  const showAlert = analysis?.hasAlert === true

  const [progress, setProgress] = React.useState(0)
  const startedAtRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (showAlert) {
      // Modo alerta: nada de auto-timeout
      setProgress(0)
      return
    }
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
  }, [durationMs, onTimeout, showAlert])

  const circumference = 2 * Math.PI * 14 // r=14 → C ≈ 87.96
  const strokeDashoffset = circumference * (1 - progress)

  // -------------------------------------------------------------------------
  // Modo alerta — análise indica qualidade subótima (não bloqueia)
  // -------------------------------------------------------------------------
  if (showAlert) {
    const reasons: string[] = []
    if (analysis?.sharpnessAlert) reasons.push('Imagem pouco nítida')
    if (analysis?.irisAlert) reasons.push('Íris pequena no enquadramento')

    return (
      <div
        role="alertdialog"
        aria-label="Qualidade abaixo do ideal"
        className="absolute inset-0 z-40 bg-black flex items-center justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Foto capturada"
          className="max-w-full max-h-full object-contain"
        />

        <Badge
          variant="outline"
          className={`absolute top-[calc(env(safe-area-inset-top)+12px)] left-3 ${LEVEL_BG_CLASS[level]} ${LEVEL_TEXT_CLASS[level]} border-0`}
        >
          {LEVEL_LABEL[level]}
        </Badge>

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-[calc(env(safe-area-inset-bottom)+24px)] px-4">
          <div className="rounded-2xl bg-black/85 backdrop-blur-sm p-4 max-w-sm w-full">
            <p className="text-sm text-white font-semibold mb-2">
              Qualidade abaixo do ideal
            </p>
            <ul className="text-xs text-white/80 space-y-1 mb-4">
              {reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onRedo}
              className="w-full rounded-full bg-white text-black py-2.5 px-4 font-semibold text-sm active:scale-95 transition-transform"
            >
              Refazer
            </button>
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={onTimeout}
                className="text-xs text-white/60 underline underline-offset-2 py-1 px-2"
              >
                Continuar assim
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Modo padrão — 2s preview com tap-to-redo + countdown
  // -------------------------------------------------------------------------
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

      <Badge
        variant="outline"
        className={`absolute top-[calc(env(safe-area-inset-top)+12px)] left-3 ${LEVEL_BG_CLASS[level]} ${LEVEL_TEXT_CLASS[level]} border-0`}
      >
        {LEVEL_LABEL[level]}
      </Badge>

      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="flex flex-col items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-6 py-3">
          <RefreshCw className="h-5 w-5 text-white" />
          <span className="text-xs text-white">Tocar para refazer</span>
        </div>
      </div>

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
