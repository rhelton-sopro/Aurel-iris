/**
 * Reading editor page — RSC.
 *
 * Phase 7 (07-09-PLAN): legacy 13-section editor surface via EditarClient
 * (which wraps EditorAccordion).
 *
 * Phase 7.4 (07.4-08-PLAN): D-UI3 + D-LEG2 — RSC router by `report_version`.
 *   - V2 path (report_version='2.0' + report_v2 populated): render
 *     <ReportAdaptiveEditor> with the 8 block editors.
 *   - Legacy path (report_version='1.0' or missing report_v2): existing
 *     EditarClient block stays exactly as it was (zero regression for the
 *     25 existing readings backfilled with report_version='1.0').
 *
 * RLS via createClient() session-bound. Therapist must own the reading.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { LocalDateTime } from '@/components/ui/local-date-time'
import type { AuditMetadata } from '@/lib/anthropic/types'
import type { AuditV2Result } from '@/lib/anthropic/types-v2'
import type { ReportV2 } from '@/lib/anthropic/report-schema'
import { ReportAdaptiveEditor } from '@/components/readings/ReportAdaptiveEditor'
import { EditarClient } from './editar-client'

export const dynamic = 'force-dynamic'

export default async function LeituraEditarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: readingId } = await params
  const supabase = await createClient()
  const { data: reading, error } = await supabase
    .from('readings')
    .select(
      'id, status, report_generated, report_delivered, audit_metadata, is_delivered, delivered_at, report_generated_at, report_v2, report_v2_delivered, report_version, client:clients(full_name)',
    )
    .eq('id', readingId)
    .maybeSingle()
  if (error || !reading) notFound()

  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const isDelivered = reading.is_delivered ?? false
  const reportGeneratedAt = reading.report_generated_at ?? null

  // V2 routing (D-UI3): branch by report_version.
  const reportVersion = (reading.report_version ?? '1.0') as '1.0' | '2.0'
  const reportV2 = reading.report_v2 as ReportV2 | null
  const isV2 = reportVersion === '2.0' && reportV2 != null

  if (isV2 && reportV2) {
    const auditMeta = reading.audit_metadata as Record<string, unknown> | null
    const audit = (auditMeta as unknown as AuditV2Result | null) ?? null
    const jsonValidationFailed = Boolean(
      auditMeta && (auditMeta as { json_validation_failed?: boolean }).json_validation_failed,
    )
    return (
      <div className="space-y-6 px-6 py-8">
        <Link
          href={`/leituras/${readingId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Voltar para a leitura
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Editar análise</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cliente: {clientName}
            {reportGeneratedAt && (
              <>
                {' '}
                · Gerada em: <LocalDateTime iso={reportGeneratedAt} />
              </>
            )}
          </p>
        </div>
        <ReportAdaptiveEditor
          readingId={reading.id}
          generated={reportV2}
          delivered={(reading.report_v2_delivered as ReportV2 | null) ?? null}
          audit={audit}
          jsonValidationFailed={jsonValidationFailed}
          isDelivered={isDelivered}
        />
      </div>
    )
  }

  // Legacy 1.0 path — D-LEG2: EditarClient + EditorAccordion render
  // unchanged. The 25 existing readings flow through this branch.
  const reportGenerated = (reading.report_generated as Record<string, string> | null) ?? {}
  const reportDelivered = (reading.report_delivered as Record<string, string> | null) ?? null
  const auditMetadata = (reading.audit_metadata as AuditMetadata | null) ?? null

  return (
    <div className="space-y-6 px-6 py-8">
      <Link
        href={`/leituras/${readingId}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Voltar para a leitura
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Editar análise</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cliente: {clientName}
          {reportGeneratedAt && (
            <>
              {' '}
              · Gerada em: <LocalDateTime iso={reportGeneratedAt} />
            </>
          )}
        </p>
      </div>
      <EditarClient
        readingId={readingId}
        reportGenerated={reportGenerated}
        reportDelivered={reportDelivered}
        auditMetadata={auditMetadata}
        isDelivered={isDelivered}
      />
    </div>
  )
}
