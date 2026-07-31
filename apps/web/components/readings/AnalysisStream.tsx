'use client'

/**
 * AnalysisStream — streaming progress UI (UI-SPEC §Surface 1 State B + §Streaming Visual Cue).
 *
 * Inputs:
 *   - sectionsReceived: number 0..15 (best-effort count from client buffer)
 *   - error: optional error message to render fallback
 *
 * Renders:
 *   - aria-live="polite" region announcing "{N}/15 seções"
 *   - shadcn Progress bar
 *   - 15-row checklist (Check icon for received, Skeleton for pending)
 *   - Hint text reassuring refresh is safe (D-S2)
 *
 * Phase 7 | Plan 07-09 → 07.4-12 → 07.4-27 (§2.5 collapsed into §2; 15
 * strictly sequential sections, Síntese Rápida = §15)
 * UI-SPEC lines 196-208, 300-318
 */
import { Loader2, Check } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  NUMBERED_SECTION_HEADINGS,
  SECTION_TITLE_BY_NUMBER,
} from '@/lib/anthropic/types'

// 15 (Plan 27 — 1..15 sequential). Continua sendo o padrão quando `steps` não vem.

// Derived from the single source of truth (Plan 27 — kills the prior
// inline-array drift; was a Plan 18 follow-up debt item).
const SECTION_TITLES: readonly string[] = NUMBERED_SECTION_HEADINGS.map(
  (h) => SECTION_TITLE_BY_NUMBER[h],
)

export interface AnalysisStreamProps {
  sectionsReceived: number
  error?: string | null
  /**
   * Etapas exibidas no checklist. Omitido = as 15 seções do Dossiê (o padrão
   * histórico). Desde 2026-07-30 a geração normal é o **Mapa do Ser**, e a página
   * passa os 7 blocos dele — que vêm do motor, não de uma cópia. Sem isto, o
   * terapeuta via "0/15 seções" e uma lista de títulos que não seriam escritos.
   */
  steps?: readonly string[]
  /** Substantivo do que está sendo contado ("seções" | "blocos"). */
  unidade?: string
}

export function AnalysisStream({
  sectionsReceived,
  error,
  steps,
  unidade = 'seções',
}: AnalysisStreamProps) {
  const titles = steps?.length ? steps : SECTION_TITLES
  const total = titles.length
  const safe = Math.min(total, Math.max(0, sectionsReceived))
  const pct = Math.round((safe / total) * 100)

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Loader2 className="h-4 w-4 animate-spin text-teal" aria-hidden />
          <span>
            Gerando relatório… {safe}/{total} {unidade}
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Você pode atualizar a página — o progresso fica salvo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={pct} aria-label="Progresso da geração" />
        <div role="region" aria-live="polite" aria-atomic="false" className="space-y-2">
          {titles.map((title, i) => {
            const received = i < safe
            // Com steps customizados (Mapa do Ser) a numeração é posicional; no
            // Dossiê continua sendo o número da seção (§1..§15).
            const headingNumber = steps?.length ? i + 1 : NUMBERED_SECTION_HEADINGS[i]
            return (
              <div key={i} className="flex items-center gap-3">
                {received ? (
                  <Check className="h-4 w-4 text-foreground" aria-hidden />
                ) : (
                  <Skeleton className="h-4 w-4 rounded-sm" />
                )}
                <span className={received ? 'text-sm' : 'text-sm text-muted-foreground'}>
                  {headingNumber}. {title}
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
