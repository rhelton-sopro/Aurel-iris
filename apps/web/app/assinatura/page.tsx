// Página /assinatura (D-11): estado completo do terapeuta — saldo + reservados
// + processos em andamento + pacotes com botão arrependimento.
// Server component: SSR de credits + reservations em paralelo, agrega totais e
// delega a UI aos widgets (08-11 Task 2). Trial removido da UI (founder 2026-05-30).
//
// Tokens semânticos NEUTROS + teal explícito; rounded-[2px]; sem prose-*.

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { listActiveReservations } from '@/lib/billing/reservations'
import { CreditsBalanceWidget } from '@/components/billing/CreditsBalanceWidget'
import { ReservationsList } from '@/components/billing/ReservationsList'
import { RefundPackageButton } from '@/components/billing/RefundPackageButton'
import { DisclaimerCopy } from '@/components/legal/DisclaimerCopy'

export const metadata = { title: 'Sua assinatura — Iris Codex' }

interface CreditRow {
  id: string
  status: string
  purchase_date: string
  expires_at: string
  leituras_purchased: number
  leituras_remaining: number
  leituras_reserved: number
  credit_packages: { name: string; price_brl: number; sku: string }
}

export default async function AssinaturaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/assinatura')

  const [{ data: credits }, reservations] = await Promise.all([
    supabase
      .from('customer_credits')
      .select(
        'id, status, purchase_date, expires_at, leituras_purchased, leituras_remaining, leituras_reserved, credit_packages(name, price_brl, sku)',
      )
      .eq('user_id', user.id)
      // Só pacotes ATIVOS (pagos). Compras 'pending' (cobrança criada e não paga)
      // não fazem sentido na lista — poluem com tentativas abandonadas (founder
      // 2026-06-20). refunded/expired também ficam fora.
      .eq('status', 'active')
      .order('purchase_date', { ascending: true }),
    listActiveReservations(user.id),
  ])

  const activeCredits = (credits ?? []) as unknown as CreditRow[]
  const liveCredits = activeCredits.filter((c) => c.status === 'active')
  const totalRemaining = liveCredits.reduce(
    (s, c) => s + c.leituras_remaining,
    0,
  )
  const totalReserved = liveCredits.reduce(
    (s, c) => s + c.leituras_reserved,
    0,
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Sua assinatura</h1>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline"
        >
          ← Dashboard
        </Link>
      </header>

      <CreditsBalanceWidget
        totalRemaining={totalRemaining}
        totalReserved={totalReserved}
        packagesCount={liveCredits.length}
      />

      <ReservationsList reservations={reservations} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Pacotes</h2>
        {activeCredits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pacote ativo.{' '}
            <Link
              href="/assinatura/comprar"
              className="text-teal-dark underline"
            >
              Comprar agora
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {activeCredits.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-[2px] border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {c.credit_packages.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.leituras_remaining}/{c.leituras_purchased} disponíveis ·
                    expira em{' '}
                    {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                  </p>
                  <div className="mt-2">
                    <RefundPackageButton
                      creditId={c.id}
                      purchaseDate={c.purchase_date}
                      priceBrl={c.credit_packages.price_brl}
                      leiturasPurchased={c.leituras_purchased}
                      leiturasRemaining={c.leituras_remaining}
                      leiturasReserved={c.leituras_reserved}
                      status={c.status}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DisclaimerCopy variant="footer" />
    </div>
  )
}
