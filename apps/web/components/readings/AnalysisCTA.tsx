'use client'

/**
 * AnalysisCTA — button group for the reading detail hero card.
 *
 * Renders 1 of 2 button configurations:
 *   - hasReport=false → single "Gerar análise" primary button
 *   - hasReport=true  → "Editar análise" link + "Regenerar análise (n/3)" outline
 *
 * Disabled tooltips (D-S4):
 *   - regenerationCount >= 3 → "Limite de 3 regenerações atingido. Edite manualmente para ajustar o relatório."
 *   - isDelivered=true       → "Esta leitura já foi entregue ao cliente. Para gerar nova versão, crie uma nova leitura."
 *
 * Phase 7 | Plan 07-09 | UI-SPEC §Surface 1 lines 100-118
 */
import Link from 'next/link'
import { Sparkles, RefreshCw } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface AnalysisCTAProps {
  readingId: string
  hasReport: boolean
  regenerationCount: number
  isDelivered: boolean
  onTrigger: () => void
}

export function AnalysisCTA({
  readingId,
  hasReport,
  regenerationCount,
  isDelivered,
  onTrigger,
}: AnalysisCTAProps) {
  const regenDisabled = regenerationCount >= 3 || isDelivered
  const regenTooltip =
    regenerationCount >= 3
      ? 'Limite de 3 regenerações atingido. Edite manualmente para ajustar o relatório.'
      : isDelivered
        ? 'Esta leitura já foi entregue ao cliente. Para gerar nova versão, crie uma nova leitura.'
        : null

  if (!hasReport) {
    return (
      <Button onClick={onTrigger} size="lg" className="gap-2" data-testid="analysis-cta-generate">
        <Sparkles className="h-4 w-4" aria-hidden />
        Gerar análise
      </Button>
    )
  }

  const regenButton = (
    <Button
      type="button"
      variant="outline"
      onClick={onTrigger}
      disabled={regenDisabled}
      className="gap-2"
      data-testid="analysis-cta-regenerate"
      aria-label={`Regenerar análise (${regenerationCount}/3)`}
    >
      <RefreshCw className="h-4 w-4" aria-hidden />
      Regenerar análise ({regenerationCount}/3)
    </Button>
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/leituras/${readingId}/editar`}
        className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
      >
        Editar análise
      </Link>
      {regenTooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{regenButton}</span>
            </TooltipTrigger>
            <TooltipContent>{regenTooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        regenButton
      )}
    </div>
  )
}
