/**
 * GET /api/readings/[id]/emocional/pdf — PDF do relatório emocional ("Mapa do Ser").
 *
 * ⛔ FOUNDER-ONLY, como a geração e a página.
 *
 * PIPELINE CAPA + CORPO + MERGE (2026-07-28), igual ao do dossiê. A versão anterior fazia
 * UMA chamada com o documento inteiro e margens zero — o que entregava o PDF, mas sem
 * capa, sem cabeçalho e sem rodapé, porque no Gotenberg as bandas de header/footer são
 * desenhadas DENTRO de marginTop/marginBottom: com margem zero não existe onde elas caibam.
 *
 * São 3 chamadas: capa (margem zero, sangra, sem cabeçalho), corpo (com as bandas), e
 * merge. O merge tem que ser pdftk — o `cat` dele preserva os destinos nomeados, e o
 * índice do documento é feito de âncoras (#b1…), então com qpdf os links morreriam.
 *
 * A CAPA É A MESMA DO DOSSIÊ, de propósito (pedido do founder: "copiar aquilo lá"):
 * mesma função `renderCoverHtml`, mesma logo, mesmo nome completo, mesma data. Não uma
 * cópia paralela — cópia paralela foi a origem dos bugs desta semana. Só o rótulo muda,
 * para não chamar o emocional de "Clínico-Funcional".
 *
 * O documento do emocional traz `@page{margin:16mm 14mm}` e `.pad{padding:até 56px}` no
 * próprio CSS. Os dois são neutralizados na impressão (ver PRINT_OVERRIDES): quem passa a
 * mandar nas margens é o Gotenberg, senão o recuo soma e o texto fica espremido.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { renderEmocional } from '@/lib/emocional/render'
import {
  renderCoverHtml,
  renderHeaderHtml,
  renderFooterHtml,
} from '@/lib/pdf/report-print-document'
import { DISCLAIMER_COMPACT } from '@/components/legal/DisclaimerCopy'

/**
 * ⚠️ O `@page` do DOCUMENTO tem que SUMIR, não ser sobrescrito.
 *
 * No Chromium, um `@page{margin:...}` no CSS VENCE as margens que o Gotenberg pede. O
 * documento emocional traz `@page{margin:16mm 14mm}` próprio. A 1ª tentativa sobrescreveu
 * com `@page{margin:0}` — o pior dos mundos: zerou a margem do CORPO enquanto as bandas de
 * cabeçalho/rodapé seguiam desenhadas onde o Gotenberg mandou. Resultado em prod: texto
 * até a borda do papel e passando por baixo do cabeçalho.
 *
 * O CSS de impressão do dossiê NÃO declara `@page` nenhum de propósito (só um comentário
 * dizendo que as margens são da rota). Aqui é a mesma coisa: removemos a regra do HTML e
 * o Gotenberg passa a ser o único dono das margens — que é onde as bandas cabem.
 */
const RE_AT_PAGE = /@page\s*\{[^}]*\}/g

/**
 * Injetado no fim do <head>.
 * - `.pad{padding:0}`: tinha até 56px; somado aos 0.7in laterais, duplicaria o recuo.
 * - `.brand/.brand-sub`: a identidade agora vive na capa e no cabeçalho de cada página;
 *   sem isto, a página 2 abriria com a terceira marca Iris Codex empilhada.
 */
const PRINT_OVERRIDES =
  '<style>@media print{' +
  '.pad{padding:0}' +
  '.brand,.brand-sub{display:none}' +
  '}</style>'

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
    .select('id, client_id, report_emocional, report_emocional_generated_at')
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
  const geradoEm: string | null = reading.report_emocional_generated_at ?? null

  let html: string
  try {
    html = renderEmocional(reading.report_emocional, findings?.exame_json ?? {}, primeiro).html
    // 1) Tira o @page do documento — daí quem manda nas margens é o Gotenberg (ver acima).
    html = html.replace(RE_AT_PAGE, '')
    // 2) Overrides no fim do <head> para vencerem o @media print por ordem de cascata.
    //    Sem </head> seguimos sem eles: o PDF sai com o recuo antigo, mas sai.
    html = html.includes('</head>')
      ? html.replace('</head>', `${PRINT_OVERRIDES}</head>`)
      : html
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

  const blob = (s: string) => new Blob([s], { type: 'text/html' })

  // CAPA — a mesma do dossiê, com o NOME COMPLETO. Margem zero para sangrar e, como é um
  // render separado, ela não recebe as bandas de cabeçalho/rodapé (o Chromium não sabe
  // pular header numa página só — foi por isso que o dossiê virou split+merge).
  const coverHtml = renderCoverHtml(
    { sections: {}, clientName: nomeCompleto, readingDate: geradoEm },
    'Mapa do Ser',
  )
  const coverForm = new FormData()
  coverForm.append('files', blob(coverHtml), 'index.html')
  coverForm.append('paperWidth', '8.27') // A4 em polegadas
  coverForm.append('paperHeight', '11.69')
  coverForm.append('marginTop', '0')
  coverForm.append('marginBottom', '0')
  coverForm.append('marginLeft', '0')
  coverForm.append('marginRight', '0')
  coverForm.append('printBackground', 'true')
  coverForm.append('scale', '1.0')

  // CORPO — as margens saem do documento e passam para cá, que é onde as bandas cabem.
  // Os mesmos valores do dossiê, para os dois PDFs terem a mesma caixa de texto.
  const bodyForm = new FormData()
  bodyForm.append('files', blob(html), 'index.html')
  bodyForm.append('files', blob(renderHeaderHtml(nomeCompleto)), 'header.html')
  bodyForm.append('files', blob(renderFooterHtml(nomeCompleto, DISCLAIMER_COMPACT)), 'footer.html')
  bodyForm.append('paperWidth', '8.27')
  bodyForm.append('paperHeight', '11.69')
  bodyForm.append('marginTop', '1.2')
  bodyForm.append('marginBottom', '1.0')
  bodyForm.append('marginLeft', '0.7')
  bodyForm.append('marginRight', '0.7')
  bodyForm.append('printBackground', 'true') // sem isto o papel marfim e as barras somem
  bodyForm.append('scale', '1.0')
  bodyForm.append('generateDocumentOutline', 'true') // marcadores clicáveis a partir dos h2

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)
  const post = (path: string, body: FormData) =>
    fetch(`${base}${path}`, { method: 'POST', body, headers, signal: controller.signal })

  try {
    const coverRes = await post('/forms/chromium/convert/html', coverForm)
    if (!coverRes.ok) {
      const detail = await coverRes.text().catch(() => '')
      console.error('[emocional/pdf] gotenberg capa', { readingId: id, status: coverRes.status, detail: detail.slice(0, 300) })
      return NextResponse.json({ error: 'falha ao gerar a capa do PDF' }, { status: 502 })
    }
    const coverPdf = await coverRes.arrayBuffer()

    const bodyRes = await post('/forms/chromium/convert/html', bodyForm)
    if (!bodyRes.ok) {
      const detail = await bodyRes.text().catch(() => '')
      console.error('[emocional/pdf] gotenberg corpo', { readingId: id, status: bodyRes.status, detail: detail.slice(0, 300) })
      return NextResponse.json({ error: 'falha na conversão para PDF' }, { status: 502 })
    }
    const bodyPdf = await bodyRes.arrayBuffer()

    // MERGE — ordenado por nome de arquivo, daí os prefixos numéricos. O engine é pdftk
    // (forçado no render.yaml): o `cat` dele preserva os destinos nomeados, então os links
    // do índice (#b1…) sobrevivem. Com qpdf --pages eles morrem.
    const mergeForm = new FormData()
    mergeForm.append('files', new Blob([coverPdf], { type: 'application/pdf' }), '1_capa.pdf')
    mergeForm.append('files', new Blob([bodyPdf], { type: 'application/pdf' }), '2_corpo.pdf')
    const mergeRes = await post('/forms/pdfengines/merge', mergeForm)
    if (!mergeRes.ok) {
      const detail = await mergeRes.text().catch(() => '')
      console.error('[emocional/pdf] gotenberg merge', { readingId: id, status: mergeRes.status, detail: detail.slice(0, 300) })
      return NextResponse.json({ error: 'falha ao juntar capa e corpo' }, { status: 502 })
    }
    const pdf = await mergeRes.arrayBuffer()
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
