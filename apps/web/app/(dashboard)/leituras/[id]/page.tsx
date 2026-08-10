/**
 * Reading detail page — RSC.
 *
 * Phase 7 (07-09-PLAN): Surface 1 (UI-SPEC §Surface 1 lines 178-220).
 * Renders one of 3 states based on persisted readings state:
 *   A — empty (report_generated IS NULL): show "Gerar análise" CTA
 *   B — streaming (client-driven, ephemeral): handled by analise-client.tsx
 *   C — generated (report_generated populated): NEW Plan 18 — render
 *       ReportReadView (continuous flowing serif text) with ReadingModeActions
 *       top buttons (Editar análise + Entregar ao cliente + PDFs).
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
import { createServiceClient } from '@/lib/supabase/service'
import { convertReservationToConsume } from '@/lib/billing/credits'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { StatusBadge } from '@/components/readings/StatusBadge'
import { AnalysisHero } from '@/components/readings/AnalysisHero'
import { ReportReadView } from '@/components/readings/ReportReadView'
import { ReadingModeActions } from '@/components/readings/ReadingModeActions'
import { AutoRefreshWhileProcessing } from '@/components/readings/AutoRefreshWhileProcessing'
import { ExpiredReadingActions } from '@/components/readings/ExpiredReadingActions'
import { MapaDoSerEmbed } from '@/components/readings/MapaDoSerEmbed'
import { getExameJson } from '@/lib/emocional/findings'
import { renderEmocional, TITULOS_BLOCOS } from '@/lib/emocional/render'
import { AnaliseClient } from './analise-client'

export const dynamic = 'force-dynamic'

export default async function LeituraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: readingId } = await params

  const supabase = await createClient()
  // Regen REMOVIDO da UI de leitura (2026-06-03): nem terapeuta nem founder
  // regeneram pela tela (cada regen = +1 geração Sonnet 2x = custo). Resgate de
  // relatório incompleto segue só via /admin/regenerar (founder-only, fora do fluxo).
  const { data: reading, error } = await supabase
    .from('readings')
    .select(
      'id, status, created_at, report_generated, report_generated_at, report_delivered, audit_metadata, regeneration_count, is_delivered, delivered_at, vision_features, client:clients(id, full_name, birth_date, phone, is_self)',
    )
    .eq('id', readingId)
    .maybeSingle()

  // analysis_started_at vem em query separada porque types/database.ts
  // ainda não tem a coluna (founder regenera após aplicar 0027). Cast
  // 'as never' isola o type-check; RLS authed garante isolation.
  const { data: progress } = await supabase
    .from('readings')
    .select(
      'analysis_started_at, analysis_completed_at, images_purged_at, report_emocional, report_emocional_generated_at' as never,
    )
    .eq('id', readingId)
    .maybeSingle<{
      analysis_started_at: string | null
      analysis_completed_at: string | null
      images_purged_at: string | null
      report_emocional: string | null
      report_emocional_generated_at: string | null
    }>()

  if (error || !reading) notFound()

  // 2026-08-03: com a saída do "Regenerar análise", esta página não tem mais nenhuma
  // ação founder-only — o Mapa do Ser deixou de ser founder-only em 2026-07-30, quando
  // virou o relatório padrão de toda leitura nova.

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
  // 2026-07-30: o Mapa do Ser virou o relatório principal, então ele TAMBÉM abre o
  // modo leitura. Sem isto, uma leitura nova (que só tem Mapa do Ser, nunca gerou
  // Dossiê) ficaria presa na tela de "Gerar análise" — sem relatório e sem botão,
  // porque todas as ações moram dentro deste modo.
  const temMapa = Boolean(progress?.report_emocional)
  const isReadingMode =
    (status === 'ready' || status === 'edited') && (hasReport || temMapa)
  const reportToShow = (reportDelivered ?? reportGenerated) as Record<string, string>
  const reportGeneratedAt =
    (reading as { report_generated_at?: string }).report_generated_at ?? null

  // On-view consume reconcile (backstop IMEDIATO — founder 2026-05-31).
  // GUARD: só age se a leitura JÁ tem relatório E ainda existe reserva ATIVA
  // dela (= órfã: o consume inline não fechou, ex. plataforma matou a função
  // antes da linha 506 numa geração longa). Leitura consumida normalmente tem
  // reserva 'converted' → SELECT não acha ativa → nem chama a RPC → crédito
  // INTOCADO. Usa a MESMA RPC do inline/cron (convert_reservation_to_consume,
  // idempotente pela 0042): se inline/cron debitar entre o SELECT e a chamada,
  // a RPC retorna 'already' (flip acha 0 ativas) → débito UMA vez só, nunca
  // duplo. Service-role: não depende de RLS pra ler/escrever a reserva.
  //
  // FIX bug#1: exige report_generated_at != null (setado SÓ no caminho de
  // sucesso, analyze/route.ts:490). O catch de erro grava report_generated
  // PARCIAL sem _at — o inline decidiu NÃO cobrar nesse caso, então o backstop
  // também não pode. Mesma regra do cron (reconcileOrphanedConsumes).
  // 2026-07-30: vale também para o MAPA DO SER — mesma regra, mesma prova de
  // sucesso. `report_emocional_generated_at` só é gravado no caminho bom (o catch
  // do gerador não escreve nada), então serve de "_at" exatamente como o do Dossiê.
  // Sem isto, uma geração de Mapa do Ser cuja função morresse logo após persistir
  // ficaria com a reserva ativa para sempre = leitura entregue e nunca cobrada.
  const geracaoBemSucedida =
    (hasReport && reportGeneratedAt != null) ||
    Boolean(progress?.report_emocional_generated_at)
  if (geracaoBemSucedida) {
    const service = createServiceClient()
    const { data: orphan } = await service
      .from('credit_reservations')
      .select('reading_id')
      .eq('reading_id', readingId)
      .eq('status', 'active')
      .maybeSingle()
    if (orphan) {
      await convertReservationToConsume(readingId).catch((e) =>
        console.warn(
          `[reading] on-view reconcile falhou reading=${readingId}:`,
          e instanceof Error ? e.message : e,
        ),
      )
    }
  }

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
  const analysisCompletedAt = progress?.analysis_completed_at ?? null
  const photosPurgedAt = progress?.images_purged_at ?? null

  // "Fotos apagadas" (furo corrigido 2026-06-29 — caso Lidia/Alessandra): o
  // expurgo de 24h (TTL, promessa de privacidade da LP/FAQ) apaga as imagens da
  // íris INDEPENDENTE do estado do relatório. Se a leitura não foi gerada dentro
  // da janela (terapeuta demorou OU captura ficou incompleta), as fotos somem e
  // NÃO há como gerar — qualquer clique em "Gerar análise" só bate em 404/502 e
  // mostra um toast enganoso de "rodando no servidor" que nunca atualiza. Aqui
  // detectamos o estado terminal (fotos purgadas + sem relatório) e renderizamos
  // um aviso claro + caminho de refazer captura, SEM o botão de gerar.
  const photosExpired = photosPurgedAt != null && !hasReport

  // Parte C (preventiva — 2026-06-29): prazo de geração. O cron photo-ttl apaga
  // as fotos 24h após a captura (readings.created_at), INDEPENDENTE do relatório.
  // Enquanto a leitura está pronta-pra-gerar e as fotos ainda existem, avisamos o
  // terapeuta do prazo pra não perder as imagens — foi exatamente o vão do caso
  // Lidia: captura completa, mas a geração só veio 2 dias depois (fotos já idas).
  const PURGE_TTL_MS = 24 * 60 * 60 * 1000
  const photosExpireAt = new Date(
    new Date(reading.created_at ?? Date.now()).getTime() + PURGE_TTL_MS,
  )
  // Frescura dirigida pela CONCLUSÃO real (completed_at), não por timer curto.
  // A geração (canonicalize lazy + Stage 1 + Stage 2) pode levar ~5-6min; o
  // timer antigo de 5min parava o AutoRefresh ANTES de terminar → a página
  // congelava no relatório velho até F5 manual (crítico em escala: terapeuta
  // acha que falhou e regenera de novo, queimando custo). Agora: "em progresso"
  // enquanto começou e ainda NÃO concluiu, com teto de segurança de 15min pra
  // gerações travadas (started sem completed). O AutoRefresh para no instante em
  // que completed_at é gravado (analyze route) e a página renderiza o relatório
  // pronto — sem hard refresh.
  const isAnalysisInProgress = (() => {
    if (!analysisStartedAt) return false
    const startedMs = new Date(analysisStartedAt).getTime()
    if (Date.now() - startedMs > 15 * 60 * 1000) return false // teto de segurança
    // Concluiu DEPOIS de começar → pronto, não está mais em progresso.
    if (
      analysisCompletedAt &&
      new Date(analysisCompletedAt).getTime() >= startedMs
    ) {
      return false
    }
    return true
  })()

  // Parte C: só avisa o prazo quando a leitura está pronta-pra-gerar, ainda tem
  // fotos e não está gerando agora. (Declarado após isAnalysisInProgress.)
  const showPurgeDeadline =
    status === 'ready' && !hasReport && !photosExpired && !isAnalysisInProgress

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
    const acoes = (
      <ReadingModeActions
        readingId={readingId}
        isDelivered={isDelivered}
        deliveredAt={reading.delivered_at}
        isSelfReading={isSelfReading}
        clientName={clientName}
        clientPhone={clientPhone}
        isAnalysisInProgress={isAnalysisInProgress}
        // Caixinhas da versão do cliente: os títulos vêm do MOTOR (server-only aqui,
        // client lá). Uma lista só, como no checklist da geração.
        titulosBlocos={TITULOS_BLOCOS}
        temMapa={temMapa}
        temDossie={hasReport}
      />
    )

    // ---- MAPA DO SER inline (relatório principal desde 2026-07-30) ----
    // Só entra aqui quem TEM o documento. Leitura anterior à mudança cai no
    // ReportReadView de sempre, com o Dossiê — nada de espaço vazio ou aviso de
    // relatório que ela nunca teve.
    if (temMapa) {
      // ⚠️ `superseded_at IS NULL` é OBRIGATÓRIO: uma leitura que falhou e foi gerada
      // de novo tem VÁRIAS linhas em report_findings (as antigas ficam marcadas como
      // superseded). Sem o filtro, `maybeSingle()` acha 2+ linhas, devolve erro com
      // data null, e o render recebe `exame = {}` — o documento sai com as agulhas
      // neutras, o mapa emocional VAZIO e a linha do tempo sem figura. Silencioso:
      // o texto aparece normal e só os gráficos somem (founder pegou em prod, 31/07).
      // service-role: a policy da 0028 (`founder_full_access`) deixava o exame vazio
      // para todo terapeuta que não fosse o founder. O dono já foi validado (a leitura
      // veio por RLS lá em cima). Ver lib/emocional/findings.ts.
      const exame = await getExameJson(readingId)

      const primeiroNome = clientName.trim().split(/\s+/)[0] || 'você'
      // ⚠️ Este render NÃO é o que vai à tela — quem serve o documento ao iframe é
      // `/leituras/<id>/emocional/documento` (o iframe precisa de URL própria para as
      // âncoras do índice funcionarem). Ele roda aqui só para SABER se o markdown ainda
      // casa com o desenho: falhando, mostramos o aviso em vez de um quadro vazio.
      let mapaHtml: string | null = null
      try {
        mapaHtml = renderEmocional(
          progress!.report_emocional!,
          exame,
          primeiroNome,
        ).html
      } catch (e) {
        // O render depende do formato @BLOCOS. Se falhar, mostramos as ações e o
        // aviso — melhor que derrubar a página inteira da leitura.
        console.error('[leitura] render do Mapa do Ser falhou', { readingId, e })
      }

      return (
        <div className="space-y-6 -mx-7 px-4 py-8 sm:mx-0 sm:px-6">
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

          <div className="flex flex-wrap items-center gap-2">{acoes}</div>

          {mapaHtml ? (
            <div className="overflow-hidden rounded-lg border bg-white">
              <MapaDoSerEmbed readingId={readingId} title={`Mapa do Ser — ${clientName}`} />
            </div>
          ) : (
            <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-5 py-5">
              <h1 className="text-lg font-semibold text-amber-950">
                Não consegui montar o Mapa do Ser
              </h1>
              <p className="mt-2 text-sm text-amber-900/90">
                O texto guardado não bate com o formato que o desenho espera. O
                conteúdo está salvo — gerar de novo resolve.
              </p>
            </div>
          )}
        </div>
      )
    }

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
          topActionsSlot={acoes}
        />
      </div>
    )
  }

  // ---- FOTOS APAGADAS (estado terminal — sem fotos, sem relatório) ----
  // Precede o State A/B pra NUNCA mostrar o botão "Gerar análise" numa leitura
  // cujas imagens já foram purgadas. Caminho único: refazer a captura.
  if (photosExpired) {
    return (
      <div className="space-y-6 -mx-7 px-4 py-8 sm:mx-0 sm:px-6">
        <div className="flex items-center justify-between">
          <Link
            href="/leituras"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Voltar para leituras
          </Link>
          <span className="inline-flex items-center rounded-full border border-amber-600/40 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            Fotos expiradas
          </span>
        </div>

        <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-5 py-5 space-y-3">
          <h1 className="text-lg font-semibold text-amber-950">
            As fotos desta leitura foram apagadas
          </h1>
          <p className="text-sm text-amber-900/90">
            Por privacidade, as imagens da íris são apagadas automaticamente{' '}
            <strong>24 horas após a captura</strong>. As fotos desta leitura
            {clientName ? ` (${clientName})` : ''} já passaram desse prazo e
            foram removidas — por isso{' '}
            <strong>não é possível gerar o relatório</strong>.
          </p>
          <p className="text-sm text-amber-900/90">
            Para fazer a leitura, é necessário{' '}
            <strong>refazer a captura</strong>. Gere um novo link para o cliente
            tirar as fotos pelo celular, ou refaça presencialmente. Lembre-se de
            gerar o relatório em até 24 horas após tirar as fotos.
          </p>
          {clientRel?.id && (
            <ExpiredReadingActions
              client={{ id: clientRel.id, full_name: clientName }}
            />
          )}
        </div>
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

      {showPurgeDeadline && (
        <div className="rounded-md border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Gere o relatório em até 24h</p>
          <p className="mt-1 text-amber-900/90">
            Por privacidade, as fotos da íris são apagadas automaticamente 24h
            após a captura. Gere o relatório antes de{' '}
            <strong>
              <LocalDateTime iso={photosExpireAt.toISOString()} />
            </strong>{' '}
            — passado esse prazo as imagens são removidas e a leitura precisa ser
            refeita.
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
          isAnalysisInProgress={isAnalysisInProgress}
          // Gerar aqui = gerar o MAPA DO SER (padrão desde 2026-07-30). Os títulos
          // vêm do motor porque `lib/emocional/render` é server-only e o checklist
          // é client — passar por prop é o que mantém UMA lista só.
          blocosTitulos={TITULOS_BLOCOS}
        />
      </AnalysisHero>
    </div>
  )
}
