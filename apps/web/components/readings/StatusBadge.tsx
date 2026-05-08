/**
 * Domain-specific status badge for /leituras listing.
 *
 * Maps `readings.status` to pt-BR copy + shadcn Badge variant.
 * On `status='failed'`, wraps the badge in a Tooltip rendering the
 * literal `error_summary` from `vision_features.processing_metadata`
 * (D-F2). When error_summary is absent, no tooltip is rendered.
 *
 * Rascunho override: when `isRascunho={true}` the badge renders
 * 'Rascunho' regardless of status (preserves Fase 3 listing UX —
 * partial-capture pending readings are user-actionable, not awaiting
 * pipeline).
 *
 * Server component (no client-side state). Tooltip primitives from
 * shadcn are imported as client components but render safely from
 * server component context.
 */
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type ReadingStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'edited'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_COPY: Record<ReadingStatus, { label: string; variant: Variant }> = {
  pending: { label: 'Aguardando', variant: 'outline' },
  processing: { label: 'Processando', variant: 'secondary' },
  ready: { label: 'Pronto', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
  edited: { label: 'Editado', variant: 'outline' },
}

const RASCUNHO_COPY: { label: string; variant: Variant } = {
  label: 'Rascunho',
  variant: 'outline',
}

export interface StatusBadgeProps {
  status: ReadingStatus
  isRascunho?: boolean
  errorSummary?: string | null
  /** Ephemeral 'gerando…' state — client-side only, NOT a persisted enum value (D-P4 + UI-SPEC line 308) */
  streaming?: boolean
}

export function StatusBadge({
  status,
  isRascunho = false,
  errorSummary,
  streaming = false,
}: StatusBadgeProps) {
  // Streaming variant short-circuit (client-side ephemeral)
  if (streaming) {
    return (
      <Badge variant="secondary" data-status="streaming" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Gerando…
      </Badge>
    )
  }

  const { label, variant } = isRascunho
    ? RASCUNHO_COPY
    : STATUS_COPY[status] ?? STATUS_COPY.pending

  const badge = (
    <Badge variant={variant} data-status={isRascunho ? 'rascunho' : status}>
      {label}
    </Badge>
  )

  // D-F2: tooltip on failed status when error_summary is populated.
  if (status === 'failed' && !isRascunho && errorSummary) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{badge}</span>
          </TooltipTrigger>
          <TooltipContent>{errorSummary}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
