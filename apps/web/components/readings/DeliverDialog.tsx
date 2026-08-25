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
  /**
   * Títulos dos blocos que vão no PDF do cliente, na ordem. Mostrados na
   * confirmação para que o terapeuta veja o que está entregando ANTES de
   * congelar a leitura — a seleção é feita noutro botão, e sem esta lista ele
   * confirmava no escuro.
   */
  blocosIncluidos?: string[]
}

export function DeliverDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  blocosIncluidos,
}: DeliverDialogProps) {
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
          {/* O aviso dizia "congelada" e parava aí. A consequência prática —
              refazer exige leitura nova, fotos novas e outro crédito — é
              exatamente o que decide se ele conclui agora ou revisa mais uma vez. */}
          <DialogDescription>
            Depois disso, corrigir qualquer coisa exige uma{' '}
            <strong>nova leitura</strong>: fotos novas e 1 crédito.
          </DialogDescription>
        </DialogHeader>
        {blocosIncluidos && blocosIncluidos.length > 0 && (
          <div className="rounded-[2px] border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">
              O PDF do cliente vai com {blocosIncluidos.length}{' '}
              {blocosIncluidos.length === 1 ? 'bloco' : 'blocos'}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-foreground">
              {blocosIncluidos.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          </div>
        )}
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
