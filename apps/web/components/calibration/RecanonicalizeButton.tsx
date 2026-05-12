'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/**
 * Phase 07.1.6 D-05 — Re-canonicalizar on-demand.
 *
 * POSTa para /api/capture/canonicalize (Plan 04 endpoint) que re-roda Sonnet
 * bbox + crop + upload para todas as 6 fotos da leitura. Idempotente:
 * canonical_storage_path é overwrite via service-role no orchestrator;
 * originais (storage_path) NUNCA são tocados.
 *
 * Custo ~$0.05/reading (6 × Sonnet 4.6 calls em paralelo ~3-5s). Founder
 * action — confirma() obrigatório antes do click pra evitar trigger acidental.
 *
 * Pós-success: router.refresh() força o server component pai (page.tsx) a
 * re-fetchar readings.canonical_metadata e re-renderizar o badge com o novo
 * status_summary. D-01 fallback semantics: se algumas fotos falham o gate,
 * endpoint retorna 200 com status_summary contendo `fallback > 0` — toast
 * usa toast.warning em vez de toast.success.
 *
 * Auth/ownership: o endpoint Plan 04 valida session + .eq('therapist_id',
 * user.id), então o button assume que o admin logado é o therapist owner da
 * leitura (founder dogfooding pattern). Cross-tenant readingId → 404 do
 * endpoint, capturado pelo branch !res.ok.
 *
 * Pattern mirror: apps/web/components/calibration/PhotoDownloadButton.tsx
 * (mesmo 'use client' + useState + sonner toast + shadcn Button + lucide).
 */

interface CanonicalizeResponseBody {
  status_summary?: {
    ok?: number
    fallback?: number
    disabled?: number
  }
  error?: string
}

export function RecanonicalizeButton({ readingId }: { readingId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    // Founder action é costly ($0.05) e idempotente — confirma explícito.
    if (
      !window.confirm(
        'Re-canonicalizar todas as 6 fotos? Custo Sonnet ~US$ 0,05 e leva ~5s.',
      )
    ) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/capture/canonicalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId }),
        cache: 'no-store',
      })

      if (!res.ok) {
        const detail = (await res
          .json()
          .catch(() => ({}))) as CanonicalizeResponseBody
        toast.error(
          `Falha ao canonicalizar (${res.status}): ${
            detail.error ?? 'erro desconhecido'
          }`,
        )
        return
      }

      const body = (await res.json()) as CanonicalizeResponseBody
      const ok = body.status_summary?.ok ?? 0
      const fallback = body.status_summary?.fallback ?? 0
      const disabled = body.status_summary?.disabled ?? 0
      const msg = `canonical: ${ok} ok · ${fallback} fallback · ${disabled} disabled`

      if (disabled > 0) {
        // D-04 kill-switch ON em produção: CANONICAL_CAPTURE_ENABLED=false
        toast.warning(`${msg} (kill-switch ativo)`)
      } else if (fallback > 0) {
        toast.warning(msg)
      } else if (ok > 0) {
        toast.success(msg)
      } else {
        toast.warning('Nenhuma foto canonicalizada (ver logs).')
      }

      // Refresh server component pai para re-render do badge com novo metadata.
      router.refresh()
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'falha de rede'
      console.error('[RecanonicalizeButton] fetch error', err)
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
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Canonicalizando...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Re-canonicalizar
        </>
      )}
    </Button>
  )
}
