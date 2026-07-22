// Renderiza a saída de um motor (.md) num HTML bonito (bench visual).
// Uso: node _motor-lab/render.mjs _motor-lab/out/self--A--sonnet-5.md
// Gera o .html ao lado. Self-contained. Espelha o pipeline de prod (HTML->PDF).
import { readFileSync, writeFileSync } from 'node:fs'

const inFile = process.argv[2]
if (!inFile) { console.error('uso: node render.mjs <arquivo.md>'); process.exit(1) }
let raw = readFileSync(inFile, 'utf8')

// --- 1. extrai bloco de dados-graficos ---
let dados = null
raw = raw.replace(/```dados-graficos\s*([\s\S]*?)```/, (_, j) => {
  try { dados = JSON.parse(j.trim()) } catch (e) { console.error('JSON dados inválido:', e.message) }
  return ''
})

// --- 2. divide zona cliente / terapeuta ---
const lines = raw.split('\n')
const norm = l => l.replace(/^\*\*(.*)\*\*$/, '$1').trim()      // desembrulha **## Titulo**
const isZone2 = l => /ZONA 2|S[ÓO] PARA O TERAPEUTA/i.test(l)
let splitIdx = lines.findIndex(l => isZone2(norm(l)) && /^#{1,3}\s/.test(norm(l)))
const isDossie = /--Bd--/.test(inFile) || (splitIdx < 0 && dados)
let clientMd, therapistMd
if (splitIdx >= 0) { clientMd = lines.slice(0, splitIdx).join('\n'); therapistMd = lines.slice(splitIdx + 1).join('\n') }
else if (isDossie) { clientMd = ''; therapistMd = raw }
else { clientMd = raw; therapistMd = '' }

// --- 3. mini markdown -> html ---
function mdToHtml(md) {
  const out = []
  let para = [], list = null, table = null
  const inline = s => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = [] } }
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null } }
  const flushTable = () => {
    if (!table) return
    const [head, ...rows] = table
    const th = head.map(c => `<th>${inline(c)}</th>`).join('')
    const trs = rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
    out.push(`<div class="tbl-wrap"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`)
    table = null
  }
  const flushAll = () => { flushPara(); flushList(); flushTable() }

  for (let rawLine of md.split('\n')) {
    const line = norm(rawLine)
    if (!line) { flushAll(); continue }
    if (/^-{3,}$/.test(line)) { flushAll(); continue }                      // hr -> espaço
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { flushAll(); const lvl = Math.min(h[1].length + 1, 4); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue }
    if (/^\|/.test(line)) {                                                  // tabela
      flushPara(); flushList()
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue                  // separador
      ;(table ||= []).push(cells); continue
    }
    flushTable()
    const dz = line.match(/^›\s*(.*)$/)                                      // deixa do terapeuta
    if (dz) { flushPara(); flushList(); out.push(`<p class="deixa">${inline(dz[1])}</p>`); continue }
    const ol = line.match(/^\d+\.\s+(.*)$/), ul = line.match(/^[-*]\s+(.*)$/)
    if (ol || ul) {
      flushPara()
      const tag = ol ? 'ol' : 'ul'
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] } }
      list.items.push((ol || ul)[1]); continue
    }
    flushList(); para.push(line)
  }
  flushAll()
  return out.join('\n')
}

// --- 4. graficos ---
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const INT = { baixa: 0.34, 'média': 0.67, media: 0.67, alta: 1.0 }

function chartEmocoes(emocoes = []) {
  const rows = emocoes.map(e => {
    const k = (e.intensidade || '').toLowerCase()
    const w = Math.round((INT[k] ?? 0.5) * 100)
    return `<div class="emo-row">
      <div class="emo-name">${esc(e.nome)}</div>
      <div class="emo-track"><div class="emo-fill" style="width:${w}%"></div></div>
      <div class="emo-val">${esc(e.intensidade)}</div>
    </div>`
  }).join('')
  return `<div class="chart"><div class="chart-h">Carga emocional</div><div class="emo">${rows}</div>
    <div class="chart-cap">Comprimento = intensidade relativa (baixa · média · alta). Sem escala numérica.</div></div>`
}

function chartTemporal(eixo) {
  if (!eixo) return ''
  const pos = Math.max(-1, Math.min(1, Number(eixo.posicao) || 0))
  const left = ((pos + 1) / 2 * 100).toFixed(1)
  return `<div class="chart"><div class="chart-h">Orientação temporal</div>
    <div class="tempo">
      <div class="tempo-track">
        <span class="tempo-mark" style="left:${left}%"></span>
        <span class="tempo-mid"></span>
      </div>
      <div class="tempo-labels">
        <div class="tl left"><b>Passado</b><span>ruminação</span></div>
        <div class="tl mid"><b>Presente</b><span>equilíbrio</span></div>
        <div class="tl right"><b>Futuro</b><span>antecipação</span></div>
      </div>
    </div>
    <div class="chart-cap">Os dois extremos alimentam a ansiedade; o presente é o eixo do equilíbrio. ${esc(eixo.leitura || '')}</div></div>`
}

function chartTemperamento(t) {
  if (!t) return ''
  const CELLS = [
    { nome: 'Colérico', el: 'Fogo' }, { nome: 'Sanguíneo', el: 'Ar' },
    { nome: 'Melancólico', el: 'Água' }, { nome: 'Fleumático', el: 'Terra' },
  ]
  const dom = (t.dominante || '').toLowerCase(), sec = (t.secundario || '').toLowerCase()
  const grid = CELLS.map(c => {
    const n = c.nome.toLowerCase()
    const role = n === dom ? 'dom' : n === sec ? 'sec' : 'off'
    const word = role === 'dom' ? 'dominante' : role === 'sec' ? 'secundário' : ''
    const tag = word ? `<span class="tp-tag">${word}</span>` : `<span class="tp-tag ph">·</span>`
    return `<div class="tp-cell ${role}">${tag}<div class="tp-nome">${esc(c.nome)}</div><div class="tp-el">${esc(c.el)}</div></div>`
  }).join('')
  return `<div class="chart"><div class="chart-h">Temperamento</div>
    <div class="tp-grid">${grid}</div>
    ${t.nota ? `<div class="chart-cap">${esc(t.nota)}</div>` : ''}</div>`
}

const dashboard = dados ? `<section class="dash">
  ${chartTemperamento(dados.temperamento)}
  ${chartEmocoes(dados.emocoes)}
  ${chartTemporal(dados.eixo_temporal)}
</section>` : ''

// --- 5. monta pagina ---
// remove títulos de zona redundantes (os selos/divisor já rotulam)
const stripZoneHead = md => md.split('\n').filter(l => !/^#{1,3}\s*(ZONA 1|PARA LER COM SEU CLIENTE)/i.test(norm(l))).join('\n')
clientMd = stripZoneHead(clientMd)
let clientHtml = clientMd.trim() ? mdToHtml(clientMd) : ''
clientHtml = clientHtml.replace(/<p>/, '<p class="lead">')   // 1o paragrafo = destaque
const therapistHtml = therapistMd.trim() ? mdToHtml(therapistMd) : ''
const title = inFile.split(/[\\/]/).pop().replace('.md', '')

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Iris Codex — ${esc(title)}</title>
<style>${CSS()}</style></head><body>
<main class="page">
  <header class="hd">
    <div class="brand">IRIS CODEX</div>
    <div class="sub">Leitura terapêutica · ${esc(title)}</div>
  </header>
  ${clientHtml ? `<section class="zone client"><div class="ztag">Para ler com seu cliente</div>${clientHtml}</section>` : ''}
  ${(clientHtml && therapistHtml) ? `<div class="zdiv"><span>Só para o terapeuta</span></div>` : ''}
  ${therapistHtml ? `<section class="zone therapist">${!clientHtml ? '<div class="ztag t">Dossiê do terapeuta</div>' : ''}${dashboard}${therapistHtml}</section>` : dashboard}
</main></body></html>`

const outFile = inFile.replace(/\.md$/, '.html')
writeFileSync(outFile, html)
console.log('→', outFile)

function CSS() { return String.raw`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Raleway:wght@400;500;600;700&display=swap');
:root{
  --ink:#1f3a3c; --ink-soft:#5a6f6e; --muted:#8a9695;
  --bg:#f6f2e9; --card:#fffdf7; --rule:#e6ded0;
  --teal:#0a7d84; --teal-deep:#0d5c63; --amber:#b5701a; --neutral:#c3bcab;
  --serif:'Fraunces',Georgia,'Times New Roman',serif;
  --sans:'Raleway',system-ui,-apple-system,'Segoe UI',sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.62;-webkit-font-smoothing:antialiased}
.page{max-width:760px;margin:0 auto;padding:56px 40px 90px}
.hd{text-align:center;padding-bottom:28px;border-bottom:1px solid var(--rule);margin-bottom:40px}
.brand{font-family:var(--sans);letter-spacing:.42em;font-weight:600;font-size:13px;color:var(--teal-deep)}
.hd .sub{font-family:var(--serif);font-style:italic;color:var(--muted);font-size:15px;margin-top:10px}
.ztag{font-family:var(--sans);text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700;
  color:var(--amber);margin-bottom:22px;display:inline-block;padding:5px 12px;border:1px solid var(--rule);border-radius:100px;background:var(--card)}
.ztag.t{color:var(--teal-deep)}
.zone{margin-bottom:8px}
.zone.client h2{font-family:var(--serif);font-weight:500;font-size:24px;line-height:1.25;color:var(--teal-deep);
  margin:34px 0 12px;letter-spacing:-.01em}
.zone.client h2:first-of-type{margin-top:4px}
.zone.client p{font-family:var(--serif);font-size:18.5px;line-height:1.68;color:#2c3a39;margin:0 0 16px}
.zone.client ul,.zone.client ol{font-family:var(--serif);font-size:18px;padding-left:22px}
.zone.client li{margin:9px 0}
.zone.client strong{color:var(--teal-deep);font-weight:600}
.zone.client p.lead{font-size:21px;font-style:italic;color:var(--teal-deep);border-left:3px solid var(--amber);padding-left:20px}
.zdiv{display:flex;align-items:center;gap:16px;margin:52px 0 40px;color:var(--muted)}
.zdiv:before,.zdiv:after{content:"";flex:1;height:1px;background:var(--rule)}
.zdiv span{font-family:var(--sans);text-transform:uppercase;letter-spacing:.18em;font-size:11px;font-weight:700;color:var(--teal-deep)}
.zone.therapist h2{font-family:var(--sans);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.08em;
  color:var(--teal-deep);margin:34px 0 10px;padding-bottom:7px;border-bottom:1px solid var(--rule)}
.zone.therapist h3{font-family:var(--sans);font-weight:600;font-size:15px;color:var(--ink);margin:20px 0 6px}
.zone.therapist p{font-size:15px;color:#33403f;margin:0 0 12px}
.zone.therapist ul,.zone.therapist ol{font-size:15px;padding-left:20px}
.zone.therapist li{margin:7px 0}
.zone.therapist strong{color:var(--teal-deep);font-weight:600}
.deixa{position:relative;background:#f0ece0;border-left:3px solid var(--teal);border-radius:0 8px 8px 0;
  padding:11px 15px 11px 34px;font-size:14.5px;color:var(--ink-soft)!important;margin:8px 0!important}
.deixa:before{content:"›";position:absolute;left:14px;top:9px;color:var(--teal);font-weight:700;font-size:18px}
/* tabela */
.tbl-wrap{overflow-x:auto;margin:14px 0 22px;border:1px solid var(--rule);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:13px;background:var(--card)}
th{background:#eef0e9;color:var(--teal-deep);font-weight:700;text-align:left;padding:11px 13px;
  font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--rule)}
td{padding:11px 13px;border-bottom:1px solid var(--rule);vertical-align:top;color:#3a4746}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#faf8f1}
td:first-child{color:var(--teal-deep);font-weight:600}
/* dashboard */
.dash{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:8px 0 30px}
.chart{background:var(--card);border:1px solid var(--rule);border-radius:14px;padding:18px 18px 16px}
.chart:first-child{grid-column:1/2}
.dash>.chart:nth-child(3){grid-column:1/-1}
.chart-h{font-family:var(--sans);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:14px}
.chart-cap{font-family:var(--serif);font-style:italic;font-size:12.5px;color:var(--muted);margin-top:13px;line-height:1.5}
/* emocoes */
.emo-row{display:grid;grid-template-columns:130px 1fr 54px;align-items:center;gap:11px;margin:9px 0}
.emo-name{font-size:12.5px;color:var(--ink);text-align:right;font-weight:500;line-height:1.25}
.emo-track{height:12px;background:#ece7db;border-radius:100px;overflow:hidden}
.emo-fill{height:100%;background:linear-gradient(90deg,var(--teal-deep),var(--teal));border-radius:100px}
.emo-val{font-size:11px;color:var(--teal-deep);font-weight:600;text-transform:lowercase}
/* temporal */
.tempo-track{position:relative;height:12px;border-radius:100px;margin:16px 4px 0;
  background:linear-gradient(90deg,var(--amber) 0%,#d8cdb8 42%,var(--neutral) 50%,#a9cdc9 58%,var(--teal) 100%)}
.tempo-mid{position:absolute;left:50%;top:-5px;width:1px;height:22px;background:var(--muted);opacity:.5}
.tempo-mark{position:absolute;top:50%;width:17px;height:17px;border-radius:50%;background:#fff;
  border:3px solid var(--teal-deep);transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,.18)}
.tempo-labels{display:flex;justify-content:space-between;margin:12px 2px 0}
.tl{display:flex;flex-direction:column;font-size:12px}
.tl.mid{align-items:center}.tl.right{align-items:flex-end}
.tl b{color:var(--ink);font-weight:600}.tl span{color:var(--muted);font-size:10.5px}
/* temperamento */
.tp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tp-cell{display:flex;flex-direction:column;gap:4px;border-radius:10px;padding:12px 13px;background:#f0ece0;border:1px solid var(--rule)}
.tp-cell .tp-nome{font-family:var(--serif);font-size:17px;font-weight:600;color:var(--muted);line-height:1.1}
.tp-cell .tp-el{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.tp-cell.dom{background:var(--teal-deep);border-color:var(--teal-deep)}
.tp-cell.dom .tp-nome,.tp-cell.dom .tp-el{color:#fff}
.tp-cell.sec{background:#f6e4cd;border-color:#e8cfa6}
.tp-cell.sec .tp-nome{color:var(--amber)}.tp-cell.sec .tp-el{color:#a07429}
.tp-tag{align-self:flex-start;font-family:var(--sans);font-size:8px;font-weight:700;
  text-transform:uppercase;letter-spacing:.09em;padding:2px 7px;border-radius:100px;background:rgba(255,255,255,.22);color:#fff}
.tp-cell.dom .tp-tag{background:rgba(255,255,255,.2);color:#fff}
.tp-cell.sec .tp-tag{background:var(--amber);color:#fff}
.tp-tag.ph{visibility:hidden}
@media(max-width:640px){.page{padding:36px 20px 70px}.dash{grid-template-columns:1fr}.chart:first-child,.dash>.chart:nth-child(3){grid-column:auto}.emo-row{grid-template-columns:104px 1fr 46px}}
`}
