'use client'

import * as React from 'react'
import { Zap, ZapOff, Camera, RotateCcw } from 'lucide-react'
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
 * PROTOCOLO REVISTO 2026-05-20 (founder UAT empírico): 2 fotos COM flash
 * (frontal+lateral) + 1 SEM flash (backlight) por olho. O card de flash
 * é o elemento visual dominante da tela — alto contraste (amarelo/preto
 * quando LIGAR, vermelho/branco quando DESLIGAR) pra deixar impossível
 * o terapeuta esquecer de ajustar entre fotos. Ver
 * sequence.ts:getSlotInstructionCopy para a tabela completa.
 */
export function AngleInterstitial({ nextSlot, slotIndex, onProceed, mode }: AngleInterstitialProps) {
  const copy = getSlotInstructionCopy(nextSlot, slotIndex, mode)

  return (
    <div
      role="dialog"
      aria-label={copy.heading}
      aria-modal="true"
      className="absolute inset-0 z-50 bg-background text-foreground flex flex-col items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+160px)] pb-12 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">{copy.heading}</h1>
          <p className="text-base text-muted-foreground">{copy.subtitle}</p>
        </div>

        {/* CARD DOMINANTE — flash on/off. Alto contraste por design pra
            impossibilitar erro entre fotos. */}
        <FlashCard flashOn={copy.flashOn} />

        {/* Aviso de câmera traseira — alto contraste vermelho.
            Founder UAT 2026-05-22: uma cliente tirou com frontal apesar do
            aviso cinza. Equiparado ao FlashCard dominante: cor + ícone +
            ilustração de troca de câmera, impossível ignorar. */}
        <RearCameraWarning />

        {/* Lembrete secundário, compacto — não compete com o card vermelho. */}
        <div className="w-full rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-left">
          <p className="text-xs text-foreground/80">
            • Se o exame é seu, peça a outra pessoa para fotografar você.
          </p>
        </div>
      </div>

      <div className="mt-8 w-full max-w-sm pb-[env(safe-area-inset-bottom)]">
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

/**
 * Card visual de flash. Dominante por design — alto contraste, ícone
 * grande, texto uppercase bold. É o que o terapeuta enxerga primeiro
 * ao abrir cada interstitial. Founder UAT 2026-05-20: tem que ser
 * impossível ignorar.
 */
function FlashCard({ flashOn }: { flashOn: boolean }) {
  if (flashOn) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full rounded-lg border-2 border-amber-600 bg-amber-400 px-4 py-4 flex items-center gap-3 shadow-md"
      >
        <Zap className="h-10 w-10 flex-shrink-0 text-amber-950 fill-amber-950" strokeWidth={2.5} />
        <div className="flex flex-col">
          <span className="text-base font-extrabold uppercase tracking-wide text-amber-950 leading-tight">
            Ligue o flash
          </span>
          <span className="text-xs text-amber-950/80 leading-tight mt-0.5">
            Toque no ícone do raio na câmera antes de fotografar.
          </span>
        </div>
      </div>
    )
  }
  // SEM flash — tratamento mais agressivo porque é o erro mais provável
  // (fácil esquecer de desligar entre fotos).
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full rounded-lg border-2 border-red-700 bg-red-600 px-4 py-4 flex items-center gap-3 shadow-md"
    >
      <ZapOff className="h-10 w-10 flex-shrink-0 text-white" strokeWidth={2.5} />
      <div className="flex flex-col">
        <span className="text-base font-extrabold uppercase tracking-wide text-white leading-tight">
          Desligue o flash
        </span>
        <span className="text-xs text-white/90 leading-tight mt-0.5">
          Esta é a 3ª foto deste olho. SEM flash — toque no raio pra desativar.
        </span>
      </div>
    </div>
  )
}

/**
 * Aviso de câmera traseira — alto contraste vermelho, mesmo nível visual
 * do FlashCard. Founder UAT 2026-05-22: cliente tirou com câmera frontal
 * apesar do aviso anterior (cinza/text-xs). Tratamento: ícone Camera grande
 * + RotateCcw indicando "vire/troque" + texto bold uppercase vermelho.
 */
function RearCameraWarning() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full rounded-lg border-2 border-red-700 bg-red-600 px-4 py-4 flex items-center gap-3 shadow-md"
    >
      <div className="relative flex-shrink-0">
        <Camera className="h-10 w-10 text-white" strokeWidth={2.5} />
        <RotateCcw
          className="absolute -bottom-1 -right-1 h-4 w-4 text-white bg-red-700 rounded-full p-0.5"
          strokeWidth={3}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-base font-extrabold uppercase tracking-wide text-white leading-tight">
          Use a câmera traseira
        </span>
        <span className="text-xs text-white/90 leading-tight mt-0.5">
          NÃO a selfie/frontal. Se o app abriu na frontal, toque no ícone de
          troca de câmera antes de fotografar.
        </span>
      </div>
    </div>
  )
}
