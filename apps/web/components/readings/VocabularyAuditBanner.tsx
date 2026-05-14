/**
 * VocabularyAuditBanner — non-dismissible destructive banner stack for D-VOC3 hits.
 *
 * Renders 0-4 Alert blocks (one per non-empty hit category + one when
 * jsonValidationFailed=true). State-driven only — no close button or `setOpen`
 * state per UI-SPEC line 175 ("NOT user-dismissible — state-driven only, so
 * terapeuta cannot accidentally hide an LGPD-06 or brand-discipline violation").
 *
 * Uses safeArray() before iterating jsonb arrays (MEMORY rule — jsonb columns
 * may drift to non-array shapes from legacy/partial rows).
 *
 * RSC by default — no `'use client'` directive. The Alert primitives don't
 * require client boundary.
 *
 * Phase 7.4 | Plan 07.4-07 | Decisões: D-VOC3
 */
import { AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { safeArray } from '@/lib/utils'

/**
 * Audit hit + result shapes (inlined Plan 10 — Direction Correction).
 *
 * Source of truth was `@/lib/anthropic/types-v2` (deleted with the 8-block
 * pipeline). VocabularyAuditBanner is retained as a runtime audit-display
 * surface (DC-10); Plan 11/12 will revisit the audit pipeline for the
 * 14-section markdown direction and may re-centralize these types.
 */
export interface AuditV2Hit {
  /** Dot-path identifier (e.g., 'executive_summary' or 'systems.linfatico.field'). */
  field: string
  term: string
  count: number
}

export interface AuditV2Result {
  iridological_jargon: AuditV2Hit[]
  sopro_vocab: AuditV2Hit[]
  forbidden_vocab: AuditV2Hit[]
  json_validation_passed: boolean
  retry_count: number
  audited_at: string // ISO timestamp
}

function uniqTerms(hits: AuditV2Hit[]): string {
  return Array.from(new Set(hits.map((h) => h.term))).join(', ')
}

export interface VocabularyAuditBannerProps {
  audit: AuditV2Result | null
  /**
   * Separate flag from the 3rd-fail path in analyze-v2 (Plan 07.4-04). When
   * true, surfaces a "generation failed" alert above the vocab alerts.
   */
  jsonValidationFailed?: boolean
}

export function VocabularyAuditBanner({
  audit,
  jsonValidationFailed,
}: VocabularyAuditBannerProps) {
  if (!audit && !jsonValidationFailed) return null

  const jargonHits = safeArray<AuditV2Hit>(audit?.iridological_jargon)
  const soproHits = safeArray<AuditV2Hit>(audit?.sopro_vocab)
  const lgpdHits = safeArray<AuditV2Hit>(audit?.forbidden_vocab)

  const hasAny =
    jargonHits.length > 0 ||
    soproHits.length > 0 ||
    lgpdHits.length > 0 ||
    Boolean(jsonValidationFailed)

  if (!hasAny) return null

  return (
    <div className="space-y-3" data-testid="vocabulary-audit-banner">
      {jsonValidationFailed && (
        <Alert variant="destructive" data-audit-kind="json_validation_failed">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Erro de geração</AlertTitle>
          <AlertDescription>
            O modelo não produziu um JSON válido após múltiplas tentativas. Esta leitura
            foi marcada para revisão. Tente regenerar a análise.
          </AlertDescription>
        </Alert>
      )}

      {jargonHits.length > 0 && (
        <Alert variant="destructive" data-audit-kind="iridological_jargon">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Termos proibidos detectados</AlertTitle>
          <AlertDescription>
            Jargão iridológico identificado: {uniqTerms(jargonHits)}. O Iris Codex usa
            linguagem clínico-funcional — termos iridológicos formais não são permitidos
            no relatório padrão.
          </AlertDescription>
        </Alert>
      )}

      {soproHits.length > 0 && (
        <Alert variant="destructive" data-audit-kind="sopro_vocab">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Termos proibidos detectados</AlertTitle>
          <AlertDescription>
            Vocabulário espiritual identificado: {uniqTerms(soproHits)}. O Iris Codex é
            separado da linha Sopro da Origem — esses termos não pertencem ao relatório.
          </AlertDescription>
        </Alert>
      )}

      {lgpdHits.length > 0 && (
        <Alert variant="destructive" data-audit-kind="forbidden_vocab">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Termos clinicamente afirmativos detectados</AlertTitle>
          <AlertDescription>
            Os seguintes termos foram identificados no relatório e precisam ser
            corrigidos antes da entrega: {uniqTerms(lgpdHits)}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
