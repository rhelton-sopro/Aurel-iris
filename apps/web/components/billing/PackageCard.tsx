'use client'

// Card de um SKU de crédito (D-22). Client component porque dispara
// createChargeAction (08-06) num useTransition e redireciona o navegador
// pro hosted checkout do Asaas (invoice_url).
//
// Design: tokens semânticos NEUTROS (border-border / bg-card / text-muted-foreground)
// + teal SEMPRE explícito por elemento (memory feedback_design_tokens_semantic_neutral).
// Cantos quase-quadrados (rounded-[2px]) e botão via <Button> do projeto pra
// herdar o idioma uppercase tracking-label da marca.

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { createChargeAction } from '@/app/actions/billing'
import { cn } from '@/lib/utils'

interface Props {
  sku: 'avulsa' | 'pequeno' | 'medio' | 'grande'
  name: string
  leiturasCount: number
  priceBrl: number
  pricePerUnit: number
  /** Economia total em R$ vs comprar tudo como Avulsa. 0 pra avulsa. */
  savingsBrl: number
  badge?: 'mais_escolhido' | 'melhor_valor' | null
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

  function handleBuy() {
    startTransition(async () => {
      const r = await createChargeAction({ sku: props.sku })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Cobrança criada — redirecionando…')
      // Redirect pro hosted checkout do Asaas (PIX / cartão / boleto).
      window.location.href = r.invoice_url
    })
  }

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
