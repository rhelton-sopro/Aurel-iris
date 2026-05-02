'use client'

import * as React from 'react'
import { AngleIcon } from './AngleIcon'
import type { Slot } from '@/lib/capture/sequence'
import { ANGLE_LABEL, EYE_LABEL } from '@/lib/capture/sequence'

interface AngleOverlayProps {
  /** Slot atual que está sendo capturado */
  slot: Slot
  /** Chave de re-entry para resetar o timer quando muda de slot */
  resetKey: string | number
}

/** Duração da fase de entrada antes de minimizar para chip (UI-SPEC §AngleOverlay) */
const ENTERING_MS = 2500

/**
 * Banner transitório que aparece entre ângulos do mesmo olho (CONTEXT D-10).
 * Estados:
 * - entering: banner full-width com ícone + texto, dura 2.5s
 * - minimized: chip pequeno persistente com apenas o ícone
 */
export function AngleOverlay({ slot, resetKey }: AngleOverlayProps) {
  const [phase, setPhase] = React.useState<'entering' | 'minimized'>('entering')

  React.useEffect(() => {
    setPhase('entering')
    const id = window.setTimeout(() => setPhase('minimized'), ENTERING_MS)
    return () => window.clearTimeout(id)
  }, [resetKey])

  if (phase === 'entering') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/70 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
      >
        <AngleIcon eye={slot.eye} angle={slot.angle} className="w-12 h-12 text-white shrink-0" />
        <div className="text-white">
          <p className="text-sm font-semibold">
            Próximo: olho {EYE_LABEL[slot.eye]} — {ANGLE_LABEL[slot.angle]}
          </p>
          <p className="text-xs text-white/70">
            Posicione o celular conforme o ícone.
          </p>
        </div>
      </div>
    )
  }

  /* minimized: chip pequeno persistente — UI-SPEC §AngleOverlay minimized */
  return (
    <div
      role="img"
      aria-label={`Captura atual: olho ${EYE_LABEL[slot.eye]} ${ANGLE_LABEL[slot.angle]}`}
      className="rounded-full bg-black/40 backdrop-blur-sm p-1.5"
    >
      <AngleIcon eye={slot.eye} angle={slot.angle} className="w-5 h-5 text-white" />
    </div>
  )
}
