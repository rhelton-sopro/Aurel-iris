'use client'

/**
 * RunSamButton — founder triggers the parallel SAM branch for this reading.
 *
 * POSTs /api/admin/calibration/sam-report/[id]. The endpoint runs SAM on the
 * reading's ORIGINAL stored photos (works on old readings — wife/Nailli — no
 * re-capture) and persists vision_features_sam + report_generated_sam WITHOUT
 * touching production columns. On success: router.refresh() so the page
 * re-renders the now-available SAM side.
 *
 * Long op (SAM cold start + Sonnet call) — keep the user informed.
 *
 * Phase 7.4 SAM harness.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, FlaskConical } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function RunSamButton({
  readingId,
  hasSamReport,
}: {
  readingId: string
  hasSamReport: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const isPending = pending || busy

  function onClick() {
    setBusy(true)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/calibration/sam-report/${readingId}`,
          { method: 'POST' },
        )
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          sections?: number
          sections_empty?: boolean
          sam_warnings?: string[]
        }
        if (!res.ok) {
          toast.error(`SAM falhou: ${body.error ?? `HTTP ${res.status}`}`)
          return
        }
        if (body.sections_empty) {
          toast.warning(
            'SAM rodou mas o relatório veio vazio (segmentação não produziu blocos de olho). Veja sam_warnings.',
          )
        } else {
          toast.success(
            `SAM concluído — ${body.sections ?? 0} seções. Atualizando…`,
          )
        }
        router.refresh()
      } catch (err) {
        toast.error(
          `Erro ao disparar SAM: ${err instanceof Error ? err.message : 'desconhecido'}`,
        )
      } finally {
        setBusy(false)
      }
    })
  }

  return (
    <Button
      type="button"
      variant={hasSamReport ? 'outline' : 'default'}
      onClick={onClick}
      disabled={isPending}
      className="gap-2"
      data-testid="run-sam-button"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <FlaskConical className="h-4 w-4" aria-hidden />
      )}
      {isPending
        ? 'Rodando SAM (pode levar ~1 min)…'
        : hasSamReport
          ? 'Re-rodar SAM'
          : 'Rodar SAM nesta leitura'}
    </Button>
  )
}
