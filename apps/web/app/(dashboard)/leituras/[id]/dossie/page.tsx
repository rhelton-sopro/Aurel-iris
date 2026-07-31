/**
 * Página do DOSSIÊ — o relatório técnico que era o principal até 2026-07-30.
 *
 * Desde que o Mapa do Ser assumiu a página da leitura, o Dossiê "abre à parte"
 * (decisão do founder): a leitura mostra o principal, e este documento fica a um
 * clique, para o terapeuta consultar o lastro.
 *
 * Read-only de propósito: as ações que MUDAM estado (editar, concluir, regenerar)
 * continuam na página da leitura, para não existirem em dois lugares.
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { ReportReadView } from '@/components/readings/ReportReadView'
import { ExportPdfButton } from '@/components/readings/ExportPdfButton'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function DossiePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) redirect('/login')

  // RLS já restringe ao dono; o select falha fechado se não for dele.
  const { data: reading } = await supabase
    .from('readings')
    .select(
      'id, created_at, report_generated, report_delivered, report_generated_at, client:clients(full_name)',
    )
    .eq('id', id)
    .maybeSingle()

  const gerado = reading?.report_generated as Record<string, string> | null
  const entregue = reading?.report_delivered as Record<string, string> | null
  if (!reading || gerado == null || Object.keys(gerado).length === 0) notFound()

  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const reportGeneratedAt =
    (reading as { report_generated_at?: string }).report_generated_at ?? null

  return (
    <div className="space-y-6 -mx-7 px-4 py-8 sm:mx-0 sm:px-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/leituras/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Voltar para a leitura
        </Link>
        <span className="text-xs text-muted-foreground">Antigo relatório · Dossiê</span>
      </div>

      <ReportReadView
        sections={(entregue ?? gerado) as Record<string, string>}
        clientName={clientName}
        readingDate={reportGeneratedAt ?? reading.created_at}
        topActionsSlot={<ExportPdfButton readingId={id} label="Dossiê (PDF)" />}
      />
    </div>
  )
}
