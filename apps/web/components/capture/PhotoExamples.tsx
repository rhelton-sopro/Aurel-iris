'use client'

import * as React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  LEVEL_BG_CLASS,
  LEVEL_TEXT_CLASS,
  LEVEL_LABEL,
} from '@/lib/capture/quality-scoring'

/**
 * Tela de FOTOS MODELO — exibida uma vez, ANTES da primeira foto.
 *
 * POR QUE EXISTE (2026-07-17, dado de `capture_attempts`):
 * o gate é o mesmo para todo mundo, mas o founder erra 20% e os demais erram
 * 59%. Desconfundindo aparelho vs pessoa (2×2), o aparelho pesa 0–12pp e QUEM
 * FOTOGRAFA pesa 31–43pp. Ou seja: não é limiar apertado, é técnica que ninguém
 * ensina. E a desistência é toda nas 3 primeiras fotos — o cliente Adriano
 * (14/07) tirou UMA foto, levou 'borrado', e sumiu. Não gerou leitura, não
 * gerou e-mail: o sistema é cego pra esse abandono.
 *
 * POR QUE MOSTRAR (e não escrever): precedente do próprio produto —
 * o FlashCard com 3 ícones (Auto ❌ / Desligado ❌ / Ligado ✓) nasceu do caso
 * Evanilce/Caroline porque texto não resolvia. Mostrar funciona; descrever não.
 *
 * POR QUE DUAS FOTOS (não uma): as duas são reais, aprovadas pelo gate
 * (`boa` e `excelente`, 17/07). A diferença entre elas é só DISTÂNCIA — as duas
 * estão em foco. Juntas dizem "assim já serve; assim é ótimo": ensinam o
 * gradiente sem transformar o exemplo em exigência. Uma foto sozinha vira uma
 * régua que o leigo sente que já reprovou antes de tentar.
 *
 * ASSIMETRIA cliente vs terapeuta (decisão do founder): o cliente SEMPRE vê;
 * o terapeuta pode dispensar. É o que o dado manda — quem erra é quem precisa
 * ver, e o terapeuta já sabe fotografar.
 */

const DISMISS_KEY = 'iris:capture-examples-dismissed-v1'

/**
 * Terapeuta já dispensou as fotos modelo neste aparelho?
 * localStorage (não perfil): a preferência é por-dispositivo, não exige
 * migration, e o fluxo de convite não tem conta pra guardar nada.
 * SSR-safe e à prova de localStorage bloqueado (Safari privado).
 */
export function hasDismissedExamples(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

interface PhotoExamplesProps {
  onProceed: () => void
  /** true = terapeuta (mostra a caixinha "não mostrar novamente"). false = cliente: sempre vê. */
  allowDismiss: boolean
}

export function PhotoExamples({ onProceed, allowDismiss }: PhotoExamplesProps) {
  const [dontShowAgain, setDontShowAgain] = React.useState(false)

  const handleProceed = React.useCallback(() => {
    if (allowDismiss && dontShowAgain) {
      try {
        window.localStorage.setItem(DISMISS_KEY, '1')
      } catch {
        // localStorage bloqueado — segue sem persistir. Nunca travar a captura.
      }
    }
    onProceed()
  }, [allowDismiss, dontShowAgain, onProceed])

  return (
    <div
      role="dialog"
      aria-label="Exemplos de foto"
      aria-modal="true"
      className="absolute inset-0 z-[60] bg-background text-foreground flex flex-col items-center justify-between overflow-y-auto px-6 pt-[calc(env(safe-area-inset-top)+72px)] pb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="flex flex-col items-center gap-5 max-w-sm w-full">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Veja como a foto precisa sair</h1>
          <p className="text-base text-muted-foreground">
            São 6 fotos. Estes dois exemplos foram aprovados de verdade.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <ExampleCard
            src="/captura/exemplo-boa.jpg"
            level="boa"
            alt="Exemplo de foto boa: metade do rosto, olho aberto e a íris nítida."
            priority
          />
          <ExampleCard
            src="/captura/exemplo-excelente.jpg"
            level="excelente"
            alt="Exemplo de foto excelente: câmera mais perto, o olho ocupa quase todo o quadro."
          />
        </div>

        {/* A lição, em uma linha. As duas fotos estão em foco — o que muda é a
            distância. É o único parâmetro que o leigo controla facilmente. */}
        <div className="w-full rounded-lg border-2 border-primary/40 bg-primary/5 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-foreground">
            As duas servem. Quanto mais perto do olho, melhor.
          </p>
        </div>

        <ul className="w-full space-y-1.5 text-left">
          <Tip>Enquadre <strong>um olho só</strong>.</Tip>
          <Tip>
            Se a pálpebra cair, <strong>segure ela com o dedo</strong> — pode.
          </Tip>
          <Tip>Toque na tela <strong>em cima do olho</strong> para focar.</Tip>
        </ul>

        {allowDismiss && (
          <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 flex-shrink-0 accent-primary"
            />
            <span className="text-sm text-foreground/80">
              Não mostrar novamente neste aparelho
            </span>
          </label>
        )}
      </div>

      <div className="mt-6 w-full max-w-sm pb-[env(safe-area-inset-bottom)]">
        <Button onClick={handleProceed} className="w-full h-12 text-base">
          Entendi, começar
        </Button>
      </div>
    </div>
  )
}

/**
 * Card de exemplo. O selo reusa LEVEL_BG_CLASS/LEVEL_TEXT_CLASS/LEVEL_LABEL
 * do quality-scoring DE PROPÓSITO: é o mesmo selo, com a mesma cor e a mesma
 * palavra, que a pessoa vai receber no preview da foto dela. O exemplo ensina
 * o vocabulário do feedback que vem depois.
 */
function ExampleCard({
  src,
  level,
  alt,
  priority,
}: {
  src: string
  level: 'boa' | 'excelente'
  alt: string
  priority?: boolean
}) {
  return (
    <figure className="relative overflow-hidden rounded-lg border border-border bg-muted">
      <Image
        src={src}
        alt={alt}
        width={640}
        height={796}
        priority={priority}
        sizes="(max-width: 420px) 45vw, 180px"
        className="h-auto w-full object-cover"
      />
      <figcaption
        className={`absolute left-1.5 top-1.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${LEVEL_BG_CLASS[level]} ${LEVEL_TEXT_CLASS[level]}`}
      >
        {LEVEL_LABEL[level]}
      </figcaption>
    </figure>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-xs text-foreground/80">
      <span aria-hidden className="text-primary">
        •
      </span>
      <span>{children}</span>
    </li>
  )
}
