/**
 * GET /api/readings/[id]/pdf
 *
 * Server-side PDF rendering for the Iris Codex 16-section report.
 *
 * Plan 7.4-23 (UAT-4 fix #3): replaces Plan 19 Print CSS approach with a
 * direct file download. Founder approved @react-pdf/renderer install during
 * UAT-4. Browser receives Content-Type: application/pdf with
 * Content-Disposition: attachment; filename, triggering a save dialog.
 *
 * Auth gates:
 *   a) Session present (auth.getUser via createClient)
 *   b) reading owned by therapist (RLS enforces; .maybeSingle() → 404)
 *   c) reading has a report (status ready/edited + report_generated populated)
 *
 * Source jsonb: reportDelivered ?? reportGenerated (delivered version
 * preferred — therapist's edits are what the client should receive).
 *
 * Threat model:
 *   - T-PDF-01 unauthorized download → mitigated by RLS + .maybeSingle()→404
 *   - T-PDF-02 PII in PDF metadata → accept (therapist owns this data)
 *   - T-PDF-03 large reports timeout → accept (~16 sections, small render)
 *
 * Phase 7.4 | Plan 07.4-23 | Supersedes: Plan 19 Print CSS PDF
 */
import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'

import { createClient } from '@/lib/supabase/server'
import { ReportDocument, buildPdfFilename } from '@/lib/pdf/report-document'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: readingId } = await params

  const supabase = await createClient()
  const { data: reading, error } = await supabase
    .from('readings')
    .select(
      'id, status, created_at, report_generated, report_delivered, report_generated_at, client:clients(full_name)',
    )
    .eq('id', readingId)
    .maybeSingle()

  if (error || !reading) {
    return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
  }

  const reportGenerated = reading.report_generated as Record<string, string> | null
  const reportDelivered = reading.report_delivered as Record<string, string> | null
  const hasReport = reportGenerated != null && Object.keys(reportGenerated).length > 0
  const status = reading.status ?? 'pending'

  if (!((status === 'ready' || status === 'edited') && hasReport)) {
    return NextResponse.json(
      { error: 'Report not ready' },
      { status: 409 },
    )
  }

  const reportToShow = (reportDelivered ?? reportGenerated) as Record<string, string>
  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const reportGeneratedAt =
    (reading as { report_generated_at?: string }).report_generated_at ?? null
  const readingDate = reportGeneratedAt ?? reading.created_at

  const filename = buildPdfFilename(clientName, readingDate)

  try {
    const pdfBuffer = await renderToBuffer(
      <ReportDocument
        sections={reportToShow}
        clientName={clientName}
        readingDate={readingDate}
      />,
    )

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[api/readings/[id]/pdf] render error', { readingId, msg })
    return NextResponse.json(
      { error: `PDF render failed: ${msg}` },
      { status: 500 },
    )
  }
}
