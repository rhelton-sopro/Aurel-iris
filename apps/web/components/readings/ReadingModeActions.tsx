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
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil, Send, RefreshCw, Loader2 } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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

// Mirrors AnaliseClient / parser.ts BOUNDARY_RE — best-effort UI counter
// for the regenerate progress card; the server parser stays authoritative.
const BOUNDARY_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][ \t]*/gmu

export interface ReadingModeActionsProps {
  readingId: string
  regenerationCount: number
  isDelivered: boolean
  deliveredAt: string | null
  /** Autoexame (terapeuta = cliente): esconde "Entregar ao cliente". */
  isSelfReading?: boolean
  /** Nome do cliente — usado no greeting do WhatsApp deeplink. */
  clientName?: string
  /** Telefone do cliente (E.164 ou só dígitos) — opcional; sem ele, abre WhatsApp sem destinatário. */
  clientPhone?: string | null
}

export function ReadingModeActions({
  readingId,
  regenerationCount,
  isDelivered,
  deliveredAt,
  isSelfReading = false,
  clientName,
  clientPhone,
}: ReadingModeActionsProps) {
  const router = useRouter()
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [deliverPending, setDeliverPending] = useState(false)
  // v2.9.0 (2026-05-27): trocado useTransition por useState pra regen
  // pending. useTransition + async/await na stream fetch (2-3min) deixa
  // isPending=false durante o await em React 19 — UI nunca renderizava o
  // AnalysisStream. Pattern de useState explícito é o mesmo já provado em
  // analise-client.tsx:62 (handleTrigger usa setStreaming + try/finally).
  const [regenPending, setRegenPending] = useState(false)
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
      // 1. Marca como entregue (flipa is_delivered, congela report_delivered).
      const result = await markReadingDelivered(readingId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDeliverOpen(false)

      // 2. Gera + baixa o PDF (Gotenberg/Chromium → /api/readings/[id]/pdf).
      toast.success('Análise entregue. Gerando PDF…')
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
        toast.error(`PDF não baixou: ${msg}. Use o botão Exportar PDF para baixar novamente.`)
        router.refresh()
        return
      }

      // 3. Abre WhatsApp com mensagem pré-pronta pro telefone do cliente.
      //    PDF não anexa via deeplink — terapeuta arrasta o arquivo baixado no chat.
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

  async function onRegenerate() {
    if (regenPending) return // double-click guard (mirror analise-client.tsx:67)
    setRegenPending(true)
    setSectionsReceived(0)
    // Toast imediato — feedback instantâneo no canto inferior direito (não
    // depende de re-render do componente). Memory: usuário relatou clicar
    // sem feedback visual perceptível na estratégia anterior (substituir
    // botões por AnalysisStream); 3 sinais simultâneos agora: toast aqui +
    // botão disabled+spinner + banner sticky no topo (renderizado abaixo).
    toast.info('Regeneração iniciada — costuma levar 2-3 minutos.')
    try {
      const res = await fetch(`/api/readings/${readingId}/analyze`, { method: 'POST' })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        const msg = detail.slice(0, 200) || `HTTP ${res.status}`
        toast.error(`Falha ao regenerar análise: ${msg}`)
        return
      }
      // Consume the stream and count `## N.` boundaries for the progress
      // banner (mirrors AnaliseClient). The body continues server-side; the
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
    } finally {
      setRegenPending(false)
    }
  }

  // v2.9.0 (2026-05-27): banner sticky visível DURANTE regen — substitui
  // a estratégia anterior (early-return que trocava botões por
  // AnalysisStream). Razão: founder relatou clicar e não ver feedback —
  // provável que o card de progresso renderizava no slot dos botões (topo
  // direito da página) mas founder estava lendo §0 mais embaixo. Banner
  // fixed top funciona qualquer scroll position.
  const regenBanner = regenPending ? (
    <div
      className="fixed inset-x-0 top-0 z-[60] border-b border-teal-dark bg-teal-dark px-4 py-2.5 text-white shadow-md"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span className="shrink-0 text-sm font-medium">
          Regenerando análise — {sectionsReceived}/15 seções
        </span>
        <Progress
          value={Math.round((Math.min(15, sectionsReceived) / 15) * 100)}
          aria-label="Progresso da regeneração"
          className="h-1 flex-1 bg-white/20 [&>*]:bg-white"
        />
        <span className="shrink-0 text-xs opacity-90">~2-3 min</span>
      </div>
    </div>
  ) : null

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
      {regenBanner}

      <ExportPdfButton readingId={readingId} />

      <Link
        href={`/leituras/${readingId}/editar`}
        className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
        data-testid="reading-mode-edit"
        aria-disabled={regenPending}
        tabIndex={regenPending ? -1 : undefined}
        onClick={(e) => {
          if (regenPending) e.preventDefault()
        }}
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Editar análise
      </Link>

      {!isSelfReading && (
        <Button
          type="button"
          onClick={() => setDeliverOpen(true)}
          disabled={regenPending}
          className="gap-2"
          data-testid="reading-mode-deliver"
        >
          <Send className="h-4 w-4" aria-hidden />
          Entregar ao cliente
        </Button>
      )}

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
