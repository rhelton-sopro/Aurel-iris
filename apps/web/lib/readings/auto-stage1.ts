import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

// ⚠️ canonicalize / prepare-direct-images / stage1-scan entram por import DINÂMICO lá
// embaixo, de propósito. Estaticamente, eles arrastam lib/anthropic/client, que ESTOURA
// no import quando não há ANTHROPIC_API_KEY no ambiente — e isso derrubava a suíte de
// toda rota que passasse a importar este módulo (o teste da /process morreu na coleta
// assim). Carregando na hora do uso, importar `ensureStage1` continua barato.

/**
 * Roda o Stage 1 (o exame estruturado da íris) assim que a captura completa —
 * SEM gerar relatório e SEM debitar crédito.
 *
 * ⭐ POR QUE ISTO EXISTE (founder, 2026-08-10 — caso Melissa/Nailli).
 *
 * Gerar o relatório é passo manual (clique do terapeuta, que é quando o crédito é
 * debitado). As fotos, por promessa de privacidade, são apagadas 24h depois da
 * captura. Entre uma coisa e outra havia um vão: o cliente terminava as 6 fotos num
 * sábado à noite, ninguém clicava, o cron apagava as imagens no domingo — e a leitura
 * virava uma casca IRRECUPERÁVEL, porque o Stage 1 lê as fotos. Aconteceu 8 vezes
 * desde o conserto de avisos de 29/06, 4 delas com a mesma terapeuta.
 *
 * A saída é esta: o Stage 1 roda sozinho no fim da captura e fica salvo em
 * `report_findings`. Daí em diante o relatório pode ser gerado a qualquer momento —
 * o Stage 2 lê o exame guardado, não as fotos (é o mesmo mecanismo que já permite
 * gerar o Dossiê depois que as imagens somem). Assim:
 *
 *   · as fotos continuam sendo apagadas em 24h — a promessa do termo fica intacta;
 *   · o crédito continua sendo debitado só na geração — o billing não muda;
 *   · a leitura para de morrer por esquecimento.
 *
 * ⛔ NÃO debita crédito, NÃO marca `analysis_started_at` (isso é da geração do
 * relatório — mexer aí faria a UI dizer que a análise está rodando quando não está)
 * e NÃO gera texto nenhum.
 *
 * Idempotente: se a leitura já tem exame corrente, sai na hora. Best-effort: qualquer
 * falha é logada e engolida — isto roda depois da resposta ao cliente, e não pode
 * derrubar a captura que já deu certo.
 */
export async function ensureStage1(readingId: string): Promise<
  { ok: true; skipped?: 'ja_tem_exame' | 'sem_fotos' } | { ok: false; erro: string }
> {
  const service = createServiceClient()

  try {
    // 1. Já existe exame corrente? Então não há o que fazer (re-entrada, retry do
    //    upload, finalize manual correndo junto com o auto-finalize).
    const { data: existente } = await service
      .from('report_findings')
      .select('id')
      .eq('reading_id', readingId)
      .is('superseded_at', null)
      .maybeSingle<{ id: string }>()
    if (existente) return { ok: true, skipped: 'ja_tem_exame' }

    const { data: reading } = await service
      .from('readings')
      .select('id, therapist_id, canonical_metadata, client:clients(full_name, birth_date)')
      .eq('id', readingId)
      .maybeSingle()
    if (!reading?.therapist_id) return { ok: false, erro: 'leitura não encontrada' }

    const therapistId = reading.therapist_id as string
    const clientName =
      (reading.client as { full_name?: string } | null)?.full_name ?? 'Cliente'
    const clientBirth =
      (reading.client as { birth_date?: string } | null)?.birth_date ?? null
    const clientAge = clientBirth
      ? Math.floor((Date.now() - new Date(clientBirth).getTime()) / 31_557_600_000)
      : null

    // 2. Centraliza a íris (best-effort, igual ao /analyze): sem isto o Sonnet lê a
    //    foto crua e só enxerga sinal grosso. Se falhar, segue no raw.
    if (!reading.canonical_metadata) {
      try {
        const { canonicalizeReading } = await import('@/lib/canonicalize')
        await canonicalizeReading(readingId, therapistId)
      } catch (err) {
        console.error('[auto-stage1] canonicalize falhou (segue com raw)', {
          readingId,
          erro: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // 3. As 6 fotos. Se já não existirem, não há Stage 1 possível — é exatamente o
    //    caso que este módulo existe para evitar, então merece log alto.
    const { prepareDirectImages } = await import('@/lib/anthropic/prepare-direct-images')
    const prep = await prepareDirectImages(service, readingId)
    if (!prep.ok) {
      console.error('[auto-stage1] sem fotos para o exame', { readingId, motivo: prep.reason })
      return { ok: true, skipped: 'sem_fotos' }
    }

    // 4. O exame em si.
    const { runStage1Scan } = await import('@/lib/anthropic/stage1-scan')
    const stage1 = await runStage1Scan({
      readingId,
      therapistId,
      images: prep.images,
      clientName,
      clientAge,
    })

    // 5. Persiste pelo MESMO RPC do /analyze (transação atômica com superseded_at) —
    //    é o que faz o exame ser reaproveitado depois, em vez de rodar de novo.
    const validationStatusForDb =
      stage1.validation_status === 'valid' || stage1.validation_status === 'valid_with_warnings'
        ? 'valid'
        : stage1.validation_status === 'invalid_retried'
          ? 'invalid_retried'
          : 'invalid_final'

    const { error: persistErr } = await service.rpc(
      'persist_report_findings_versioned' as never,
      {
        p_reading_id: readingId,
        p_therapist_id: therapistId,
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
        p_cache_creation_input_tokens: stage1.cache_creation_input_tokens,
        p_cache_read_input_tokens: stage1.cache_read_input_tokens,
      } as never,
    )
    if (persistErr) {
      // Gravar é o ponto INTEIRO desta função: se o exame não entra no banco, a
      // leitura continua dependendo das fotos e volta a morrer no expurgo.
      console.error('[auto-stage1] persist_report_findings_versioned falhou', {
        readingId,
        erro: persistErr.message,
      })
      return { ok: false, erro: persistErr.message }
    }

    console.info('[auto-stage1] exame salvo — a leitura não depende mais das fotos', {
      readingId,
      validacao: stage1.validation_status,
      custo_usd: Number(stage1.cost_usd.toFixed(4)),
    })
    return { ok: true }
  } catch (err) {
    console.error('[auto-stage1] falhou', {
      readingId,
      erro: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, erro: err instanceof Error ? err.message : String(err) }
  }
}
