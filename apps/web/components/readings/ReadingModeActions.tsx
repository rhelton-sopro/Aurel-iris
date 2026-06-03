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
  /**
   * v2.9.0: análise rodando no SERVIDOR neste momento (analysis_started_at
   * dentro da janela de 5min sem analysis_completed_at). Server-side gate
   * já bloqueia POST duplicado; este flag faz a UI refletir o estado quando
   * o terapeuta navegou pra fora durante regen e voltou (state local
   * regenPending=false mas regen continua rodando). Quando true: banner
   * fica visível com progresso indeterminado, botões disabled.
   */
  isAnalysisInProgress?: boolean
  /**
   * Regen só pro founder (2026-06-03): o "Regenerar análise" foi removido do
   * terapeuta. Como não há mais segunda chance e a foto é apagada na geração,
   * o resgate de relatório incompleto é manual, via founder (aqui ou em
   * /admin/regenerar). Não-founder nunca vê o botão; o gate (e) do
   * /analyze reforça no servidor.
   */
  isFounder?: boolean
}

export function ReadingModeActions({
  readingId,
  regenerationCount,
  isDelivered,
  deliveredAt,
  isSelfReading = false,
  clientName,
  clientPhone,
  isAnalysisInProgress = false,
  isFounder = false,
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

  // v2.9.0: regenDisabled inclui isAnalysisInProgress (server-side regen
  // detectada via RSC) pra evitar 409 quando founder volta numa página com
  // regen rodando. busy = regenPending (stream local ativo) || server-side
  // regen detectada. Banner+disable estados refletem ambos.
  const regenServerOrLocal = regenPending || isAnalysisInProgress
  // Cap = 1 geração original + 1 regen grátis (founder 2026-05-29, commit 1de47fc).
  // regeneration_count conta gerações TOTAIS (1 após a original), então o gate é
  // count >= 2 — espelha o backend (analyze/route.ts) e o AnalysisCTA. Antes este
  // componente divergia em >= 3 (mostrava n/3 mas o backend bloqueava em 2).
  const regensUsed = Math.max(0, regenerationCount - 1)
  const regenDisabled = regenerationCount >= 2 || regenServerOrLocal
  const regenTooltip =
    regenerationCount >= 2
      ? 'Você já usou a regeneração desta leitura. Para um novo relatório, faça uma nova leitura (novas fotos).'
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
        // 402 = sem créditos. Estado de saldo, não erro de sistema.
        if (res.status === 402) {
          toast.error('Sem créditos para regenerar este relatório.')
          return
        }
        // Distingue 5xx da PLATAFORMA / "já em andamento" de erro real de app.
        // Regen longa (~2-3min): a plataforma corta a conexão em ~300s e devolve
        // 5xx mesmo rodando OK server-side (Fluid Compute continua). NÃO é falha
        // → reconcilia via refresh; o RSC decide pelo estado autoritativo
        // (isAnalysisInProgress → banner "regenerando" + auto-refresh). Espelha
        // analise-client.tsx:87-113 (mesma lógica do handleTrigger da geração).
        let appMsg: string | null = null
        let inflight = false
        try {
          const j = (await res.clone().json()) as {
            error?: string
            message?: string
            retry_after_seconds?: number
          }
          appMsg = j.message ?? j.error ?? null
          if (j.retry_after_seconds != null) inflight = true // gate "already running"
        } catch {
          // corpo não-JSON (página 5xx da plataforma) — trata como 5xx abaixo.
        }
        if (res.status >= 500 || inflight) {
          toast.info('A regeneração está rodando no servidor — esta página atualiza sozinha quando terminar.')
          router.refresh()
          return
        }
        toast.error(`Falha ao regenerar análise: ${appMsg ?? `HTTP ${res.status}`}`)
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
      // O stream caiu (iOS bg-kill ao trocar de app — ex.: abrir o WhatsApp e
      // voltar —, aba fechada, network drop, OU a plataforma cortou a conexão
      // longa). A regeneração CONTINUA server-side (Fluid Compute). NÃO é falha
      // real → reconcilia via refresh; o RSC decide pelo estado autoritativo
      // (isAnalysisInProgress → banner "regenerando" + auto-refresh, OU o
      // relatório novo se já completou). Antes gritava "Falha ao regenerar"
      // (falso) — exatamente o caso iPhone → WhatsApp → volta.
      const msg = err instanceof Error ? err.message : 'desconhecido'
      console.error('[regen] stream error', msg)
      toast.info('Conexão do stream caiu — a regeneração continua no servidor. Atualizando…')
      router.refresh()
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
  //
  // Dois modos:
  // 1. regenPending=true: founder clicou regen NESTA sessão de página,
  //    stream local ativo → mostra contagem N/15 real.
  // 2. !regenPending && isAnalysisInProgress=true: regen rodando server-
  //    side mas founder navegou pra fora e voltou (sem stream local) →
  //    mostra progresso INDETERMINADO ("aguarde 2-3 min"). RSC auto-
  //    refresh polla a cada 4s e quando completar, recarrega o conteúdo.
  const regenBanner = regenServerOrLocal ? (
    <div
      className="fixed inset-x-0 top-0 z-[60] border-b border-teal-dark bg-teal-dark px-4 py-2.5 text-white shadow-md"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        {regenPending ? (
          <>
            <span className="shrink-0 text-sm font-medium">
              Regenerando análise — {sectionsReceived}/15 seções
            </span>
            <Progress
              value={Math.round((Math.min(15, sectionsReceived) / 15) * 100)}
              aria-label="Progresso da regeneração"
              className="h-1 flex-1 bg-white/20 [&>*]:bg-white"
            />
            <span className="shrink-0 text-xs opacity-90">~2-3 min</span>
          </>
        ) : (
          <>
            <span className="shrink-0 text-sm font-medium">
              Análise sendo regenerada no servidor
            </span>
            <Progress
              value={null}
              aria-label="Análise em andamento"
              className="h-1 flex-1 animate-pulse bg-white/20 [&>*]:bg-white"
            />
            <span className="shrink-0 text-xs opacity-90">
              Atualiza sozinho quando terminar
            </span>
          </>
        )}
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
      aria-label={`Regenerar análise (${regensUsed}/1)`}
    >
      <RefreshCw className={cn('h-4 w-4', regenServerOrLocal && 'animate-spin')} aria-hidden />
      {regenServerOrLocal ? 'Regenerando…' : `Regenerar análise (${regensUsed}/1)`}
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
        aria-disabled={regenServerOrLocal}
        tabIndex={regenServerOrLocal ? -1 : undefined}
        onClick={(e) => {
          if (regenServerOrLocal) e.preventDefault()
        }}
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Editar análise
      </Link>

      {!isSelfReading && (
        <Button
          type="button"
          onClick={() => setDeliverOpen(true)}
          disabled={regenServerOrLocal}
          className="gap-2"
          data-testid="reading-mode-deliver"
        >
          <Send className="h-4 w-4" aria-hidden />
          Entregar ao cliente
        </Button>
      )}

      {/* Regen só pro founder (2026-06-03): o terapeuta não regenera mais. */}
      {isFounder &&
        (regenTooltip ? (
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
        ))}

      <DeliverDialog
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
        onConfirm={onDeliverConfirm}
        pending={deliverPending}
      />
    </>
  )
}
