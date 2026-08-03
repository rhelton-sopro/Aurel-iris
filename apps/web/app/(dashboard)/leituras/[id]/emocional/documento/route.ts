/**
 * GET /leituras/[id]/emocional/documento — o Mapa do Ser como DOCUMENTO CRU (text/html).
 *
 * ⭐ POR QUE ESTA ROTA EXISTE (2026-08-03). O relatório é embutido na página da leitura num
 * `<iframe>`. Enquanto isso era feito com `srcDoc`, o documento NÃO tinha URL própria — ele
 * herdava a base do documento pai — e por isso `href="#b7"` resolvia para
 * `/leituras/<id>#b7`: o iframe carregava a página da leitura DENTRO de si mesmo (o founder
 * viu e descreveu como "recursivo").
 *
 * A primeira tentativa foi remover os links do índice na cópia embutida. Isso matou a
 * recursão, mas também matou a NAVEGAÇÃO — founder: *"eu clico e não vai para lugar nenhum,
 * deveria descer na página"*. Meia solução.
 *
 * Com uma URL de verdade o iframe passa a ter documento próprio, e `#b7` volta a ser âncora
 * interna: rola dentro do quadro, sem recarregar nada. É o conserto inteiro, não metade.
 *
 * ⛔ Mesma origem, de propósito: a página pai precisa ler `contentDocument` para medir a
 * altura (o embed cresce com o conteúdo, sem barra de rolagem interna).
 * ⛔ Sem cache: documento de cliente. O isolamento é o RLS da query — a leitura de outro
 * terapeuta simplesmente não retorna.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderEmocional } from '@/lib/emocional/render'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return new NextResponse('não autenticado', { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas da 0051, tipos não regerados
  const db = supabase as unknown as { from: (t: string) => any }

  const { data: reading } = await db
    .from('readings')
    .select('id, client_id, report_emocional')
    .eq('id', id)
    .single()
  if (!reading?.report_emocional) return new NextResponse('Mapa do Ser não gerado', { status: 404 })

  const [{ data: findings }, { data: client }] = await Promise.all([
    // superseded_at IS NULL — sem isto, leitura regerada tem 2+ linhas, o maybeSingle erra
    // e o documento sai com os gráficos vazios (o mesmo bug que já mordeu tela e PDF).
    db.from('report_findings').select('exame_json').eq('reading_id', id).is('superseded_at', null).maybeSingle(),
    db.from('clients').select('full_name').eq('id', reading.client_id).maybeSingle(),
  ])

  const nome = (client?.full_name || '').trim().split(/\s+/)[0] || 'você'
  try {
    const { html } = renderEmocional(reading.report_emocional, findings?.exame_json ?? {}, nome)
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    })
  } catch (e) {
    console.error('[emocional/documento] falha ao renderizar', { readingId: id, e })
    return new NextResponse('falha ao montar o documento', { status: 500 })
  }
}
