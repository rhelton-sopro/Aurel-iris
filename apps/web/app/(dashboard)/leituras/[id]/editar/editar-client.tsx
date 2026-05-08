'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { saveReportDelivered, markReadingDelivered } from '@/app/actions/analise'
import { EditorAccordion } from '@/components/readings/EditorAccordion'
import { EditorAuditBanner } from '@/components/readings/EditorAuditBanner'
import { DeliverDialog } from '@/components/readings/DeliverDialog'
import type { AuditMetadata } from '@/lib/anthropic/types'

export interface EditarClientProps {
  readingId: string
  reportGenerated: Record<string, string>
  reportDelivered: Record<string, string> | null
  auditMetadata: AuditMetadata | null
  isDelivered: boolean
}

export function EditarClient({
  readingId,
  reportGenerated,
  reportDelivered: initialDelivered,
  auditMetadata,
  isDelivered,
}: EditarClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deliverPending, setDeliverPending] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)

  // Local mutable state of delivered text per section.
  // Initial: report_delivered if exists; else report_generated.
  const [delivered, setDelivered] = useState<Record<string, string>>(() => {
    const base = initialDelivered ?? reportGenerated
    return { ...base }
  })

  function onSectionChange(key: string, value: string) {
    setDelivered((prev) => ({ ...prev, [key]: value }))
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveReportDelivered(readingId, delivered)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Edição salva. Você pode continuar revisando.')
      router.refresh()
    })
  }

  async function onDeliverConfirm() {
    setDeliverPending(true)
    try {
      const result = await markReadingDelivered(readingId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Análise entregue. O cliente pode receber o relatório.')
      setDeliverOpen(false)
      router.refresh()
    } finally {
      setDeliverPending(false)
    }
  }

  const editedCount = Object.entries(delivered).filter(
    ([k, v]) => k !== 'encerramento_disclaimer' && v !== (reportGenerated[k] ?? ''),
  ).length

  return (
    <div className="space-y-6">
      <EditorAuditBanner auditMetadata={auditMetadata} />

      {isDelivered && (
        <p className="rounded-md border bg-muted px-4 py-3 text-sm">
          Análise entregue ao cliente — somente leitura.
        </p>
      )}

      <EditorAccordion
        reportGenerated={reportGenerated}
        reportDelivered={delivered}
        onSectionChange={onSectionChange}
        readOnly={isDelivered}
      />

      {!isDelivered && (
        <div className="sticky bottom-0 -mx-6 border-t bg-background/95 backdrop-blur px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto">
            <p className="text-sm text-muted-foreground">
              {editedCount} {editedCount === 1 ? 'seção editada' : 'seções editadas'}
            </p>
            <div className="flex gap-2">
              <Button variant="default" onClick={onSave} disabled={pending}>
                {pending ? 'Salvando…' : 'Salvar edição'}
              </Button>
              <Button variant="default" onClick={() => setDeliverOpen(true)}>
                Entregar ao cliente
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeliverDialog
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
        onConfirm={onDeliverConfirm}
        pending={deliverPending}
      />
    </div>
  )
}
