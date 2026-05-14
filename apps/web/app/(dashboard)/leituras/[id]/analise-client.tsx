/**
 * Client orchestrator for the trigger CTA + streaming consumer.
 *
 * Composes:
 *   - <AnalysisCTA> (button group A/C with disabled-tooltips D-S4)
 *   - <AnalysisStream> (legacy 13 sections) OR <AdaptiveAnalysisStream>
 *     (V2 8 blocos) based on `reportVersion`.
 *
 * Stream consumption: fetch POST /api/readings/[id]/analyze, getReader().read()
 * loop, count progress on the accumulated buffer:
 *   - legacy 1.0: `^### N. ` boundary regex → 0..13 sections
 *   - V2 2.0: top-level key transitions in the JSON stream → 0..8 blocos
 *     (D-VAL3 path b — RESEARCH §LANDMINE-4)
 * On stream end, router.refresh() so RSC reads the persisted report_generated
 * or report_v2.
 *
 * UI-SPEC §State Machine line 222: 'gerando…' is purely client-side ephemeral
 * — DO NOT add a new persisted ReadingStatus.
 *
 * Phase 7 (07-09-PLAN) — legacy. Phase 7.4 (07.4-08-PLAN) — V2 switch.
 */
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { AnalysisCTA } from '@/components/readings/AnalysisCTA'
import { AnalysisStream } from '@/components/readings/AnalysisStream'
import { AdaptiveAnalysisStream } from '@/components/readings/AdaptiveAnalysisStream'

const BOUNDARY_RE = /^### \d{1,2}\.\s+/gm

/**
 * Top-level keys for V2 streaming progress detection (D-VAL3 path b).
 *
 * Inlined here (not imported from `lib/anthropic/report-schema.ts`) because
 * that module declares `import 'server-only'` and would refuse to be pulled
 * into a client bundle. Stream-parser-v2 on the server uses the canonical
 * REPORT_V2_TOP_LEVEL_KEYS constant; this client-side mirror MUST stay in
 * sync with that source (8 user-facing blocos in the visual order — excludes
 * report_version and advanced_analysis which the UI does not surface).
 *
 * Sonnet is instructed in the prompt to emit keys in this exact order; the
 * detector below counts how many keys have already been emitted by looking
 * for the next key's start (which proves the previous one closed).
 */
const V2_KEYS_ORDERED = [
  'executive_summary',
  'constitutional_pattern',
  'systems_with_tendency',
  'integrative_axes',
  'bilateral_findings',
  'therapeutic_synthesis',
  'priority_focus',
  'clinical_note',
] as const

/**
 * Best-effort block count from the accumulated streaming buffer.
 *
 * Strategy: for each key K[i] (except the last), look for the start of K[i+1]
 * in the buffer. If found, K[i] is complete → count++. For the final key
 * (clinical_note), look for `,"advanced_analysis":` as the sentinel that
 * clinical_note closed.
 *
 * RESEARCH §LANDMINE-4 truncated-stream edge case (documented limitation):
 * if the stream terminates after `clinical_note` content but BEFORE the
 * `,"advanced_analysis":` separator hits the buffer, the client UI keeps the
 * final block on the Skeleton state even though zod parse will succeed on
 * the final buffer once persisted. This is cosmetic only — the page refetch
 * after stream end renders the full report correctly via ReportAdaptiveView.
 */
function detectBlocksReceived(buffer: string): number {
  let count = 0
  for (let i = 0; i < V2_KEYS_ORDERED.length - 1; i++) {
    const next = V2_KEYS_ORDERED[i + 1]
    // Match `,\s*"next_key"\s*:` — the JSON stream emits keys in order, so
    // seeing the next key's opening quote+colon proves the previous one closed.
    const re = new RegExp(`,\\s*"${next}"\\s*:`)
    if (re.test(buffer)) {
      count++
    } else {
      // Keys are emitted in order — bail at the first miss.
      break
    }
  }
  // Final key (clinical_note) closes when advanced_analysis appears.
  if (count === V2_KEYS_ORDERED.length - 1) {
    const finalRe = /,\s*"advanced_analysis"\s*:/
    if (finalRe.test(buffer)) count++
  }
  return count
}

export interface AnaliseClientProps {
  readingId: string
  hasInitialReport: boolean
  regenerationCount: number
  isDelivered: boolean
  /**
   * Phase 7.4 Plan 07.4-08: switches streaming UI between legacy
   * AnalysisStream (13 sections) and V2 AdaptiveAnalysisStream (8 blocos).
   * Defaults to '1.0' when undefined to preserve legacy behaviour.
   */
  reportVersion?: '1.0' | '2.0'
}

export function AnaliseClient({
  readingId,
  hasInitialReport,
  regenerationCount,
  isDelivered,
  reportVersion = '1.0',
}: AnaliseClientProps) {
  const router = useRouter()
  const [streaming, setStreaming] = useState(false)
  const [sectionsReceived, setSectionsReceived] = useState(0)
  const [blocksReceived, setBlocksReceived] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const isV2 = reportVersion === '2.0'

  const handleTrigger = useCallback(async () => {
    if (streaming) return
    setStreaming(true)
    setSectionsReceived(0)
    setBlocksReceived(0)
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
        if (isV2) {
          // V2: count top-level JSON keys completed (D-VAL3 path b).
          setBlocksReceived(detectBlocksReceived(accumulated))
        } else {
          // Legacy: count `^### N. ` markdown boundaries. Best-effort count
          // without monotonic guard (UI hint only); server parser does the
          // strict thing for persistence.
          const boundaryMatches = accumulated.match(BOUNDARY_RE) ?? []
          setSectionsReceived(boundaryMatches.length)
        }
      }
      toast.success(
        isV2
          ? 'Análise gerada. Revise os 8 blocos antes de entregar.'
          : 'Análise gerada. Revise as 13 seções antes de entregar.',
      )
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconhecido'
      console.error('[analise-client] stream error', msg)
      setError(msg)
      toast.error(`Geração interrompida: ${msg}`)
    } finally {
      setStreaming(false)
    }
  }, [readingId, router, streaming, isV2])

  return (
    <>
      {streaming ? (
        isV2 ? (
          <AdaptiveAnalysisStream blocksReceived={blocksReceived} error={error} />
        ) : (
          <AnalysisStream sectionsReceived={sectionsReceived} error={error} />
        )
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
