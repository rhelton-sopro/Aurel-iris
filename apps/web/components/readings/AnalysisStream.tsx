'use client'

/**
 * AnalysisStream — streaming progress UI (UI-SPEC §Surface 1 State B + §Streaming Visual Cue).
 *
 * Inputs:
 *   - sectionsReceived: number 0..14 (best-effort count from client buffer)
 *   - error: optional error message to render fallback
 *
 * Renders:
 *   - aria-live="polite" region announcing "{N}/14 seções"
 *   - shadcn Progress bar
 *   - 14-row checklist (Check icon for received, Skeleton for pending)
 *   - Hint text reassuring refresh is safe (D-S2)
 *
 * Phase 7 | Plan 07-09 → 07.4-12 (Direction Correction DC-1: 13→14 sections,
 * §14 Mensagem para o Cliente as warm-voice client-delivered closer)
 * UI-SPEC lines 196-208, 300-318
 */
import { Loader2, Check } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SECTION_TITLES = [
  'Constituição e Temperamento',
  'Mapa Orgânico',
  'Linha do Tempo Emocional',
  'Padrões Emocionais Ativos',
  'Eixo Psicossomático',
  'Heranças Transgeracionais',
  'Carências Funcionais',
  'Estado Mental e Nervoso',
  'Recursos e Forças',
  'Dimensão Arquetípica',
  'Sugestões Integrativas',
  'Roteiro de Anamnese',
  'Síntese Integrativa',
  'Mensagem para o Cliente',
]

export interface AnalysisStreamProps {
  sectionsReceived: number
  error?: string | null
}

export function AnalysisStream({ sectionsReceived, error }: AnalysisStreamProps) {
  const safe = Math.min(14, Math.max(0, sectionsReceived))
  const pct = Math.round((safe / 14) * 100)

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>
            Gerando relatório… {safe}/14 seções
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
