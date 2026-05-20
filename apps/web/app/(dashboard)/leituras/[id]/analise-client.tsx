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

  const handleTrigger = useCallback(async () => {
    if (streaming) return
    setStreaming(true)
    setSectionsReceived(0)
    setError(null)
    try {
      const res = await fetch(`/api/readings/${readingId}/analyze`, { method: 'POST' })
      if (!res.ok) {
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
