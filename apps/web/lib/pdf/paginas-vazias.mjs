/**
 * Detecta PÁGINAS EM BRANCO num PDF, sem dependência nenhuma além do `zlib` do Node.
 *
 * ⭐ POR QUE EXISTE (founder, 2026-08-01): *"para gerar o PDF, a gente já tem que ver antes
 * de gerar o PDF para não ter mais páginas em branco"*. O caso real foi uma folha 100%
 * branca entre a linha do tempo e as Heranças transgeracionais — o separador `<hr>` mora
 * ENTRE as <section> e, como toda seção começa em página nova, ele transbordava sozinho.
 * A causa foi corrigida no CSS; este módulo é a REDE, para o próximo caso que ninguém
 * previu. O defeito depende de ONDE o texto cai, e isso muda com os dados de cada pessoa —
 * um teste com uma leitura-modelo nunca cobriria.
 *
 * ⚠️ Este é o ÚNICO detector (usado pela rota de PDF e por scripts/pdf-paginas-vazias.mjs).
 * Duas cópias divergiriam, que é o erro que "UM MOTOR SÓ" existe para impedir.
 *
 * COMO FUNCIONA: o Chromium escreve o conteúdo de cada página num content stream
 * Flate-comprimido. Inflando e contando os operadores de texto (Tj/TJ), a separação é
 * total — medido no Mapa do Ser real: páginas normais 32 a 210 operadores, a página em
 * branco EXATAMENTE 0. Por isso o critério é `=== 0`, sem limiar arbitrário.
 * ⚠️ O Chromium emite string HEXADECIMAL (`<002C> Tj`), não literal `(...) Tj` — um regex
 * que exija `)` antes do Tj não casa NADA e o detector mente dizendo que tudo está vazio.
 *
 * FAIL-OPEN de propósito: qualquer erro de parsing devolve `ok:false` e lista vazia. Um
 * detector quebrado nunca pode impedir a entrega de um PDF que provavelmente está bom.
 */
import zlib from 'node:zlib'

/**
 * @param {ArrayBuffer|Buffer|Uint8Array} entrada — o PDF
 * @returns {{ok: boolean, total: number, vazias: number[]}} `vazias` é 1-based.
 */
export function paginasVazias(entrada) {
  try {
    const buf = Buffer.isBuffer(entrada) ? entrada : Buffer.from(entrada)
    const raw = buf.toString('latin1')

    // offset de cada "N 0 obj"
    const objs = new Map()
    for (const m of raw.matchAll(/(\d+)\s+0\s+obj\b/g)) objs.set(Number(m[1]), m.index)
    if (!objs.size) return { ok: false, total: 0, vazias: [] }

    const corpoDe = (n) => {
      const off = objs.get(n)
      if (off === undefined) return null
      const fim = raw.indexOf('endobj', off)
      return { off, texto: raw.slice(off, fim === -1 ? raw.length : fim) }
    }

    const streamDe = (n) => {
      const o = corpoDe(n)
      if (!o) return null
      const i = o.texto.indexOf('stream')
      if (i === -1) return null
      let ini = i + 6
      if (o.texto[ini] === '\r') ini++
      if (o.texto[ini] === '\n') ini++
      const abs = o.off + ini
      const fim = raw.indexOf('endstream', abs)
      if (fim === -1) return null
      const bytes = buf.subarray(abs, fim)
      if (/\/Filter\s*\/FlateDecode/.test(o.texto.slice(0, i))) {
        try { return zlib.inflateSync(bytes).toString('latin1') } catch { return null }
      }
      return bytes.toString('latin1')
    }

    // páginas na ORDEM DO ARQUIVO (o Chromium as escreve em ordem; suficiente para dizer
    // QUANTAS e ONDE, que é o que a rota precisa para decidir se regenera).
    const paginas = []
    for (const [n] of objs) {
      const o = corpoDe(n)
      if (!o) continue
      // /Type /Page (e NÃO /Pages, que é o nó da árvore)
      if (!/\/Type\s*\/Page[^s]/.test(o.texto)) continue
      const c = o.texto.match(/\/Contents\s+(\d+)\s+0\s+R/)
      paginas.push({ off: o.off, contents: c ? Number(c[1]) : null })
    }
    if (!paginas.length) return { ok: false, total: 0, vazias: [] }
    paginas.sort((a, b) => a.off - b.off)

    const vazias = []
    for (const [i, p] of paginas.entries()) {
      if (p.contents === null) continue
      const s = streamDe(p.contents)
      if (s === null) continue // ilegível: não acusa (fail-open por página)
      if (!/\bT[jJ]\b/.test(s)) vazias.push(i + 1)
    }
    return { ok: true, total: paginas.length, vazias }
  } catch {
    return { ok: false, total: 0, vazias: [] }
  }
}
