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
import { renderEmocional, OMITIR_NA_VERSAO_CLIENTE } from '@/lib/emocional/render'
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
 * ⛔ NÃO MEXER NA GEOMETRIA DO DOCUMENTO. Lição de 2026-07-28.
 *
 * A primeira versão zerava `.pad` e escondia `.brand/.brand-sub` para o documento "caber"
 * no pipeline. Isso é o avesso do certo: o desenho foi aprovado pelo founder em 2026-07-27
 * ("FICA O MOCKUP") e o `@media print` dele foi escrito junto, calibrado para essa
 * geometria. Mudar recuo e blocos quebrou o layout (Heranças) em produção.
 *
 * Regra: o pipeline se molda ao documento, não o contrário. A ÚNICA coisa que precisa sair
 * é o `@page` — porque as bandas de cabeçalho/rodapé só existem nas margens do Gotenberg,
 * e um `@page` no CSS vence essas margens. Tudo o mais do desenho fica como aprovado.
 */

export const runtime = 'nodejs'
export const maxDuration = 120

const RENDER_TIMEOUT_MS = 90_000

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  // 2026-07-30: o gate founder-only CAIU aqui — o Mapa do Ser é o relatório principal,
  // e o terapeuta precisa baixar o PDF do próprio trabalho. O isolamento continua sendo
  // o de sempre: RLS na leitura abaixo (a query não retorna leitura de outro terapeuta).

  // Versão do cliente (2026-07-30): blocos 1-6; o 7 ("Perguntas para a sua sessão") é o
  // guia de condução do terapeuta e só entra se ele marcar a caixinha (`&guia=1`).
  const sp = new URL(req.url).searchParams
  const isClient = sp.get('variant') === 'client'
  const comGuia = sp.get('guia') === '1'
  const omitirTitulos = isClient && !comGuia ? OMITIR_NA_VERSAO_CLIENTE : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas da 0051, tipos não regerados
  const db = supabase as unknown as { from: (t: string) => any }

  const { data: reading } = await db
    .from('readings')
    .select('id, client_id, report_emocional, report_emocional_generated_at')
    .eq('id', id)
    .single()
  if (!reading?.report_emocional) {
    return NextResponse.json({ error: 'Mapa do Ser ainda não gerado' }, { status: 404 })
  }

  const [{ data: findings }, { data: client }] = await Promise.all([
    // superseded_at IS NULL — sem isto, leitura regerada tem 2+ linhas, o maybeSingle
    // erra e o PDF sai com os gráficos vazios (mesmo bug da tela).
    db
      .from('report_findings')
      .select('exame_json')
      .eq('reading_id', id)
      .is('superseded_at', null)
      .maybeSingle(),
    db.from('clients').select('full_name').eq('id', reading.client_id).maybeSingle(),
  ])
  const nomeCompleto = (client?.full_name || 'cliente').trim()
  const primeiro = nomeCompleto.split(/\s+/)[0] || 'você'
  const geradoEm: string | null = reading.report_emocional_generated_at ?? null

  let html: string
  try {
    html = renderEmocional(reading.report_emocional, findings?.exame_json ?? {}, primeiro, {
      omitirTitulos,
    }).html
    // Única alteração no documento: tirar o @page, senão as bandas não têm onde caber.
    // Nada de mexer em .pad, .brand ou qualquer coisa do desenho aprovado (ver acima).
    html = html.replace(RE_AT_PAGE, '')
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
  //
  // LATERAIS = 0.551in = 14mm, que é EXATAMENTE o que o `@page` aprovado declarava. Somado
  // ao recuo do `.pad` (preservado), a caixa de texto fica idêntica à do desenho aprovado.
  // ⚠️ NÃO usar os 0.7in do dossiê aqui: são 0.15in a mais de cada lado, e foi isso (junto
  // com o `.pad` zerado) que estreitou a coluna e desmontou o bloco das Heranças.
  //
  // VERTICAIS = 1.2 / 1.0, como no dossiê. Aqui o custo é inevitável: a banda do cabeçalho
  // e a do rodapé SÓ existem dentro dessas margens, então a altura útil cai de 10.43in para
  // 9.49in e a paginação muda. É o preço de ter cabeçalho e rodapé em toda página — não dá
  // para ter os dois e a paginação original. Os blocos frágeis já têm `break-inside:avoid`
  // no @media print aprovado (.gen das Heranças inclusive), que é o que segura isso.
  const bodyForm = new FormData()
  bodyForm.append('files', blob(html), 'index.html')
  bodyForm.append('files', blob(renderHeaderHtml(nomeCompleto)), 'header.html')
  bodyForm.append('files', blob(renderFooterHtml(nomeCompleto, DISCLAIMER_COMPACT)), 'footer.html')
  bodyForm.append('paperWidth', '8.27')
  bodyForm.append('paperHeight', '11.69')
  bodyForm.append('marginTop', '1.2')
  bodyForm.append('marginBottom', '1.0')
  bodyForm.append('marginLeft', '0.551')
  bodyForm.append('marginRight', '0.551')
  bodyForm.append('printBackground', 'true') // sem isto o papel marfim e as barras somem
  // ⭐ SCALE 0.85 — é o que faz o PDF mostrar o desenho APROVADO.
  //
  // O documento foi aprovado num card de 820px (`.sheet{max-width:820px}`). A 100%, a caixa
  // de impressão do A4 dá 688px — abaixo do breakpoint de 700px, então a regra de CELULAR
  // disparava dentro do PDF: o diagrama de gerações (.genfig .gen) empilhava em 1 coluna e
  // a linha que liga os círculos (.gen-line) recebia display:none. Era isso o "perdeu toda a
  // diagramação do transgeracional" — e acontecia em TODAS as versões do PDF, não só depois
  // das minhas margens. Só desligar o breakpoint na impressão não serve: o comentário dele
  // avisa que abaixo de 700px a fileira de 16 figuras estouraria.
  //
  // A 0.85 o viewport de impressão vira 810px ≈ os 820px aprovados: TODOS os breakpoints
  // (700/640/600/560/540) ficam desligados e o layout renderiza como o aprovado. De bônus, a
  // altura útil sai de 911px para 1072px (+18%), o que já alivia a paginação.
  bodyForm.append('scale', '0.85')
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
        'Content-Disposition': `inline; filename="Mapa-do-Ser-${slug || 'cliente'}${
          isClient ? '-cliente' : ''
        }.pdf"`,
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
