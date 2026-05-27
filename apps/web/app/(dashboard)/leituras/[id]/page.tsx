/**
 * Reading detail page — RSC.
 *
 * Phase 7 (07-09-PLAN): Surface 1 (UI-SPEC §Surface 1 lines 178-220).
 * Renders one of 3 states based on persisted readings state:
 *   A — empty (report_generated IS NULL): show "Gerar análise" CTA
 *   B — streaming (client-driven, ephemeral): handled by analise-client.tsx
 *   C — generated (report_generated populated): NEW Plan 18 — render
 *       ReportReadView (continuous flowing serif text) with ReadingModeActions
 *       top buttons (Editar análise + Entregar ao cliente + Regenerar análise).
 *
 * Phase 7.4 Plan 10 (Direction Correction — see 07.4-CONTEXT.md DC-1..DC-10):
 *   The 8-block JSON v2 surface (ReportAdaptiveView + AdvancedAnalysisCTA
 *   footerSlot + report_version routing) has been removed. All readings render
 *   via the legacy AnalysisHero + AnaliseClient + EditorAccordion path until
 *   Plan 12 rebuilt the v2 surface around 14 markdown sections.
 *
 * Phase 7.4 Plan 18 (UAT-3 UX flip): State C is now the new ReportReadView
 * reading-mode surface (continuous flowing serif text — NOT accordion). The
 * accordion lives exclusively on /leituras/[id]/editar for granular per-section
 * edits. Plan 19 will add Exportar PDF as a 4th top-button.
 *
 * Auth + RLS via createClient() session-bound. Therapist must own the reading
 * to see it (RLS enforces; route returns 404 via `notFound()` if missing).
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { StatusBadge } from '@/components/readings/StatusBadge'
import { AnalysisHero } from '@/components/readings/AnalysisHero'
import { ReportReadView } from '@/components/readings/ReportReadView'
import { ReadingModeActions } from '@/components/readings/ReadingModeActions'
import { AutoRefreshWhileProcessing } from '@/components/readings/AutoRefreshWhileProcessing'
import { AnaliseClient } from './analise-client'

export const dynamic = 'force-dynamic'

export default async function LeituraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: readingId } = await params

  const supabase = await createClient()
  const { data: reading, error } = await supabase
    .from('readings')
    .select(
      'id, status, created_at, report_generated, report_delivered, audit_metadata, regeneration_count, is_delivered, delivered_at, vision_features, client:clients(id, full_name, birth_date, phone, is_self)',
    )
    .eq('id', readingId)
    .maybeSingle()

  // analysis_started_at vem em query separada porque types/database.ts
  // ainda não tem a coluna (founder regenera após aplicar 0027). Cast
  // 'as never' isola o type-check; RLS authed garante isolation.
  const { data: progress } = await supabase
    .from('readings')
    .select('analysis_started_at' as never)
    .eq('id', readingId)
    .maybeSingle<{ analysis_started_at: string | null }>()

  if (error || !reading) notFound()

  // Marca como "vista pelo terapeuta" — derruba o badge de notificação
  // no /dashboard (0026 readings.seen_by_therapist_at). Idempotente:
  // só atualiza se ainda for NULL; UPDATE WHERE seen IS NULL impede
  // sobrescrever timestamp original em aberturas subsequentes.
  // RLS authed garante que só o dono atualiza.
  // Cast 'as never' temporário: types/database.ts ainda não tem a coluna
  // (founder regenera depois de aplicar 0026).
  await supabase
    .from('readings')
    .update({ seen_by_therapist_at: new Date().toISOString() } as never)
    .eq('id', readingId)
    .is('seen_by_therapist_at' as never, null)

  const clientRel = reading.client as
    | { id?: string; full_name?: string; phone?: string | null; is_self?: boolean }
    | null
  const clientName = clientRel?.full_name ?? 'Cliente'
  const clientPhone = clientRel?.phone ?? null
  const isSelfReading = clientRel?.is_self === true
  const reportGenerated = reading.report_generated as Record<string, string> | null
  const reportDelivered = reading.report_delivered as Record<string, string> | null
  const hasReport = reportGenerated != null && Object.keys(reportGenerated).length > 0
  const regenerationCount = reading.regeneration_count ?? 0
  const isDelivered = reading.is_delivered ?? false
  const status = reading.status ?? 'pending'
  const isReadingMode = (status === 'ready' || status === 'edited') && hasReport
  const reportToShow = (reportDelivered ?? reportGenerated) as Record<string, string>
  const reportGeneratedAt =
    (reading as { report_generated_at?: string }).report_generated_at ?? null

  // Versão da análise (v2.4.4 — exibida ao lado de "Leitura realizada em";
  // v2.5.2 — agora mostra Stage 1 + Stage 2 separados).
  // report_generations tem 1 row por geração (regen inclui); pega a mais
  // recente pro Stage 2. report_findings CURRENT (superseded_at IS NULL)
  // dá o Stage 1 ativo. Coluna method_version é nova (0031) — types ainda
  // sem ela, cast 'as never' isola até founder regenerar gen:types.
  const [{ data: lastGen }, { data: currentFinding }] = await Promise.all([
    supabase
      .from('report_generations')
      .select('method, method_version, created_at' as never)
      .eq('reading_id', readingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ method: string | null; method_version: string | null }>(),
    supabase
      .from('report_findings')
      .select('method_version' as never)
      .eq('reading_id', readingId)
      .is('superseded_at', null)
      .maybeSingle<{ method_version: string | null }>(),
  ])
  // Stage 1 method_version vem como 'sonnet_2x_0.2.1' (semver embutido no
  // ID). Stage 2 method_version vem como '0.3.0' separado de method.
  // Display: "S1 v0.2.1 · S2 v0.3.0" — compacto, legível, comparável.
  const stage1SemverMatch = currentFinding?.method_version?.match(/(\d+\.\d+\.\d+)$/)
  const stage1Version = stage1SemverMatch?.[1] ?? null
  const stage2Version = lastGen?.method_version ?? null
  const analysisVersion =
    stage1Version && stage2Version
      ? `S1 v${stage1Version} · S2 v${stage2Version}`
      : stage2Version
        ? `v${stage2Version}`
        : stage1Version
          ? `S1 v${stage1Version}`
          : null

  // Geração em andamento (0027): set no início do POST /analyze, clear
  // no finalize. Janela de 5min (após isso, considera handler morto
  // — UI libera retry). FIX founder UAT 2026-05-20.
  const analysisStartedAt = progress?.analysis_started_at ?? null
  const isAnalysisInProgress = (() => {
    if (!analysisStartedAt) return false
    const ageMs = Date.now() - new Date(analysisStartedAt).getTime()
    return ageMs < 5 * 60 * 1000
  })()

  // Phase 7.4 Sonnet-direct: signal (no hard block) when ≥1 photo was read
  // from a non-iris-centered frame (canonicalization fallback).
  const fallbackCount =
    (reading.audit_metadata as { canonical_fallback_count?: number } | null)
      ?.canonical_fallback_count ?? 0
  const technicalNotice =
    fallbackCount > 0
      ? `Observação técnica: ${fallbackCount} ${
          fallbackCount === 1 ? 'imagem foi analisada' : 'imagens foram analisadas'
        } a partir de uma foto não perfeitamente centrada na íris (enquadramento da câmera). A leitura permanece válida; para máxima precisão, recapture essa(s) foto(s).`
      : undefined

  // ---- READING MODE (Plan 18 default) ----
  // Continuous flowing serif document with top action buttons.
  if (isReadingMode) {
    return (
      <div className="space-y-6 -mx-7 px-4 py-8 sm:mx-0 sm:px-6">
        {/* v2.9.0 (2026-05-27): auto-refresh + banner em reading mode
            quando há regen rodando no servidor mas o cliente não tem
            stream local (founder navegou pra fora e voltou). Antes só
            existia no branch State A/B; reading mode ficava cego. */}
        <AutoRefreshWhileProcessing active={isAnalysisInProgress} />
        <div className="flex items-center justify-between">
          <Link
            href="/leituras"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Voltar para leituras
          </Link>
          <StatusBadge status={status as never} />
        </div>

        <ReportReadView
          sections={reportToShow}
          clientName={clientName}
          readingDate={reportGeneratedAt ?? reading.created_at}
          analysisVersion={analysisVersion}
          technicalNotice={technicalNotice}
          topActionsSlot={
            <ReadingModeActions
              readingId={readingId}
              regenerationCount={regenerationCount}
              isDelivered={isDelivered}
              deliveredAt={reading.delivered_at}
              isSelfReading={isSelfReading}
              clientName={clientName}
              clientPhone={clientPhone}
              isAnalysisInProgress={isAnalysisInProgress}
            />
          }
        />
      </div>
    )
  }

  // ---- WAITING / EMPTY / STREAMING (State A or State B) ----
  // Preserved AnalysisHero + AnaliseClient path.
  return (
    <div className="space-y-6 -mx-7 px-4 py-8 sm:mx-0 sm:px-6">
      <AutoRefreshWhileProcessing active={status === 'processing' || isAnalysisInProgress} />
      <div className="flex items-center justify-between">
        <Link
          href="/leituras"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Voltar para leituras
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Análise da leitura</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cliente: {clientName} · Capturada em:{' '}
            <LocalDateTime iso={reading.created_at} />
          </p>
        </div>
        <StatusBadge status={status as never} />
      </div>

      {isAnalysisInProgress && (
        <div className="rounded-md border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Análise em andamento</p>
          <p className="mt-1 text-amber-900/90">
            A geração do relatório está rodando no servidor (~2-3 minutos no
            total). Esta página atualiza sozinha quando terminar — pode fechar e
            voltar à vontade, a análise continua mesmo se você sair daqui.
          </p>
        </div>
      )}

      <AnalysisHero
        readingId={readingId}
        hasReport={hasReport}
        status={status as never}
        regenerationCount={regenerationCount}
        isDelivered={isDelivered}
        deliveredAt={reading.delivered_at}
        reportGeneratedAt={reportGeneratedAt}
        auditMetadata={reading.audit_metadata as never}
      >
        <AnaliseClient
          readingId={readingId}
          hasInitialReport={hasReport}
          regenerationCount={regenerationCount}
          isDelivered={isDelivered}
          isAnalysisInProgress={isAnalysisInProgress}
        />
      </AnalysisHero>
    </div>
  )
}
