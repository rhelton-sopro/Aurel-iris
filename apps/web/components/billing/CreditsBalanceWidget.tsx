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

interface Props {
  totalRemaining: number
  totalReserved: number
  packagesCount: number
}

export function CreditsBalanceWidget({
  totalRemaining,
  totalReserved,
  packagesCount,
}: Props) {
  return (
    <section className="space-y-4 rounded-[2px] border border-teal-dark/30 bg-card p-5">
      <h2 className="text-lg font-semibold text-ink">Seu saldo</h2>

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
        {totalRemaining === 0 ? 'Comprar créditos' : 'Comprar mais'}
      </Link>
    </section>
  )
}
