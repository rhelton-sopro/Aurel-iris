'use client'

/**
 * ReadingModeActions — top-of-page action buttons for reading-mode
 * (Plan 7.4-18 — UAT-3 UX flip).
 *
 * Mounted via ReportReadView.topActionsSlot prop on /leituras/[id] when the
 * report is ready. Manages 3 action paths:
 *   1. Editar análise — Link to /leituras/[id]/editar (preserved accordion)
 *   2. Entregar ao cliente — DeliverDialog → markReadingDelivered server action
 *   3. Regenerar análise — POST /api/readings/[id]/analyze + router.refresh
 *
 * Plan 19 will add a 4th button: Exportar PDF (server-side @react-pdf/renderer).
 *
 * Hidden states:
 *   - isDelivered=true → ALL action buttons hidden; only a small status text
 *     "Entregue ao cliente em <date>" rendered. To regenerate or edit a
 *     delivered reading, the therapist creates a new reading.
 *   - regenerationCount >= 3 → Regenerar disabled with tooltip
 *
 * Phase 7.4 | Plan 07.4-18 | UAT-3 UX flip
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil, Send, RefreshCw } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { cn } from '@/lib/utils'
import { DeliverDialog } from './DeliverDialog'
import { ExportPdfButton } from './ExportPdfButton'
import { markReadingDelivered } from '@/app/actions/analise'

export interface ReadingModeActionsProps {
  readingId: string
  regenerationCount: number
  isDelivered: boolean
  deliveredAt: string | null
}

export function ReadingModeActions({
  readingId,
  regenerationCount,
  isDelivered,
  deliveredAt,
}: ReadingModeActionsProps) {
  const router = useRouter()
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [deliverPending, setDeliverPending] = useState(false)
  const [regenPending, startRegenTransition] = useTransition()

  if (isDelivered) {
    // Plan 19: ExportPdfButton stays visible — therapist can re-export a
    // delivered reading at any time (PDF doesn't modify state).
    // Editar/Regenerar/Entregar are hidden because they DO modify state.
    return (
      <>
        <ExportPdfButton readingId={readingId} />
        <p
          className="text-sm text-muted-foreground"
          data-testid="reading-mode-delivered-status"
        >
          Entregue ao cliente
          {deliveredAt && (
            <>
              {' '}
              em <LocalDateTime iso={deliveredAt} />
            </>
          )}
        </p>
      </>
    )
  }

  const regenDisabled = regenerationCount >= 3 || regenPending
  const regenTooltip =
    regenerationCount >= 3
      ? 'Limite de 3 regenerações atingido. Edite manualmente para ajustar o relatório.'
      : null

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

  function onRegenerate() {
    startRegenTransition(async () => {
      try {
        const res = await fetch(`/api/readings/${readingId}/analyze`, { method: 'POST' })
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          const msg = detail.slice(0, 200) || `HTTP ${res.status}`
          toast.error(`Falha ao regenerar análise: ${msg}`)
          return
        }
        // Drain the stream — we don't show a progress UI here (the page
        // refresh below will pick up the new report). The fetch promise
        // resolves once the route handler returns headers; the body stream
        // continues server-side. router.refresh() will re-read once the
        // analyze route finishes persisting.
        const reader = res.body?.getReader()
        if (reader) {
          while (!(await reader.read()).done) {
            /* drain */
          }
        }
        toast.success('Análise regenerada. Atualizando…')
        router.refresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'desconhecido'
        toast.error(`Falha ao regenerar: ${msg}`)
      }
    })
  }

  const regenButton = (
    <Button
      type="button"
      variant="outline"
      onClick={onRegenerate}
      disabled={regenDisabled}
      className="gap-2"
      data-testid="reading-mode-regenerate"
      aria-label={`Regenerar análise (${regenerationCount}/3)`}
    >
      <RefreshCw className={cn('h-4 w-4', regenPending && 'animate-spin')} aria-hidden />
      {regenPending ? 'Regenerando…' : `Regenerar análise (${regenerationCount}/3)`}
    </Button>
  )

  return (
    <>
      <ExportPdfButton readingId={readingId} />

      <Link
        href={`/leituras/${readingId}/editar`}
        className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
        data-testid="reading-mode-edit"
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Editar análise
      </Link>

      <Button
        type="button"
        onClick={() => setDeliverOpen(true)}
        className="gap-2"
        data-testid="reading-mode-deliver"
      >
        <Send className="h-4 w-4" aria-hidden />
        Entregar ao cliente
      </Button>

      {regenTooltip ? (
        <TooltipProvider>
          <Tooltip>
            {/* base-ui uses `render` prop (not Radix `asChild`); span wrapper
                because disabled buttons don't fire mouse events. */}
            <TooltipTrigger render={<span />}>{regenButton}</TooltipTrigger>
            <TooltipContent>{regenTooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        regenButton
      )}

      <DeliverDialog
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
        onConfirm={onDeliverConfirm}
        pending={deliverPending}
      />
    </>
  )
}
