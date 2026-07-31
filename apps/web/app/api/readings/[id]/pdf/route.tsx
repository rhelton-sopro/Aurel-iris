/**
 * GET /api/readings/[id]/pdf
 *
 * Server-side PDF rendering for the Iris Codex 15-section report.
 *
 * Plan 7.4-26 (UAT-5 PDF rebuild): @react-pdf/renderer failed 3 UAT rounds —
 * the report is rendered as real HTML/CSS (lib/pdf/report-print-document) and
 * Gotenberg (headless Chromium on Render) does the PDF conversion; Vercel's
 * role is the fetch() orchestration. Full CSS3: §15 grid, brand colors, emoji.
 *
 * Plan 7.4-28 (UAT iter-4): SPLIT + MERGE. The cover must bleed with NO
 * running header while every other page carries a horizontal-logo header;
 * Chromium has no per-page header skip, so we render TWO PDFs (cover, then
 * body-with-header/footer) and merge them via Gotenberg pdfengines. Three
 * Gotenberg calls (cover render, body render, merge) inside one 45s budget.
 * Direct file download — one button, no browser interaction.
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
import { filterSectionsForClient } from '@/lib/anthropic/types'
import { getClientReportSections } from '@/lib/admin/client-report-config'
import {
  renderCoverHtml,
  renderBodyHtml,
  renderHeaderHtml,
  renderFooterHtml,
  buildPdfFilename,
} from '@/lib/pdf/report-print-document'
// Surface 1 (LGPD-05) — fallback do rodapé do PDF ancorado na copy canônica.
import { DISCLAIMER_COMPACT } from '@/components/legal/DisclaimerCopy'

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
  if (!flat) return DISCLAIMER_COMPACT
  const firstSentence = flat.split(/(?<=[.!?])\s/)[0] ?? flat
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}…` : firstSentence
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: readingId } = await params

  // Phase 7.4 SAM harness: ?variant=sam renders the parallel SAM report
  // (report_generated_sam) through the SAME Gotenberg path — marginal cost,
  // no code duplication. Default (absent/any other value) = production report.
  const variant = request.nextUrl.searchParams.get('variant')
  const isSam = variant === 'sam'
  // "Versão do cliente" (2026-06-21): mesmo relatório de produção, mas reduzido
  // ao subconjunto de seções escolhido pelo founder (app_settings). O filtro é
  // aplicado depois de resolver reportToShow; o gerador renumera por posição.
  const isClient = variant === 'client'

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

  let reportToShow: Record<string, string>
  if (isSam) {
    // SAM column fetched ONLY here — the default production select above never
    // references report_generated_sam, so this route is byte-identical to its
    // pre-SAM behaviour on the normal path and safe to deploy before the
    // migration (no production-breakage ordering coupling).
    const { data: samRow } = await supabase
      .from('readings')
      .select('report_generated_sam')
      .eq('id', readingId)
      .maybeSingle()
    const reportSam =
      (samRow as { report_generated_sam?: Record<string, string> | null } | null)
        ?.report_generated_sam ?? null
    // SAM report existence is its own gate (independent of production status —
    // a SAM run can exist for a reading in any production state).
    if (reportSam == null || Object.keys(reportSam).length === 0) {
      return NextResponse.json(
        { error: 'SAM report not generated for this reading' },
        { status: 409 },
      )
    }
    reportToShow = reportSam
  } else {
    const hasReport =
      reportGenerated != null && Object.keys(reportGenerated).length > 0
    const status = reading.status ?? 'pending'
    if (!((status === 'ready' || status === 'edited') && hasReport)) {
      return NextResponse.json({ error: 'Report not ready' }, { status: 409 })
    }
    reportToShow = (reportDelivered ?? reportGenerated) as Record<string, string>
  }

  // Versão do cliente: filtra o jsonb pro subconjunto global. Mantém disclaimer
  // + _display_order; o render renumera as seções presentes 1..N (sem buracos).
  if (isClient) {
    const allowed = await getClientReportSections()
    reportToShow = filterSectionsForClient(reportToShow, allowed)
  }

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

  const props = { sections: reportToShow, clientName, readingDate }
  // Rótulo da capa por variante (naming do founder, 2026-07-30): o documento
  // completo é o **Dossiê** (do terapeuta); a versão do cliente é um recorte
  // dele e por isso NÃO se chama dossiê — fica no rótulo neutro.
  const coverHtml = renderCoverHtml(props, isClient ? 'Leitura Iridológica' : 'Dossiê')
  const bodyHtml = await renderBodyHtml(props)
  const headerHtml = renderHeaderHtml(clientName)
  const footerHtml = renderFooterHtml(clientName, disclaimerFooterLine(reportToShow))
  const filename = isSam
    ? buildPdfFilename(clientName, readingDate).replace(/\.pdf$/i, '-SAM.pdf')
    : isClient
      ? buildPdfFilename(clientName, readingDate).replace(/\.pdf$/i, '-cliente.pdf')
      : buildPdfFilename(clientName, readingDate)

  const base = gotenbergUrl.replace(/\/$/, '')
  const headers: Record<string, string> = {}
  const basicAuth = process.env.GOTENBERG_BASIC_AUTH
  if (basicAuth) {
    headers.Authorization = `Basic ${Buffer.from(basicAuth).toString('base64')}`
  }

  // Split render (Plan 7.4-28): the cover must bleed with NO running header,
  // every other page carries the horizontal-logo header — Chromium has no
  // per-page header skip, so we render two PDFs and merge them. A4 in inches.
  const blob = (s: string) => new Blob([s], { type: 'text/html' })

  const coverForm = new FormData()
  coverForm.append('files', blob(coverHtml), 'index.html')
  coverForm.append('paperWidth', '8.27')
  coverForm.append('paperHeight', '11.69')
  coverForm.append('marginTop', '0')
  coverForm.append('marginBottom', '0')
  coverForm.append('marginLeft', '0')
  coverForm.append('marginRight', '0')
  coverForm.append('printBackground', 'true')
  coverForm.append('scale', '1.0')

  const bodyForm = new FormData()
  bodyForm.append('files', blob(bodyHtml), 'index.html')
  bodyForm.append('files', blob(headerHtml), 'header.html')
  bodyForm.append('files', blob(footerHtml), 'footer.html')
  bodyForm.append('paperWidth', '8.27')
  bodyForm.append('paperHeight', '11.69')
  // iter-6 — breathing doubled. The header/footer render in fixed-height
  // bands inside marginTop/marginBottom; widening the margins is the only
  // per-page lever for the gap between the running header/footer and the
  // body (CSS padding can't reach the repeated bands). marginTop/Bottom
  // ≈ 2× the prior post-header/pre-footer gap. L/R 0.7in is the content
  // column (internal CSS padding ~0 so insets don't double). Cover render
  // keeps all margins 0 (bleed).
  bodyForm.append('marginTop', '1.2')
  bodyForm.append('marginBottom', '1.0')
  bodyForm.append('marginLeft', '0.7')
  bodyForm.append('marginRight', '0.7')
  bodyForm.append('printBackground', 'true')
  bodyForm.append('scale', '1.0')
  // CHANGE 4 — Chromium emits a clickable PDF bookmark tree from the heading
  // structure (the §1..§15 h2.sec-title), giving real in-PDF navigation.
  bodyForm.append('generateDocumentOutline', 'true')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)

  const post = async (path: string, body: FormData): Promise<Response> =>
    fetch(`${base}${path}`, {
      method: 'POST',
      body,
      headers,
      signal: controller.signal,
    })

  try {
    const coverRes = await post('/forms/chromium/convert/html', coverForm)
    if (!coverRes.ok) {
      const detail = await coverRes.text().catch(() => '')
      console.error('[api/readings/[id]/pdf] gotenberg cover error', {
        readingId,
        status: coverRes.status,
        detail: detail.slice(0, 500),
      })
      return NextResponse.json(
        { error: `PDF render failed (cover, gotenberg ${coverRes.status})` },
        { status: 502 },
      )
    }
    const coverPdf = await coverRes.arrayBuffer()

    const bodyRes = await post('/forms/chromium/convert/html', bodyForm)
    if (!bodyRes.ok) {
      const detail = await bodyRes.text().catch(() => '')
      console.error('[api/readings/[id]/pdf] gotenberg body error', {
        readingId,
        status: bodyRes.status,
        detail: detail.slice(0, 500),
      })
      return NextResponse.json(
        { error: `PDF render failed (body, gotenberg ${bodyRes.status})` },
        { status: 502 },
      )
    }
    const bodyPdf = await bodyRes.arrayBuffer()

    // Merge cover + body. Gotenberg orders by filename — the numeric prefixes
    // keep cover first. Merge engine is forced to pdftk first
    // (render.yaml --pdfengines-merge-engines=pdftk,qpdf,pdfcpu): pdftk `cat`
    // preserves the body's named destinations so the Índice anchor links
    // survive the merge. qpdf `--pages` (the prior default) dropped them.
    const mergeForm = new FormData()
    mergeForm.append(
      'files',
      new Blob([coverPdf], { type: 'application/pdf' }),
      '1_cover.pdf',
    )
    mergeForm.append(
      'files',
      new Blob([bodyPdf], { type: 'application/pdf' }),
      '2_body.pdf',
    )
    const mergeRes = await post('/forms/pdfengines/merge', mergeForm)
    if (!mergeRes.ok) {
      const detail = await mergeRes.text().catch(() => '')
      console.error('[api/readings/[id]/pdf] gotenberg merge error', {
        readingId,
        status: mergeRes.status,
        detail: detail.slice(0, 500),
      })
      return NextResponse.json(
        { error: `PDF merge failed (gotenberg ${mergeRes.status})` },
        { status: 502 },
      )
    }

    const pdf = await mergeRes.arrayBuffer()
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
    const msg = aborted
      ? `timeout after ${RENDER_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : 'unknown'
    console.error('[api/readings/[id]/pdf] gotenberg request failed', { readingId, msg })
    return NextResponse.json(
      { error: aborted ? 'PDF render timed out' : 'PDF service unreachable' },
      { status: 502 },
    )
  } finally {
    clearTimeout(timeout)
  }
}
