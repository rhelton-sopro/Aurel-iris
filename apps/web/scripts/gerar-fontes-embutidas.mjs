/**
 * Gera `lib/pdf/fontes-embutidas.mjs` a partir dos .woff2 de `lib/pdf/fonts/`.
 *
 * Por que base64 embutido e não arquivo servido: o PDF de produção NÃO pode depender de
 * rede. Se o Gotenberg falhasse ao buscar a fonte, ele cairia no fallback CALADO — que é
 * exatamente o defeito que estamos consertando (ver docs/DECISOES.md 2026-08-02).
 * Com `data:` URI a fonte viaja dentro do próprio HTML.
 *
 * De onde vêm os arquivos (ambos com licença que PERMITE embarcar):
 *   Inter            — SIL OFL 1.1 · @fontsource/inter@5.3.0 (files/inter-latin-<peso>-*.woff2)
 *   TeX Gyre Pagella — GUST Font License (clone livre da Palatino) ·
 *                      https://cdn.jsdelivr.net/npm/typeface-tex-gyre-pagella/files/
 * ⛔ Palatino Linotype e Segoe UI (as do desenho original) são proprietárias da Microsoft
 *    e NÃO podem ser embarcadas — daí os substitutos.
 *
 * Uso: node scripts/gerar-fontes-embutidas.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('lib/pdf/fonts')
const SAIDA = path.resolve('lib/pdf/fontes-embutidas.mjs')

// arquivo → (família, peso, estilo)
const MAPA = {
  'pagella-400.woff2': ['TeX Gyre Pagella', 400, 'normal'],
  'pagella-400italic.woff2': ['TeX Gyre Pagella', 400, 'italic'],
  'pagella-700.woff2': ['TeX Gyre Pagella', 700, 'normal'],
  'pagella-700italic.woff2': ['TeX Gyre Pagella', 700, 'italic'],
  'inter-400.woff2': ['Inter', 400, 'normal'],
  'inter-400italic.woff2': ['Inter', 400, 'italic'],
  'inter-500.woff2': ['Inter', 500, 'normal'],
  'inter-600.woff2': ['Inter', 600, 'normal'],
  'inter-700.woff2': ['Inter', 700, 'normal'],
}

const achados = readdirSync(DIR).filter((f) => f.endsWith('.woff2'))
const faltando = Object.keys(MAPA).filter((f) => !achados.includes(f))
if (faltando.length) throw new Error('faltam fontes em lib/pdf/fonts/: ' + faltando.join(', '))

let css = ''
let bytes = 0
for (const [arq, [fam, peso, estilo]] of Object.entries(MAPA)) {
  const b = readFileSync(path.join(DIR, arq))
  bytes += b.length
  css += `@font-face{font-family:'${fam}';font-style:${estilo};font-weight:${peso};font-display:block;`
    + `src:url(data:font/woff2;base64,${b.toString('base64')}) format('woff2')}\n`
}

writeFileSync(SAIDA, `// ⚠️ ARQUIVO GERADO — não editar à mão.
// Rode: node scripts/gerar-fontes-embutidas.mjs
// Fontes e licenças estão documentadas nesse script.
export const FONT_FACE_CSS = ${JSON.stringify(css)}
`)
console.log(`✓ ${SAIDA}\n  ${Object.keys(MAPA).length} faces · ${(bytes / 1024).toFixed(0)} KB de fonte · ${(css.length / 1024).toFixed(0)} KB de CSS`)
