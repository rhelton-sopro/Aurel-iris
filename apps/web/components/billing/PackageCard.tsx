'use client'

// Card de um SKU de crédito (D-22). Client component porque dispara
// createChargeAction (08-06) num useTransition e redireciona o navegador
// pro hosted checkout do Asaas (invoice_url).
//
// Design: tokens semânticos NEUTROS (border-border / bg-card / text-muted-foreground)
// + teal SEMPRE explícito por elemento (memory feedback_design_tokens_semantic_neutral).
// Cantos quase-quadrados (rounded-[2px]) e botão via <Button> do projeto pra
// herdar o idioma uppercase tracking-label da marca.

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { createChargeAction } from '@/app/actions/billing'
import {
  hasPixDiscount,
  maxInstallmentsFor,
  pixPriceBrl,
  PIX_DISCOUNT_LABEL,
} from '@/lib/billing/pricing'
import { cn } from '@/lib/utils'

interface Props {
  sku: 'avulsa' | 'pequeno' | 'medio' | 'grande' | 'teste' // 'teste' = UAT efêmero
  name: string
  leiturasCount: number
  priceBrl: number
  pricePerUnit: number
  /** Economia total em R$ vs comprar tudo como Avulsa. 0 pra avulsa. */
  savingsBrl: number
  badge?: 'mais_escolhido' | 'melhor_valor' | null
  // Quando a compra veio de uma leitura (banner "sem créditos"): repassa pro
  // createChargeAction montar o successUrl de volta pra essa leitura.
  readingId?: string
}

const BADGE_LABELS: Record<NonNullable<Props['badge']>, string> = {
  mais_escolhido: 'Mais escolhido',
  melhor_valor: 'Melhor valor',
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function PackageCard(props: Props) {
  const [isPending, startTransition] = useTransition()
  // B-lite: cliente escolhe PIX ou cartão AQUI; passamos o billingType específico
  // pra cobrança Asaas → checkout hospedado mostra só esse método (boleto nunca).
  const [method, setMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX')
  // Parcelamento (médio até 2x, grande até 3x — lib/billing/pricing). O cliente
  // NÃO escolhe o nº de parcelas aqui: o Checkout Pro do MP não pré-trava (abre
  // sempre em 1x), então mandamos o TETO do SKU e ele escolhe 1..teto no checkout.
  // O card só COMUNICA "em até Nx sem juros" (founder 2026-06-20).
  const maxInst = maxInstallmentsFor(props.sku)
  // Desconto PIX (5% em médio+grande). Comunicado como bônus à vista embaixo — o
  // DESTAQUE do card é o parcelamento sem juros (founder 2026-06-20).
  const pixEligible = hasPixDiscount(props.sku)
  const pixPrice = pixPriceBrl(props.sku, props.priceBrl)
  const canShowInstallments = maxInst > 1

  function chooseMethod(value: 'PIX' | 'CREDIT_CARD') {
    setMethod(value)
  }

  function handleBuy() {
    startTransition(async () => {
      const r = await createChargeAction({
        sku: props.sku,
        billingType: method,
        reading_id: props.readingId,
        // Teto de parcelas do SKU (cliente escolhe quantas no checkout do MP).
        installments: method === 'CREDIT_CARD' && maxInst > 1 ? maxInst : undefined,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Cobrança criada — redirecionando…')
      // Redirect pro checkout hospedado do Asaas (só o método escolhido).
      window.location.href = r.invoice_url
    })
  }

  const methods = [
    { value: 'PIX' as const, label: 'PIX' },
    { value: 'CREDIT_CARD' as const, label: 'Cartão' },
  ]

  const highlighted = !!props.badge

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-[2px] border bg-card p-5 transition-colors',
        highlighted
          ? 'border-teal-dark'
          : 'border-border hover:border-teal-dark/40',
      )}
      data-testid={`package-card-${props.sku}`}
    >
      {props.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-[2px] bg-teal-dark px-3 py-0.5 text-[10px] font-medium uppercase tracking-label text-white">
          {BADGE_LABELS[props.badge]}
        </span>
      ) : null}

      <h3 className="text-lg font-semibold text-ink">{props.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {props.leiturasCount} {props.leiturasCount === 1 ? 'leitura' : 'leituras'}
      </p>

      <div className="my-4 flex-1">
        <p className="text-3xl font-bold tracking-tight text-ink">
          R$ {formatBrl(props.priceBrl)}
        </p>
        {/* Parcelamento sem juros em DESTAQUE (founder 2026-06-20): no ticket alto
            o gancho é "cabe no bolso"; o PIX 5% vem como bônus à vista abaixo. */}
        {canShowInstallments ? (
          <p className="mt-1 text-sm font-semibold text-teal-dark">
            em até {maxInst}x de R$ {formatBrl(props.priceBrl / maxInst)} sem juros
          </p>
        ) : null}
        {pixEligible ? (
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            ou <span className="text-teal-dark">{PIX_DISCOUNT_LABEL} no PIX</span>: R${' '}
            {formatBrl(pixPrice)}
          </p>
        ) : null}
        {props.leiturasCount > 1 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            R$ {formatBrl(props.pricePerUnit)} por leitura
          </p>
        ) : null}
        {props.savingsBrl > 0 ? (
          <p className="mt-2 text-sm font-medium text-teal-dark">
            Economia de R$ {formatBrl(props.savingsBrl)} vs Avulsa
          </p>
        ) : null}
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Validade: 12 meses após a confirmação do pagamento
      </p>

      {/* Seletor de método (B-lite). Só PIX / Cartão — boleto nunca é oferecido. */}
      <div
        role="radiogroup"
        aria-label="Forma de pagamento"
        className="mb-2 grid grid-cols-2 gap-1"
      >
        {methods.map((m) => {
          const active = method === m.value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isPending}
              onClick={() => chooseMethod(m.value)}
              className={cn(
                'rounded-[2px] border px-2 py-1.5 text-[11px] font-medium uppercase tracking-label transition-colors',
                active
                  ? 'border-teal-dark bg-teal-dark/5 text-teal-dark'
                  : 'border-border text-muted-foreground hover:border-teal-dark/40',
              )}
              data-testid={`method-${m.value}-${props.sku}`}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Parcelas (cartão): escolhidas pelo cliente no checkout do MP — aqui só
          informamos. O Checkout Pro não pré-trava o nº de parcelas. */}
      {canShowInstallments && method === 'CREDIT_CARD' ? (
        <p className="mb-2 text-center text-[11px] text-muted-foreground">
          parcele em até {maxInst}x sem juros no checkout
        </p>
      ) : null}

      <Button
        type="button"
        onClick={handleBuy}
        disabled={isPending}
        aria-busy={isPending}
        className="w-full bg-teal-dark text-white hover:bg-teal-dark/90"
        data-testid={`buy-${props.sku}`}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-3.5 animate-spin" />
            Criando cobrança…
          </>
        ) : (
          'Comprar'
        )}
      </Button>
    </div>
  )
}
