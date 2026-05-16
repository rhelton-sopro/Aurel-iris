'use client'

/**
 * CompareShell — N-column side-by-side compare with a BLIND toggle.
 *
 * Phase 7.4 calibration harness. Generalized from the original 2-column
 * (vigente vs SAM) shell to N columns so Column C (ANÁLISE DIRETA SONNET)
 * can be compared alongside vigente + SAM.
 *
 * Receives already-rendered server columns as ReactNode props (RSC nodes are
 * passable to a client component). Responsibilities are deliberately thin:
 * layout + blind mode only. It does NOT know report content — that keeps it
 * dumb and the comparison honest.
 *
 * Blind mode (default ON):
 *   - hides which column is which, labels them "Coluna A / B / C"
 *   - randomizes column ORDER once per mount (Fisher-Yates) so screen
 *     position carries no signal — the founder cannot memorize
 *     "left = vigente"
 *   - per-column actions (e.g. Export PDF) are HIDDEN while blind (their
 *     mere presence/absence would otherwise leak which column is which)
 *   - "Revelar lados" un-blinds: each shuffled position shows its true
 *     identity + actions
 *
 * The structured verdict capture + Forer-control arm are a later phase —
 * here we only provide the unbiased viewing surface.
 *
 * Phase 7.4 SAM/Sonnet-direct harness.
 */
import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export interface CompareColumn {
  id: 'vigente' | 'sam' | 'sonnet_direct'
  /** True identity label, shown only after "Revelar". */
  label: string
  node: ReactNode
  /** Optional per-column actions (Export PDF). Shown only after "Revelar". */
  actions?: ReactNode
}

const BLIND_LETTERS = ['A', 'B', 'C', 'D'] as const

function shuffledIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function SamCompareShell({ columns }: { columns: CompareColumn[] }) {
  const [blind, setBlind] = useState(true)
  // Randomize column order once per mount (stable across re-renders).
  const order = useMemo(() => shuffledIndices(columns.length), [columns.length])

  const gridCols =
    columns.length >= 3
      ? 'lg:grid-cols-3'
      : columns.length === 2
        ? 'lg:grid-cols-2'
        : 'lg:grid-cols-1'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <p className="text-sm text-muted-foreground">
          {blind
            ? 'Modo cego ativo — ordem das colunas randomizada. Julgue qual coluna é mais específica/ancorada ANTES de revelar.'
            : 'Revelado — Vigente / SAM / Sonnet direto identificados.'}
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

      <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
        {order.map((colIdx, pos) => {
          const col = columns[colIdx]
          return (
            <section key={col.id} className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3
                  className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                  data-testid={`compare-col-${pos}-label`}
                >
                  {blind ? `Coluna ${BLIND_LETTERS[pos]}` : col.label}
                </h3>
                {!blind && col.actions ? <div>{col.actions}</div> : null}
              </div>
              <div className="rounded-lg border bg-white p-4">{col.node}</div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
