/**
 * Reprocessar button — POSTs to /api/readings/[id]/process to retry
 * the Modal pipeline (D-T3).
 *
 * Disabled when:
 *   - status==='processing' (D-T3 — pipeline already running)
 *   - in-flight (local pending state during fetch)
 *
 * On 202: router.refresh() so the listing RSC re-fetches and the badge
 * transitions failed → processing without manual page reload.
 * On non-202: log + leave UI as-is (server state controls badge).
 *
 * D-T2: no polling — terapeuta sees the next state change on next
 * navigation (or via router.refresh after a successful Reprocessar).
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface ReprocessButtonProps {
  readingId: string
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'edited'
}

export function ReprocessButton({ readingId, status }: ReprocessButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  // D-T3: disabled while pipeline is running OR while our POST is in flight.
  const disabled = status === 'processing' || pending

  async function handleClick() {
    if (disabled) return
    setPending(true)
    try {
      const res = await fetch(`/api/readings/${readingId}/process`, {
        method: 'POST',
      })
      if (res.status === 202) {
        // Re-fetch the listing — badge will transition to 'processing'.
        router.refresh()
      } else {
        const detail = await res.text().catch(() => '')
        console.error(
          `[reprocess] non-202 reading=${readingId} status=${res.status} body=${detail.slice(0, 200)}`,
        )
      }
    } catch (err) {
      console.error(
        `[reprocess] fetch threw reading=${readingId}:`,
        err instanceof Error ? err.message : 'unknown',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={disabled}
      aria-label={`Reprocessar leitura ${readingId}`}
      data-testid="reprocess-button"
    >
      <RefreshCw
        className={`mr-1 h-4 w-4${pending ? ' animate-spin' : ''}`}
        aria-hidden
      />
      Reprocessar
    </Button>
  )
}
