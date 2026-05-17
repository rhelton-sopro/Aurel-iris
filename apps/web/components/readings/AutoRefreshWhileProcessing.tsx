'use client'

/**
 * AutoRefreshWhileProcessing — polls the RSC while a reading is mid-pipeline.
 *
 * Renders nothing. While `active`, calls router.refresh() every `intervalMs`
 * so the server-rendered status (force-dynamic pages) flips from
 * "Processando" to "Pronto" without a manual F5. Stops automatically when
 * the parent re-renders with active=false (status reached a terminal state).
 *
 * Codebase-consistent: the whole app drives freshness via router.refresh()
 * (no Supabase Realtime infra). Polling is scoped to non-terminal status only.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export interface AutoRefreshWhileProcessingProps {
  active: boolean
  intervalMs?: number
}

export function AutoRefreshWhileProcessing({
  active,
  intervalMs = 4000,
}: AutoRefreshWhileProcessingProps) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs, router])
  return null
}
