// Card grande de saldo (D-11): trial state (se ativo) + disponível / reservado /
// total + contagem de pacotes + CTA comprar. Server component puro — recebe data
// já agregada pela page; sem 'use client', sem I/O.
//
// Design: tokens semânticos NEUTROS (border-border / bg-card / text-ink /
// text-muted-foreground) + teal SEMPRE explícito por elemento
// (memory feedback_design_tokens_semantic_neutral). Cantos quase-quadrados
// rounded-[2px] e <Button asChild> via Link pra herdar o idioma da marca.
// Tailwind v4 sem typography plugin — nada de prose-*.

import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import type { TrialState } from '@/lib/billing/trial'

interface Props {
  trialState: TrialState
  totalRemaining: number
  totalReserved: number
  packagesCount: number
}

export function CreditsBalanceWidget({
  trialState,
  totalRemaining,
  totalReserved,
  packagesCount,
}: Props) {
  const inTrial = trialState.status === 'active'

  return (
    <section className="space-y-4 rounded-[2px] border border-teal-dark/30 bg-card p-5">
      <h2 className="text-lg font-semibold text-ink">Seu saldo</h2>

      {inTrial ? (
        <div className="space-y-1 rounded-[2px] border border-teal-dark/30 bg-teal-dark/5 p-3">
          <p className="text-sm font-semibold text-teal-dark">Trial ativo</p>
          <p className="text-xs text-muted-foreground">
            {trialState.readings_remaining}{' '}
            {trialState.readings_remaining === 1 ? 'leitura' : 'leituras'}{' '}
            restantes · expira em {trialState.days_remaining}{' '}
            {trialState.days_remaining === 1 ? 'dia' : 'dias'}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-ink">{totalRemaining}</p>
          <p className="text-xs text-muted-foreground">Disponível</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-ink">{totalReserved}</p>
          <p className="text-xs text-muted-foreground">Reservado</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-ink">
            {totalRemaining + totalReserved}
          </p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {packagesCount}{' '}
        {packagesCount === 1 ? 'pacote ativo' : 'pacotes ativos'}
      </p>

      <Link
        href="/assinatura/comprar"
        className={buttonVariants({ className: 'w-full' })}
      >
        {totalRemaining === 0 && !inTrial ? 'Comprar créditos' : 'Comprar mais'}
      </Link>
    </section>
  )
}
