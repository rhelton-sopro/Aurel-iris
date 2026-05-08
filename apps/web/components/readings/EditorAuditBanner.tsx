/**
 * EditorAuditBanner — RSC banner component.
 * Renders 0/1/2 Alert destructive based on auditMetadata.
 * UI-SPEC §Surface 2 lines 127-130, lines 92 (state-driven, NOT dismissible).
 */
import { AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { AuditMetadata } from '@/lib/anthropic/types'

export interface EditorAuditBannerProps {
  auditMetadata: AuditMetadata | null
}

export function EditorAuditBanner({ auditMetadata }: EditorAuditBannerProps) {
  if (!auditMetadata) return null

  const showAnchor = auditMetadata.low_anchor_rate
  const showVocab = (auditMetadata.forbidden_vocab?.length ?? 0) > 0

  if (!showAnchor && !showVocab) return null

  const termList = (auditMetadata.forbidden_vocab ?? [])
    .map((h) => h.term)
    .filter((t, i, a) => a.indexOf(t) === i)
    .join(', ')

  const missingPct = 100 - (auditMetadata.anchor_rate_pct ?? 100)

  return (
    <div className="space-y-3">
      {showAnchor && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Baixa ancoragem em features</AlertTitle>
          <AlertDescription>
            {missingPct}% das afirmações nas seções 2 a 6 não citam a feature de visão que as
            fundamenta. Revise essas seções antes de entregar ao cliente.
          </AlertDescription>
        </Alert>
      )}
      {showVocab && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Termos clinicamente afirmativos detectados</AlertTitle>
          <AlertDescription>
            Os seguintes termos foram identificados no texto e precisam ser corrigidos antes da
            entrega: {termList}. Linguagem hipotética é obrigatória nesta ferramenta.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
