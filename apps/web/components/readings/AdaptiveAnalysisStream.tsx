'use client'

/**
 * AdaptiveAnalysisStream — streaming progress UI for the V2 (report_version='2.0') path.
 *
 * Counts 8 top-level blocks (vs 13 sections in legacy AnalysisStream). One
 * Skeleton placeholder per pending block; Check icon per completed block.
 * `aria-live="polite"` on the progress region so screen readers announce
 * progress without interrupting the user.
 *
 * Caller (Plan 07.4-08 page route) passes `blocksReceived` derived from the
 * SSE stream parser (Plan 07.4-04). When `error` is set, a fallback message
 * is rendered below the checklist.
 *
 * Phase 7.4 | Plan 07.4-07 | Decisões: D-VAL3
 */
import { Check, Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

const BLOCK_TITLES = [
  'Resumo executivo',
  'Padrão constitucional',
  'Sistemas com tendência',
  'Eixos integrativos',
  'Achados bilaterais',
  'Síntese terapêutica',
  'Foco prioritário',
  'Nota clínica',
] as const

const TOTAL_BLOCKS = BLOCK_TITLES.length

export interface AdaptiveAnalysisStreamProps {
  blocksReceived: number
  error?: string | null
}

export function AdaptiveAnalysisStream({
  blocksReceived,
  error,
}: AdaptiveAnalysisStreamProps) {
  const safe = Math.min(TOTAL_BLOCKS, Math.max(0, blocksReceived))
  const pct = Math.round((safe / TOTAL_BLOCKS) * 100)

  return (
    <Card className="max-w-3xl" data-testid="adaptive-analysis-stream">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span data-testid="adaptive-analysis-stream-counter">
            Gerando relatório… {safe}/{TOTAL_BLOCKS} blocos
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Você pode atualizar a página — o progresso fica salvo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={pct} aria-label="Progresso da geração" />
        <div
          role="region"
          aria-live="polite"
          aria-atomic="false"
          className="space-y-2"
        >
          {BLOCK_TITLES.map((title, i) => {
            const received = i < safe
            return (
              <div key={title} className="flex items-center gap-3">
                {received ? (
                  <Check className="h-4 w-4 text-foreground" aria-hidden />
                ) : (
                  <Skeleton className="h-4 w-4 rounded-sm" />
                )}
                <span
                  className={
                    received ? 'text-sm' : 'text-sm text-muted-foreground'
                  }
                >
                  {i + 1}. {title}
                </span>
              </div>
            )
          })}
        </div>
        {error && (
          <p className="text-sm text-destructive" data-testid="adaptive-analysis-stream-error">
            A geração foi interrompida. Você pode tentar novamente quando quiser.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
