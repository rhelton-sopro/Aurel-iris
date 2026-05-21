/**
 * Reading editor page — RSC.
 *
 * Phase 7 (07-09-PLAN): legacy 13-section editor surface via EditarClient
 * (which wraps EditorAccordion).
 *
 * Phase 7.4 Plan 10 (Direction Correction — see 07.4-CONTEXT.md DC-1..DC-10):
 *   The 8-block ReportAdaptiveEditor early-return has been removed. All
 *   readings route through the legacy EditarClient + EditorAccordion path
 *   until Plan 12 rebuilds the v2 editor around 14 markdown sections.
 *
 * RLS via createClient() session-bound. Therapist must own the reading.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { runAudit } from '@/lib/anthropic/audit'
import type { ReportJsonb } from '@/lib/anthropic/types'
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
      'id, status, report_generated, report_delivered, audit_metadata, is_delivered, delivered_at, report_generated_at, client:clients(id, full_name, phone, is_self)',
    )
    .eq('id', readingId)
    .maybeSingle()
  if (error || !reading) notFound()

  const clientRel = reading.client as
    | { full_name?: string; phone?: string | null; is_self?: boolean }
    | null
  const clientName = clientRel?.full_name ?? 'Cliente'
  const clientPhone = clientRel?.phone ?? null
  const isSelfReading = clientRel?.is_self === true
  const isDelivered = reading.is_delivered ?? false
  const reportGeneratedAt = reading.report_generated_at ?? null

  // Legacy 1.0 path — EditarClient + EditorAccordion render unchanged.
  const reportGenerated = (reading.report_generated as Record<string, string> | null) ?? {}
  const reportDelivered = (reading.report_delivered as Record<string, string> | null) ?? null
  // Recompute audit from the CURRENT report (not the frozen generate-time
  // snapshot) so the banner reflects edits + the live detection rules and
  // pinpoints the section. Delivery hard-block stays in the save action.
  const reportForAudit =
    reportDelivered ??
    (Object.keys(reportGenerated).length > 0 ? reportGenerated : null)
  const auditMetadata = reportForAudit
    ? runAudit(reportForAudit as unknown as ReportJsonb)
    : null

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
        isSelfReading={isSelfReading}
        clientName={clientName}
        clientPhone={clientPhone}
      />
    </div>
  )
}
