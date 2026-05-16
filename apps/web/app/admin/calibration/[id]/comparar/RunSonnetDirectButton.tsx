'use client'

/**
 * RunSonnetDirectButton — founder triggers Column C (ANÁLISE DIRETA SONNET).
 *
 * POSTs /api/admin/calibration/sonnet-direct/[id]. The endpoint sends the
 * reading's 6 ORIGINAL stored photos DIRECTLY to Sonnet (no Modal, no RAG)
 * and persists report_generated_sonnet_direct WITHOUT touching production /
 * SAM columns. On success: router.refresh() so the page renders Column C.
 *
 * No segmentation cold-start (Column C bypasses Modal entirely) — typically
 * faster than "Rodar SAM"; still one Sonnet call with 6 images.
 *
 * Phase 7.4 | Column C | calibration harness.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Eye } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function RunSonnetDirectButton({
  readingId,
  hasReport,
}: {
  readingId: string
  hasReport: boolean
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
          `/api/admin/calibration/sonnet-direct/${readingId}`,
          { method: 'POST' },
        )
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          sections?: number
          sections_empty?: boolean
          cost_usd?: number
        }
        if (!res.ok) {
          toast.error(
            `Coluna C falhou: ${body.error ?? `HTTP ${res.status}`}`,
          )
          return
        }
        if (body.sections_empty) {
          toast.warning(
            'Sonnet direto rodou mas o relatório veio vazio (sem seções). Veja os logs.',
          )
        } else {
          toast.success(
            `Coluna C concluída — ${body.sections ?? 0} seções` +
              (body.cost_usd != null ? ` · ~$${body.cost_usd}` : '') +
              '. Atualizando…',
          )
        }
        router.refresh()
      } catch (err) {
        toast.error(
          `Erro ao disparar Coluna C: ${err instanceof Error ? err.message : 'desconhecido'}`,
        )
      } finally {
        setBusy(false)
      }
    })
  }

  return (
    <Button
      type="button"
      variant={hasReport ? 'outline' : 'default'}
      onClick={onClick}
      disabled={isPending}
      className="gap-2"
      data-testid="run-sonnet-direct-button"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Eye className="h-4 w-4" aria-hidden />
      )}
      {isPending
        ? 'Rodando Sonnet direto…'
        : hasReport
          ? 'Re-rodar Coluna C'
          : 'Gerar Coluna C (Sonnet direto)'}
    </Button>
  )
}
