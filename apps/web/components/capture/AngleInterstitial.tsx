'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { AngleIcon } from './AngleIcon'
import type { Slot } from '@/lib/capture/sequence'
import { getInterstitialCopy, getFirstInterstitialCopy } from '@/lib/capture/sequence'

interface AngleInterstitialProps {
  /** Slot que vai começar após o CTA */
  nextSlot: Slot
  /** Callback chamado quando o usuário toca no CTA */
  onProceed: () => void
  /**
   * Quando true, usa a copy da TELA INICIAL ("Vamos começar pelo olho... Primeiro ângulo: ...")
   * exibida antes da 1ª captura. Quando false (default), usa a copy de TRANSIÇÃO
   * entre olhos (direito → esquerdo).
   */
  isFirst?: boolean
}

/**
 * Tela fullscreen exibida (a) antes da 1ª captura ou (b) na transição entre olhos.
 * CONTEXT D-10: câmera para, instrução visual com CTA.
 * UI-SPEC §AngleInterstitial: fade + slide-up 300ms, CTA h-12 full-width na bottom safe area.
 */
export function AngleInterstitial({ nextSlot, onProceed, isFirst = false }: AngleInterstitialProps) {
  const copy = isFirst ? getFirstInterstitialCopy(nextSlot) : getInterstitialCopy(nextSlot.eye)

  return (
    <div
      role="dialog"
      aria-label={copy.heading}
      aria-modal="true"
      className="absolute inset-0 z-50 bg-background text-foreground flex flex-col items-center justify-center px-6 py-12 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Ícone grande 96×96 — UI-SPEC §AngleInterstitial */}
        <AngleIcon
          eye={nextSlot.eye}
          angle={nextSlot.angle}
          className="w-24 h-24 text-foreground"
        />
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">{copy.heading}</h1>
          <p className="text-base text-muted-foreground">{copy.subtitle}</p>
        </div>
      </div>

      {/* CTA na bottom safe area — UI-SPEC: Button h-12 full-width */}
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
