'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { discardReadingsAction } from '@/app/actions/readings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteReadingDialogProps {
  readingIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteReadingDialog({
  readingIds,
  open,
  onOpenChange,
  onDeleted,
}: DeleteReadingDialogProps) {
  const [isPending, startTransition] = useTransition()
  const n = readingIds.length
  const plural = n > 1

  function handleDelete() {
    startTransition(async () => {
      const result = await discardReadingsAction(readingIds)
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
            {plural ? `Excluir ${n} leituras` : 'Excluir leitura'}
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita.{' '}
            {plural
              ? `As ${n} leituras selecionadas, suas fotos de íris e análises geradas serão removidas permanentemente.`
              : 'A leitura, suas fotos de íris e a análise gerada serão removidas permanentemente.'}
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
