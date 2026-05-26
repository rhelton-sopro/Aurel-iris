'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { deleteClientsAction } from '@/app/actions/clients'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteClientDialogProps {
  /** IDs dos clientes a apagar — aceita 1+ pra suportar bulk delete. */
  clientIds: string[]
  /** Nome do único cliente quando clientIds.length === 1 — pra mostrar
   *  "Todos os dados de **Maria** serão removidos". Ignorado em batch. */
  singleClientName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteClientDialog({
  clientIds,
  singleClientName,
  open,
  onOpenChange,
  onDeleted,
}: DeleteClientDialogProps) {
  const [isPending, startTransition] = useTransition()
  const n = clientIds.length
  const plural = n > 1

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClientsAction(clientIds)
      if (!result?.error) {
        onDeleted?.()
        onOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {plural ? `Excluir ${n} clientes` : 'Excluir cliente'}
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita.{' '}
            {plural ? (
              <>
                Os {n} clientes selecionados, suas leituras, fotos de íris e
                análises serão removidos permanentemente conforme a LGPD.
              </>
            ) : singleClientName ? (
              <>
                Todos os dados de <strong>{singleClientName}</strong>, suas
                leituras, fotos de íris e análises serão removidos
                permanentemente conforme a LGPD.
              </>
            ) : (
              <>
                O cliente, suas leituras, fotos de íris e análises serão
                removidos permanentemente conforme a LGPD.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : plural ? (
              `Excluir ${n}`
            ) : (
              'Excluir'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
