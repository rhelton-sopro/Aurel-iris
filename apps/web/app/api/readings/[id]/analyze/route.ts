/**
 * POST /api/readings/[id]/analyze
 *
 * Streaming endpoint for the LLM analysis. Owned by the Reading detail page
 * (`/leituras/[id]`); user fires "Gerar análise" → fetch POST → consume
 * ReadableStream of text deltas → re-fetch on close.
 *
 * Phase 7.4 (2026-05-16): **flipped to the Sonnet-direct pipeline.** This is
 * now the single production path — Sonnet reads the 6 canonical 800×800
 * crops DIRECTLY (no Modal features, no RAG). The Modal vision-service / SAM
 * / RAG are retired (archived). Streaming, auth gates, regeneration cap/log,
 * audit, and `report_generated` storage are preserved unchanged so the
 * therapist UX + downstream consumers are byte-compatible.
 *
 * Auth gates (T-7-AUTH a-e):
 *   a) Session present
 *   b) reading.therapist_id === user.id
 *   c) reading.status === 'ready'  (now set by the canonicalize step, not
 *      the Modal webhook — see finalizeReadingAction / process route)
 *   d) reading.report_delivered IS NULL
 *   e) reading.regeneration_count < 3 (founder-bypassed for calibration)
 *
 * Phase 7 | Plan 07-08 → Phase 7.4 Sonnet-direct flip
 */
import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { purgeIrisPhotos } from '@/lib/capture/delete-iris-photos'
import {
  convertReservationToConsume,
  reserveCreditForReading,
  readingHasReservation,
} from '@/lib/billing/credits'
import { logAuditEvent } from '@/lib/audit/log'
import { logReportGeneration } from '@/lib/calibration/log-generation'
import { notifyTherapistReportReady } from '@/lib/notifications/notify-report-ready'
import {
  analyzeReadingComposeStage2,
  STAGE2_METHOD,
  STAGE2_METHOD_VERSION,
  STAGE2_VERSION,
} from '@/lib/anthropic/analyze-direct'
import { runStage1Scan } from '@/lib/anthropic/stage1-scan'
import { buildRecentPhrasesContext } from '@/lib/anthropic/recent-phrases-context'
import { extractPhrases } from '@/lib/anthropic/extract-phrases'
import { prepareDirectImages } from '@/lib/anthropic/prepare-direct-images'
import { canonicalizeReading } from '@/lib/canonicalize'
import { isFounderEmail } from '@/lib/auth/founder'
import {
  findAllBoundaries,
  closeSections,
  extractEssencePhrase,
  extractZeroSection,
} from '@/lib/anthropic/parser'
import { runAudit } from '@/lib/anthropic/audit'
import { MODEL } from '@/lib/anthropic/client'
import { getSystemPromptVersion } from '@/lib/anthropic/prompts'
import {
  ENCERRAMENTO_LITERAL,
  type ReportJsonb,
  type RegenerationLogEntry,
  type CanonicalMetadata,
} from '@/lib/anthropic/types'

export const runtime = 'nodejs'
// v2.4 (2026-05-24): bump 300s → 800s. Founder upgrade pro plano Pro
// confirmado em 2026-05-24 — libera até 800s no Fluid Compute. Stage 2
// v2.4 (com VOICE_OVERRIDE_V2_4) demorava ~290-310s em íris densas
// (Evanilce timeoutou 2x consecutivas no limite de 300s do Hobby).
// 800s dá margem confortável de >2x a latência observada — voz v2.4
// preservada sem risco operacional de timeout em UAT.
export const maxDuration = 800

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: readingId } = await params

  // Gate (a): session present
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Load reading (RLS + explicit therapist_id check). No vision_features /
  // canonical merge — the Sonnet-direct path consumes the photos directly.
  const { data: reading, error: readingError } = await supabase
    .from('readings')
    .select(
      'id, therapist_id, status, report_delivered, regeneration_count, regeneration_log, client_id, canonical_metadata, notification_sent_at, client:clients(full_name, birth_date)',
    )
    .eq('id', readingId)
    .maybeSingle()

  // analysis_started_at (0027) + analysis_completed_at (0030) em query
  // separada — types/database.ts ainda não tem essas colunas até founder
  // regenerar. Idempotency gate (f) usa o par {started, completed}.
  const { data: progress } = await supabase
    .from('readings')
    .select('analysis_started_at, analysis_completed_at' as never)
    .eq('id', readingId)
    .maybeSingle<{
      analysis_started_at: string | null
      analysis_completed_at: string | null
    }>()

  if (readingError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!reading) {
    return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
  }
  // Gate (b): ownership
  if (reading.therapist_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Gate (c): status
  if (reading.status !== 'ready') {
    return NextResponse.json(
      { error: `Reading status '${reading.status}' is not ready for analysis` },
      { status: 409 },
    )
  }
  // Gate (d): not yet delivered.
  if (reading.report_delivered != null) {
    return NextResponse.json(
      { error: 'Reading already delivered. Cannot regenerate.' },
      { status: 409 },
    )
  }
  // Gate (e): regen REMOVIDO do terapeuta (2026-06-03). regeneration_count
  // conta GERAÇÕES totais (incrementa a cada geração, inclusive a original →
  // 1 após a 1ª). Não-founder pode gerar UMA vez (count 0→1); a 2ª geração
  // (regen) é bloqueada em `>= 1`. Retry de uma 1ª geração que FALHOU continua
  // ok (count só sobe no sucesso). Founder bypassa — regen vive nele (página
  // da leitura + /admin/regenerar). Antes era `>= 2` (1 regen grátis).
  const currentCount = reading.regeneration_count ?? 0
  const isFounder = isFounderEmail(user.email)
  if (currentCount >= 1 && !isFounder) {
    return NextResponse.json(
      {
        error:
          'A regeneração agora é feita pela equipe. Para um novo relatório, faça uma nova leitura (novas fotos).',
      },
      { status: 409 },
    )
  }

  // Gate (f): "Already running" — evita duplo-spend se cliente clica
  // Gerar 2x ou se fechou aba no meio (handler continua server-side;
  // segundo POST encontraria started_at preenchido). 5min é o teto
  // de tolerância (Stage 1 ~60s + Stage 2 stream ~150s + finalize +
  // slack = ~5min na pior hipótese). Após isso, libera.
  //
  // v2.3.0 (2026-05-23): par {started_at, completed_at}. Inflight =
  // started IS NOT NULL E completed IS NULL. Quando handler termina
  // (sucesso OU erro final), seta completed_at no finally — libera
  // imediatamente em vez de esperar a janela de 5min expirar.
  const startedAt = progress?.analysis_started_at ?? null
  const completedAt = progress?.analysis_completed_at ?? null
  if (startedAt && !completedAt) {
    const ageMs = Date.now() - new Date(startedAt).getTime()
    if (ageMs < 5 * 60 * 1000) {
      return NextResponse.json(
        {
          error: 'Análise em andamento. Aguarde a conclusão antes de tentar novamente.',
          retry_after_seconds: Math.ceil((5 * 60 * 1000 - ageMs) / 1000),
        },
        { status: 409 },
      )
    }
    // started_at sem completed_at e age > 5min = handler stale, libera retry.
  }

  // ===== GATE DE CRÉDITO (Fase 8 redesign — consume-na-geração) =====
  // A reserva saiu da CAPTURA (invite + consultório): captura é sempre livre,
  // o cliente nunca é bloqueado. O crédito é gateado AQUI, no início da
  // geração, ANTES de gastar Sonnet:
  //   - 1ª geração (sem reserva ainda): reserve → no_balance? bloqueia 402
  //     (fotos salvas, terapeuta compra e regenera); internal/trial/credit ok.
  //   - regen (já tem reserva active/converted): reusa, NÃO cobra de novo
  //     (fifo_reserve_credit não é idempotente por reading_id — ver
  //     readingHasReservation). 1 leitura = 1 crédito.
  // O débito firme (convert) segue no pós-stream. Founder bypassa via
  // internal_use dentro do fifo_reserve_credit.
  if (!(await readingHasReservation(readingId))) {
    const reserve = await reserveCreditForReading(user.id, readingId)
    if (!reserve.ok) {
      if (reserve.reason === 'no_balance') {
        return NextResponse.json(
          {
            error: 'no_balance',
            message:
              'Sem créditos para gerar este relatório. As fotos estão salvas — compre créditos para gerar.',
            redirect_to: '/assinatura/comprar',
          },
          { status: 402 },
        )
      }
      console.error(
        `[analyze] reserve falhou reading=${readingId}: ${reserve.reason}`,
      )
      return NextResponse.json(
        { error: 'Erro ao verificar créditos. Tente novamente.' },
        { status: 500 },
      )
    }
    // D-09: audit de internal_use (founder/admin) — migrado da captura pro gate
    // de geração (chokepoint único). Sem isso, leituras do founder ficariam
    // invisíveis pra exclusão de métricas de faturamento. Best-effort.
    if (reserve.source === 'internal') {
      await logAuditEvent({
        event_type: 'admin.internal_use_used',
        actor_user_id: user.id,
        actor_email: user.email,
        target_type: 'reading',
        target_id: readingId,
        metadata: { entry_point: 'generate', client_id: reading.client_id ?? null },
      })
    }
  }

  const clientName =
    (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
  const clientBirth =
    (reading.client as { birth_date?: string } | null)?.birth_date ?? null
  const clientAge = clientBirth
    ? Math.floor((Date.now() - new Date(clientBirth).getTime()) / 31_557_600_000)
    : null

  // Prepare the 6 photos (canonical 800×800 ?? raw → sharp → base64).
  // Service client for storage signing (mirrors /process — avoids RLS tax);
  // ownership already enforced above with the user client.
  const service = createServiceClient()

  // Lazy canonicalization (fix 07.4 — raiz da convergência cross-leitura):
  // leituras capturadas via CONVITE não passam pelo finalizeReadingAction (que
  // é quem dispara o canonicalize no fluxo do terapeuta), então chegam aqui com
  // canonical_metadata NULL e a íris NUNCA foi centralizada. Sem isso o Sonnet
  // lê a foto crua/larga (íris = fração do quadro) e só enxerga sinais grossos/
  // periféricos (esclera, pigmento âmbar→fígado, tamanho de pupila), fazendo
  // toda leitura convergir no mesmo padrão genérico (auditoria N=5, 2026-05-29).
  //
  // Roda 1× aqui, lazy, só quando faltou: o terapeuta já está autenticado + é
  // owner (checado acima), maxDuration=800s acomoda os 6 bbox, e capturas
  // abandonadas nunca pagam o custo (~$0.07). Best-effort (D-01): se falhar,
  // prepareDirectImages cai no raw (comportamento atual) — NUNCA bloqueia a
  // geração. Idempotente (D-05): re-rodar sobrescreve os crops.
  if (!reading.canonical_metadata) {
    try {
      await canonicalizeReading(readingId, user.id)
      console.info(`[analyze] lazy-canonicalize OK reading=${readingId}`)
    } catch (err) {
      console.error(
        `[analyze] lazy-canonicalize falhou reading=${readingId} (segue com raw):`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  const prep = await prepareDirectImages(service, readingId)
  if (!prep.ok) {
    const status = prep.reason === 'no_images' ? 404 : 502
    return NextResponse.json(
      { error: `Image preparation failed: ${prep.reason} ${prep.message ?? ''}`.trim() },
      { status },
    )
  }

  // ===== v2.3.0 Sonnet 2x pipeline =====
  // Marca "em curso" ANTES de Stage 1 — idempotency gate (f) já protege
  // re-entradas. completed_at: null garante que reprocessamento limpe
  // completed antigo (se houver) pra gate funcionar.
  await service
    .from('readings')
    .update({
      analysis_started_at: new Date().toISOString(),
      analysis_completed_at: null,
    } as never)
    .eq('id', readingId)

  // ===== ETAPA 1 — Observação estruturada (Sonnet vê 6 fotos) =====
  // runStage1Scan faz tool_use com REGISTRAR_EXAME_TOOL, valida (5
  // blindagens), retry 1x em invalid, retorna JSON estruturado.
  // Fallback Sonnet 4.6 → 4.5 inline em 429/503/5xx.
  const stage1 = await runStage1Scan({
    readingId,
    therapistId: user.id,
    images: prep.images,
    clientName,
    clientAge,
  })

  // Persistência via RPC (transação atômica superseded_at).
  // Migration 0030 cria o RPC; se pendente, log warn e segue (analytics
  // perde linha mas relatório não trava).
  const validationStatusForDb =
    stage1.validation_status === 'valid' ||
    stage1.validation_status === 'valid_with_warnings'
      ? 'valid'
      : stage1.validation_status === 'invalid_retried'
        ? 'invalid_retried'
        : 'invalid_final'
  const { error: findingsErr } = await service.rpc(
    'persist_report_findings_versioned' as never,
    {
      p_reading_id: readingId,
      p_therapist_id: user.id,
      p_prompt_version: stage1.prompt_version,
      p_prompt_sha: stage1.prompt_sha,
      p_method_version: stage1.method_version,
      p_model: stage1.model,
      p_exame_json: stage1.exame ?? {},
      p_raw_xml: stage1.raw_output,
      p_validation_status: validationStatusForDb,
      p_tokens_in: stage1.tokens_in,
      p_tokens_out: stage1.tokens_out,
      p_cost_usd: Number(stage1.cost_usd.toFixed(6)),
      p_latency_ms: stage1.latency_ms,
      // Migration 0031: cache buckets (RPC tem defaults NULL — se migration
      // ainda não foi aplicada, postgres aceita os params extras só se a RPC
      // já tem a nova assinatura; senão erro fica preso no findingsErr below).
      p_cache_creation_input_tokens: stage1.cache_creation_input_tokens,
      p_cache_read_input_tokens: stage1.cache_read_input_tokens,
    } as never,
  )
  if (findingsErr) {
    console.warn(
      '[analyze] persist_report_findings_versioned RPC failed (migration 0030 pending?):',
      findingsErr.message,
    )
  }

  // Aborta Etapa 2 se Stage 1 falhou 2x. Preserva custo Sonnet (~$0.15)
  // e qualidade do produto (não gera relatório fraco sem ancoragem).
  // Terapeuta clica Reprocessar; pipeline tenta de novo.
  if (stage1.validation_status === 'invalid_final' || !stage1.exame) {
    console.error('[analyze] Stage 1 invalid_final — aborting Stage 2', {
      readingId,
      tokens_in: stage1.tokens_in,
      tokens_out: stage1.tokens_out,
      cost_usd: stage1.cost_usd,
    })
    await service
      .from('readings')
      .update({ analysis_completed_at: new Date().toISOString() } as never)
      .eq('id', readingId)
    return NextResponse.json(
      {
        error: 'Falha na observação estruturada da íris. Clique em Reprocessar pra tentar novamente.',
        stage: 1,
        validation_status: stage1.validation_status,
      },
      { status: 502 },
    )
  }

  // ===== Builder do contexto recente (10 últimas frases do terapeuta) =====
  // Best-effort: se Supabase falhar ou tabela report_phrases pendente,
  // retorna empty string — orquestrador segue sem memória (primeira
  // leitura do terapeuta também passa por aqui com empty).
  const recentPhrasesBlock = await buildRecentPhrasesContext(user.id)

  // ===== ETAPA 2 — Composição ancorada (Sonnet NÃO vê fotos) =====
  // Mesmo contract {stream, finalize} de analyzeReadingDirect.
  // IMPORTANTE: NÃO passamos request.signal. Antes (founder UAT 2026-05-20
  // bug), o signal abortava o llmStream quando cliente fechava a página
  // → analysis.finalize() nunca rodava → audit/log/cost não persistiam +
  // sections parciais ficavam sem o último update. Em Vercel Fluid
  // Compute, o handler continua até completar mesmo após cliente
  // desconectar (até maxDuration=300s). Trade-off aceito: cliente
  // abusivo pagaria Sonnet completo mesmo se cancelar — mitigado pelo
  // gate (f) "already running" acima.
  const analysis = await analyzeReadingComposeStage2({
    readingId,
    therapistId: user.id,
    exameIridologico: stage1.exame, // garantido não-null pelo check acima
    recentPhrasesBlock,
    clientName,
    clientAge,
  })

  const encoder = new TextEncoder()
  const completedSections: ReportJsonb = {}
  let buffer = ''

  const responseStream = new ReadableStream({
    async start(controller) {
      // Helper: enqueue silencioso. Quando cliente desconecta, o controller
      // entra em estado fechado e .enqueue() throw — sem este try, o erro
      // mata o for-await e o finalize() nunca roda (era exatamente o bug
      // do founder UAT 2026-05-20). Agora ignoramos; o handler segue
      // até completar e persistir tudo no DB.
      const enqueueSilent = (chunk: Uint8Array): void => {
        try {
          controller.enqueue(chunk)
        } catch {
          // controller fechado pelo client disconnect — no-op, segue.
        }
      }

      try {
        // v2.4 (2026-05-23): UPDATE incremental REMOVIDO. Antes o consumer
        // fazia UPDATE em report_generated a cada nova boundary detectada
        // (com `boundaries.slice(0, -1)` — só fechava as anteriores). Se
        // o stream era cortado por timeout, report_generated ficava em
        // estado PARCIAL CORROMPIDO (faltando §14, §15, essence_phrase)
        // sobrescrevendo geração anterior boa. Bug grave de regen.
        //
        // Novo fluxo: acumula buffer em memória durante stream, faz parse
        // + UPDATE ATÔMICO único no fim. Trade-off: UI que recarregar a
        // página durante stream NÃO vê parcial — vê banner "Análise em
        // andamento" + AutoRefreshWhileProcessing. Aceitável (já é a UX
        // documentada do banner). Stream pro cliente em tempo real
        // continua intacto via enqueueSilent.
        for await (const text of analysis.stream) {
          buffer += text
          enqueueSilent(encoder.encode(text))
        }

        const finalBoundaries = findAllBoundaries(buffer)
        for (const section of closeSections(finalBoundaries, buffer)) {
          completedSections[section.key] = section.content
        }

        const sectionKeysBeforeEncerramento = Object.keys(completedSections)
        console.log(
          '[analyze/route] stream-finalize',
          JSON.stringify({
            readingId,
            buffer_length: buffer.length,
            sections_completed: sectionKeysBeforeEncerramento,
            boundaries_count: finalBoundaries.length,
            canonical_fallback_count: prep.fallbackCount,
          }),
        )

        const essence = extractEssencePhrase(buffer)
        if (essence) completedSections.essence_phrase = essence
        // v2.7.0: §0 (Marca 7 v2 microfilme) é extraído separadamente —
        // fica OUT de NUMBERED_SECTION_HEADINGS pra preservar monotonicidade
        // §1..§15 caso Sonnet pule §0. Ver parser.ts extractZeroSection.
        const zeroSection = extractZeroSection(buffer)
        if (zeroSection) completedSections['0_em_poucas_palavras'] = zeroSection
        completedSections.encerramento_disclaimer = ENCERRAMENTO_LITERAL

        if (sectionKeysBeforeEncerramento.length === 0) {
          console.error(
            `[analyze/route] EMPTY-REPORT reading=${readingId} buffer_head=${buffer.slice(0, 400).replace(/\n/g, ' ⏎ ')}`,
          )
        }

        const finalization = await analysis.finalize()
        const audit = runAudit(completedSections)

        const logEntry: RegenerationLogEntry = {
          timestamp: new Date().toISOString(),
          therapist_id: user.id,
          reading_id: readingId,
          model_version: MODEL,
          latency_ms: finalization.latency_ms,
          tokens_in: finalization.usage.input_tokens,
          tokens_out: finalization.usage.output_tokens,
          cache_creation_input_tokens: finalization.usage.cache_creation_input_tokens,
          cache_read_input_tokens: finalization.usage.cache_read_input_tokens,
          cost_estimate_usd: finalization.cost_estimate_usd,
        }

        const existingLog = Array.isArray(reading.regeneration_log)
          ? (reading.regeneration_log as unknown as RegenerationLogEntry[])
          : []

        // (f) Persist the canonicalization fallback count alongside the audit
        // (queryable for the >30%/2-week instrumentation + the in-report
        // notice rendered by ReportReadView).
        const auditWithFallback = {
          ...audit,
          canonical_fallback_count: prep.fallbackCount,
        }

        await supabase
          .from('readings')
          .update({
            report_generated: completedSections,
            report_generated_at: new Date().toISOString(),
            regeneration_count: currentCount + 1,
            regeneration_log: [...existingLog, logEntry] as unknown as never,
            audit_metadata: auditWithFallback as unknown as never,
            report_raw_text: buffer as unknown as never,
          })
          .eq('id', readingId)

        // Fase 8 D-11 (08-07): relatório gerado com sucesso → converte a
        // reservation 'active' → 'converted' (debita firmemente do saldo).
        // Idempotente: regenerate, internal_use (sem reservation) e race
        // perdida caem em not_found/already e são tratados como no-op.
        // NUNCA bloqueia a entrega do relatório por falha de consume — o
        // ledger é defensivo; o produto é o relatório. Audit de credit.consumed
        // já é emitido dentro de convertReservationToConsume — não duplicar.
        try {
          const consume = await convertReservationToConsume(readingId)
          if (!consume.ok && consume.reason !== 'not_found') {
            console.warn(
              `[analyze] convert reservation failed reading=${readingId}: ${consume.reason}`,
            )
          }
        } catch (consumeErr) {
          console.warn(
            `[analyze] convert reservation threw reading=${readingId}:`,
            consumeErr instanceof Error ? consumeErr.message : consumeErr,
          )
        }

        // ===== Ciclo de vida da foto (LGPD — 2026-06-03) =====
        // Relatório completo+auditado → apaga a íris para sempre AGORA (a LP/FAQ
        // prometem "apagada na geração"). Incompleto → RETÉM a foto: como o
        // regen do terapeuta foi removido, a leitura aparece em /admin/regenerar
        // pro founder resgatar dentro das 24h (depois o cron horário apaga pelo
        // TTL de qualquer jeito). Best-effort: NUNCA bloqueia a entrega.
        const completeness = auditWithFallback.section_completeness
        try {
          if (completeness?.complete) {
            const purge = await purgeIrisPhotos(service, readingId, 'audit_complete')
            if (!purge.ok) {
              console.warn(
                `[analyze] purge fotos falhou reading=${readingId}: ${purge.error} — cron horário cobre`,
              )
            }
          } else {
            console.warn(
              `[analyze] relatório INCOMPLETO reading=${readingId} missing=${JSON.stringify(
                completeness?.missing ?? ['section_completeness ausente'],
              )} — foto RETIDA p/ regen em /admin/regenerar`,
            )
          }
        } catch (purgeErr) {
          console.warn(
            `[analyze] purge fotos threw reading=${readingId}:`,
            purgeErr instanceof Error ? purgeErr.message : purgeErr,
          )
        }

        // v2.9.0 (2026-05-27): "leitura pronta" e-mail DESATIVADO globalmente.
        // Founder verbatim: "Estou recebendo emails de leituras geradas...
        // não precisa... só mesmo das fotos tiradas". Beta B2B com poucos
        // terapeutas + founder gera leituras em sessão acompanhada do
        // pipeline em tempo real → email redundante. notify-therapist-
        // capture-complete (fotos chegando do cliente via convite) segue
        // ATIVO em convite/[token]/upload e finalize.
        //
        // Implementação lib/notifications/notify-report-ready.ts preservada
        // — se reativação for necessária (multi-terapeuta GA, preferência
        // por perfil), reabrir este bloco e considerar adicionar coluna
        // profiles.notify_report_ready boolean OU env var NOTIFY_REPORT_
        // READY_ENABLED. notification_sent_at fica nullable; não bloqueia
        // future reativação (idempotência continua trabalhando).
        //
        // Originalmente em D-04: e-mail idempotente disparado quando
        // report_generated foi populado pela 1ª vez. Regen NÃO re-enviava.
        void notifyTherapistReportReady // referência preservada — re-ativar
        // chamada removida intencionalmente; comentário acima documenta
        // como reativar.

        // ===== v2.3.0 Extração de frases-chave + persistência da memória =====
        // Roda DEPOIS do stream fechar e DEPOIS do report_generated estar
        // persistido. PII scrub via clientName. Best-effort: se RPC falhar
        // (migration 0030 pendente), apenas loga warn — memória inter-leituras
        // perde uma entry mas pipeline não trava.
        try {
          const extracted = extractPhrases(buffer, clientName)
          const { error: phrasesErr } = await service.rpc(
            'persist_report_phrases_versioned' as never,
            {
              p_reading_id: readingId,
              p_therapist_id: user.id,
              p_prompt_version: getSystemPromptVersion(),
              p_prompt_sha: getSystemPromptVersion(),
              p_method_version: STAGE2_METHOD_VERSION,
              p_phrases: extracted as unknown as Record<string, unknown>,
              p_markdown_blob_url: null,
            } as never,
          )
          if (phrasesErr) {
            console.warn(
              '[analyze] persist_report_phrases_versioned RPC failed (migration 0030 pending?):',
              phrasesErr.message,
            )
          }
        } catch (err) {
          console.warn(
            '[analyze] extract_phrases/persist failed (non-fatal):',
            err instanceof Error ? err.message : err,
          )
        }

        // 07.4-36: bbox cost/latency already persisted by canonicalizeReading
        // into readings.canonical_metadata — read it here (no extra call).
        const canon = (reading as { canonical_metadata?: unknown })
          .canonical_metadata as CanonicalMetadata | null

        await logReportGeneration(service, {
          reading_id: readingId,
          method: STAGE2_METHOD,
          method_version: STAGE2_VERSION,
          latency_ms: finalization.latency_ms,
          cost_usd: Number(finalization.cost_estimate_usd.toFixed(5)),
          tokens_in: finalization.usage.input_tokens,
          tokens_out: finalization.usage.output_tokens,
          cache_creation_input_tokens:
            finalization.usage.cache_creation_input_tokens,
          cache_read_input_tokens: finalization.usage.cache_read_input_tokens,
          model_version: MODEL,
          prompt_version: getSystemPromptVersion(),
          canonical_fallback_count: prep.fallbackCount,
          audit_summary: audit,
          regeneration_count: currentCount + 1,
          client_id:
            (reading as { client_id?: string | null }).client_id ?? null,
          bbox_cost_usd:
            typeof canon?.cost_usd === 'number'
              ? Number(canon.cost_usd.toFixed(5))
              : null,
          bbox_latency_ms:
            typeof canon?.bbox_latency_ms === 'number'
              ? canon.bbox_latency_ms
              : null,
        })

        revalidatePath(`/leituras/${readingId}`)
        revalidatePath(`/leituras/${readingId}/editar`)
        revalidatePath('/leituras')

        // (2026-05-23) Notificação por email foi movida daqui pra antes:
        // dispara no /api/convite/[token]/upload (auto-finalize count=6) e
        // /api/convite/[token]/finalize (manual). Founder decision: sinal
        // útil é "cliente terminou a captura", não "relatório pronto" —
        // este último vira ruído durante UAT. Ver
        // lib/notifications/notify-therapist-capture-complete.ts.

        try {
          controller.close()
        } catch {
          // already closed by client disconnect — no-op
        }
      } catch (err) {
        console.error(
          '[analyze] stream error reading=' + readingId + ' err=',
          err instanceof Error ? err.message : 'unknown',
        )
        try {
          if (Object.keys(completedSections).length > 0 || buffer.length > 0) {
            const partialEssence = extractEssencePhrase(buffer)
            if (partialEssence) completedSections.essence_phrase = partialEssence
            const partialZero = extractZeroSection(buffer)
            if (partialZero) completedSections['0_em_poucas_palavras'] = partialZero
            await supabase
              .from('readings')
              .update({
                report_generated: completedSections,
                report_raw_text: buffer as unknown as never,
              })
              .eq('id', readingId)
          }
          enqueueSilent(
            encoder.encode(
              '\n\n[erro]: ' + (err instanceof Error ? err.message : 'desconhecido'),
            ),
          )
        } finally {
          try {
            controller.close()
          } catch {
            // already closed — no-op
          }
        }
      } finally {
        // v2.3.0: marca completed_at (mantém started_at intacto pra
        // histórico). Idempotency gate (f) lê {started, completed} —
        // completed populado = handler terminou (sucesso OU erro final),
        // libera retentativa imediatamente. Sem isso, terapeuta teria que
        // esperar a janela de 5min stale expirar.
        const { error: completedErr } = await service
          .from('readings')
          .update({ analysis_completed_at: new Date().toISOString() } as never)
          .eq('id', readingId)
        if (completedErr) {
          console.warn(
            '[analyze] analysis_completed_at update failed (migration 0030 pending?):',
            completedErr.message,
          )
        }
      }
    },

    async cancel() {
      console.info('[analyze] stream cancelled by caller reading=' + readingId)
    },
  })

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
