// Agrupa os 4 SKUs em 2 grupos visuais (D-21):
//   Grupo 1 "Sem compromisso": Trial (sintético, fora de credit_packages) + Avulsa
//   Grupo 2 "Pacotes com economia": Pequeno + Médio + Grande
// Server component — recebe os pacotes (SSR query).
// O cálculo de economia usa o preço/un da Avulsa (D-02) como baseline.

import { PackageCard } from './PackageCard'

export interface CreditPackage {
  id: string
  sku: 'avulsa' | 'pequeno' | 'medio' | 'grande' | 'teste' // 'teste' = UAT efêmero
  name: string
  leituras_count: number
  price_brl: number
  badge: 'mais_escolhido' | 'melhor_valor' | null
}

// Preço/un da Avulsa (D-02) — baseline pra calcular economia dos pacotes.
const AVULSA_PRICE = 99.7

interface Props {
  packages: CreditPackage[]
  // Propagado quando a compra veio de uma leitura (banner "sem créditos"):
  // cada PackageCard usa pra montar o successUrl de retorno à leitura.
  readingId?: string
}

export function PackageGrid({ packages, readingId }: Props) {
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
          {avulsa ? (
            <PackageCard
              sku={avulsa.sku}
              name={avulsa.name}
              leiturasCount={avulsa.leituras_count}
              priceBrl={avulsa.price_brl}
              pricePerUnit={avulsa.price_brl}
              savingsBrl={0}
              badge={null}
              readingId={readingId}
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
                readingId={readingId}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
