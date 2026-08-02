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

const { renderHTML } = await import('../_motor-lab/render-novo.mjs')
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
console.log('✓ render OK —', html.length, 'chars · AG', JSON.stringify(AG))
