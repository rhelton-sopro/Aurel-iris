/**
 * POST /api/readings/[id]/emocional — gera o RELATÓRIO EMOCIONAL ("Mapa do Ser").
 *
 * ⛔ FOUNDER-ONLY por enquanto (decisão founder 2026-07-28: "somente no meu usuário").
 * O gate é fail-closed: sem FOUNDER_EMAIL no ambiente, ninguém passa.
 *
 * Não captura nada novo — reaproveita o Stage 1 da leitura que JÁ existe
 * (`report_findings.exame_json`). Se a leitura não tem Stage 1, não há o que processar.
 *
 * Guarda o MARKDOWN, não o HTML: o desenho muda toda semana e re-renderizar tem que ser
 * de graça. Ver 0051_report_emocional.sql.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { gerarRelatorioEmocional, BLOCOS_ESPERADOS } from '@/lib/emocional/gerar'

export const runtime = 'nodejs'
export const maxDuration = 800 // plano PRO; a geração leva ~200s e o teto da SDK é maior

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (!isFounderEmail(user.email)) {
    return NextResponse.json({ error: 'indisponível' }, { status: 403 })
  }

  // a leitura tem que ser do próprio terapeuta (RLS já cobre, mas falhamos explícito)
  // ⚠️ as colunas report_emocional_* vêm da migration 0051 e ainda não estão nos tipos
  // gerados do schema — o cast sai quando os tipos forem regerados pós-deploy.
  const db = supabase as unknown as {
    from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const { data: reading, error: eRead } = await db
    .from('readings')
    .select('id, therapist_id, client_id, report_emocional')
    .eq('id', id)
    .single()
  if (eRead || !reading) return NextResponse.json({ error: 'leitura não encontrada' }, { status: 404 })

  // o Stage 1 que já foi gerado para o Dossiê (o relatório que já estava no ar)
  const { data: findings } = await db
    .from('report_findings')
    .select('exame_json')
    .eq('reading_id', id)
    .maybeSingle()

  const exame = findings?.exame_json as Record<string, unknown> | null
  if (!exame || Object.keys(exame).length === 0) {
    return NextResponse.json(
      // ⚠️ NÃO dizer "relatório principal" aqui: desde 2026-07-30 o principal é o Mapa
      // do Ser (este), e o que falta gerar é o Dossiê. Dizer "principal" mandaria o
      // founder gerar exatamente o que ele já está tentando gerar.
      { error: 'esta leitura ainda não tem Stage 1 — gere o Dossiê primeiro' },
      { status: 409 },
    )
  }

  const { data: client } = await db
    .from('clients')
    .select('full_name')
    .eq('id', reading.client_id)
    .maybeSingle()
  const nome = (client?.full_name || '').trim().split(/\s+/)[0] || 'você'

  try {
    const { markdown, completo, metadata } = await gerarRelatorioEmocional(exame, nome)
    // Mesma trava da rota que o terapeuta usa (2026-08-23): documento cortado não vira
    // relatório. Aqui não há crédito para proteger (founder-only), mas guardar metade
    // como pronta é o mesmo defeito — e foi assim que o corte de 23/08 passou batido.
    if (!completo) {
      console.error('[emocional] INCOMPLETO', {
        readingId: id,
        blocos: metadata.blocos,
        stop_reason: metadata.stop_reason,
      })
      return NextResponse.json(
        { error: `saiu incompleto (${metadata.blocos} de ${BLOCOS_ESPERADOS} partes) — nada foi gravado`, metadata },
        { status: 502 },
      )
    }
    const { error: eUp } = await db
      .from('readings')
      .update({
        report_emocional: markdown,
        report_emocional_generated_at: new Date().toISOString(),
        report_emocional_metadata: metadata,
      })
      .eq('id', id)
    if (eUp) throw new Error(`falha ao gravar: ${eUp.message}`)

    return NextResponse.json({ ok: true, metadata })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido'
    console.error('[emocional] falha na geração', { readingId: id, msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
