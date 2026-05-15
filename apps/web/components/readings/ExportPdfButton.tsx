'use client'

/**
 * ExportPdfButton — direct PDF download via @react-pdf/renderer (Plan 7.4-23).
 *
 * Founder approved @react-pdf/renderer install during UAT-4 — replaces
 * Plan 19's Print CSS approach (which opened browser print dialog) with a
 * direct file download.
 *
 * Click flow:
 *   1. fetch GET /api/readings/[id]/pdf
 *   2. Get blob from response (Content-Type: application/pdf)
 *   3. Read filename from Content-Disposition header
 *   4. Create object URL + anchor element with download attribute → click
 *   5. Revoke object URL after download triggers
 *
 * Loading state: button disabled + spinning icon during fetch.
 * Error state: toast.error with HTTP status or generic message.
 *
 * Available regardless of isDelivered state — therapist can re-export a
 * delivered reading at any time (PDF doesn't modify state).
 */
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface ExportPdfButtonProps {
  readingId: string
}

function parseFilenameFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null
  // Content-Disposition: attachment; filename="Leitura-Cliente-2026-05-15.pdf"
  const m = headerValue.match(/filename\*?=(?:UTF-8''|")?([^";]+)/)
  return m ? decodeURIComponent(m[1]!.replace(/^"|"$/g, '')) : null
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a short delay so the browser can read the blob
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

export function ExportPdfButton({ readingId }: ExportPdfButtonProps) {
  const [pending, startTransition] = useTransition()
  const [localPending, setLocalPending] = useState(false)
  const isPending = pending || localPending

  function onClick() {
    setLocalPending(true)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/readings/${readingId}/pdf`, { method: 'GET' })
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          const msg = detail.slice(0, 200) || `HTTP ${res.status}`
          toast.error(`Falha ao gerar PDF: ${msg}`)
          return
        }
        const blob = await res.blob()
        const filename =
          parseFilenameFromHeader(res.headers.get('Content-Disposition')) ??
          `leitura-${readingId}.pdf`
        triggerDownload(blob, filename)
        toast.success('PDF baixado.')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'desconhecido'
        toast.error(`Falha ao baixar PDF: ${msg}`)
      } finally {
        setLocalPending(false)
      }
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={isPending}
      className="gap-2"
      data-testid="reading-mode-export-pdf"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4" aria-hidden />
      )}
      {isPending ? 'Gerando PDF…' : 'Exportar PDF'}
    </Button>
  )
}
