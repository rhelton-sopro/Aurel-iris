/**
 * Acusa PÁGINAS EM BRANCO num PDF.
 *
 * Existe porque o founder pegou uma folha totalmente em branco (entre a linha do tempo e as
 * Heranças transgeracionais) que eu não vi mesmo tendo olhado o PDF — eu confiro as páginas
 * onde MEXI, e defeito de paginação nasce onde não se mexeu. Conferir 30+ páginas no olho
 * não escala.
 *
 * ⚠️ A lógica NÃO mora aqui: vem de `lib/pdf/paginas-vazias.mjs`, o MESMO módulo que a rota
 * de produção usa como guard. Duas cópias divergiriam.
 *
 * A 1ª versão rasterizava cada página pelo Chrome e media tinta com o `sharp` (~2 min para
 * 32 páginas). O módulo compartilhado lê o content stream direto do PDF: mesmo resultado em
 * milissegundos, sem browser e sem dependência.
 *
 * Uso: node scripts/pdf-paginas-vazias.mjs [caminho.pdf]
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { paginasVazias } from '../lib/pdf/paginas-vazias.mjs'

const PDF = path.resolve(process.argv[2] ?? '_pdf-local/mapa-do-ser.pdf')
const r = paginasVazias(readFileSync(PDF))

if (!r.ok) {
  console.error(`⚠️ não consegui ler as páginas de ${PDF} — o detector é fail-open, então isto NÃO significa que o PDF está bom.`)
  process.exit(2)
}
console.log(`${path.basename(PDF)} · ${r.total} páginas`)
if (r.vazias.length) {
  console.error(`\n⛔ ${r.vazias.length} página(s) EM BRANCO: ${r.vazias.join(', ')}`)
  process.exit(1)
}
console.log('\n✓ nenhuma página em branco')
