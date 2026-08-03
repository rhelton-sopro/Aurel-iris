'use client'

/**
 * AnalysisCTA — button group for the reading detail hero card.
 *
 * Renders 1 of 2 button configurations:
 *   - hasReport=false → single "Gerar relatório · Mapa do Ser" primary button
 *   - hasReport=true  → "Editar análise" link
 *
 * ⛔ "Regenerar análise" SAIU (founder, 2026-08-03). Era founder-only; agora leitura com
 * relatório não tem porta de UI para gerar de novo — nem aqui, nem no ReadingModeActions.
 * O POST /analyze continua sendo o mesmo da primeira geração, e o resgate manual segue
 * por /admin/regenerar.
 *
 * Phase 7 | Plan 07-09 | UI-SPEC §Surface 1 lines 100-118
 */
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface AnalysisCTAProps {
  readingId: string
  hasReport: boolean
  onTrigger: () => void
}

export function AnalysisCTA({ readingId, hasReport, onTrigger }: AnalysisCTAProps) {
  if (!hasReport) {
    return (
      <Button onClick={onTrigger} size="lg" className="gap-2" data-testid="analysis-cta-generate">
        <Sparkles className="h-4 w-4" aria-hidden />
        {/* 2026-07-30: este botão passou a gerar o MAPA DO SER (o relatório
            principal). Nomear o documento evita a dúvida de "qual dos dois vem?",
            agora que a leitura pode ter dois. */}
        Gerar relatório · Mapa do Ser
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/leituras/${readingId}/editar`}
        className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
      >
        Editar análise
      </Link>
    </div>
  )
}
