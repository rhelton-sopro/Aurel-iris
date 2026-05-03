'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AngleIcon } from './AngleIcon'
import type { Slot } from '@/lib/capture/sequence'
import { getSlotInstructionCopy } from '@/lib/capture/sequence'

interface AngleInterstitialProps {
  /** Slot que vai começar após o CTA */
  nextSlot: Slot
  /** Índice 0-based do slot — usado pela copy ("Foto X de N — Olho..."). */
  slotIndex: number
  /** Callback chamado quando o usuário toca no CTA */
  onProceed: () => void
}

/**
 * Tela fullscreen exibida antes de cada foto do fluxo de captura nativa.
 * Copy é específica do slot (frente/direita 90°/esquerda 90°), comunicando
 * a rotação do paciente — a câmera fica sempre frontal ao olho.
 */
export function AngleInterstitial({ nextSlot, slotIndex, onProceed }: AngleInterstitialProps) {
  const copy = getSlotInstructionCopy(nextSlot, slotIndex)

  return (
    <div
      role="dialog"
      aria-label={copy.heading}
      aria-modal="true"
      className="absolute inset-0 z-50 bg-background text-foreground flex flex-col items-center justify-center px-6 py-12 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        <AngleIcon
          eye={nextSlot.eye}
          angle={nextSlot.angle}
          className="w-24 h-24 text-foreground"
        />
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">{copy.heading}</h1>
          <p className="text-base text-muted-foreground">{copy.subtitle}</p>
          <p className="flex items-start justify-center gap-1.5 text-sm font-medium text-destructive pt-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Use a câmera traseira — vire o celular com a câmera apontando para o olho do paciente
            </span>
          </p>
        </div>
      </div>

      <div className="mt-12 w-full max-w-sm pb-[env(safe-area-inset-bottom)]">
        <Button
          onClick={onProceed}
          className="w-full h-12 text-base"
        >
          {copy.cta}
        </Button>
      </div>
    </div>
  )
}
