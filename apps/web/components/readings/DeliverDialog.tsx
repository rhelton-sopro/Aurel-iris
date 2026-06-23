'use client'

/**
 * DeliverDialog — confirmation dialog before terminal markReadingDelivered.
 * UI-SPEC §Surface 2 lines 142-147, §Destructive actions lines 161-164.
 *
 * Default focus on Cancel button per UI-SPEC contract (DialogContent initialFocus
 * prop maps to base-ui Popup.initialFocus — accepts RefObject<HTMLElement>).
 */
import { useRef } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface DeliverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}

export function DeliverDialog({ open, onOpenChange, onConfirm, pending }: DeliverDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} initialFocus={cancelRef}>
        <DialogHeader>
          <DialogTitle>Concluir leitura?</DialogTitle>
          <DialogDescription>
            Ao confirmar: a análise fica congelada e não poderá mais ser editada, o PDF é
            gerado e baixado pra este dispositivo, e o WhatsApp do cliente abre com uma mensagem
            pré-pronta — você só precisa anexar o PDF e enviar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Concluindo…' : 'Sim, concluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
