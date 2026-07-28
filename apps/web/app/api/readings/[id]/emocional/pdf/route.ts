/**
 * GET /api/readings/[id]/emocional/pdf — PDF do relatório emocional ("Mapa do Ser").
 *
 * ⛔ FOUNDER-ONLY, como a geração e a página.
 *
 * Estratégia (decisão founder 2026-07-28, opção B): UMA chamada ao Gotenberg com o
 * documento inteiro, em vez do pipeline capa+corpo+merge que o relatório de produção usa.
 * Motivo: o emocional já tem `@media print` próprio (escrito 2026-07-27) cuidando das
 * quebras — card dos três centros, momentos da linha do tempo, pêndulos e os 7
 * movimentos do bloco 7 não partem entre páginas. Capa dedicada com header/footer por
 * página fica como melhoria depois; isto entrega o PDF hoje.
 *
 * As margens vão em ZERO de propósito: a "folha" do documento é desenhada em CSS
 * (.sheet, marfim, 820px) e o @media print já define @page margin. Deixar o Gotenberg
 * aplicar margem por cima duplicaria o recuo.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { renderEmocional } from '@/lib/emocional/render'

export const runtime = 'nodejs'
export const maxDuration = 120

const RENDER_TIMEOUT_MS = 90_000

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (!isFounderEmail(auth.user.email)) {
    return NextResponse.json({ error: 'indisponível' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas da 0051, tipos não regerados
  const db = supabase as unknown as { from: (t: string) => any }

  const { data: reading } = await db
    .from('readings')
    .select('id, client_id, report_emocional')
    .eq('id', id)
    .single()
  if (!reading?.report_emocional) {
    return NextResponse.json({ error: 'relatório emocional ainda não gerado' }, { status: 404 })
  }

  const [{ data: findings }, { data: client }] = await Promise.all([
    db.from('report_findings').select('exame_json').eq('reading_id', id).maybeSingle(),
    db.from('clients').select('full_name').eq('id', reading.client_id).maybeSingle(),
  ])
  const nomeCompleto = (client?.full_name || 'cliente').trim()
  const primeiro = nomeCompleto.split(/\s+/)[0] || 'você'

  let html: string
  try {
    html = renderEmocional(reading.report_emocional, findings?.exame_json ?? {}, primeiro).html
  } catch (e) {
    console.error('[emocional/pdf] falha ao renderizar', { readingId: id, e })
    return NextResponse.json({ error: 'falha ao montar o documento' }, { status: 500 })
  }

  const base = process.env.GOTENBERG_URL
  if (!base) {
    console.error('[emocional/pdf] GOTENBERG_URL ausente')
    return NextResponse.json({ error: 'serviço de PDF não configurado' }, { status: 503 })
  }

  const headers: Record<string, string> = {}
  const basicAuth = process.env.GOTENBERG_BASIC_AUTH
  if (basicAuth) headers.Authorization = `Basic ${Buffer.from(basicAuth).toString('base64')}`

  const form = new FormData()
  form.append('files', new Blob([html], { type: 'text/html' }), 'index.html')
  form.append('paperWidth', '8.27') // A4 em polegadas
  form.append('paperHeight', '11.69')
  // margens no CSS (@page do próprio documento), não aqui — ver nota no topo
  form.append('marginTop', '0')
  form.append('marginBottom', '0')
  form.append('marginLeft', '0')
  form.append('marginRight', '0')
  form.append('printBackground', 'true') // sem isto o papel marfim e as barras somem
  form.append('scale', '1.0')
  form.append('generateDocumentOutline', 'true') // índice clicável a partir dos h2

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/forms/chromium/convert/html`, {
      method: 'POST',
      body: form,
      headers,
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[emocional/pdf] gotenberg', { readingId: id, status: res.status, detail: detail.slice(0, 300) })
      return NextResponse.json({ error: 'falha na conversão para PDF' }, { status: 502 })
    }
    const pdf = await res.arrayBuffer()
    const slug = nomeCompleto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Mapa-do-Ser-${slug || 'cliente'}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    const abortado = e instanceof Error && e.name === 'AbortError'
    console.error('[emocional/pdf] erro', { readingId: id, abortado, e })
    return NextResponse.json(
      { error: abortado ? 'a conversão demorou demais' : 'erro ao gerar o PDF' },
      { status: abortado ? 504 : 500 },
    )
  } finally {
    clearTimeout(timeout)
  }
}
