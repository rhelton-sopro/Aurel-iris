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

// ---------- CENTRO por ZONA topográfica (decisão founder — bloco 2 é topográfico) ----------
// Fonte: coluna "zona iridológica" do glossário de produção. Superior=Mente ·
// temporal/medial=Coração · inferior/visceral/estrutura=Corpo. Separado da
// componente EMOCIONAL da tabela-lastro (que descreve como a emoção SE SENTE).
const TOPO_CENTRO = {
  // Mente (superior 11-1h + cerebral/nervoso)
  cerebrum_motor: ['mente'], cerebellum_sensory: ['mente'], pineal_hipotalamica: ['mente'],
  sistema_nervoso_autonomico: ['mente'], eixo_pituitario_adrenal: ['mente'],
  // Coração (temporal/medial 2-4h · 8-10h + expressão/peito)
  coracao: ['coracao'], pulmoes: ['coracao'], tireoide: ['coracao'], boca_garganta: ['coracao'],
  coluna_cervical: ['coracao'], coluna_toracica: ['coracao'], sistema_linfatico: ['coracao'],
  sistema_circulatorio: ['coracao'],
  // Corpo (inferior 4-8h + víscera/estrutura/periferia física)
  figado_vesicula: ['corpo'], rim: ['corpo'], adrenal: ['corpo'], estomago: ['corpo'],
  intestino_delgado: ['corpo'], intestino_grosso: ['corpo'], pancreas: ['corpo'],
  sistema_reprodutor: ['corpo'], sistema_urinario: ['corpo'], sistema_musculoesqueletico: ['corpo'],
  pele_tegumentar: ['corpo'], sacro_coccyx: ['corpo'], coluna_lombar: ['corpo'], coroa_simpatica: ['corpo'],
  // splits (víscera→cérebro / defesa)
  radii_solaris: ['mente', 'corpo'], sistema_imune: ['coracao', 'corpo'],
}

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
    // (B) emoções do lastro: 🔴 (carga) e 🟢 (recurso), agregando todos os blocos de elemento
    // Pega só as ~4 PRIMEIRAS de cada bloco (o NÚCLEO) — corta a cauda de
    // paleta genérica que, somada entre campos, inflava Forer (ex.: "culpa"
    // subia acima da "raiva contida"). Núcleo = específico = discriminante.
    const NUCLEO_CAP = 4
    const emos = (emoji) => {
      const out = []
      const re = new RegExp(`${emoji} emoções:\\*\\*\\s*(.*)`, 'g')
      let m
      while ((m = re.exec(b))) {
        const phrases = m[1].split('·').map((p) => p.replace(/\([^)]*\)/g, '').replace(/[*_`]/g, '').trim()).filter((p) => p && p.length > 2)
        out.push(...phrases.slice(0, NUCLEO_CAP))
      }
      return out
    }
    map[name] = { elem, centros: centros.length ? centros : ['corpo'], carga: emos('🔴'), recurso: emos('🟢') }
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
  const emoCarga = {}, emoRecurso = {} // (B) mapa emocional — acumula score por emoção
  const achadoList = [] // TODOS os achados evidenciados (decisão founder: nada de colapsar em 1)
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
    const cs = TOPO_CENTRO[key] || t.centros // centro por ZONA topográfica (decisão founder)
    const cw = w / cs.length
    for (const c of cs) centro[c].t += cw
    for (const e of t.carga) emoCarga[e] = (emoCarga[e] || 0) + w // (B) leque de carga
    // cada achado evidenciado com seu elemento dominante + emoção-núcleo
    const elemDom = ['fogo', 'agua', 'terra', 'ar'].sort((x, y) => (t.elem[y] || 0) - (t.elem[x] || 0))[0]
    achadoList.push({ campo: a.campo, int: a.intensidade, elem: elemDom, emo: t.carga[0] || '?', w })
  }
  // PRESERVADOS → recurso (elemento) + livre (centro)
  for (const p of preservados) {
    const { key } = classify(p.campo)
    const t = lastro[key]
    const w = W_PRES[p.polaridade_funcional] || W_PRES.neutro
    if (t) {
      for (const e of ['fogo', 'agua', 'terra', 'ar']) elem.recurso[e] += w * (t.elem[e] || 0)
      const cs = TOPO_CENTRO[key] || t.centros
      const cw = w / cs.length
      for (const c of cs) centro[c].l += cw
      for (const e of t.recurso) emoRecurso[e] = (emoRecurso[e] || 0) + w // (B) leque de recurso
    }
  }
  // ZONA QUIETA: centro sem tensão nenhuma = preservado (livre)
  for (const c of ['mente', 'coracao', 'corpo']) if (centro[c].t === 0) centro[c].l += 1.0

  const pres = preservados.map((p) => ({ campo: p.campo, pol: p.polaridade_funcional }))
  // (E) seleção top-N do leque
  const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
  const mapaCarga = top(emoCarga, 8)
  const mapaRecurso = top(emoRecurso, 5)
  achadoList.sort((a, b) => b.w - a.w)
  return { name, elem, centro, pres, mapaCarga, mapaRecurso, achadoList, skipped, adjuvantes, nAch: achados.length, nPres: preservados.length }
}

function fmt(r) {
  const L = []
  L.push(`\n===================== ${r.name.toUpperCase()} =====================`)
  L.push(`achados=${r.nAch} preservados=${r.nPres}`)
  if (r.adjuvantes.length) L.push(`adjuvantes (sem peso): ${r.adjuvantes.join(', ')}`)
  if (r.skipped.length) L.push(`pulados: ${r.skipped.join(', ')}`)
  const emoji = { fogo: '🔥', agua: '💧', terra: '🌍', ar: '💨' }
  // ELEMENTO = SÓ CARGA (achados). Preservados NÃO entram (decisão founder) —
  // eles vão pro trilho separado da FORÇA, abaixo.
  const byCarga = ['fogo', 'agua', 'terra', 'ar'].sort((a, b) => r.elem.carga[b] - r.elem.carga[a])
  const maxC = Math.max(...['fogo', 'agua', 'terra', 'ar'].map((e) => r.elem.carga[e])) || 1
  L.push('\nPERFIL DE ELEMENTOS = só CARGA (o que PESA · define o PRINCIPAL):')
  byCarga.forEach((e, i) => {
    const c = r.elem.carga[e]
    const bar = '█'.repeat(Math.round((c / maxC) * 20)).padEnd(20)
    L.push(`  ${i === 0 ? '★' : ' '} ${emoji[e]} ${e.padEnd(6)} ${bar} ${c.toFixed(1)}${i === 0 ? '  ← PRINCIPAL' : ''}`)
  })
  L.push('\nTODOS OS ACHADOS EVIDENCIADOS (nada colapsa — cada um vira fio da narrativa):')
  r.achadoList.forEach((a, i) => {
    const tag = i === 0 ? 'PRINCIPAL' : i === 1 ? 'secundário' : i === 2 ? 'terciário' : ''
    L.push(`  ${i === 0 ? '★' : '·'} I${a.int} ${emoji[a.elem]} ${a.campo.padEnd(28)} → "${a.emo}"  ${tag}`)
  })
  const elems3 = [...new Set(r.achadoList.slice(0, 4).map((a) => a.elem))]
  L.push(`  → narrativa dos elementos: ${elems3.map((e) => emoji[e] + e).join(' + ')}`)

  L.push('\nFORÇA / RECURSOS (trilho separado — dos preservados, NÃO entra no elemento):')
  for (const p of r.pres) L.push(`    ✓ ${p.campo}${p.pol === 'vital_ativo' ? ' (vital)' : ''}`)

  // (B) mapa emocional — o leque que o prompt seleciona
  const nivel = (s) => (s >= 8 ? 'muito alta' : s >= 5 ? 'alta' : s >= 3 ? 'média' : 'baixa')
  const maxE = (r.mapaCarga[0] || [0, 1])[1] || 1
  L.push('\n(B) MAPA EMOCIONAL — leque de CARGA (score=Σ intensidade^γ · o prompt seleciona):')
  for (const [emo, s] of r.mapaCarga) {
    const bar = '▓'.repeat(Math.round((s / maxE) * 16)).padEnd(16)
    L.push(`    ${bar} ${s.toFixed(1).padStart(4)} ${nivel(s).padEnd(9)} ${emo}`)
  }
  L.push('   leque de RECURSO (força — dos preservados):')
  for (const [emo, s] of r.mapaRecurso) L.push(`    · ${s.toFixed(1).padStart(4)}  ${emo}`)
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
