'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
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
 * Copy é específica do slot (frontal/câmera-à-direita/câmera-à-esquerda).
 *
 * PROTOCOLO REVISTO 2026-05-12: cliente fica fixo olhando para um ponto;
 * terapeuta inclina levemente a câmera entre as 3 fotos. FLASH ATIVO em
 * todas as fotos (revela fibras radiais; reverte política anterior). Ver
 * comentário em sequence.ts:getSlotInstructionCopy para detalhes do
 * protocolo e razão da revisão.
 */
export function AngleInterstitial({ nextSlot, slotIndex, onProceed, mode }: AngleInterstitialProps) {
  const copy = getSlotInstructionCopy(nextSlot, slotIndex, mode)

  return (
    <div
      role="dialog"
      aria-label={copy.heading}
      aria-modal="true"
      className="absolute inset-0 z-50 bg-background text-foreground flex flex-col items-center justify-center px-6 pt-[calc(env(safe-area-inset-top)+128px)] pb-12 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">{copy.heading}</h1>
          <p className="text-base text-muted-foreground">{copy.subtitle}</p>
        </div>

        <div className="w-full bg-muted/60 border border-border rounded-lg px-4 py-3 text-left space-y-2">
          <p className="text-sm font-medium text-foreground">Antes de fotografar</p>
          <p className="text-sm text-foreground/80">
            Use a câmera traseira (não a frontal) e ative o flash tocando no ícone do raio.
          </p>
          <p className="text-sm text-foreground/80">
            A iluminação direta sobre o olho é o que revela as fibras radiais da íris — sem flash, a foto não serve para análise.
          </p>
          <p className="text-sm text-foreground/80">
            Se o exame é da sua íris, peça a outra pessoa para fotografar você.
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
