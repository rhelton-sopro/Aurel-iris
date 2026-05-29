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
        const detail = await res.text().catch(() => '')
        const msg = detail.slice(0, 200) || `HTTP ${res.status}`
        setError(msg)
        toast.error(`Falha ao iniciar análise: ${msg}`)
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
      // Camada 1 (v2.4.5): ANTES de gritar "Geração interrompida",
      // verifica o estado real no banco. iOS bg-kill / aba fechada /
      // network drop fazem o stream cair sem o backend ter falhado —
      // a análise continua rodando server-side e provavelmente já
      // completou. Sem este reconcile, terapeuta queima regen
      // desnecessariamente.
      try {
        const statusRes = await fetch(`/api/readings/${readingId}/status`, {
          cache: 'no-store',
        })
        if (statusRes.ok) {
          const data = (await statusRes.json()) as {
            status: string
            has_report: boolean
          }
          if (data.status === 'ready' && data.has_report) {
            // Backend completou enquanto o stream caía. Suprime o erro
            // e mostra o relatório real via RSC refresh.
            toast.success('Relatório pronto. Conexão tinha caído, mas o servidor terminou.')
            router.refresh()
            setStreaming(false)
            return
          }
          if (data.status === 'analyzing' || data.status === 'pending') {
            // Backend ainda gerando. Mostra mensagem honesta + poll.
            toast.info('Conexão caiu — análise continua rodando no servidor. Aguarde.', {
              duration: 5000,
            })
            // Sai do streaming state — page.tsx vai mostrar
            // "Aguardando análise terminar..." via isAnalysisInProgress.
            // O AutoRefresh server-side recarrega quando finalizar.
            setStreaming(false)
            router.refresh()
            return
          }
          // status='failed' ou outro → erro real
        }
      } catch (recErr) {
        console.error('[analise-client] reconcile error', recErr)
        // cai pro toast.error padrão abaixo
      }
      setError(msg)
      toast.error(`Geração interrompida: ${msg}`)
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
          href="/assinatura/comprar"
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
