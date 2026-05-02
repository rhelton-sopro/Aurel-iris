'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { SEQUENCE, getSlotProgressLabel } from '@/lib/capture/sequence'

interface CaptureProgressProps {
  /** Índice 0-based do slot atual sendo capturado */
  currentIndex: number
  /** Quantidade de slots já capturados com sucesso */
  capturedCount: number
}

/**
 * Pill horizontal com 6 dots representando os 6 slots (eye × angle).
 * UI-SPEC §CaptureProgress:
 * - pending: bg-neutral-300
 * - current: bg-primary + ring pulsante (motion-safe:animate-pulse para reduced motion)
 * - done: bg-emerald-500 + ícone check 12px
 */
export function CaptureProgress({ currentIndex, capturedCount }: CaptureProgressProps) {
  const displayIndex = currentIndex < 0 ? capturedCount : currentIndex

  return (
    <div
      role="group"
      aria-label="Progresso da captura"
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm"
    >
      <div className="flex items-center gap-1.5">
        {SEQUENCE.map((_, idx) => {
          const isDone = idx < capturedCount
          const isCurrent = !isDone && idx === currentIndex

          if (isDone) {
            return (
              <div
                key={idx}
                aria-hidden="true"
                className="h-3 w-3 rounded-full bg-emerald-500 flex items-center justify-center"
              >
                <Check className="h-2 w-2 text-white" aria-hidden="true" />
              </div>
            )
          }

          if (isCurrent) {
            return (
              <div
                key={idx}
                aria-hidden="true"
                className="h-3 w-3 rounded-full bg-white motion-safe:animate-pulse"
              />
            )
          }

          return (
            <div
              key={idx}
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-white/30"
            />
          )
        })}
      </div>
      <span className="text-xs text-white/80 font-medium ml-1" aria-live="polite">
        {getSlotProgressLabel(displayIndex)}
      </span>
    </div>
  )
}
