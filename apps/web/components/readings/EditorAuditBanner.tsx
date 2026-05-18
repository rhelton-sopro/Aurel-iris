/**
 * EditorAuditBanner — RSC banner component.
 * Renders 0/1/2 Alert destructive based on auditMetadata.
 * UI-SPEC §Surface 2 lines 127-130, lines 92 (state-driven, NOT dismissible).
 */
import { AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { AuditMetadata } from '@/lib/anthropic/types'
import { SECTION_TITLE_BY_NUMBER } from '@/lib/anthropic/types'

export interface EditorAuditBannerProps {
  auditMetadata: AuditMetadata | null
}

export function EditorAuditBanner({ auditMetadata }: EditorAuditBannerProps) {
  if (!auditMetadata) return null

  const showAnchor = auditMetadata.low_anchor_rate
  const showVocab = (auditMetadata.forbidden_vocab?.length ?? 0) > 0

  if (!showAnchor && !showVocab) return null

  function sectionLabel(key: string): string {
    const num = key.match(/^(\d{1,2})/)?.[1]
    if (num && num in SECTION_TITLE_BY_NUMBER) {
      return `§${num} ${SECTION_TITLE_BY_NUMBER[num as keyof typeof SECTION_TITLE_BY_NUMBER]}`
    }
    return key.replace(/_/g, ' ')
  }
  const vocabByTerm = new Map<string, Set<string>>()
  for (const h of auditMetadata.forbidden_vocab ?? []) {
    if (!vocabByTerm.has(h.term)) vocabByTerm.set(h.term, new Set())
    vocabByTerm.get(h.term)!.add(sectionLabel(h.section))
  }

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
            <p>
              Linguagem hipotética é obrigatória. Corrija antes da entrega — cada
              termo está na(s) seção(ões) indicada(s):
            </p>
            <ul className="mt-1 list-disc pl-4">
              {[...vocabByTerm.entries()].map(([term, secs]) => (
                <li key={term}>
                  <strong>{term}</strong> — em: {[...secs].join(', ')}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
