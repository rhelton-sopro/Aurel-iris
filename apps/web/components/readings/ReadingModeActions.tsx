'use client'

/**
 * ReadingModeActions — top-of-page action buttons for reading-mode
 * (Plan 7.4-18 — UAT-3 UX flip).
 *
 * Mounted via ReportReadView.topActionsSlot prop on /leituras/[id] when the
 * report is ready. Manages 2 action paths:
 *   1. Editar análise — Link to /leituras/[id]/editar (preserved accordion)
 *   2. Entregar ao cliente — DeliverDialog → markReadingDelivered server action
 *
 * Plus the PDF exports (server-side via Gotenberg/Chromium — Plan 26).
 *
 * ⛔ "Regenerar análise" SAIU DAQUI (founder, 2026-08-03). Era founder-only e a última
 * porta de UI para o POST /analyze de uma leitura que já tem relatório. A rota continua
 * existindo — é a mesma que gera pela primeira vez — e o resgate manual segue por
 * /admin/regenerar. O banner de "análise rodando no servidor" FICA: ele reflete estado
 * do servidor (uma geração em curso), não o botão que sumiu.
 *
 * Hidden states:
 *   - isDelivered=true → ALL action buttons hidden; only a small status text
 *     "Entregue ao cliente em <date>" rendered. To edit a delivered reading,
 *     the therapist creates a new reading.
 *
 * Phase 7.4 | Plan 07.4-18 | UAT-3 UX flip
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil, Send, Loader2 } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { cn } from '@/lib/utils'
import { DeliverDialog } from './DeliverDialog'
import { ExportPdfButton } from './ExportPdfButton'
import { VersaoClienteButton } from './VersaoClienteButton'
import { AntigoRelatorioButton } from './AntigoRelatorioButton'
import { markReadingDelivered } from '@/app/actions/analise'

export interface ReadingModeActionsProps {
  readingId: string
  isDelivered: boolean
  deliveredAt: string | null
  /** Autoexame (terapeuta = cliente): esconde "Concluir leitura". */
  isSelfReading?: boolean
  /** Nome do cliente — usado no greeting do WhatsApp deeplink. */
  clientName?: string
  /** Telefone do cliente (E.164 ou só dígitos) — opcional; sem ele, abre WhatsApp sem destinatário. */
  clientPhone?: string | null
  /**
   * v2.9.0: análise rodando no SERVIDOR neste momento (analysis_started_at
   * dentro da janela de 5min sem analysis_completed_at). Server-side gate
   * já bloqueia POST duplicado; este flag faz a UI refletir o estado quando
   * o terapeuta abriu a página no meio de uma geração. Quando true: banner
   * fica visível com progresso indeterminado, botões disabled.
   */
  isAnalysisInProgress?: boolean
  /**
   * Títulos dos blocos do Mapa do Ser, na ordem de exibição — vêm do MOTOR, via server
   * component (`lib/emocional/render` é server-only). Alimentam as caixinhas da versão
   * do cliente.
   */
  titulosBlocos?: string[]
  /**
   * Esta leitura tem MAPA DO SER (o relatório principal desde 2026-07-30).
   * Quando true, a página exibe o Mapa do Ser e o Dossiê vira "antigo relatório".
   */
  temMapa?: boolean
  /**
   * Esta leitura tem DOSSIÊ (`report_generated`). Leituras anteriores a
   * 2026-07-30 têm só ele — e continuam exatamente como estavam.
   */
  temDossie?: boolean
}

export function ReadingModeActions({
  readingId,
  isDelivered,
  deliveredAt,
  isSelfReading = false,
  clientName,
  clientPhone,
  isAnalysisInProgress = false,
  titulosBlocos = [],
  temMapa = false,
  temDossie = true,
}: ReadingModeActionsProps) {
  const router = useRouter()
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [deliverPending, setDeliverPending] = useState(false)

  if (isDelivered) {
    // Plan 19: ExportPdfButton stays visible — therapist can re-export a
    // delivered reading at any time (PDF doesn't modify state).
    // Editar/Entregar are hidden because they DO modify state.
    return (
      <>
        {temMapa ? (
          <>
            <ExportPdfButton
              readingId={readingId}
              variant="emocional"
              label="Mapa do Ser (PDF)"
            />
            <VersaoClienteButton readingId={readingId} titulos={titulosBlocos} />
            {temDossie && <AntigoRelatorioButton readingId={readingId} jaExiste />}
          </>
        ) : (
          <>
            <ExportPdfButton readingId={readingId} label="Dossiê (PDF)" />
            <ExportPdfButton
              readingId={readingId}
              variant="client"
              label="Versão do cliente (PDF)"
            />
          </>
        )}
        <p
          className="text-sm text-muted-foreground"
          data-testid="reading-mode-delivered-status"
        >
          Leitura concluída
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
      toast.success('Leitura concluída. Gerando PDF…')
      try {
        // O PDF que vai pro cliente é o do relatório DELE. Numa leitura nova isso é
        // o Mapa do Ser; pedir `/pdf` aqui buscaria o Dossiê e devolveria 409 "Report
        // not ready" em toda leitura nova.
        // Sem `blocos=`: a conclusão entrega a seleção PADRÃO. Escolher bloco a bloco
        // é o caminho do "Versão do cliente", onde ele vê o que está marcando.
        const pdfUrl = temMapa
          ? `/api/readings/${readingId}/emocional/pdf?variant=client`
          : `/api/readings/${readingId}/pdf`
        const res = await fetch(pdfUrl, { method: 'GET' })
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

  // v2.9.0 (2026-05-27): banner sticky enquanto a análise roda no SERVIDOR — a página
  // pode ter sido aberta no meio de uma geração (o RSC detecta por
  // analysis_started_at sem completed_at) e o AutoRefresh recarrega quando terminar.
  //
  // Desde 2026-08-03 este é o único modo: o botão de regenerar saiu, então não existe
  // mais stream local aqui para contar seções. Progresso indeterminado, que é o honesto
  // — quem tem a contagem real é a tela de geração (AnalysisStream).
  const regenBanner = isAnalysisInProgress ? (
    <div
      className="fixed inset-x-0 top-0 z-[60] border-b border-teal-dark bg-teal-dark px-4 py-2.5 text-white shadow-md"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span className="shrink-0 text-sm font-medium">
          Análise sendo gerada no servidor
        </span>
        <Progress
          value={null}
          aria-label="Análise em andamento"
          className="h-1 flex-1 animate-pulse bg-white/20 [&>*]:bg-white"
        />
        <span className="shrink-0 text-xs opacity-90">
          Atualiza sozinho quando terminar
        </span>
      </div>
    </div>
  ) : null

  return (
    <>
      {regenBanner}

      {/* ===== Leitura NOVA: o principal é o Mapa do Ser ===== */}
      {temMapa ? (
        <>
          <ExportPdfButton
            readingId={readingId}
            variant="emocional"
            label="Mapa do Ser (PDF)"
          />
          <VersaoClienteButton readingId={readingId} titulos={titulosBlocos} />
          <AntigoRelatorioButton
            readingId={readingId}
            jaExiste={temDossie}
            disabled={isAnalysisInProgress}
          />
        </>
      ) : (
        <>
          {/* ===== Leitura ANTERIOR a 2026-07-30: segue com o Dossiê, sem mudança ===== */}
          <ExportPdfButton readingId={readingId} label="Dossiê (PDF)" />
          <ExportPdfButton
            readingId={readingId}
            variant="client"
            label="Versão do cliente (PDF)"
          />
        </>
      )}

      {/* O editor é seção-a-seção do DOSSIÊ — não existe editor para o Mapa do Ser,
          então o botão só aparece quando há dossiê para editar. */}
      {temDossie && (
        <Link
          href={`/leituras/${readingId}/editar`}
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          data-testid="reading-mode-edit"
          aria-disabled={isAnalysisInProgress}
          tabIndex={isAnalysisInProgress ? -1 : undefined}
          onClick={(e) => {
            if (isAnalysisInProgress) e.preventDefault()
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Editar análise
        </Link>
      )}

      {!isSelfReading && (
        <Button
          type="button"
          onClick={() => setDeliverOpen(true)}
          disabled={isAnalysisInProgress}
          className="gap-2"
          data-testid="reading-mode-deliver"
        >
          <Send className="h-4 w-4" aria-hidden />
          Concluir leitura
        </Button>
      )}

      {/* ⛔ NÃO existe botão de "gerar Mapa do Ser" em leitura antiga (founder,
          2026-07-30: "não deixa disponível não"). Leitura anterior permanece no
          Dossiê; quem quiser o Mapa do Ser tira fotos novas — o que é coerente com
          o produto, já que o Mapa do Ser nasce do Stage 1 daquelas fotos e a leitura
          nova é o que o cliente paga. A rota POST /emocional continua existindo e
          founder-only, como ferramenta manual — só não tem porta na UI. */}

      {/* ⛔ "Regenerar análise" saiu em 2026-08-03 (founder). Ver o cabeçalho. */}

      <DeliverDialog
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
        onConfirm={onDeliverConfirm}
        pending={deliverPending}
      />
    </>
  )
}
