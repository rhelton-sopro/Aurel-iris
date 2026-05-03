'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AngleIcon } from './AngleIcon'
import type { Slot, CaptureMode } from '@/lib/capture/sequence'
import { getSlotInstructionCopy } from '@/lib/capture/sequence'

interface AngleInterstitialProps {
  /** Slot que vai começar após o CTA */
  nextSlot: Slot
  /** Índice 0-based do slot — usado pela copy ("Foto X de N — Olho..."). */
  slotIndex: number
  /** Callback chamado quando o usuário toca no CTA */
  onProceed: () => void
  /** Modo de captura — afeta apenas a copy do CTA. Default 'camera' (Fase 3). */
  mode?: CaptureMode
}

/**
 * Tela fullscreen exibida antes de cada foto do fluxo de captura nativa.
 * Copy é específica do slot (frente/direita 90°/esquerda 90°), comunicando
 * a rotação do paciente — a câmera fica sempre frontal ao olho.
 */
export function AngleInterstitial({ nextSlot, slotIndex, onProceed, mode }: AngleInterstitialProps) {
  const copy = getSlotInstructionCopy(nextSlot, slotIndex, mode)

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
        </div>

        <div
          role="alert"
          className="w-full bg-destructive/10 border-2 border-destructive rounded-lg px-4 py-3 flex items-start gap-2.5"
        >
          <AlertTriangle className="h-6 w-6 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="text-left space-y-1.5">
            <p className="text-base font-bold text-destructive uppercase tracking-wide">
              Use a câmera traseira · Nunca utilize o flash
            </p>
            <p className="text-sm text-destructive/90">
              Não use a câmera frontal (selfie). O flash gera reflexo que cobre a íris e invalida a leitura.
            </p>
            <p className="text-sm text-destructive/90 pt-1 border-t border-destructive/20">
              Se o exame é da sua íris, peça a alguém para tirar a foto para você.
            </p>
          </div>
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
