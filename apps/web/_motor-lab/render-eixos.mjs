#!/usr/bin/env node
// RENDER da tabela de EIXOS do pêndulo, com NUMERAÇÃO DE LINHA estável — pra revisão
// linha a linha com o founder ("a linha 87 está errada").
// A numeração é sequencial e cobre TUDO: cabeçalho de eixo, cada 🔴 e cada 🟢.
// uso: node apps/web/_motor-lab/render-eixos.mjs  → out/eixos.html (localhost:8899/eixos.html)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// BASE relativa ao PRÓPRIO módulo — o lab roda com cwd=raiz do repo e o app
// Next roda com cwd=apps/web. Resolver por import.meta.url faz o MESMO motor
// servir os dois, sem cópia paralela que deriva depois.
const LAB_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(LAB_DIR, '../../..')
import { parseLastro, calc, eixoDe, EIXOS } from './motor-calc.mjs'

const OUT = path.join(LAB_DIR, 'out/eixos.html')
const EXAMES = ['self', 'daniel', 'miguel', 's5novo', 'opus']
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---- onde há atrito REAL: emoções que colidem (carga e força no mesmo eixo) nos exames ----
const lastro = parseLastro()
const colide = new Map() // emoção → [exames]
const noMapa = new Map() // emoção → [exames] (apareceu de fato no mapa de alguém)
for (const n of EXAMES) {
  const r = calc(n, lastro)
  const vc = new Set(r.mapaCarga.map(([e]) => e)), vr = new Set(r.mapaRecurso.map(([e]) => e))
  for (const e of [...vc, ...vr]) noMapa.set(e, [...(noMapa.get(e) || []), n])
  for (const c of r.colisoes.filter((x) => vc.has(x.carga) && vr.has(x.recurso))) {
    for (const e of [c.carga, c.recurso]) colide.set(e, [...new Set([...(colide.get(e) || []), n])])
  }
}
const acha = (map, e) => map.get(e) || [...map.entries()].find(([k]) => e.startsWith(k) || k.startsWith(e))?.[1]

let L = 0
const linhas = []
for (const [i, x] of EIXOS.entries()) {
  const nEixo = String(i + 1).padStart(2, '0')
  linhas.push({ n: ++L, tipo: 'eixo', eixo: `E${nEixo}`, rotulo: x.rotulo, oque: x.oque })
  for (const e of x.carga) linhas.push({ n: ++L, tipo: 'carga', txt: e, col: acha(colide, e), viu: acha(noMapa, e) })
  for (const e of x.recurso) linhas.push({ n: ++L, tipo: 'recurso', txt: e, col: acha(colide, e), viu: acha(noMapa, e) })
  for (const e of (x.variacoes || [])) linhas.push({ n: ++L, tipo: 'variacao', txt: e })
}

const rows = linhas.map((r) => {
  if (r.tipo === 'eixo') {
    return `<tr class="eixo"><td class="ln">${r.n}</td><td class="tag">${r.eixo}</td><td colspan="2"><b>${esc(r.rotulo)}</b> <span class="oque">— ${esc(r.oque)}</span></td></tr>`
  }
  if (r.tipo === 'variacao') return `<tr class="variacao"><td class="ln">${r.n}</td><td class="pol">✎</td><td>${esc(r.txt)}</td><td class="mk"><span class="viu" title="formulação só do cliente — não existe na canônica">variação</span></td></tr>`
  const marca = r.col ? `<span class="col" title="colide no(s) exame(s): ${r.col.join(', ')}">⚠️ colisão</span>` : r.viu ? `<span class="viu" title="apareceu no mapa de: ${r.viu.join(', ')}">● no mapa</span>` : ''
  return `<tr class="${r.tipo}"><td class="ln">${r.n}</td><td class="pol">${r.tipo === 'carga' ? '🔴' : '🟢'}</td><td>${esc(r.txt)}</td><td class="mk">${marca}</td></tr>`
}).join('\n')

const nEixos = EIXOS.length
const nC = linhas.filter((r) => r.tipo === 'carga').length
const nR = linhas.filter((r) => r.tipo === 'recurso').length
const nV = linhas.filter((r) => r.tipo === 'variacao').length

fs.writeFileSync(OUT, `<!doctype html><meta charset="utf-8"><title>Eixos do pêndulo — revisão</title>
<style>
 body{font:15px/1.5 -apple-system,Segoe UI,system-ui,sans-serif;background:#faf8f4;color:#2b2721;margin:0;padding:28px 20px 80px}
 .wrap{max-width:900px;margin:0 auto}
 h1{font:600 22px/1.3 Palatino,Georgia,serif;margin:0 0 4px}
 .sub{color:#7a7266;font-size:13px;margin-bottom:20px}
 .sub b{color:#2b2721}
 table{border-collapse:collapse;width:100%}
 td{padding:3px 8px;vertical-align:top;border-bottom:1px solid #eee7dc}
 tr.eixo td{background:#f0ece2;padding-top:10px;padding-bottom:8px;border-top:2px solid #d9d0bf;font-size:15px}
 tr.eixo .oque{color:#6b6357;font-weight:400;font-style:italic}
 .ln{color:#b3aa99;text-align:right;width:48px;font:12px ui-monospace,Menlo,monospace;user-select:all}
 .tag{font:600 12px ui-monospace,Menlo,monospace;color:#8a6a2a;width:44px}
 .pol{width:22px;text-align:center}
 tr.recurso td:nth-child(3){color:#2f6b4a}
 tr.variacao td:nth-child(3){color:#2f6b4a;font-style:italic} tr.variacao .pol{color:#a99a7d}
 .mk{width:96px;text-align:right;white-space:nowrap}
 .col{color:#a3401c;font-size:11px;font-weight:600;cursor:help}
 .viu{color:#8a8275;font-size:11px;cursor:help}
 .legend{position:sticky;top:0;background:#faf8f4;padding:8px 0;border-bottom:1px solid #e3dccd;font-size:12px;color:#7a7266;margin-bottom:8px}
</style>
<div class="wrap">
<h1>Eixos do pêndulo — 🔴 carga ⟷ 🟢 antídoto</h1>
<div class="sub"><b>${nEixos}</b> eixos · <b>${nC}</b> cargas · <b>${nR}</b> recursos · <b>${nV}</b> variações · cobertura verificada por <code>check-eixos.mjs</code>.<br>
Cada linha tem número fixo — <b>fale "linha N"</b> e eu corrijo. O nome em negrito do eixo é o termo que vai pro cliente (lei da 8ª série).</div>
<div class="legend">⚠️ <b>colisão</b> = essa emoção aparece dos DOIS lados no mapa de alguém real · ● <b>no mapa</b> = já apareceu num dos 5 exames (passe o mouse pra ver quem)</div>
<table>${rows}</table>
</div>`)
console.log(`→ out/eixos.html · ${L} linhas · ${nEixos} eixos · ${nC} 🔴 + ${nR} 🟢`)
