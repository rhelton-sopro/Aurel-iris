'use client'

/**
 * AnalysisCTA — button group for the reading detail hero card.
 *
 * Renders 1 of 2 button configurations:
 *   - hasReport=false → single "Gerar análise" primary button
 *   - hasReport=true  → "Editar análise" link + "Regenerar análise (n/1)" outline
 *
 * Regra (founder 2026-05-29): 1 geração original + 1 regen grátis. Como
 * regeneration_count conta gerações totais (1 após a original), o contador
 * exibe regens usados = count-1 (/1) e o cap é count >= 2.
 *
 * Disabled tooltips (D-S4):
 *   - regenerationCount >= 2 → "Você já usou a regeneração desta leitura. Para um novo relatório, faça uma nova leitura (novas fotos)."
 *   - isDelivered=true       → "Esta leitura já foi concluída. Para gerar nova versão, crie uma nova leitura."
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
  /**
   * Regen só pro founder (2026-06-03): "Regenerar análise" foi removido do
   * terapeuta. Não-founder com relatório vê apenas "Editar análise". O gate
   * (e) do /analyze reforça no servidor.
   */
  isFounder?: boolean
}

export function AnalysisCTA({
  readingId,
  hasReport,
  regenerationCount,
  isDelivered,
  onTrigger,
  isFounder = false,
}: AnalysisCTAProps) {
  // 1 geração original + 1 regen grátis (founder 2026-05-29). regenerationCount
  // conta gerações TOTAIS (= 1 após a original), então regens usados = count-1
  // e o cap é count >= 2 (espelha o gate (e) do analyze/route).
  const regensUsed = Math.max(0, regenerationCount - 1)
  const regenDisabled = regenerationCount >= 2 || isDelivered
  const regenTooltip =
    regenerationCount >= 2
      ? 'Você já usou a regeneração desta leitura. Para um novo relatório, faça uma nova leitura (novas fotos).'
      : isDelivered
        ? 'Esta leitura já foi concluída. Para gerar nova versão, crie uma nova leitura.'
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
      aria-label={`Regenerar análise (${regensUsed}/1)`}
    >
      <RefreshCw className="h-4 w-4" aria-hidden />
      Regenerar análise ({regensUsed}/1)
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
      {/* Regen só pro founder (2026-06-03): o terapeuta não regenera mais. */}
      {isFounder &&
        (regenTooltip ? (
          <TooltipProvider>
            <Tooltip>
              {/* base-ui Tooltip.Trigger uses `render` prop for custom element (not Radix `asChild`).
                  Span wrapper is needed because regenButton may be disabled — disabled buttons
                  don't fire mouse events, so the trigger must render as a non-button. */}
              <TooltipTrigger render={<span />}>
                {regenButton}
              </TooltipTrigger>
              <TooltipContent>{regenTooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          regenButton
        ))}
    </div>
  )
}
