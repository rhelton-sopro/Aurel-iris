/**
 * /admin/calibration/[id]/comparar — Phase 7.4 calibration harness.
 *
 * Side-by-side compare of up to THREE report-generation methods, each
 * rendered with the SAME ReportReadView so the only thing differing is the
 * input that fed it:
 *   - Coluna vigente  : production pipeline (Hough) features → Sonnet + RAG
 *   - Coluna SAM       : SAM segmentation features → Sonnet + RAG
 *   - Coluna C         : ANÁLISE DIRETA SONNET — 6 photos → Sonnet, NO
 *                        features, NO RAG (isolates Sonnet's direct vision)
 *
 * Blind toggle (SamCompareShell) randomizes column order + hides identity
 * AND per-column actions until "Revelar". Reads only — never mutates
 * production / SAM columns.
 *
 * Founder-gated by the /admin shell + middleware (same as the sibling page).
 *
 * Phase 7.4 SAM / Sonnet-direct harness.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabase/service'
import { ReportReadView } from '@/components/readings/ReportReadView'
import { ExportPdfButton } from '@/components/readings/ExportPdfButton'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { Badge } from '@/components/ui/badge'
import { RunSamButton } from './RunSamButton'
import { RunSonnetDirectButton } from './RunSonnetDirectButton'
import { SamCompareShell, type CompareColumn } from './SamCompareShell'

export const dynamic = 'force-dynamic'

function getClient(
  c: { full_name: string | null } | { full_name: string | null }[] | null,
): { full_name: string | null } | null {
  if (!c) return null
  return Array.isArray(c) ? (c[0] ?? null) : c
}

function nonEmpty(r: Record<string, string> | null | undefined): boolean {
  return (
    r != null &&
    Object.keys(r).some(
      (k) => k !== 'encerramento_disclaimer' && k !== 'essence_phrase',
    )
  )
}

export default async function SamComparePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: readingId } = await params
  const supabase = createServiceClient()

  // Base fetch — KNOWN columns only. notFound() here means the reading itself
  // is absent — NEVER because the SAM / sonnet columns are missing (those are
  // handled defensively below as actionable states, not a 404).
  const { data: reading, error } = await supabase
    .from('readings')
    .select(
      'id, status, created_at, report_generated, report_delivered, report_generated_at, client:clients(full_name)',
    )
    .eq('id', readingId)
    .maybeSingle()

  if (error || !reading) notFound()

  // Defensive SAM-columns fetch (migration 0016). Absent → actionable notice.
  const { data: samRow, error: samErr } = await supabase
    .from('readings')
    .select('report_generated_sam, report_generated_sam_at, sam_run_metadata')
    .eq('id', readingId)
    .maybeSingle()
  const sam0016Missing = samErr != null

  // Defensive Sonnet-direct-columns fetch (migration 0017). Independent of
  // 0016 — Column C just won't appear until 0017 is applied.
  const { data: sdRow, error: sdErr } = await supabase
    .from('readings')
    .select(
      'report_generated_sonnet_direct, report_generated_sonnet_direct_at, sonnet_direct_run_metadata',
    )
    .eq('id', readingId)
    .maybeSingle()
  const sd0017Missing = sdErr != null

  const client = getClient(reading.client as Parameters<typeof getClient>[0])
  const clientName = client?.full_name ?? 'Cliente'

  const reportGenerated = reading.report_generated as Record<string, string> | null
  const reportDelivered = reading.report_delivered as Record<string, string> | null
  const reportSam =
    (samRow as { report_generated_sam?: Record<string, string> | null } | null)
      ?.report_generated_sam ?? null
  const samMeta =
    (samRow as { sam_run_metadata?: Record<string, unknown> | null } | null)
      ?.sam_run_metadata ?? null
  const samGeneratedAt =
    (samRow as { report_generated_sam_at?: string } | null)
      ?.report_generated_sam_at ?? null

  const reportSonnet =
    (sdRow as { report_generated_sonnet_direct?: Record<string, string> | null } | null)
      ?.report_generated_sonnet_direct ?? null
  const sonnetMeta =
    (sdRow as { sonnet_direct_run_metadata?: Record<string, unknown> | null } | null)
      ?.sonnet_direct_run_metadata ?? null
  const sonnetGeneratedAt =
    (sdRow as { report_generated_sonnet_direct_at?: string } | null)
      ?.report_generated_sonnet_direct_at ?? null

  const vigenteSections = (reportDelivered ?? reportGenerated) ?? null
  const hasVigente = nonEmpty(vigenteSections)
  const hasSam = nonEmpty(reportSam)
  const hasSonnet = nonEmpty(reportSonnet)

  const vigenteDate =
    (reading as { report_generated_at?: string }).report_generated_at ??
    reading.created_at
  const samDate = samGeneratedAt ?? reading.created_at
  const sonnetDate = sonnetGeneratedAt ?? reading.created_at

  // Build the column set — only methods that actually have a report. The
  // blind shell needs ≥2 to be a meaningful comparison.
  const columns: CompareColumn[] = []
  if (hasVigente) {
    columns.push({
      id: 'vigente',
      label: 'Vigente (produção — Hough + RAG)',
      node: (
        <ReportReadView
          sections={vigenteSections as Record<string, string>}
          clientName={clientName}
          readingDate={vigenteDate}
        />
      ),
      actions: <ExportPdfButton readingId={readingId} label="Exportar PDF" />,
    })
  }
  if (hasSam) {
    columns.push({
      id: 'sam',
      label: 'SAM (segmentação paralela + RAG)',
      node: (
        <ReportReadView
          sections={reportSam as Record<string, string>}
          clientName={clientName}
          readingDate={samDate}
        />
      ),
      actions: (
        <ExportPdfButton
          readingId={readingId}
          variant="sam"
          label="Exportar PDF"
        />
      ),
    })
  }
  if (hasSonnet) {
    columns.push({
      id: 'sonnet_direct',
      label: 'Sonnet direto (6 fotos — sem features, sem RAG)',
      node: (
        <ReportReadView
          sections={reportSonnet as Record<string, string>}
          clientName={clientName}
          readingDate={sonnetDate}
        />
      ),
      // No Export PDF for Column C — PDF export is out of scope this phase
      // (founder: comparação inline já é suficiente). Keeping it absent does
      // NOT leak identity: actions are hidden for ALL columns while blind.
    })
  }

  const canCompare = columns.length >= 2

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/calibration/${readingId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Voltar para calibração
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            Comparação de calibração — {clientName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reading: <span className="font-mono text-xs">{readingId}</span>
            {samMeta?.model_version ? (
              <>
                {' '}
                · SAM:{' '}
                <span className="font-mono text-xs">
                  {String(samMeta.model_version)}
                </span>
              </>
            ) : null}
            {sonnetMeta?.method_version ? (
              <>
                {' '}
                · C:{' '}
                <span className="font-mono text-xs">
                  {String(sonnetMeta.method_version)}
                </span>
                {sonnetMeta?.cost_usd != null ? (
                  <> (~${String(sonnetMeta.cost_usd)})</>
                ) : null}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sam0016Missing ? (
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              migration 0016 pendente
            </Badge>
          ) : hasSam ? (
            <Badge variant="default" className="bg-violet-600">
              SAM ✓
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              SAM pendente
            </Badge>
          )}
          {sd0017Missing ? (
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              migration 0017 pendente
            </Badge>
          ) : hasSonnet ? (
            <Badge variant="default" className="bg-emerald-600">
              Coluna C ✓
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Coluna C pendente
            </Badge>
          )}
          {!sam0016Missing && (
            <RunSamButton readingId={readingId} hasSamReport={hasSam} />
          )}
          {!sd0017Missing && (
            <RunSonnetDirectButton readingId={readingId} hasReport={hasSonnet} />
          )}
        </div>
      </header>

      {(sam0016Missing || sd0017Missing) && (
        <div className="rounded-lg border border-dashed border-amber-500 p-4 text-sm text-amber-700">
          {sam0016Missing && (
            <p>
              <strong>Migration 0016 não aplicada</strong> — colunas{' '}
              <span className="font-mono">*_sam</span> ausentes. Rode{' '}
              <span className="font-mono">supabase db push</span> e recarregue.
            </p>
          )}
          {sd0017Missing && (
            <p>
              <strong>Migration 0017 não aplicada</strong> — colunas{' '}
              <span className="font-mono">*_sonnet_direct</span> +{' '}
              <span className="font-mono">report_generations</span> ausentes.
              Rode <span className="font-mono">supabase db push</span> (migration{' '}
              <span className="font-mono">
                0017_report_generations_and_sonnet_direct.sql
              </span>
              ), recarregue, e o botão “Gerar Coluna C” passa a persistir. A
              produção não é afetada.
            </p>
          )}
        </div>
      )}

      {!hasVigente ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Esta leitura ainda não tem relatório de produção (vigente) para
            comparar — gere a análise normal primeiro em{' '}
            <span className="font-mono">/leituras/{readingId}</span>.
          </p>
        </div>
      ) : !canCompare ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Há apenas a coluna vigente. Gere <strong>SAM</strong> e/ou{' '}
            <strong>Coluna C (Sonnet direto)</strong> acima para comparar
            lado a lado (cego). Column C não precisa de Modal — só uma chamada
            Sonnet com as 6 fotos.
          </p>
          {samMeta?.error_summary ? (
            <p className="mt-3 text-sm text-red-600">
              Último erro SAM: {String(samMeta.error_summary)}
            </p>
          ) : null}
        </div>
      ) : (
        <SamCompareShell columns={columns} />
      )}
    </div>
  )
}
