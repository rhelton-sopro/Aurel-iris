/**
 * Reading detail page — RSC.
 *
 * Phase 7 (07-09-PLAN): Surface 1 (UI-SPEC §Surface 1 lines 178-220).
 * Renders one of 3 states based on persisted readings state:
 *   A — empty (report_generated IS NULL): show "Gerar análise" CTA
 *   B — streaming (client-driven, ephemeral): handled by analise-client.tsx
 *   C — generated (report_generated populated): show "Editar análise" + regen
 *
 * Auth + RLS via createClient() session-bound. Therapist must own the reading
 * to see it (RLS enforces; route returns 404 via `notFound()` if missing).
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { StatusBadge } from '@/components/readings/StatusBadge'
import { AnalysisHero } from '@/components/readings/AnalysisHero'
import { AnaliseClient } from './analise-client'

export const dynamic = 'force-dynamic'

export default async function LeituraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: readingId } = await params

  const supabase = await createClient()
  const { data: reading, error } = await supabase
    .from('readings')
    .select(
      'id, status, created_at, report_generated, report_delivered, audit_metadata, regeneration_count, is_delivered, delivered_at, vision_features, client:clients(full_name, birth_date)',
    )
    .eq('id', readingId)
    .maybeSingle()

  if (error || !reading) notFound()

  const clientName = (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const reportGenerated = reading.report_generated as Record<string, string> | null
  const hasReport = reportGenerated != null && Object.keys(reportGenerated).length > 0
  const regenerationCount = reading.regeneration_count ?? 0
  const isDelivered = reading.is_delivered ?? false
  const status = reading.status ?? 'pending'

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/leituras"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Voltar para leituras
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Análise da leitura</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cliente: {clientName} · Capturada em:{' '}
            <LocalDateTime iso={reading.created_at} />
          </p>
        </div>
        <StatusBadge status={status as never} />
      </div>

      {/* The hero card decides which State (A/B/C) to render based on
          server-side data + delegates streaming-state UI to analise-client. */}
      <AnalysisHero
        readingId={readingId}
        hasReport={hasReport}
        status={status as never}
        regenerationCount={regenerationCount}
        isDelivered={isDelivered}
        deliveredAt={reading.delivered_at}
        reportGeneratedAt={
          (reading as { report_generated_at?: string }).report_generated_at ?? null
        }
        auditMetadata={reading.audit_metadata as never}
      >
        {/* Client island for streaming state machine + fetch */}
        <AnaliseClient
          readingId={readingId}
          hasInitialReport={hasReport}
          regenerationCount={regenerationCount}
          isDelivered={isDelivered}
        />
      </AnalysisHero>
    </div>
  )
}
