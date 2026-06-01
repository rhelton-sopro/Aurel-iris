'use client'

/**
 * Banner de "créditos acabando" — nudge de recompra quando o saldo COMPRADO
 * total fica baixo. Montado no topo do layout (dashboard), então aparece em
 * todas as páginas autenticadas — inclusive na geração/criação de leitura
 * (founder 2026-06-01: "dashboard + criação de leitura").
 *
 * Gatilho = SALDO TOTAL (soma das leituras_remaining dos pacotes ativos), não
 * por-pacote (founder escolheu total). O layout já computa esse total e passa
 * via prop. Teto = 2 (founder 2026-06-01): 3 cutucava cedo demais — quem comprou
 * 5 e usou só 2 (3 restantes) ainda nem passou da metade. Com 2, o nudge só
 * aparece quando está realmente acabando.
 *
 * NÃO mostra quando:
 *   - saldo = 0 → é trial/paywall (sem pacote comprado), tratado em outro lugar
 *     (paywall do gate + selo de trial no header).
 *   - saldo > teto → confortável.
 *   - já está em /assinatura → redundante (terapeuta já está comprando).
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wallet } from 'lucide-react'

// Limiar do saldo total (leituras) abaixo do qual o nudge aparece. Ajustável.
const LOW_CREDITS_THRESHOLD = 2

export function LowCreditsBanner({
  creditsRemaining,
}: {
  creditsRemaining: number
}) {
  const pathname = usePathname()

  // Redundante na própria tela de compra/assinatura.
  if (pathname?.startsWith('/assinatura')) return null
  // Só nudge quando há saldo COMPRADO baixo (0 < n ≤ teto). 0 não é "acabando"
  // — é ausência de pacote (trial/paywall); > teto é confortável.
  if (creditsRemaining <= 0 || creditsRemaining > LOW_CREDITS_THRESHOLD) return null

  const leiturasLabel =
    creditsRemaining === 1 ? 'leitura restante' : 'leituras restantes'

  return (
    <div
      role="status"
      data-testid="low-credits-banner"
      className="mb-5 flex flex-col gap-3 rounded-[2px] border border-teal-dark/30 bg-teal-dark/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-teal-dark" aria-hidden />
        <p className="text-sm text-ink">
          <span className="font-semibold">Seus créditos estão acabando</span> —
          restam {creditsRemaining} {leiturasLabel}. Renove para não interromper
          seus atendimentos.
        </p>
      </div>
      <Link
        href="/assinatura/comprar"
        className="inline-block shrink-0 rounded-[2px] bg-teal-dark px-4 py-2 text-center text-sm font-medium text-white hover:opacity-90"
      >
        Comprar mais créditos
      </Link>
    </div>
  )
}
