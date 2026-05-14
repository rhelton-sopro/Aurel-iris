/**
 * Client orchestrator for the trigger CTA + streaming consumer.
 *
 * Composes:
 *   - <AnalysisCTA> (button group A/C with disabled-tooltips D-S4)
 *   - <AnalysisStream> (Iris Codex V1 markdown sections — 14, Plan 07.4-11
 *     extended the server parser to §1..§14, Plan 07.4-12 wires the UI counter)
 *
 * Stream consumption: fetch POST /api/readings/[id]/analyze, getReader().read()
 * loop, count progress via the `^### N. ` boundary regex on the accumulated
 * buffer. The regex `\d{1,2}` is intentionally generic — it accepts §1..§14
 * (and would even tolerate §15+ if the prompt drifts; server parser is the
 * strict source of truth). AnalysisStream clamps the displayed count to 14.
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

// Plan 17: extended to mirror parser.ts BOUNDARY_RE — accepts H2/H3, optional
// §, decimal `.5` for §2.5, em-dash/en-dash/hyphen separators. Best-effort UI
// counter; server parser is authoritative for persistence.
const BOUNDARY_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}(?:\.\d)?[ \t]*[\p{Pd}.][ \t]*/gmu

export interface AnaliseClientProps {
  readingId: string
  hasInitialReport: boolean
  regenerationCount: number
  isDelivered: boolean
}

export function AnaliseClient({
  readingId,
  hasInitialReport,
  regenerationCount,
  isDelivered,
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
