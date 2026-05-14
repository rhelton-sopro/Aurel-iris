/**
 * Print-optimized reading page — RSC.
 *
 * Phase 7.4 | Plan 07.4-19 (UAT-3 PDF export via Print CSS)
 *
 * Founder picked Print CSS over @react-pdf/renderer to avoid a new dep.
 * Browser handles the actual PDF generation via "Save as PDF" in the
 * print dialog (which auto-opens via PrintTrigger).
 *
 * Composition top → bottom:
 *   - Screen-only banner: print instructions + "Voltar" link (print:hidden)
 *   - Print-included header: "Iris Codex" wordmark + tagline
 *   - ReportReadView (NO topActionsSlot — no buttons in PDF)
 *   - PrintTrigger (auto-fires window.print() after 250ms)
 *
 * Auth + RLS via createClient() session-bound. Therapist must own the
 * reading; notFound() if missing/RLS-blocked or report not ready.
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { ReportReadView } from '@/components/readings/ReportReadView'
import { PrintTrigger } from './print-trigger'

export const dynamic = 'force-dynamic'

export default async function LeituraPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: readingId } = await params

  const supabase = await createClient()
  const { data: reading, error } = await supabase
    .from('readings')
    .select(
      'id, status, created_at, report_generated, report_delivered, is_delivered, delivered_at, report_generated_at, client:clients(full_name)',
    )
    .eq('id', readingId)
    .maybeSingle()

  if (error || !reading) notFound()

  const reportGenerated = reading.report_generated as Record<string, string> | null
  const reportDelivered = reading.report_delivered as Record<string, string> | null
  const hasReport = reportGenerated != null && Object.keys(reportGenerated).length > 0
  const status = reading.status ?? 'pending'
  const isReadingMode = (status === 'ready' || status === 'edited') && hasReport

  if (!isReadingMode) {
    // Print only makes sense for ready reports — bounce back to the detail
    // page so user sees the appropriate State A/B UI.
    redirect(`/leituras/${readingId}`)
  }

  const reportToShow = (reportDelivered ?? reportGenerated) as Record<string, string>
  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const reportGeneratedAt =
    (reading as { report_generated_at?: string }).report_generated_at ?? null

  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto max-w-prose px-6 py-4 print:hidden">
        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          <p>
            Esta é a versão para impressão. Use{' '}
            <kbd className="rounded border bg-background px-1.5 py-0.5 text-xs">Ctrl+P</kbd>{' '}
            (Windows) ou{' '}
            <kbd className="rounded border bg-background px-1.5 py-0.5 text-xs">Cmd+P</kbd>{' '}
            (Mac) e escolha &quot;Salvar como PDF&quot; no destino.
          </p>
          <Link
            href={`/leituras/${readingId}`}
            className="mt-2 inline-block text-muted-foreground hover:underline"
          >
            ← Voltar para a leitura
          </Link>
        </div>
      </div>

      <main className="px-6 py-4 print:px-0 print:py-0">
        <header className="mx-auto mb-8 max-w-prose border-b pb-4 text-center print:mb-12">
          <h1 className="font-serif text-2xl font-bold tracking-tight">Iris Codex</h1>
          <p className="font-serif text-sm italic text-muted-foreground">
            A íris como mapa do ser.
          </p>
        </header>

        <ReportReadView
          sections={reportToShow}
          clientName={clientName}
          readingDate={reportGeneratedAt ?? reading.created_at}
        />
      </main>

      <PrintTrigger />
    </div>
  )
}
