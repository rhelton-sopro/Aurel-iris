/**
 * Reading detail page — RSC.
 *
 * Phase 7 (07-09-PLAN): Surface 1 (UI-SPEC §Surface 1 lines 178-220).
 * Renders one of 3 states based on persisted readings state:
 *   A — empty (report_generated IS NULL): show "Gerar análise" CTA
 *   B — streaming (client-driven, ephemeral): handled by analise-client.tsx
 *   C — generated (report_generated populated): show "Editar análise" + regen
 *
 * Phase 7.4 (07.4-08-PLAN): D-UI3 + D-LEG2 — RSC router by `report_version`.
 *   - V2 path (report_version='2.0' + report_v2 populated): render
 *     <ReportAdaptiveView> below the hero with AdvancedAnalysisCTA in footerSlot.
 *   - Legacy path (report_version='1.0' or missing report_v2): existing
 *     AnalysisHero + AnaliseClient block stays exactly as it was (zero regression
 *     for 25 existing readings backfilled with report_version='1.0').
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
import { ReportAdaptiveView } from '@/components/readings/ReportAdaptiveView'
import { AdvancedAnalysisCTA } from '@/components/readings/AdvancedAnalysisCTA'
import type { ReportV2 } from '@/lib/anthropic/report-schema'
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
      'id, status, created_at, report_generated, report_delivered, audit_metadata, regeneration_count, is_delivered, delivered_at, vision_features, report_v2, report_v2_delivered, report_version, client:clients(full_name, birth_date)',
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

  // V2 routing (D-UI3): branch render by report_version.
  const reportV2 = reading.report_v2 as ReportV2 | null
  const reportV2Delivered = reading.report_v2_delivered as ReportV2 | null
  const reportVersion = (reading.report_version ?? '1.0') as '1.0' | '2.0'
  const isV2 = reportVersion === '2.0' || reportV2 != null
  const hasReportV2 =
    isV2 && reportV2 != null && Object.keys(reportV2).length > 0

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
          server-side data + delegates streaming-state UI to analise-client.
          UNCHANGED for legacy 1.0 path — D-LEG2 zero regression. The V2 path
          ALSO uses the same hero for empty/streaming states; the adaptive
          report body renders below the hero when report_v2 is populated. */}
      <AnalysisHero
        readingId={readingId}
        hasReport={isV2 ? hasReportV2 : hasReport}
        status={status as never}
        regenerationCount={regenerationCount}
        isDelivered={isDelivered}
        deliveredAt={reading.delivered_at}
        reportGeneratedAt={
          (reading as { report_generated_at?: string }).report_generated_at ?? null
        }
        auditMetadata={reading.audit_metadata as never}
      >
        {/* Client island for streaming state machine + fetch.
            reportVersion drives the streaming UI switch in analise-client.tsx
            (V2 → AdaptiveAnalysisStream; legacy → AnalysisStream). */}
        <AnaliseClient
          readingId={readingId}
          hasInitialReport={isV2 ? hasReportV2 : hasReport}
          regenerationCount={regenerationCount}
          isDelivered={isDelivered}
          reportVersion={reportVersion}
        />
      </AnalysisHero>

      {/* V2 path (D-UI3): adaptive report body below the hero. Prefers the
          delivered jsonb if present, falls back to generated. Legacy 1.0
          readings skip this entire branch — the editar route renders their
          report via EditorAccordion (unchanged). */}
      {isV2 && hasReportV2 && (
        <ReportAdaptiveView
          report={(reportV2Delivered ?? reportV2) as ReportV2}
          footerSlot={<AdvancedAnalysisCTA />}
        />
      )}
    </div>
  )
}
