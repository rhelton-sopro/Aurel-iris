// Agrupa os 4 SKUs em 2 grupos visuais (D-21):
//   Grupo 1 "Sem compromisso": Trial (sintético, fora de credit_packages) + Avulsa
//   Grupo 2 "Pacotes com economia": Pequeno + Médio + Grande
// Server component — recebe os pacotes (SSR query) + o trialState já avaliado.
// O cálculo de economia usa o preço/un da Avulsa (D-02) como baseline.

import { PackageCard } from './PackageCard'
import type { TrialState } from '@/lib/billing/trial'

export interface CreditPackage {
  id: string
  sku: 'avulsa' | 'pequeno' | 'medio' | 'grande'
  name: string
  leituras_count: number
  price_brl: number
  badge: 'mais_escolhido' | 'melhor_valor' | null
}

// Preço/un da Avulsa (D-02) — baseline pra calcular economia dos pacotes.
const AVULSA_PRICE = 99.7

interface Props {
  packages: CreditPackage[]
  trialState: TrialState
}

/** Card do trial gratuito — estado dinâmico (ativo / encerrado / indisponível). */
function TrialCard({ state }: { state: TrialState }) {
  if (state.status === 'active') {
    return (
      <div
        className="relative flex flex-col rounded-[2px] border border-teal-dark bg-card p-5"
        data-testid="trial-card-active"
      >
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-[2px] bg-teal-dark px-3 py-0.5 text-[10px] font-medium uppercase tracking-label text-white">
          Gratuito
        </span>
        <h3 className="text-lg font-semibold text-ink">Trial gratuito</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.readings_remaining}{' '}
          {state.readings_remaining === 1 ? 'leitura restante' : 'leituras restantes'}
          {' · '}expira em {state.days_remaining}{' '}
          {state.days_remaining === 1 ? 'dia' : 'dias'}
        </p>
        <p className="mt-4 flex-1 text-xs text-muted-foreground">
          Sem cartão de crédito. Quando o trial encerrar, escolha um pacote
          para continuar gerando leituras.
        </p>
      </div>
    )
  }

  // ended ou no_trial
  return (
    <div
      className="relative flex flex-col rounded-[2px] border border-border bg-muted/20 p-5"
      data-testid="trial-card-inactive"
    >
      <h3 className="text-lg font-semibold text-ink">Trial gratuito</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {state.status === 'ended' ? 'Já utilizado' : 'Não disponível'}
      </p>
      <p className="mt-4 flex-1 text-xs text-muted-foreground">
        Compre uma Avulsa ou um pacote para continuar.
      </p>
    </div>
  )
}

export function PackageGrid({ packages, trialState }: Props) {
  const avulsa = packages.find((p) => p.sku === 'avulsa')
  const group2 = packages
    .filter((p) => p.sku !== 'avulsa')
    .sort((a, b) => a.leituras_count - b.leituras_count)

  return (
    <div className="space-y-10">
      {/* Grupo 1: Sem compromisso */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Sem compromisso</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TrialCard state={trialState} />
          {avulsa ? (
            <PackageCard
              sku={avulsa.sku}
              name={avulsa.name}
              leiturasCount={avulsa.leituras_count}
              priceBrl={avulsa.price_brl}
              pricePerUnit={avulsa.price_brl}
              savingsBrl={0}
              badge={null}
            />
          ) : null}
        </div>
      </section>

      {/* Grupo 2: Pacotes com economia */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">
          Pacotes com economia
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {group2.map((pkg) => {
            const pricePerUnit = pkg.price_brl / pkg.leituras_count
            const savingsPerUnit = AVULSA_PRICE - pricePerUnit
            const totalSavings = savingsPerUnit * pkg.leituras_count
            return (
              <PackageCard
                key={pkg.id}
                sku={pkg.sku}
                name={pkg.name}
                leiturasCount={pkg.leituras_count}
                priceBrl={pkg.price_brl}
                pricePerUnit={pricePerUnit}
                savingsBrl={totalSavings}
                badge={pkg.badge}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
