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
 * 4th button: Exportar PDF (server-side via Gotenberg/Chromium — Plan 26).
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
import { AnalysisStream } from './AnalysisStream'

// Mirrors AnaliseClient / parser.ts BOUNDARY_RE — best-effort UI counter
// for the regenerate progress card; the server parser stays authoritative.
const BOUNDARY_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][ \t]*/gmu

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
  const [sectionsReceived, setSectionsReceived] = useState(0)

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
      setSectionsReceived(0)
      try {
        const res = await fetch(`/api/readings/${readingId}/analyze`, { method: 'POST' })
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          const msg = detail.slice(0, 200) || `HTTP ${res.status}`
          toast.error(`Falha ao regenerar análise: ${msg}`)
          return
        }
        // Consume the stream and count `## N.` boundaries for the progress
        // card (mirrors AnaliseClient). The body continues server-side; the
        // route persists report_generated; router.refresh() re-reads it.
        const reader = res.body?.getReader()
        if (reader) {
          const decoder = new TextDecoder()
          let acc = ''
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            acc += decoder.decode(value, { stream: true })
            setSectionsReceived((acc.match(BOUNDARY_RE) ?? []).length)
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

  if (regenPending) {
    return <AnalysisStream sectionsReceived={sectionsReceived} />
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
