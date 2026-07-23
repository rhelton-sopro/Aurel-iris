#!/usr/bin/env node
// RENDERIZADOR do relatório NOVO no estilo do MOCKUP aprovado.
// Reusa o <style> do mockup; desenha agulhas (3 centros) e pêndulos (mapa) a
// partir dos NÚMEROS do motor; a prosa vem do markdown gerado pelo Sonnet.
// uso: node apps/web/_motor-lab/render-novo.mjs [self|daniel|miguel]
import { readFileSync, writeFileSync } from 'node:fs'
import { parseLastro, calc, BASELINE_LIVRE, EXAM } from './motor-calc.mjs'

const name = process.argv[2] || 'self'
const MD = readFileSync(`apps/web/_motor-lab/out/novo-${name}--sonnet-5.md`, 'utf8')
const MOCK = readFileSync('apps/web/_motor-lab/relatorio-novo/relatorio-completo.html', 'utf8')
const STYLE = MOCK.slice(MOCK.indexOf('<style>') + 7, MOCK.indexOf('</style>'))

// ---------- números do motor ----------
const α = BASELINE_LIVRE
const lastro = parseLastro()
const r = calc(name, lastro)
const agu = (c) => Math.round(((r.centro[c].l + α) / (r.centro[c].t + r.centro[c].l + 2 * α)) * 100)
const AG = { mente: agu('mente'), coracao: agu('coracao'), corpo: agu('corpo') }
const nivel = (s) => (s >= 6 ? 'muito alta' : s >= 4 ? 'alta' : s >= 2.5 ? 'média' : 'baixa')
// carga: agulha à esquerda (quanto mais carga, mais à esquerda); recurso: à direita
const leftCarga = (s) => Math.max(12, Math.min(44, Math.round(46 - s * 3)))
const ANTIDOTO = { // carga → polo livre (pêndulo); fallback = '—'
  'raiva contida': 'Serenidade', 'irritação que "sobe" do visceral ao mental': 'Calma',
  'dificuldade de soltar': 'Leveza', '"tagarelice mental rotativa" — mente que não desliga': 'Calma mental',
  frustração: 'Fluidez', 'irritabilidade de fundo': 'Serenidade', 'medo estrutural de base': 'Segurança',
  'apego ao passado': 'Presença', 'baixa autoestima': 'Autovalor', ressentimento: 'Perdão',
  'desilusão/trauma localizado': 'Reencontro de sentido', 'rigidez/intolerância': 'Flexibilidade',
}
function short(e) {
  let s = e.replace(/["']/g, '').replace(/\s*\(.*?\)/g, '').trim()
  s = s.split(/\s*[—–]\s|,\s/)[0].trim() // corta cláusula após travessão/vírgula
  if (s.length > 34) s = s.slice(0, 32).replace(/\s\S*$/, '') + '…'
  return s
}

// ---------- helpers de markdown → html ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>')

// gráfico das 3 agulhas (bloco 2)
function pcard(paras) {
  const nomes = { mente: ['Mente', 'modo de pensar'], coracao: ['Coração', 'modo de sentir'], corpo: ['Corpo', 'modo de agir'] }
  const ctr = (c) => `<div class="ctr">
    <div class="ctr-head"><span class="ctr-name ${c}">${nomes[c][0]}</span><span class="ctr-fn ${c}">${nomes[c][1]}</span></div>
    <div class="dv"><span class="dv-lab a">tensão</span><div class="dv-track"><i class="dv-needle" style="left:${AG[c]}%"></i></div><span class="dv-lab b">livre</span></div>
    <p class="ctr-txt">${inl(paras[c] || '')}</p></div>`
  return `<div class="pcard">${ctr('mente')}${ctr('coracao')}${ctr('corpo')}</div>`
}

// gráfico dos pêndulos (bloco 5) a partir do mapa do motor
function pendulos() {
  const carga = r.mapaCarga.slice(0, 6).map(([e, s]) => {
    const lv = nivel(s)
    return `<div class="pend"><div class="pend-labels"><span class="pl-carga">${esc(short(e))} <span class="lv">${lv}</span></span><span class="pl-anti">${ANTIDOTO[e] || '—'}</span></div><div class="pend-track"><i class="needle" style="left:${leftCarga(s)}%"></i></div></div>`
  }).join('\n')
  const rec = r.mapaRecurso.slice(0, 5).map(([e, s], i) => {
    const lv = s >= 2 ? 'vital' : 'livre'
    return `<div class="pend"><div class="pend-labels"><span class="pl-shadow">&nbsp;</span><span class="pl-resource">${esc(short(e))} <span class="lv">${lv}</span></span></div><div class="pend-track"><i class="needle free" style="left:${88 - i * 2}%"></i></div></div>`
  }).join('\n')
  return `<div class="pgroup"><p class="pgl carga">O que pesa hoje</p>${carga}</div>
    <div class="pgroup"><p class="pgl livre">O que está leve — sua força</p>${rec}</div>`
}

// ---------- prosa: markdown de um bloco → html (com rótulos-callout do mockup) ----------
function prose(mdBlock) {
  const out = []
  let ul = null
  const flush = () => { if (ul) { out.push(`<ul class="mdul">${ul.join('')}</ul>`); ul = null } }
  for (let line of mdBlock.split('\n')) {
    const t = line.trim()
    if (!t) { flush(); continue }
    if (t.startsWith('`[') || /^\|/.test(t)) continue // needle placeholder / tabela (substituídos)
    if (/^[-*_]{3,}$/.test(t)) continue // regra horizontal do markdown (a div já separa)
    if (t.startsWith('> ')) { flush(); out.push(`<blockquote class="chave">${inl(t.slice(2))}</blockquote>`); continue }
    if (t.startsWith('- ')) { (ul = ul || []).push(`<li>${inl(t.slice(2))}</li>`); continue }
    flush()
    // callout "**Rótulo:**" no início do parágrafo → destaca como rootlab
    const m = t.match(/^\*\*(.+?):\*\*\s*(.*)$/)
    if (m) { out.push(`<p class="rootlab">${esc(m[1])}</p>`); if (m[2]) out.push(`<p class="block-serif">${inl(m[2])}</p>`); continue }
    if (/^\*\*(.+?)\*\*$/.test(t)) { out.push(`<p class="minih">${inl(t)}</p>`); continue } // header curto isolado
    out.push(`<p>${inl(t)}</p>`)
  }
  flush()
  return out.join('\n')
}

// extrai os 3 parágrafos de centro do bloco 2 (texto após cada header de centro)
function centerParas(block) {
  const p = {}
  const map = { mente: /Mente\b/i, coracao: /Cora[çc][ãa]o\b/i, corpo: /Corpo\b/i }
  const lines = block.split('\n')
  for (const c of ['mente', 'coracao', 'corpo']) {
    const i = lines.findIndex((l) => /^\*\*/.test(l.trim()) && map[c].test(l))
    if (i < 0) continue
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim()
      if (!t || t.startsWith('`[') || /^\*\*/.test(t)) { if (p[c]) break; else continue }
      p[c] = t; break
    }
  }
  return p
}

// ---------- monta os blocos ----------
const blocks = MD.split(/^# /m).filter(Boolean)
const NUMS = ['1', '2', '3', '4', '5', '6']
const sections = blocks.map((b, i) => {
  const nl = b.indexOf('\n')
  const title = b.slice(0, nl).trim()
  const body = b.slice(nl + 1)
  const eyebrow = `<p class="eyebrow"><span class="secnum">${NUMS[i] || ''}</span> &nbsp;${esc(title)}</p>`
  // bloco 2 → injeta pcard; bloco 5 → injeta pendulos
  if (/como você funciona/i.test(title)) {
    const paras = centerParas(body)
    // corta a parte dos 3 centros (do 1º "**Mente" até "**Em resumo" ou "**...tensão")
    const afterIdx = body.search(/\*\*Em resumo/i)
    const head = afterIdx > 0 ? body.slice(0, body.search(/\*\*Mente/i)) : body
    const tail = afterIdx > 0 ? body.slice(afterIdx) : ''
    return `<section class="block">${eyebrow}<h2 class="display">${esc(title)}</h2>${prose(head)}${pcard(paras)}${prose(tail)}</section>`
  }
  if (/mapa emocional/i.test(title)) {
    const intro = body.slice(0, body.search(/\|/) > 0 ? body.search(/\*\*O que pesa/i) : body.length)
    const after = body.search(/pulo do gato/i)
    const tail = after > 0 ? body.slice(body.lastIndexOf('\n', after) ) : ''
    return `<section class="block">${eyebrow}<h2 class="display">${esc(title)}</h2>${prose(intro)}${pendulos()}${prose(tail)}</section>`
  }
  return `<section class="block">${eyebrow}<h2 class="display">${esc(title)}</h2>${prose(body)}</section>`
}).join('\n<hr class="div">\n')

const NOME = { self: 'Helton', daniel: 'Daniel', miguel: 'Miguel' }[name] || name
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório · ${NOME}</title><style>${STYLE}
.mdul{margin:6px 0 14px 0;padding-left:20px} .mdul li{margin:4px 0}
.minih{font-weight:600;margin:16px 0 4px} .chave{margin:6px 0;padding:8px 14px;border-left:3px solid var(--amber,#b5701a);background:#faf6ee;font-style:italic}
.pgroup{margin:14px 0} .pgl{font-weight:600;font-size:.82rem;letter-spacing:.04em;text-transform:uppercase;margin:10px 0 6px} .pgl.carga{color:#b5701a} .pgl.livre{color:#2f7a54}
</style></head><body>
<div class="sheet"><div class="pad">
  <div class="brand">IRIS CODEX</div>
  <div class="brand-sub">Leitura emocional · ${NOME}</div>
  ${sections}
</div></div>
</body></html>`

const out = `apps/web/_motor-lab/out/novo-${name}.html`
writeFileSync(out, html)
console.log(`→ ${out} (${html.length} chars · agulhas M${AG.mente}/C${AG.coracao}/Corpo${AG.corpo})`)
