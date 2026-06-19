'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Coins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { grantCreditsAction } from '@/app/actions/admin-therapists'

export interface CreditPackageOption {
  sku: string
  name: string
  leituras_count: number
  price_brl: number
}

interface GrantCreditsDialogProps {
  therapistId: string
  email: string
  fullName: string
  packages: CreditPackageOption[]
}

/**
 * Crédito manual de leituras (stopgap InfinitePay enquanto o cartão Asaas está
 * sob análise — chamado #1285903). Founder escolhe o pacote que o terapeuta pagou
 * via link InfinitePay e credita na hora; validade de 12 meses, igual a uma
 * compra confirmada pelo webhook.
 */
export function GrantCreditsDialog({
  therapistId,
  email,
  fullName,
  packages,
}: GrantCreditsDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [sku, setSku] = React.useState(packages[0]?.sku ?? '')
  const [ref, setRef] = React.useState('')
  const [isPending, startTransition] = useTransition()

  const selected = packages.find((p) => p.sku === sku)

  function handleOpenChange(next: boolean) {
    if (!next && !isPending) {
      setRef('')
      setSku(packages[0]?.sku ?? '')
    }
    setOpen(next)
  }

  function handleGrant() {
    if (isPending || !sku) return
    startTransition(async () => {
      const result = await grantCreditsAction(therapistId, sku, ref)
      if (result.ok) {
        const ate = result.expiresAt
          ? new Date(result.expiresAt).toLocaleDateString('pt-BR')
          : ''
        toast.success(
          `+${result.leituras} leituras creditadas a ${email} (válido até ${ate}).`,
        )
        setOpen(false)
        setRef('')
      } else {
        toast.error(result.error ?? 'Falha ao creditar.')
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label={`Creditar leituras para ${email}`}
        title="Creditar leituras (pagamento manual)"
      >
        <Coins className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Creditar leituras</DialogTitle>
            <DialogDescription>
              Crédito manual (ex.: pagamento via link InfinitePay). Cria um pacote
              ativo na hora, válido por 12 meses.
            </DialogDescription>
          </DialogHeader>

          <div className="text-sm">
            <p>
              <strong className="text-foreground">{fullName}</strong>{' '}
              <span className="font-mono text-xs text-muted-foreground">
                ({email})
              </span>
            </p>
          </div>

          <div className="space-y-1.5 pt-2">
            <label htmlFor="grant-pkg" className="block text-xs text-muted-foreground">
              Pacote pago
            </label>
            <select
              id="grant-pkg"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              disabled={isPending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {packages.length === 0 && <option value="">(nenhum pacote ativo)</option>}
              {packages.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.name} — {p.leituras_count} leituras (R$ {p.price_brl})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="grant-ref" className="block text-xs text-muted-foreground">
              Referência InfinitePay{' '}
              <span className="text-muted-foreground/60">(opcional — id/NSU da cobrança)</span>
            </label>
            <input
              id="grant-ref"
              type="text"
              autoComplete="off"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              disabled={isPending}
              placeholder="ex: NSU 123456"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {selected && (
            <p className="text-xs text-muted-foreground">
              Vai creditar <strong className="text-foreground">{selected.leituras_count} leituras</strong>{' '}
              ativas, válidas por 12 meses a partir de hoje.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleGrant} disabled={isPending || !sku} aria-busy={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creditando…
                </>
              ) : (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  Creditar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
