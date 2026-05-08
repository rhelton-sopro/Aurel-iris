import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { LocalDateTime } from '@/components/ui/local-date-time'
import type { AuditMetadata } from '@/lib/anthropic/types'
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
      'id, status, report_generated, report_delivered, audit_metadata, is_delivered, delivered_at, report_generated_at, client:clients(full_name)',
    )
    .eq('id', readingId)
    .maybeSingle()
  if (error || !reading) notFound()

  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const reportGenerated = (reading.report_generated as Record<string, string> | null) ?? {}
  const reportDelivered = (reading.report_delivered as Record<string, string> | null) ?? null
  const auditMetadata = (reading.audit_metadata as AuditMetadata | null) ?? null
  const isDelivered = reading.is_delivered ?? false
  const reportGeneratedAt = reading.report_generated_at ?? null

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
