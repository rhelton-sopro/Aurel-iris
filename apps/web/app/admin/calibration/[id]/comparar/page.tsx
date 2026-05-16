/**
 * /admin/calibration/[id]/comparar — Phase 7.4 SAM comparison harness.
 *
 * Side-by-side: production report (vigente, report_generated/_delivered) vs
 * the parallel SAM report (report_generated_sam), each rendered with the SAME
 * ReportReadView so the only thing differing is the segmentation that fed it.
 * Blind toggle (SamCompareShell) + per-side Export PDF (the SAM side uses the
 * PDF route's ?variant=sam branch). Reads only — never mutates production.
 *
 * Founder-gated by the /admin shell + middleware (same as the sibling page).
 *
 * Phase 7.4 SAM harness.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabase/service'
import { ReportReadView } from '@/components/readings/ReportReadView'
import { ExportPdfButton } from '@/components/readings/ExportPdfButton'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { Badge } from '@/components/ui/badge'
import { RunSamButton } from './RunSamButton'
import { SamCompareShell } from './SamCompareShell'

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
  // is absent — NEVER because the SAM columns / migration 0016 are missing
  // (that is handled defensively below as an actionable state, not a 404).
  const { data: reading, error } = await supabase
    .from('readings')
    .select(
      'id, status, created_at, report_generated, report_delivered, report_generated_at, client:clients(full_name)',
    )
    .eq('id', readingId)
    .maybeSingle()

  if (error || !reading) notFound()

  // Defensive SAM-columns fetch. If migration 0016 is not applied the columns
  // don't exist → PostgREST errors → show an actionable "migration pending"
  // notice instead of a confusing 404 (same robustness as the PDF route).
  const { data: samRow, error: samErr } = await supabase
    .from('readings')
    .select('report_generated_sam, report_generated_sam_at, sam_run_metadata')
    .eq('id', readingId)
    .maybeSingle()
  const migrationMissing = samErr != null

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

  const vigenteSections = (reportDelivered ?? reportGenerated) ?? null
  const hasVigente = nonEmpty(vigenteSections)
  const hasSam = nonEmpty(reportSam)

  const vigenteDate =
    (reading as { report_generated_at?: string }).report_generated_at ??
    reading.created_at
  const samDate = samGeneratedAt ?? reading.created_at

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
            Comparação SAM — {clientName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reading: <span className="font-mono text-xs">{readingId}</span>
            {samMeta?.model_version ? (
              <>
                {' '}
                · SAM: <span className="font-mono text-xs">{String(samMeta.model_version)}</span>
              </>
            ) : null}
            {samGeneratedAt ? (
              <>
                {' '}
                ·{' '}
                <LocalDateTime iso={samGeneratedAt} />
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {migrationMissing ? (
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              migration 0016 pendente
            </Badge>
          ) : hasSam ? (
            <Badge variant="default" className="bg-violet-600">
              SAM gerado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              SAM pendente
            </Badge>
          )}
          {!migrationMissing && (
            <RunSamButton readingId={readingId} hasSamReport={hasSam} />
          )}
        </div>
      </header>

      {migrationMissing ? (
        <div className="rounded-lg border border-dashed border-amber-500 p-8 text-center">
          <p className="text-sm text-amber-700">
            <strong>Migration 0016 não aplicada.</strong> As colunas{' '}
            <span className="font-mono">*_sam</span> ainda não existem no
            banco — por isso a página não conseguia carregar (antes dava 404).
            Rode <span className="font-mono">supabase db push</span> (migration{' '}
            <span className="font-mono">0016_readings_sam_parallel.sql</span>),
            recarregue esta página, e então o botão “Rodar SAM” aparece. A
            produção não é afetada.
          </p>
        </div>
      ) : !hasSam ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Ainda não há relatório SAM para esta leitura. Clique em{' '}
            <strong>Rodar SAM nesta leitura</strong> acima — roda o ramo SAM
            sobre as fotos originais já no Storage (funciona em leituras
            antigas; não refaz a captura). Custo: uma chamada Sonnet (~$0,30).
          </p>
          {samMeta?.error_summary ? (
            <p className="mt-3 text-sm text-red-600">
              Último erro: {String(samMeta.error_summary)}
            </p>
          ) : null}
        </div>
      ) : !hasVigente ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Esta leitura ainda não tem relatório de produção (vigente) para
            comparar — gere a análise normal primeiro em{' '}
            <span className="font-mono">/leituras/{readingId}</span>.
          </p>
        </div>
      ) : (
        <SamCompareShell
          vigente={
            <ReportReadView
              sections={vigenteSections as Record<string, string>}
              clientName={clientName}
              readingDate={vigenteDate}
              topActionsSlot={
                <ExportPdfButton readingId={readingId} label="Exportar PDF" />
              }
            />
          }
          sam={
            <ReportReadView
              sections={reportSam as Record<string, string>}
              clientName={clientName}
              readingDate={samDate}
              topActionsSlot={
                <ExportPdfButton
                  readingId={readingId}
                  variant="sam"
                  label="Exportar PDF"
                />
              }
            />
          }
        />
      )}
    </div>
  )
}
