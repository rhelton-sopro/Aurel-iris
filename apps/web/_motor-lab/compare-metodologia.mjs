#!/usr/bin/env node
// COMPARA duas metodologias de cálculo do mapa emocional — SEM ELEMENTOS (decisão founder).
// A = peso puro do achado (sem reforço) · B = reforço por FAMÍLIA DE EMOÇÃO (psicologia, não elemento).
// uso: node apps/web/_motor-lab/compare-metodologia.mjs [self|daniel|miguel]
import fs from 'node:fs'
import { parseLastro, classify, EXAM } from './motor-calc.mjs'

const GAMMA = 1.1, DECAY = 0.6
const name = process.argv[2] || 'self'
const lastro = parseLastro()
const d = JSON.parse(fs.readFileSync(EXAM(name), 'utf8'))
const achados = d.achados_de_atencao || []

// ---------- FAMÍLIAS DE EMOÇÃO (psicologia — NÃO elemento) por palavra-chave ----------
const FAM = [
  [/raiva|irrita|frustra|\bira\b|rancor|hostil|cr[ií]tic|impaci|vingan|ódio|dureza|orgulho/i, 'Raiva'],
  [/ressentimento|amargura|m[áa]goa|inveja|possessiv/i, 'Mágoa/ressentimento'],
  [/medo|inseguran|pavor|terror|f[óo]bia|p[âa]nico|desampar|falta de (reserva|apoio|chão|base)/i, 'Medo/insegurança'],
  [/soltar|apego|reten|controle|largar|passado|obstina|rigidez/i, 'Apego/controle'],
  [/tristeza|luto|pesar|des[âa]nimo|melancol|solid|rejei|desamor|abandono|perda|choro/i, 'Tristeza/luto'],
  [/culpa|vergonha|auto-?rejei|autoestima|autovalor|merecer|humilha/i, 'Culpa/vergonha'],
  [/ansiedade|preocupa|rumina|tagarel|nervos|alerta|urg[êe]ncia|tens[ãa]o (nerv|mus)|vigil|dispers|não desliga|antecipa|inquiet|dever|tenho de/i, 'Ansiedade/mente'],
]
const familiaDe = (e) => (FAM.find(([re]) => re.test(e)) || [null, '(outras)'])[1]

// ---------- acumula ----------
const emoA = {}, emoFam = {} // A: score por emoção (peso puro, com decaimento na paleta)
const famB = {} // B: score por família — só o NÚCLEO de cada achado (cap anti-inflação)
for (const a of achados) {
  const { key, klass } = classify(a.campo)
  if (klass !== 'emocional') continue
  const t = lastro[key]; if (!t) continue
  const w = Math.pow(a.intensidade || 0, GAMMA)
  // A: todas as emoções da tabela, decaindo por ordem
  t.carga.forEach((e, i) => { const val = w * Math.pow(DECAY, i); emoA[e] = (emoA[e] || 0) + val; emoFam[e] = familiaDe(e) })
  // B: só o NÚCLEO do achado (peso cheio) entra na família — a família soma núcleos entre achados
  const nucleo = t.carga[0]
  if (nucleo) { const f = familiaDe(nucleo); famB[f] = (famB[f] || 0) + w }
}
// representante de cada família = emoção mais forte dela em A
const repDe = {}
for (const [e, s] of Object.entries(emoA)) { const f = emoFam[e]; if (!repDe[f] || s > emoA[repDe[f]]) repDe[f] = e }

// ---------- escalas (mesma régua contínua −50/+50 dos dois lados) ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const bip = (s) => clamp(Math.round(-7.5 * s), -48, -6)
const nivel = (s) => (s >= 6 ? 'muito alta' : s >= 4 ? 'alta' : s >= 2.5 ? 'média' : 'baixa')
const fmt = (e, s) => `${e.replace(/["']/g, '').slice(0, 30).padEnd(31)} ${s.toFixed(1).padStart(4)}  ${bip(s).toString().padStart(3)}  ${nivel(s)}`

// C híbrida: emoções individuais (como A), mas o LÍDER de uma família que REPETE
// carrega a carga reforçada da família (raiva contida sobe pro extremo; o resto fica granular).
const emoC = { ...emoA }
for (const [f, s] of Object.entries(famB)) { const leader = repDe[f]; if (leader) emoC[leader] = Math.max(emoC[leader] || 0, s) }

const topA = Object.entries(emoA).sort((a, b) => b[1] - a[1]).slice(0, 8)
const topB = Object.entries(famB).sort((a, b) => b[1] - a[1]).map(([f, s]) => [`${f} → ${repDe[f]}`, s]).slice(0, 8)
const topC = Object.entries(emoC).sort((a, b) => b[1] - a[1]).slice(0, 8)

console.log(`\n===== ${name.toUpperCase()} — SEM ELEMENTOS · A × B × C =====`)
console.log(`achados: ${achados.filter((a) => classify(a.campo).klass === 'emocional').map((a) => `${a.campo}(I${a.intensidade})`).join(' · ')}\n`)
console.log('OPÇÃO A — peso puro do achado (granular, sem reforço):')
console.log('  emoção                          score  bip  nível')
for (const [e, s] of topA) console.log('  ' + fmt(e, s))
console.log('\nOPÇÃO B — família de emoção (agrega em temas):')
console.log('  família → representante         score  bip  nível')
for (const [e, s] of topB) console.log('  ' + fmt(e, s))
console.log('\nOPÇÃO C — HÍBRIDA (granular como A + líder da família que repete no extremo):')
console.log('  emoção                          score  bip  nível')
for (const [e, s] of topC) console.log('  ' + fmt(e, s))
console.log('')
