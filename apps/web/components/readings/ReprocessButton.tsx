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
 * On 400 incomplete_capture: surface server message via toast (founder
 * UAT 2026-05-22, caso Caroline: terapeuta vê POR QUE não pode
 * reprocessar, em vez de silêncio).
 * On other non-202: surface error message via toast + leave UI as-is.
 *
 * D-T2: no polling — terapeuta sees the next state change on next
 * navigation (or via router.refresh after a successful Reprocessar).
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

export interface ReprocessButtonProps {
  readingId: string
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'edited'
  /** Tamanho do botão. Default 'sm' (compatível com listing manager). */
  size?: 'sm' | 'default' | 'lg'
  /** Variant visual. Default 'outline'. */
  variant?: 'outline' | 'default' | 'secondary'
}

export function ReprocessButton({
  readingId,
  status,
  size = 'sm',
  variant = 'outline',
}: ReprocessButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  // D-T3: disabled while pipeline is running OR while our POST is in flight.
  const disabled = status === 'processing' || pending

  async function handleClick() {
    if (disabled) return
    setPending(true)
    const toastId = toast.loading('Reprocessando leitura…')
    try {
      const res = await fetch(`/api/readings/${readingId}/process`, {
        method: 'POST',
      })
      if (res.status === 202) {
        toast.success('Leitura marcada como pronta.', { id: toastId, duration: 3000 })
        router.refresh()
        return
      }

      // Tenta extrair JSON com mensagem do servidor (incomplete_capture
      // surfaceia a contagem real de fotos pra UI 2026-05-22).
      let serverMessage: string | null = null
      try {
        const body = (await res.json()) as { message?: string; error?: string }
        serverMessage = body.message ?? body.error ?? null
      } catch {
        // resposta não-JSON; cai pro fallback genérico abaixo
      }

      const fallback = `Não foi possível reprocessar (HTTP ${res.status}).`
      toast.error(serverMessage ?? fallback, {
        id: toastId,
        duration: 6000,
      })
      console.error(
        `[reprocess] non-202 reading=${readingId} status=${res.status} message=${serverMessage ?? '(none)'}`,
      )
    } catch (err) {
      toast.error('Falha de rede ao reprocessar. Tente novamente.', {
        id: toastId,
        duration: 6000,
      })
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
      size={size}
      variant={variant}
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
