#!/usr/bin/env node
// MOTOR (protótipo determinístico) — calcula 3 centros + perfil de elementos
// a partir do output do Stage 1, cruzando com a tabela-lastro canônica.
// uso: node _motor-lab/motor-calc.mjs            (roda os 3 exames)
//      node _motor-lab/motor-calc.mjs self       (um só)
import fs from 'node:fs'
import path from 'node:path'

const LASTRO = path.resolve('apps/web/_motor-lab/lastro/tabela-lastro-CANONICA.md')
const EXAM = (n) => path.resolve(`apps/web/_exame-${n}.json`)

// ---------- parâmetros (calibráveis) ----------
const GAMMA = 1.1
const K = 6 // saturação squash S/(S+k)
const W_PRES = { vital_ativo: 2.0, neutro: 1.5 }
const squash = (s) => s / (s + K)

// ---------- classificação dos campos (de classificacao-campos.md) ----------
const ALIAS = {
  manchas_psoricas: 'sistema_imune',
  rosario_linfatico: 'sistema_linfatico',
  anel_nervoso: 'sistema_nervoso_autonomico',
  anel_sodico: 'sistema_circulatorio',
}
const MARCADOR = new Set(['anel_interno', 'collarette', 'pigmento_amber', 'lacuna_estrutural', 'cripta'])
const MODULADOR = new Set(['cor_predominante', 'trama_fibras', 'pupila', 'bordas_pupilares', 'padrao_pupilar'])
// VISTO/extra-iridológico → sem peso, ADJUVANTE do órgão-alvo
const VISTO = { vascularizacao_escleral: 'figado_vesicula', arco_senil_periferico: 'sistema_circulatorio' }

// ---------- parse da tabela-lastro: campo → {elem:{fogo,agua,terra,ar}, centros:[...]} ----------
const ELEM_KEY = { '🔥': 'fogo', '💧': 'agua', '🌍': 'terra', '💨': 'ar' }
function parseLastro() {
  const md = fs.readFileSync(LASTRO, 'utf8')
  const blocks = md.split(/^### /m).slice(1)
  const map = {}
  for (const b of blocks) {
    const name = (b.match(/^`([^`]+)`/) || [])[1]
    if (!name) continue
    const elemLine = (b.match(/- \*\*Elemento\(s\):\*\*(.*)/) || [])[1] || ''
    const elem = { fogo: 0, agua: 0, terra: 0, ar: 0 }
    const re = /(🔥|💧|🌍|💨)[^\d%·]*?(\d+)%/g
    let m
    while ((m = re.exec(elemLine))) elem[ELEM_KEY[m[1]]] = +m[2] / 100
    const centroLine = (b.match(/- \*\*Centro:\*\*(.*)/) || [])[1] || ''
    const centros = []
    if (/Mente/i.test(centroLine)) centros.push('mente')
    if (/Cora[çc][ãa]o/i.test(centroLine)) centros.push('coracao')
    if (/Instinto|Corpo/i.test(centroLine)) centros.push('corpo')
    map[name] = { elem, centros: centros.length ? centros : ['corpo'] }
  }
  return map
}

// ---------- resolve um campo do exame → chave da tabela + classe ----------
function classify(campo) {
  if (ALIAS[campo]) return { key: ALIAS[campo], klass: 'emocional' }
  if (VISTO[campo]) return { key: VISTO[campo], klass: 'visto', alvo: VISTO[campo] }
  if (MARCADOR.has(campo)) return { key: campo, klass: 'marcador' }
  if (MODULADOR.has(campo)) return { key: campo, klass: 'modulador' }
  return { key: campo, klass: 'emocional' }
}

function calc(name, lastro) {
  const d = JSON.parse(fs.readFileSync(EXAM(name), 'utf8'))
  const achados = d.achados_de_atencao || []
  const preservados = d.sistemas_preservados || []

  const elem = { carga: { fogo: 0, agua: 0, terra: 0, ar: 0 }, recurso: { fogo: 0, agua: 0, terra: 0, ar: 0 } }
  const centro = { mente: { t: 0, l: 0 }, coracao: { t: 0, l: 0 }, corpo: { t: 0, l: 0 } }
  const skipped = [], adjuvantes = []

  // ACHADOS → carga (elemento) + tensão (centro)
  for (const a of achados) {
    const { key, klass, alvo } = classify(a.campo)
    if (klass === 'marcador' || klass === 'modulador') { skipped.push(`${a.campo}(${klass})`); continue }
    if (klass === 'visto') { adjuvantes.push(`${a.campo}→${alvo}`); continue } // sem peso
    const t = lastro[key]
    if (!t) { skipped.push(`${a.campo}(SEM-LASTRO)`); continue }
    const w = Math.pow(a.intensidade || 0, GAMMA)
    for (const e of ['fogo', 'agua', 'terra', 'ar']) elem.carga[e] += w * (t.elem[e] || 0)
    const cw = w / t.centros.length
    for (const c of t.centros) centro[c].t += cw
  }
  // PRESERVADOS → recurso (elemento) + livre (centro)
  for (const p of preservados) {
    const { key } = classify(p.campo)
    const t = lastro[key]
    const w = W_PRES[p.polaridade_funcional] || W_PRES.neutro
    if (t) {
      for (const e of ['fogo', 'agua', 'terra', 'ar']) elem.recurso[e] += w * (t.elem[e] || 0)
      const cw = w / t.centros.length
      for (const c of t.centros) centro[c].l += cw
    }
  }
  // ZONA QUIETA: centro sem tensão nenhuma = preservado (livre)
  for (const c of ['mente', 'coracao', 'corpo']) if (centro[c].t === 0) centro[c].l += 1.0

  return { name, elem, centro, skipped, adjuvantes, nAch: achados.length, nPres: preservados.length }
}

function fmt(r) {
  const L = []
  L.push(`\n===================== ${r.name.toUpperCase()} =====================`)
  L.push(`achados=${r.nAch} preservados=${r.nPres}`)
  if (r.adjuvantes.length) L.push(`adjuvantes (sem peso): ${r.adjuvantes.join(', ')}`)
  if (r.skipped.length) L.push(`pulados: ${r.skipped.join(', ')}`)
  L.push('\nPERFIL DE ELEMENTOS (magnitude 0-100 · balanço 0-100% livre):')
  for (const e of ['fogo', 'agua', 'terra', 'ar']) {
    const c = r.elem.carga[e], rc = r.elem.recurso[e], tot = c + rc
    const mag = Math.round(squash(tot) * 100)
    const bal = tot ? Math.round((rc / tot) * 100) : 0
    const bar = '█'.repeat(Math.round(mag / 5)).padEnd(20)
    const emoji = { fogo: '🔥', agua: '💧', terra: '🌍', ar: '💨' }[e]
    L.push(`  ${emoji} ${e.padEnd(6)} ${bar} mag ${String(mag).padStart(3)}  balanço ${String(bal).padStart(3)}% livre  (carga ${c.toFixed(1)} · recurso ${rc.toFixed(1)})`)
  }
  L.push('\n3 CENTROS (agulha 0=tensão ⟷ 100=livre):')
  for (const c of ['mente', 'coracao', 'corpo']) {
    const { t, l } = r.centro[c]
    const agulha = t + l ? Math.round((l / (t + l)) * 100) : 50
    const pos = Math.round(agulha / 5)
    const track = ('·'.repeat(pos) + '◉' + '·'.repeat(20 - pos)).slice(0, 21)
    L.push(`  ${c.padEnd(8)} tensão${track}livre   agulha=${agulha}  (t ${t.toFixed(1)} / l ${l.toFixed(1)})`)
  }
  return L.join('\n')
}

const lastro = parseLastro()
const which = process.argv[2] ? [process.argv[2]] : ['self', 'daniel', 'miguel']
console.log(`MOTOR protótipo · γ=${GAMMA} k=${K} · pesos pres vital=${W_PRES.vital_ativo}/neutro=${W_PRES.neutro}`)
console.log(`campos no lastro: ${Object.keys(lastro).length}`)
for (const n of which) console.log(fmt(calc(n, lastro)))
