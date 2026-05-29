'use client'

// Botão + modal de arrependimento CDC 7d (D-13). Só renderiza se computeRefundValue
// considerar o pacote elegível (dentro de 7d + saldo refundável). O cálculo client
// é DISPLAY-ONLY: refundPackageAction (08-06) RE-computa server-side (T-08-11-03);
// nunca confiar no valor do client.
//
// Design: tokens semânticos NEUTROS + teal/destructive explícito; rounded-[2px];
// <Button> do projeto. Sem prose-* (Tailwind v4).

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { refundPackageAction } from '@/app/actions/billing'
import { computeRefundValue } from '@/lib/billing/refund-policy'

interface Props {
  creditId: string
  purchaseDate: string
  priceBrl: number
  leiturasPurchased: number
  leiturasRemaining: number
  leiturasReserved: number
  status: string
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function RefundPackageButton(props: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const policy = computeRefundValue({
    purchase_date: props.purchaseDate,
    price_brl: props.priceBrl,
    leituras_purchased: props.leiturasPurchased,
    leituras_remaining: props.leiturasRemaining,
    leituras_reserved: props.leiturasReserved,
    status: props.status,
  })

  if (!policy.eligible) return null // botão só aparece se elegível

  function handleConfirm() {
    startTransition(async () => {
      const r = await refundPackageAction({ credit_id: props.creditId })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(
        `Reembolso solicitado — R$ ${formatBrl(r.refunded_value_brl)} (${
          r.kind === 'total' ? 'integral' : 'proporcional'
        })`,
      )
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="xs"
        onClick={() => setOpen(true)}
        className="text-[#B23A2B] hover:text-[#8f2e22]"
      >
        Solicitar reembolso (arrependimento 7d)
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-[2px] border border-border bg-background p-5">
            <h3 className="text-lg font-semibold text-ink">
              Solicitar reembolso
            </h3>
            <p className="text-sm text-foreground">
              {policy.kind === 'total' ? (
                <>
                  Você terá um reembolso{' '}
                  <strong>integral de R$ {formatBrl(policy.value_brl)}</strong>{' '}
                  via o método original (mesmo trajeto da compra).
                </>
              ) : (
                <>
                  Você terá um reembolso{' '}
                  <strong>
                    proporcional de R$ {formatBrl(policy.value_brl)}
                  </strong>{' '}
                  ({policy.leituras_to_refund} leituras restantes × R${' '}
                  {formatBrl(policy.unit_price_brl)}).
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              O crédito será zerado imediatamente. O valor cai na sua conta
              original em até 5 dias úteis (PIX ≤ 1d; cartão 5d).
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirm}
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending ? 'Processando…' : 'Confirmar reembolso'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
