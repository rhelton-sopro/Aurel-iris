/**
 * AnalysisHero — RSC wrapper Card deciding A/B/C state for the detail page.
 *
 * Server-side: renders the static frame (Card + state copy). Streaming state B
 * is delegated to the client island (children — typically <AnaliseClient>).
 *
 * Phase 7 | Plan 07-09 | UI-SPEC §Surface 1 lines 178-220
 */
import { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { ReprocessButton } from '@/components/readings/ReprocessButton'

export interface AnalysisHeroProps {
  readingId: string
  hasReport: boolean
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'edited'
  regenerationCount: number
  isDelivered: boolean
  deliveredAt: string | null
  reportGeneratedAt: string | null
  auditMetadata: { low_anchor_rate?: boolean; forbidden_vocab?: unknown[] } | null
  children: ReactNode
}

export function AnalysisHero({
  readingId,
  status,
  hasReport,
  reportGeneratedAt,
  isDelivered,
  auditMetadata,
  children,
}: AnalysisHeroProps) {
  // Status not ready = State "waiting"
  if (status !== 'ready' && status !== 'edited' && !hasReport) {
    // 2026-05-22 (caso Caroline): leituras que ficaram presas em 'pending'
    // — auto-finalize do upload route não rodou, finalize do client falhou
    // silenciosamente — precisam de um caminho de cura manual pro terapeuta.
    // ReprocessButton valida count=6 server-side; se faltar foto, mostra
    // toast claro em vez de aceitar a captura incompleta.
    const showReprocess = status === 'pending' || status === 'failed'
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-xl">
            {status === 'failed'
              ? 'Processamento falhou'
              : 'Captura aguardando finalização'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {status === 'failed'
              ? 'O processamento desta leitura falhou. Clique em Reprocessar para tentar novamente.'
              : 'Esta leitura ainda não foi marcada como pronta. Se a captura está completa (6 fotos), clique em Reprocessar para liberar a geração da análise.'}
          </p>
          {showReprocess && (
            <ReprocessButton
              readingId={readingId}
              status={status}
              size="default"
              variant="default"
            />
          )}
        </CardContent>
      </Card>
    )
  }

  // State A — empty
  if (!hasReport) {
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-xl">Pronto para gerar a análise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            As features de visão estão prontas. Ao clicar abaixo, geramos um relatório iridológico em pt-BR ancorado em conhecimento de referência. O texto chega em streaming e pode ser revisado e editado antes de entregar ao cliente.
          </p>
          {children}
        </CardContent>
      </Card>
    )
  }

  // State C — generated (children = AnalysisCTA editar/regenerar)
  const auditOk = !(auditMetadata?.low_anchor_rate || (auditMetadata?.forbidden_vocab?.length ?? 0) > 0)
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-xl">Análise pronta para revisão</CardTitle>
        <p className="text-sm text-muted-foreground">
          {reportGeneratedAt && (
            <>
              Gerada em <LocalDateTime iso={reportGeneratedAt} />
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={auditOk ? 'outline' : 'destructive'}>
            {auditOk ? 'Auditoria OK' : 'Revisão recomendada'}
          </Badge>
          {isDelivered && <Badge variant="outline">Entregue ao cliente</Badge>}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
