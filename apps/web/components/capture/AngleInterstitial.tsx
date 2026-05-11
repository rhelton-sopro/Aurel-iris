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
 * Copy é específica do slot (frontal/câmera-à-direita/câmera-à-esquerda).
 *
 * PROTOCOLO REVISTO 2026-05-12: paciente fica fixo olhando para um ponto;
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
          className="w-full bg-amber-500/10 border-2 border-amber-600 rounded-lg px-4 py-3 flex items-start gap-2.5"
        >
          <AlertTriangle className="h-6 w-6 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="text-left space-y-1.5">
            <p className="text-base font-bold text-amber-900 uppercase tracking-wide">
              Ative o flash · Use câmera traseira
            </p>
            <p className="text-sm text-amber-900/90">
              Toque no ícone do raio (flash) na câmera antes de fotografar — a iluminação direta revela as fibras radiais da íris. Não use câmera frontal (selfie).
            </p>
            <p className="text-sm text-amber-900/90 pt-1 border-t border-amber-600/30">
              Se o exame é da sua íris, peça a alguém para fotografar você.
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
