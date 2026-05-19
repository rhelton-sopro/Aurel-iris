'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
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
import { deleteTherapistAction } from '@/app/actions/admin-therapists'

interface DeleteTherapistDialogProps {
  therapistId: string
  email: string
  fullName: string
  clientsCount: number
  readingsCount: number
}

export function DeleteTherapistDialog({
  therapistId,
  email,
  fullName,
  clientsCount,
  readingsCount,
}: DeleteTherapistDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState('')
  const [isPending, startTransition] = useTransition()

  const canSubmit =
    !isPending && confirm.trim().toLowerCase() === email.toLowerCase()

  function handleOpenChange(next: boolean) {
    if (!next && !isPending) setConfirm('')
    setOpen(next)
  }

  function handleDelete() {
    if (!canSubmit) return
    startTransition(async () => {
      const result = await deleteTherapistAction(therapistId, confirm)
      if (result.ok) {
        toast.success(`${email} excluído.`)
        setOpen(false)
        setConfirm('')
      } else {
        toast.error(result.error ?? 'Falha ao excluir.')
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
        aria-label={`Excluir ${email}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir terapeuta</DialogTitle>
            <DialogDescription>
              Ação irreversível — remove conta, dados, clientes, leituras e
              fotos.
            </DialogDescription>
          </DialogHeader>

          <div className="text-sm">
            <p>
              <strong className="text-foreground">{fullName}</strong>{' '}
              <span className="font-mono text-xs text-muted-foreground">
                ({email})
              </span>
            </p>
            <ul className="mt-2 text-foreground/80 list-disc pl-5 space-y-0.5">
              <li>Conta de acesso e perfil</li>
              <li>
                {clientsCount} cliente{clientsCount === 1 ? '' : 's'} cadastrado
                {clientsCount === 1 ? '' : 's'}
              </li>
              <li>
                {readingsCount} leitura{readingsCount === 1 ? '' : 's'} e todas
                as fotos no storage
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Logs de consentimento ficam anonimizados (LGPD).
            </p>
          </div>

          <div className="space-y-1.5 pt-2">
            <label
              htmlFor="confirm-email"
              className="block text-xs text-muted-foreground"
            >
              Digite o email{' '}
              <span className="font-mono text-foreground/80">{email}</span> para
              confirmar:
            </label>
            <input
              id="confirm-email"
              type="email"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={isPending}
              placeholder={email}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!canSubmit}
              aria-busy={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                'Excluir definitivamente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
