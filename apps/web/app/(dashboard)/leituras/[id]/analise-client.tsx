/**
 * Client orchestrator for the trigger CTA + streaming consumer.
 *
 * Composes:
 *   - <AnalysisCTA> (button group A/C with disabled-tooltips D-S4)
 *   - <AnalysisStream> (Iris Codex markdown sections — 15 strictly sequential
 *     §1..§15; server parser in parser.ts is the strict source of truth)
 *
 * Stream consumption: fetch POST /api/readings/[id]/analyze, getReader().read()
 * loop, count progress via the `^### N. ` boundary regex on the accumulated
 * buffer. The regex `\d{1,2}` is intentionally generic — it accepts §1..§15
 * (server parser enforces membership + monotonicity). AnalysisStream derives
 * the total from NUMBERED_SECTION_HEADINGS.length.
 * On stream end, router.refresh() so RSC reads the persisted report_generated.
 *
 * UI-SPEC §State Machine line 222: 'gerando…' is purely client-side ephemeral
 * — DO NOT add a new persisted ReadingStatus.
 *
 * Phase 7 (07-09-PLAN) — legacy. Phase 7.4 Plan 10 (Direction Correction):
 * removed the V2 8-block AdaptiveAnalysisStream switch + V2_KEYS_ORDERED
 * detector. All readings stream via the legacy markdown path.
 * Phase 7.4 Plan 12: docstring updated to reflect 14-section reality (no code
 * change required — boundary detector already uses generic `\d{1,2}`).
 */
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { AnalysisCTA } from '@/components/readings/AnalysisCTA'
import { AnalysisStream } from '@/components/readings/AnalysisStream'

// Mirrors parser.ts BOUNDARY_RE — accepts H2/H3, optional §, em-dash/en-dash/
// hyphen separators (decimal tail tolerated only for legacy buffers; Plan 27
// is 1..15 sequential). Best-effort UI counter; server parser is authoritative.
const BOUNDARY_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][ \t]*/gmu

export interface AnaliseClientProps {
  readingId: string
  hasInitialReport: boolean
  regenerationCount: number
  isDelivered: boolean
  /**
   * Server-side flag: análise rodando agora (started_at < 5min, sem
   * finalize ainda). Quando true, esconde o CTA "Gerar análise" pra
   * evitar duplo-click (gate server-side já bloqueia, mas UI clara
   * é melhor que erro 409). Página tem AutoRefresh que recarrega
   * quando terminar.
   */
  isAnalysisInProgress?: boolean
}

export function AnaliseClient({
  readingId,
  hasInitialReport,
  regenerationCount,
  isDelivered,
  isAnalysisInProgress = false,
}: AnaliseClientProps) {
  const router = useRouter()
  const [streaming, setStreaming] = useState(false)
  const [sectionsReceived, setSectionsReceived] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Fase 8: gate de crédito na geração devolve 402 quando o terapeuta está sem
  // saldo. Mostra CTA de compra (as fotos já estão salvas).
  const [noBalance, setNoBalance] = useState(false)

  const handleTrigger = useCallback(async () => {
    if (streaming) return
    setStreaming(true)
    setSectionsReceived(0)
    setError(null)
    setNoBalance(false)
    try {
      const res = await fetch(`/api/readings/${readingId}/analyze`, { method: 'POST' })
      if (!res.ok) {
        // 402 = sem créditos (gate de crédito na geração). Não é erro de
        // sistema — é estado de saldo; mostra CTA de compra.
        if (res.status === 402) {
          setNoBalance(true)
          setStreaming(false)
          toast.error('Sem créditos para gerar este relatório.')
          return
        }
        // Distingue erro de APP (4xx com JSON: cap atingido, já entregue) do
        // 500 da PLATAFORMA / "já em andamento". Numa geração longa (~5min) a
        // plataforma corta a conexão em ~300s e devolve "internal server error"
        // mesmo a geração rodando OK server-side (Fluid Compute continua). NÃO é
        // falha real → reconcilia via refresh; a página decide pelo estado
        // autoritativo (isAnalysisInProgress → "em andamento" + auto-refresh, OU
        // CTA de retry se realmente não começou). Antes este path gritava
        // "Falha ao iniciar análise: internal server error" (falso).
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
          // corpo não-JSON (página 500 da plataforma) — trata como 5xx abaixo.
        }
        if (res.status >= 500 || inflight) {
          toast.info('A análise está rodando no servidor — esta página atualiza sozinha quando terminar.')
          setStreaming(false)
          router.refresh()
          return
        }
        const msg = appMsg ?? `HTTP ${res.status}`
        setError(msg)
        toast.error(msg)
        setStreaming(false)
        return
      }
      const reader = res.body?.getReader()
      if (!reader) {
        setError('Stream indisponível')
        setStreaming(false)
        return
      }
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        // Legacy: count `^### N. ` markdown boundaries. Best-effort count
        // without monotonic guard (UI hint only); server parser does the
        // strict thing for persistence.
        const boundaryMatches = accumulated.match(BOUNDARY_RE) ?? []
        setSectionsReceived(boundaryMatches.length)
      }
      toast.success('Análise gerada. Revise as seções antes de entregar.')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconhecido'
      console.error('[analise-client] stream error', msg)
      // O stream caiu (iOS bg-kill, aba fechada, network drop, OU a plataforma
      // cortou a conexão longa em ~300s numa geração de ~5min). A geração
      // CONTINUA server-side (Fluid Compute). NÃO é falha real → reconcilia via
      // refresh: a página decide pelo estado AUTORITATIVO (page.tsx
      // isAnalysisInProgress, baseado em analysis_started/completed_at + teto
      // 15min → mostra "em andamento" com auto-refresh, OU o relatório se já
      // completou). Antes o reconcile via /status checava status='analyzing'
      // que NUNCA casa (readings.status fica 'ready' durante a geração) → caía
      // no "Geração interrompida" falso e o terapeuta queimava regen.
      toast.info('Conexão do stream caiu — a análise continua no servidor. Atualizando…')
      router.refresh()
    } finally {
      setStreaming(false)
    }
  }, [readingId, router, streaming])

  // In-progress server-side (handler rodando após cliente fechar): UI
  // espera sem CTA. Auto-refresh server-side já atualiza quando terminar.
  if (isAnalysisInProgress && !streaming) {
    return (
      <div className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        Aguardando análise terminar…
      </div>
    )
  }

  // Sem créditos (402 do gate de geração): as fotos estão salvas, falta saldo.
  if (noBalance) {
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/30 px-4 py-5">
        <p className="text-sm font-semibold">
          Sem créditos para gerar este relatório
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          As fotos estão salvas. Compre créditos e depois clique em
          “Gerar análise” — a geração fica pendente até lá.
        </p>
        <Link
          href={`/assinatura/comprar?reading=${readingId}`}
          className="inline-block rounded-md bg-teal-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Comprar créditos
        </Link>
      </div>
    )
  }

  return (
    <>
      {streaming ? (
        <AnalysisStream sectionsReceived={sectionsReceived} error={error} />
      ) : (
        <AnalysisCTA
          readingId={readingId}
          hasReport={hasInitialReport}
          regenerationCount={regenerationCount}
          isDelivered={isDelivered}
          onTrigger={handleTrigger}
        />
      )}
    </>
  )
}
