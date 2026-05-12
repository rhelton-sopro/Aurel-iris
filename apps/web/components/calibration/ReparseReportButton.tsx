'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/**
 * Phase 07.1.6 UAT-1 follow-up — re-parse report_raw_text without burning
 * a regeneration cycle. Hits POST /api/admin/calibration/reparse/[reading_id].
 *
 * Use case: previous /analyze call wrote a 40KB buffer to report_raw_text but
 * the parser missed every section boundary (e.g. Sonnet drift from `### N. `
 * to `## §N — `). After deploying a parser fix, hit this button to recover
 * the original LLM output WITHOUT spending another $0.30 + 4 min on a regen.
 *
 * Founder action: zero Anthropic cost, instant, idempotent. Re-parses the same
 * buffer with the current parser regex. audit_metadata refreshes; regen counter
 * does NOT increment.
 *
 * Pattern mirror: RecanonicalizeButton.tsx (same shape — 'use client' +
 * useState + sonner toast + shadcn Button).
 */

interface ReparseResponseBody {
  reading_id?: string
  sections_parsed?: number
  keys?: string[]
  buffer_length?: number
  boundaries_found?: number
  audit_anchor_rate_pct?: number
  error?: string
}

export function ReparseReportButton({ readingId }: { readingId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/admin/calibration/reparse/${encodeURIComponent(readingId)}`,
        { method: 'POST', cache: 'no-store' },
      )

      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))) as ReparseResponseBody
        toast.error(
          `Falha ao re-parsear (${res.status}): ${detail.error ?? 'erro desconhecido'}`,
        )
        return
      }

      const body = (await res.json()) as ReparseResponseBody
      const sections = body.sections_parsed ?? 0
      const boundaries = body.boundaries_found ?? 0
      const buf = body.buffer_length ?? 0
      const anchor = body.audit_anchor_rate_pct ?? 0

      if (boundaries === 0) {
        toast.warning(
          `Re-parse: 0 boundaries no buffer (${buf} chars). Parser ainda não casa — buffer pode ter formato novo.`,
        )
      } else {
        toast.success(
          `Re-parse: ${sections} seções (${boundaries} boundaries, anchor ${anchor.toFixed(0)}%).`,
        )
      }

      router.refresh()
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'falha de rede'
      console.error('[ReparseReportButton] fetch error', err)
      toast.error(`Falha: ${reason}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isLoading}
      aria-busy={isLoading}
      title="Re-parsear report_raw_text com o parser atual (sem chamar LLM)"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Re-parseando...
        </>
      ) : (
        <>
          <FileText className="mr-2 h-4 w-4" />
          Re-parsear report
        </>
      )}
    </Button>
  )
}
