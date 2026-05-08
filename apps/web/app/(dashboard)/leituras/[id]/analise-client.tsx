/**
 * Client orchestrator for the trigger CTA + streaming consumer.
 *
 * Composes:
 *   - <AnalysisCTA> (button group A/C with disabled-tooltips D-S4)
 *   - <AnalysisStream> (progress + checklist B, only while streaming)
 *
 * Stream consumption: fetch POST /api/readings/[id]/analyze, getReader().read()
 * loop, count `^### N. ` boundaries in accumulated buffer, push count to UI.
 * On stream end, router.refresh() so RSC reads the persisted report_generated.
 *
 * UI-SPEC §State Machine line 222: 'gerando…' is purely client-side ephemeral
 * — DO NOT add a new persisted ReadingStatus.
 */
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { AnalysisCTA } from '@/components/readings/AnalysisCTA'
import { AnalysisStream } from '@/components/readings/AnalysisStream'

const BOUNDARY_RE = /^### \d{1,2}\.\s+/gm

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
        const boundaryMatches = accumulated.match(BOUNDARY_RE) ?? []
        // Best-effort count without monotonic guard (UI hint only); server
        // parser does the strict thing for persistence.
        setSectionsReceived(boundaryMatches.length)
      }
      toast.success('Análise gerada. Revise as 13 seções antes de entregar.')
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
