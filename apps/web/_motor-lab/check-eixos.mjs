#!/usr/bin/env node
// VERIFICADOR dos eixos do pêndulo — mesma disciplina do invariante 232/146/378 que já
// vale pra emocao-familia.md. Confere que TODA emoção da tabela-lastro caiu em UM eixo
// (nem zero, nem dois) e denuncia entrada de eixo que não existe na canônica (typo).
// uso: node apps/web/_motor-lab/check-eixos.mjs
import fs from 'node:fs'
import path from 'node:path'
import { parseLastro } from './motor-calc.mjs'

const MD = path.resolve('apps/web/_motor-lab/lastro/emocao-familia.md')

export function parseEixos() {
  const md = fs.readFileSync(MD, 'utf8')
  const sec = md.slice(md.indexOf('## Eixos do pêndulo'))
  const eixos = []
  for (const b of sec.split(/^### Eixo · /m).slice(1)) {
    const nome = b.split('\n')[0].trim()
    const anti = (b.match(/\*\*🟢 Antídoto:\*\*\s*(.*)/) || [])[1] || ''
    const [rotulo, oque] = anti.split(' — ').map((s) => (s || '').replace(/\*/g, '').trim())
    const lista = (re) => {
      const raw = (b.match(re) || [])[1] || ''
      if (raw.trim() === '—') return []
      return raw.split(' · ').map((s) => s.trim()).filter(Boolean).map((s) => s.split(' :: ')[0].trim())
    }
    eixos.push({ nome, rotulo, oque, carga: lista(/\*\*🔴 Cargas:\*\*\s*(.*)/), recurso: lista(/\*\*🟢 Recursos:\*\*\s*(.*)/) })
  }
  return eixos
}

if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] || '').href) {
  // Compara contra a canônica CRUA (sem o NUCLEO_CAP=4 do parseLastro) — o cap é knob do
  // motor, não do vocabulário: a 5ª emoção de um bloco existe na fonte e um dia pode subir.
  const rawMd = fs.readFileSync(path.resolve('apps/web/_motor-lab/lastro/tabela-lastro-CANONICA.md'), 'utf8')
  const clean = (p) => p.replace(/\([^)]*\)/g, '').replace(/[*_`]/g, '').trim()
  const canonC = new Set(), canonR = new Set()
  for (const ln of rawMd.split('\n')) {
    const c = ln.match(/🔴 emoções:\*\*\s*(.*)/); const r = ln.match(/🟢 emoções:\*\*\s*(.*)/)
    if (c) c[1].split('·').map(clean).filter((s) => s.length > 2).forEach((s) => canonC.add(s))
    if (r) r[1].split('·').map(clean).filter((s) => s.length > 2).forEach((s) => canonR.add(s))
  }
  const lastro = parseLastro()
  const capC = new Set(); for (const k in lastro) lastro[k].carga.forEach((e) => capC.add(e))
  console.log(`vocabulário CRU da canônica: ${canonC.size} 🔴 / ${canonR.size} 🟢 · (o motor hoje só enxerga ${capC.size} 🔴 por causa do NUCLEO_CAP=4)`)
  const md0 = fs.readFileSync(MD, "utf8")
  const eixos = parseEixos()
  // seção "Fora do pêndulo": semântica de marcador ("herda a emoção da área") — não é
  // emoção, então não tem oposto. Declarada no md, não hardcoded aqui.
  const foraSec = md0.slice(md0.indexOf('### Fora do pêndulo'))
  const fora = new Set(['🔴', '🟢'].flatMap((k) => {
    const raw = (foraSec.match(new RegExp(`\\*\\*${k}:\\*\\*\\s*(.*)`)) || [])[1] || ''
    return raw.split(' · ').map((s) => s.trim()).filter(Boolean)
  }))

  // O eixo herda o rótulo do emocao-familia.md, que estende o da canônica com o sufixo
  // "→ emoção-base" (princípio psicossomático). Casa por PREFIXO normalizado.
  const norm = (s) => s.replace(/[*_`]/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  // SÓ a forma com seta (não prefixo solto — senão "insegurança" engoliria
  // "insegurança material/financeira", que é outra entrada).
  const casa = (eixo, canon) => eixo === canon || eixo.startsWith(canon + ' →')

  const vistoC = new Map(), vistoR = new Map()
  for (const x of eixos) {
    for (const e of x.carga) vistoC.set(norm(e), [...(vistoC.get(norm(e)) || []), x.nome])
    for (const e of x.recurso) vistoR.set(norm(e), [...(vistoR.get(norm(e)) || []), x.nome])
  }
  const report = (lab, canonRaw, visto) => {
    const canon = new Set([...canonRaw].map(norm).filter((c) => ![...fora].some((f) => norm(f) === c)))
    const achou = (c) => [...visto.keys()].filter((e) => casa(e, c))
    const faltando = [...canon].filter((c) => achou(c).length === 0)
    const fantasma = [...visto.keys()].filter((e) => ![...canon].some((c) => casa(e, c)))
    const dupes = [...canon].map((c) => [c, achou(c).flatMap((e) => visto.get(e))]).filter(([, xs]) => xs.length > 1)
    console.log(`\n${lab}: canônica=${canon.size} · nos eixos=${visto.size}`)
    console.log(`  ❌ SEM EIXO (${faltando.length}):`); faltando.forEach((e) => console.log(`      · ${e}`))
    console.log(`  👻 NÃO EXISTE NA CANÔNICA — typo (${fantasma.length}):`); fantasma.forEach((e) => console.log(`      · ${e}`))
    console.log(`  ♻️ EM 2+ EIXOS (${dupes.length}):`); dupes.forEach(([e, xs]) => console.log(`      · ${e} → ${xs.join(' | ')}`))
    return faltando.length + fantasma.length + dupes.length
  }
  console.log(`EIXOS definidos: ${eixos.length}`)
  // LEI DA 8ª SÉRIE: rótulo que vai pro cliente tem que ser curto
  const longos = eixos.filter((x) => x.rotulo.split(/\s+/).length > 4)
  if (longos.length) console.log(`\n⚠️ rótulos longos demais p/ a lei da 8ª série: ${longos.map((x) => x.rotulo).join(' · ')}`)
  const erros = report('🔴 CARGA', canonC, vistoC) + report('🟢 RECURSO', canonR, vistoR)
  console.log(erros === 0 ? '\n✅ COBERTURA COMPLETA — todo mundo em exatamente um eixo.' : `\n⚠️ ${erros} pendência(s).`)
}
