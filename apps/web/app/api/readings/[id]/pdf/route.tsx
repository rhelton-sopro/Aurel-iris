/**
 * GET /api/readings/[id]/pdf
 *
 * Server-side PDF rendering for the Iris Codex 16-section report.
 *
 * Plan 7.4-26 (UAT-5 PDF rebuild): @react-pdf/renderer (Plan 23) failed 3 UAT
 * rounds — the decisive fix is architectural, not another patch. This route
 * now renders the report as real HTML/CSS (lib/pdf/report-print-document) and
 * delegates PDF conversion to a Gotenberg (headless Chromium) service running
 * on Render — the binary that Vercel serverless can't host runs where it can,
 * and Vercel's role shrinks to a single fetch(). Full CSS3: §16 grid, brand
 * colors, emoji, future logo/icons/images. Still a direct file download — one
 * button, no browser interaction (NOT window.print()).
 *
 * Env contract (set in Vercel project settings):
 *   - GOTENBERG_URL          required, e.g. https://iris-gotenberg.onrender.com
 *   - GOTENBERG_BASIC_AUTH   optional "user:pass" (if the Gotenberg service has
 *                            --api-enable-basic-auth — recommended so it's not
 *                            an open HTML→PDF proxy)
 *
 * Auth gates (unchanged):
 *   a) Session present (RLS via createClient)
 *   b) reading owned by therapist (RLS + .maybeSingle() → 404)
 *   c) reading has a report (status ready/edited + report_generated populated)
 *
 * Source jsonb: reportDelivered ?? reportGenerated (delivered preferred —
 * the therapist's edits are what the client should receive).
 *
 * Threat model:
 *   - T-PDF-01 unauthorized download → RLS + .maybeSingle()→404
 *   - T-PDF-02 PII in PDF metadata → accept (therapist owns this data)
 *   - T-PDF-03 PII egress to renderer → Gotenberg is self-hosted on Render
 *     (the founder's own infra), not a third-party SaaS; lock it with basic
 *     auth + a non-guessable URL
 *   - T-PDF-04 render timeout → 45s AbortController inside maxDuration 60
 *
 * Phase 7.4 | Plan 07.4-26 | Supersedes: Plan 23 @react-pdf/renderer
 */
import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  renderReportPrintHtml,
  renderFooterHtml,
  buildPdfFilename,
} from '@/lib/pdf/report-print-document'

export const runtime = 'nodejs'
export const maxDuration = 60

const RENDER_TIMEOUT_MS = 45_000

/** First sentence of the disclaimer, condensed for the per-page running footer. */
function disclaimerFooterLine(sections: Record<string, string>): string {
  const raw = sections['encerramento_disclaimer'] ?? ''
  const flat = raw
    .replace(/[#>*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return 'Relatório de apoio à anamnese terapêutica integrativa.'
  const firstSentence = flat.split(/(?<=[.!?])\s/)[0] ?? flat
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}…` : firstSentence
}

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
    return NextResponse.json({ error: 'Report not ready' }, { status: 409 })
  }

  const reportToShow = (reportDelivered ?? reportGenerated) as Record<string, string>
  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const reportGeneratedAt =
    (reading as { report_generated_at?: string }).report_generated_at ?? null
  const readingDate = reportGeneratedAt ?? reading.created_at

  const gotenbergUrl = process.env.GOTENBERG_URL
  if (!gotenbergUrl) {
    console.error('[api/readings/[id]/pdf] GOTENBERG_URL is not configured')
    return NextResponse.json(
      { error: 'PDF service not configured (GOTENBERG_URL missing)' },
      { status: 503 },
    )
  }

  const indexHtml = await renderReportPrintHtml({
    sections: reportToShow,
    clientName,
    readingDate,
  })
  const footerHtml = renderFooterHtml(clientName, disclaimerFooterLine(reportToShow))
  const filename = buildPdfFilename(clientName, readingDate)

  const form = new FormData()
  form.append(
    'files',
    new Blob([indexHtml], { type: 'text/html' }),
    'index.html',
  )
  form.append(
    'files',
    new Blob([footerHtml], { type: 'text/html' }),
    'footer.html',
  )
  // A4 in inches. Top/left/right margin = 0 so the black cover bleeds to the
  // paper edge (page whitespace is CSS padding in PRINT_CSS, not page margin).
  // Only the bottom 0.6in is reserved — Gotenberg renders footer.html there
  // on every page (ivory plinth). printBackground is essential (black cover,
  // §16 card fills, teal rules).
  form.append('paperWidth', '8.27')
  form.append('paperHeight', '11.69')
  form.append('marginTop', '0')
  form.append('marginBottom', '0.6')
  form.append('marginLeft', '0')
  form.append('marginRight', '0')
  form.append('printBackground', 'true')
  form.append('scale', '1.0')

  const headers: Record<string, string> = {}
  const basicAuth = process.env.GOTENBERG_BASIC_AUTH
  if (basicAuth) {
    headers.Authorization = `Basic ${Buffer.from(basicAuth).toString('base64')}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)
  try {
    const res = await fetch(
      `${gotenbergUrl.replace(/\/$/, '')}/forms/chromium/convert/html`,
      { method: 'POST', body: form, headers, signal: controller.signal },
    )

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[api/readings/[id]/pdf] gotenberg error', {
        readingId,
        status: res.status,
        detail: detail.slice(0, 500),
      })
      return NextResponse.json(
        { error: `PDF render failed (gotenberg ${res.status})` },
        { status: 502 },
      )
    }

    const pdf = await res.arrayBuffer()
    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    const msg = aborted ? `timeout after ${RENDER_TIMEOUT_MS}ms` : err instanceof Error ? err.message : 'unknown'
    console.error('[api/readings/[id]/pdf] gotenberg request failed', { readingId, msg })
    return NextResponse.json(
      { error: aborted ? 'PDF render timed out' : 'PDF service unreachable' },
      { status: 502 },
    )
  } finally {
    clearTimeout(timeout)
  }
}
