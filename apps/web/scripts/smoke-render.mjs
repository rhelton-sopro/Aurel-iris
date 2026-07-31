// Teste de fumaça do render — CHAMA renderHTML de verdade.
// Existe porque `import()` sozinho NÃO pega o erro: uma crase perdida num comentário CSS
// deixa o módulo sintaticamente válido e só explode ao renderizar (3 vezes em 2026-07-31).
import { readFileSync } from 'node:fs'
import { renderHTML } from '../_motor-lab/render-novo.mjs'
const md = readFileSync('../_motor-lab/out/novo-miguel--sonnet-5.md','utf8')
const { html, AG } = renderHTML(md, 'miguel', 'Teste')
if (!html || html.length < 50000) throw new Error('HTML suspeito: ' + html.length)
if (!/id="b7"/.test(html)) throw new Error('bloco 7 ausente')
console.log('✓ render OK —', html.length, 'chars · AG', JSON.stringify(AG))
