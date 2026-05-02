'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  /** Reabre câmera nativa para nova captura no mesmo slot */
  onRedo: () => void
  /** Avança para o próximo slot */
  onConfirm: () => void
  /**
   * Resultado da análise pós-captura. Quando `hasAlert=true`, mostra os motivos
   * acima dos botões (não bloqueia — usuário ainda pode confirmar).
   */
  analysis?: PostCaptureAnalysis | null
}

/**
 * Preview pós-captura no fluxo de input nativo.
 * Sem auto-timeout: o usuário sempre confirma ou refaz manualmente.
 *
 * Layout: imagem com letterbox, badge de qualidade no topo, painel inferior com:
 *  - alertas de qualidade (quando analysis.hasAlert)
 *  - dois botões de mesmo tamanho: "Refazer" (secundário neutro) + "Confirmar" (primário)
 */
export function CapturePreview({
  imageUrl,
  qualityScore,
  onRedo,
  onConfirm,
  analysis,
}: CapturePreviewProps) {
  const level: QualityLevel = levelFromScore(qualityScore)
  const showAlert = analysis?.hasAlert === true

  // Iris-detection-failed e iris-too-small são mutuamente exclusivos.
  const reasons: string[] = []
  if (analysis?.irisUndetectedAlert) {
    reasons.push('Não foi possível detectar a íris — verifique o enquadramento')
  } else if (analysis?.irisAlert) {
    reasons.push('Íris pequena — aproxime mais')
  }
  if (analysis?.sharpnessAlert) reasons.push('Imagem pouco nítida')

  return (
    <div
      role="dialog"
      aria-label="Preview da captura"
      aria-modal="true"
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
        {LEVEL_LABEL[level]} · {Math.round(qualityScore * 100)}%
      </Badge>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-[calc(env(safe-area-inset-bottom)+24px)] px-4">
        <div className="rounded-2xl bg-black/85 backdrop-blur-sm p-4 max-w-sm w-full">
          {showAlert && reasons.length > 0 && (
            <>
              <p className="text-sm text-white font-semibold mb-2">
                Qualidade abaixo do ideal
              </p>
              <ul className="text-xs text-white/80 space-y-1 mb-4">
                {reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </>
          )}

          {/* Dois botões de mesmo tamanho.
              "Refazer" secundário (reabre câmera). "Confirmar" primário (avança). */}
          <div className="flex gap-2">
            <Button
              onClick={onRedo}
              variant="secondary"
              className="flex-1 h-11 text-sm font-semibold"
            >
              Refazer
            </Button>
            <Button
              onClick={onConfirm}
              variant="default"
              className="flex-1 h-11 text-sm font-semibold"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
