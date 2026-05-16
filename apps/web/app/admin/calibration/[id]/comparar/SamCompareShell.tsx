'use client'

/**
 * SamCompareShell — side-by-side compare with a BLIND toggle.
 *
 * Receives two already-rendered server columns (vigente, SAM) as ReactNode
 * props (RSC nodes are passable to a client component). Responsibilities are
 * deliberately thin: layout + blind mode only. It does NOT know report
 * content — that keeps it dumb and the comparison honest.
 *
 * Blind mode (default ON): hides which side is which, labels them "A"/"B",
 * and randomizes left/right order once per mount so position carries no
 * signal. "Revelar" un-blinds. This is the seed of the future Forer blinded-
 * validation (the structured verdict capture + Forer-control arm is a later
 * phase — here we only provide the unbiased viewing surface).
 *
 * Phase 7.4 SAM harness.
 */
import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export function SamCompareShell({
  vigente,
  sam,
}: {
  vigente: ReactNode
  sam: ReactNode
}) {
  const [blind, setBlind] = useState(true)
  // Randomize side assignment once per mount (stable across re-renders).
  const samOnLeft = useMemo(() => Math.random() < 0.5, [])

  const leftIsSam = blind ? samOnLeft : false
  const left = leftIsSam ? sam : vigente
  const right = leftIsSam ? vigente : sam

  const labelFor = (isSam: boolean): string => {
    if (blind) return isSam === leftIsSam ? 'Coluna A' : 'Coluna B'
    return isSam ? 'SAM (paralelo)' : 'Vigente (produção)'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <p className="text-sm text-muted-foreground">
          {blind
            ? 'Modo cego ativo — julgue qual coluna é mais específica/ancorada ANTES de revelar.'
            : 'Revelado — Vigente vs SAM identificados.'}
        </p>
        <Button
          type="button"
          variant={blind ? 'default' : 'outline'}
          onClick={() => setBlind((b) => !b)}
          data-testid="blind-toggle"
        >
          {blind ? 'Revelar lados' : 'Voltar ao modo cego'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-w-0 space-y-2">
          <h3
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            data-testid="compare-left-label"
          >
            {labelFor(leftIsSam)}
          </h3>
          <div className="rounded-lg border bg-white p-4">{left}</div>
        </section>
        <section className="min-w-0 space-y-2">
          <h3
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            data-testid="compare-right-label"
          >
            {labelFor(!leftIsSam)}
          </h3>
          <div className="rounded-lg border bg-white p-4">{right}</div>
        </section>
      </div>
    </div>
  )
}
