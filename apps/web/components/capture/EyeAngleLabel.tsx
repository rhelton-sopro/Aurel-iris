'use client'

import * as React from 'react'
import type { Slot } from '@/lib/capture/sequence'
import { ANGLE_LABEL, EYE_LABEL, SEQUENCE } from '@/lib/capture/sequence'

interface EyeAngleLabelProps {
  slot: Slot
  /** Índice 0-based do slot atual */
  currentIndex: number
}

/**
 * Chip persistente no topo da tela durante toda a fase de streaming.
 * Formato: "DIREITO · Frontal (1/6)". Não some — comunica claramente
 * qual olho/ângulo está sendo capturado a cada momento.
 */
export function EyeAngleLabel({ slot, currentIndex }: EyeAngleLabelProps) {
  const eye = EYE_LABEL[slot.eye].toUpperCase()
  const angleRaw = ANGLE_LABEL[slot.angle]
  const angle = angleRaw.charAt(0).toUpperCase() + angleRaw.slice(1)

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-full bg-black/70 backdrop-blur-sm px-4 py-1.5 text-white text-sm font-semibold tracking-wide"
    >
      {eye} · {angle} ({currentIndex + 1}/{SEQUENCE.length})
    </div>
  )
}
