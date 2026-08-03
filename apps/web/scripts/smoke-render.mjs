// Teste de fumaça do render — CHAMA renderHTML de verdade.
// Existe porque `import()` sozinho NÃO pega o erro: uma crase perdida num comentário CSS
// deixa o módulo sintaticamente válido e só explode ao renderizar.
import { readFileSync } from 'node:fs'

// ⛔ TRAVA DA CRASE — roda ANTES do import, e por isso pega o erro com LINHA e TRECHO em vez
// de um "ReferenceError: body is not defined" no meio do CSS.
//
// O CSS de render-novo.mjs mora dentro de uma template string. Uma crase num comentário
// (`.section-body`, `node scripts/x.mjs`, qualquer coisa) FECHA a string e o resto do CSS
// vira código. Errei isso 5 vezes entre 31/07 e 02/08, sempre do mesmo jeito: escrevendo um
// comentário explicativo bem-intencionado. Reconhecer o padrão não bastou — daí a trava.
{
  const fonte = readFileSync('../_motor-lab/render-novo.mjs', 'utf8')
  const linhas = fonte.split('\n')
  // acha o trecho de CSS: da abertura da template string do STYLE até o fim do @media print
  const ini = linhas.findIndex((l) => l.includes('const STYLE_EXTRA') || l.includes('@media print'))
  const suspeitas = []
  linhas.forEach((l, i) => {
    const t = l.trim()
    // dentro do CSS, comentário é /* ... */ e NUNCA deve conter crase
    if (i > 400 && /\/\*|^\s+\*|^\s*[.#@a-z-]+\{/.test(t) && t.includes('`')) {
      suspeitas.push(`  linha ${i + 1}: ${t.slice(0, 100)}`)
    }
  })
  if (suspeitas.length && ini >= 0) {
    console.error('⛔ CRASE dentro do bloco de CSS (fecha a template string e quebra o render):')
    console.error(suspeitas.join('\n'))
    console.error('\n→ troque a crase por aspas duplas no comentário.')
    process.exit(1)
  }
}

const { renderHTML, TITULOS_BLOCOS, OMITIR_RX_POR_BLOCO } = await import('../_motor-lab/render-novo.mjs')
const md = readFileSync('../_motor-lab/out/novo-miguel--sonnet-5.md', 'utf8')
const { html, AG } = renderHTML(md, 'miguel', 'Teste')
if (!html || html.length < 50000) throw new Error('HTML suspeito: ' + html.length)
if (!/id="b7"/.test(html)) throw new Error('bloco 7 ausente')

// as duas famílias canônicas — ver docs/DECISOES.md (2026-08-02). Se voltar a aparecer
// font-family literal, o PDF volta a sair com fonte acidental.
const literais = [...html.matchAll(/font-family:\s*(?!var\(--)([^;}]{3,60})/g)].map((m) => m[1].trim())
if (literais.length) {
  console.error('⛔ font-family LITERAL no HTML (tem que ser var(--serif)/var(--sans)):')
  console.error([...new Set(literais)].map((x) => '  ' + x).join('\n'))
  process.exit(1)
}
// ⛔ REGRESSÃO 2026-08-03: o diagrama transgeracional desenha os pictogramas com
// `<use href="#g-adulto">` — 33 deles. Um regex meu que removia `href="#..."` (escrito pra
// matar a recursão de âncora dentro do iframe) apagou TODOS, e as figuras sumiram da tela.
// Quem pegou foi o founder. Regex largo em cima de HTML acerta o que você não estava mirando.
const usos = (html.match(/<use\b[^>]*href="#/g) || []).length
if (usos < 20) {
  console.error(`⛔ só ${usos} <use href="#..."> no SVG do transgeracional (esperado 30+). As figuras somem da tela.`)
  process.exit(1)
}
// ⛔ SELEÇÃO DE BLOCOS DA VERSÃO DO CLIENTE (founder, 2026-08-03) — provada NOS DOIS
// SENTIDOS: o bloco desmarcado some E os outros ficam.
//
// Mora aqui, e não no vitest, porque o motor é .mjs e não carrega sob o vite (o import
// morre com SyntaxError antes de qualquer teste rodar). Sem este guard, um padrão que
// casa demais tira o bloco errado e um que casa de menos entrega ao cliente o guia de
// condução do terapeuta — nada disso aparece em build, lint ou tsc.
{
  const todos = TITULOS_BLOCOS.map((_t, i) => i)
  if (OMITIR_RX_POR_BLOCO.length !== TITULOS_BLOCOS.length) {
    console.error('⛔ OMITIR_RX_POR_BLOCO e TITULOS_BLOCOS têm tamanhos diferentes — a caixinha passa a desmarcar o bloco errado.')
    process.exit(1)
  }
  const omitirDaSelecao = (inc) => OMITIR_RX_POR_BLOCO.filter((_rx, i) => !inc.includes(i))
  const doc = (inc) => renderHTML(md, 'miguel', 'Teste', { omitirTitulos: omitirDaSelecao(inc) }).html
  const presentes = (h) => todos.filter((i) => h.includes(`<section class="block" id="b${i + 1}"`))

  const cheio = presentes(doc(todos))
  if (cheio.length !== todos.length) {
    console.error('⛔ com TODOS os blocos marcados o documento veio incompleto:', cheio.map((i) => i + 1).join(','))
    process.exit(1)
  }
  for (const alvo of todos) {
    const inc = todos.filter((i) => i !== alvo)
    const h = doc(inc)
    const p = presentes(h)
    if (p.includes(alvo)) {
      console.error(`⛔ desmarcar "${TITULOS_BLOCOS[alvo]}" NÃO tirou o bloco do documento.`)
      process.exit(1)
    }
    if (h.includes(`href="#b${alvo + 1}"`)) {
      console.error(`⛔ "${TITULOS_BLOCOS[alvo]}" saiu do documento mas continua no ÍNDICE (âncora morta).`)
      process.exit(1)
    }
    if (inc.some((i) => !p.includes(i))) {
      console.error(`⛔ desmarcar "${TITULOS_BLOCOS[alvo]}" derrubou outro bloco junto: presentes=${p.map((i) => i + 1).join(',')}`)
      process.exit(1)
    }
  }
  // fitoterapia é do TERAPEUTA e nunca dependeu de caixinha
  if (doc(todos).includes('Fitoterapia tradicional')) {
    console.error('⛔ Fitoterapia tradicional VAZOU para a versão do cliente.')
    process.exit(1)
  }
  if (!html.includes('Fitoterapia tradicional')) {
    console.error('⛔ Fitoterapia tradicional sumiu do PDF do TERAPEUTA (deveria estar lá).')
    process.exit(1)
  }
  console.log(`✓ seleção de blocos OK — ${todos.length} blocos, cada um provado nos dois sentidos`)
}

console.log('✓ render OK —', html.length, 'chars · AG', JSON.stringify(AG), '·', usos, 'pictogramas')
