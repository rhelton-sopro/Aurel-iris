'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { saveReportDelivered, markReadingDelivered } from '@/app/actions/analise'
import { EditorAccordion } from '@/components/readings/EditorAccordion'
import { EditorAuditBanner } from '@/components/readings/EditorAuditBanner'
import { DeliverDialog } from '@/components/readings/DeliverDialog'
import { FullReportCopyBlock } from '@/components/readings/FullReportCopyBlock'
import type { AuditMetadata } from '@/lib/anthropic/types'

export interface EditarClientProps {
  readingId: string
  reportGenerated: Record<string, string>
  reportDelivered: Record<string, string> | null
  auditMetadata: AuditMetadata | null
  isDelivered: boolean
  /** Autoexame: esconde "Entregar ao cliente" (terapeuta = cliente). */
  isSelfReading?: boolean
  /** Nome do cliente — usado no greeting do WhatsApp. */
  clientName?: string
  /** Telefone do cliente — opcional; sem ele, abre WhatsApp sem destinatário. */
  clientPhone?: string | null
}

export function EditarClient({
  readingId,
  reportGenerated,
  reportDelivered: initialDelivered,
  auditMetadata,
  isDelivered,
  isSelfReading = false,
  clientName,
  clientPhone,
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
      // Se tem edição local não salva, persiste primeiro — senão server cai
      // no fallback report_generated e o trabalho do terapeuta seria descartado.
      if (editedCount > 0) {
        const saveResult = await saveReportDelivered(readingId, delivered)
        if (saveResult.error) {
          toast.error(`Falha ao salvar antes de concluir: ${saveResult.error}`)
          return
        }
      }
      const result = await markReadingDelivered(readingId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDeliverOpen(false)

      toast.success('Leitura concluída. Gerando PDF…')
      try {
        const res = await fetch(`/api/readings/${readingId}/pdf`, { method: 'GET' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const cd = res.headers.get('Content-Disposition')
        const m = cd?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/)
        const filename = m ? decodeURIComponent(m[1]!.replace(/^"|"$/g, '')) : `leitura-${readingId}.pdf`
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 500)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'desconhecido'
        toast.error(`PDF não baixou: ${msg}. Acesse a leitura e use Exportar PDF.`)
        router.refresh()
        return
      }

      const greeting = clientName ? `Olá, ${clientName}!` : 'Olá!'
      const waMsg = `${greeting}\n\nSegue em anexo o relatório da sua leitura iridológica. Qualquer dúvida estou à disposição.`
      const phoneDigits = clientPhone?.replace(/\D/g, '') ?? ''
      const waUrl = phoneDigits
        ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(waMsg)}`
      window.open(waUrl, '_blank', 'noopener,noreferrer')

      toast.success('PDF baixado. WhatsApp aberto — anexe o arquivo e envie.')
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
          Leitura concluída — somente leitura.
        </p>
      )}

      <EditorAccordion
        reportGenerated={reportGenerated}
        reportDelivered={delivered}
        onSectionChange={onSectionChange}
        readOnly={isDelivered}
      />

      <FullReportCopyBlock reportDelivered={delivered} />

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
              {!isSelfReading && (
                <Button variant="default" onClick={() => setDeliverOpen(true)}>
                  Concluir leitura
                </Button>
              )}
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
