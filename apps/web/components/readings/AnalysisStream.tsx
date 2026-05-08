'use client'

/**
 * AnalysisStream — streaming progress UI (UI-SPEC §Surface 1 State B + §Streaming Visual Cue).
 *
 * Inputs:
 *   - sectionsReceived: number 0..13 (best-effort count from client buffer)
 *   - error: optional error message to render fallback
 *
 * Renders:
 *   - aria-live="polite" region announcing "{N}/13 seções"
 *   - shadcn Progress bar
 *   - 13-row checklist (Check icon for received, Skeleton for pending)
 *   - Hint text reassuring refresh is safe (D-S2)
 *
 * Phase 7 | Plan 07-09 | UI-SPEC lines 196-208, 300-318
 */
import { Loader2, Check } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SECTION_TITLES = [
  'Constituição',
  'Estrutural Física',
  'Indicações Sistêmicas',
  'Toxemia',
  'Psicoemocional',
  'Cargas Temporais',
  'Carências Nutricionais',
  'Simbólico Espiritual',
  'Cuidados Integrativos',
  'Potenciais e Forças',
  'Afirmações de Integração',
  'Síntese Integrativa',
  'Mensagem Final',
]

export interface AnalysisStreamProps {
  sectionsReceived: number
  error?: string | null
}

export function AnalysisStream({ sectionsReceived, error }: AnalysisStreamProps) {
  const safe = Math.min(13, Math.max(0, sectionsReceived))
  const pct = Math.round((safe / 13) * 100)

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>
            Gerando relatório… {safe}/13 seções
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Você pode atualizar a página — o progresso fica salvo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={pct} aria-label="Progresso da geração" />
        <div role="region" aria-live="polite" aria-atomic="false" className="space-y-2">
          {SECTION_TITLES.map((title, i) => {
            const received = i < safe
            return (
              <div key={i} className="flex items-center gap-3">
                {received ? (
                  <Check className="h-4 w-4 text-foreground" aria-hidden />
                ) : (
                  <Skeleton className="h-4 w-4 rounded-sm" />
                )}
                <span className={received ? 'text-sm' : 'text-sm text-muted-foreground'}>
                  {i + 1}. {title}
                </span>
              </div>
            )
          })}
        </div>
        {error && (
          <p className="text-sm text-destructive">
            A geração foi interrompida. As seções já recebidas estão salvas. Clique em &quot;Tentar novamente&quot; para retomar.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
