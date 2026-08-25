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
import { getTrialState } from '@/lib/billing/trial'
import { CreditsBalanceWidget } from '@/components/billing/CreditsBalanceWidget'
import { ReservationsList } from '@/components/billing/ReservationsList'
import { RefundPackageButton } from '@/components/billing/RefundPackageButton'

export const metadata = { title: 'Seus créditos — Iris Codex' }

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

  const [{ data: credits }, reservations, trial] = await Promise.all([
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
    getTrialState(user.id),
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
    /* Esta tela agora vive DENTRO do layout do painel (2026-08-25): o menu
       lateral levava até ela e desaparecia na chegada, deixando como único
       caminho de volta um "← Dashboard" pequeno no canto. Com o layout, o menu
       fica — e o "voltar" improvisado sai junto, porque virou redundância. */
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">
          Seus créditos
        </h1>
      </header>

      {/* ⭐ A avaliação gratuita não aparecia AQUI (tirada da UI em 2026-05-30) — e
          esta é exatamente a tela pra onde o selo "1 grátis" do topo aponta. Quem
          clicava pra ver o saldo de cortesia lia "Nenhum pacote ativo" e concluía
          que não tinha nada. O selo levava ao desmentido do próprio selo. */}
      {trial.status === 'active' && (
        <section className="rounded-[2px] border border-teal-dark/40 bg-teal-dark/5 p-4">
          <p className="text-[11px] font-medium uppercase tracking-label text-teal-dark">
            Avaliação gratuita
          </p>
          <p className="mt-1.5 text-lg font-semibold text-ink">
            {trial.readings_remaining}{' '}
            {trial.readings_remaining === 1
              ? 'leitura de cortesia'
              : 'leituras de cortesia'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Válida até{' '}
            <strong className="text-ink">
              {new Date(trial.expires_at).toLocaleDateString('pt-BR')}
            </strong>{' '}
            ({trial.days_remaining}{' '}
            {trial.days_remaining === 1 ? 'dia restante' : 'dias restantes'}). É
            gasta antes dos créditos comprados — o que você comprar fica intacto
            até ela acabar.
          </p>
        </section>
      )}

      {trial.status === 'ended' && (
        <section className="rounded-[2px] border border-border bg-muted/30 p-4">
          <p className="text-[11px] font-medium uppercase tracking-label text-muted-foreground">
            Avaliação gratuita
          </p>
          <p className="mt-1.5 text-sm text-ink">
            {trial.reason === 'readings_exhausted'
              ? 'Encerrada — a leitura de cortesia já foi usada.'
              : trial.reason === 'days_elapsed'
                ? 'Encerrada — o prazo de 15 dias venceu.'
                : 'Encerrada.'}{' '}
            A partir daqui, cada leitura consome 1 crédito.
          </p>
        </section>
      )}

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

    </div>
  )
}
