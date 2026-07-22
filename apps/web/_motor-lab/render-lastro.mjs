// Renderiza tabela-lastro-CANONICA.md -> HTML escaneável (cores dos 4 elementos, 2 colunas).
// uso: node _motor-lab/render-lastro.mjs
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('apps/web/_motor-lab/lastro/tabela-lastro-CANONICA.md');
const OUT = path.resolve('apps/web/_motor-lab/relatorio-novo/tabela-lastro-CANONICA.html');

const ELEM = {
  '🔥Fogo': { key: 'fogo', label: 'Fogo', color: '#d0a017' },
  '💧Água': { key: 'agua', label: 'Água', color: '#159d90' },
  '🌍Terra': { key: 'terra', label: 'Terra', color: '#c0552a' },
  '💨Ar':   { key: 'ar',   label: 'Ar',   color: '#1e6fa8' },
};

const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// inline markdown -> html (aplicar DEPOIS do escape)
function inline(s){
  let h = esc(s);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return h;
}

const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split(/\r?\n/);

// --- header (título + intro + legenda + guardrails) até o 1º "# 1." ---
let introEnd = lines.findIndex(l => /^# \d+\./.test(l));
if (introEnd < 0) introEnd = lines.length;
const title = (lines[0]||'').replace(/^#\s*/, '');
const introBlock = lines.slice(1, introEnd);

// --- parse campos ---
const groups = [];
let curGroup = null, curCampo = null;

function pushCampo(){ if (curCampo && curGroup) curGroup.campos.push(curCampo); curCampo = null; }
function pushGroup(){ pushCampo(); if (curGroup) groups.push(curGroup); }

for (let i = introEnd; i < lines.length; i++){
  const l = lines[i];
  const gm = l.match(/^#\s+(\d+)\.\s+(.*)$/);
  if (gm){ pushGroup(); curGroup = { num: gm[1], title: gm[2].trim(), campos: [] }; continue; }
  const cm = l.match(/^###\s+`([^`]+)`\s*—?\s*(.*)$/);
  if (cm){ pushCampo(); curCampo = { name: cm[1], topo: cm[2].trim(), bullets: [] }; continue; }
  // sub-seção fora de grupo (ex.: "## Camada estrutural", "## Resolução...") -> ignora no grid
  if (/^##\s/.test(l) && curGroup){ pushGroup(); curGroup = null; continue; }
  if (curCampo){
    // captura "- **Label:** rest" ou "- **🔴 DESEQUILÍBRIO**" (sem dois-pontos); indentação decide topo vs sub
    const m = l.match(/^(\s*)-\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (m){
      const indent = m[1].length;
      const label = m[2].replace(/:\s*$/,'').trim();
      const text = m[3].replace(/^:\s*/,'').trim();
      if (indent >= 2 && curCampo.bullets.length){
        curCampo.bullets[curCampo.bullets.length-1].sub.push({ label, text });
      } else {
        curCampo.bullets.push({ label, text, sub: [] });
      }
    }
  }
}
pushGroup();

// helpers p/ extrair de um campo
function getBullet(c, re){ return c.bullets.find(b => re.test(b.label)); }
function getSub(bullet, re){ return bullet && bullet.sub.find(s => re.test(s.label)); }

function elementBars(text){
  const found = [];
  const re = /(🔥Fogo|💧Água|🌍Terra|💨Ar)\s*(\d+)%/g;
  let m; while ((m = re.exec(text))) found.push({ e: ELEM[m[1]], pct: +m[2] });
  if (!found.length){
    // localizador / constitucional / modulador
    const kind = /localizador/i.test(text) ? 'localizador'
      : /constitucional/i.test(text) ? 'constitucional'
      : /modulador/i.test(text) ? 'modulador' : 'especial';
    return `<div class="elem-special">${kind}</div>`;
  }
  const bar = found.map(f =>
    `<span class="seg" style="width:${f.pct}%;background:${f.e.color}" title="${f.e.label} ${f.pct}%"></span>`
  ).join('');
  const chips = found.map(f =>
    `<span class="chip" style="--c:${f.e.color}">${f.e.label} <b>${f.pct}%</b></span>`
  ).join('');
  return `<div class="elem-bar">${bar}</div><div class="elem-chips">${chips}</div>`;
}

// mapa emoji do elemento -> cor
const EMOJI_COLOR = { '🔥':'#d0a017', '💧':'#159d90', '🌍':'#c0552a', '💨':'#1e6fa8' };
const isElemLabel = (lab) => /^(🔥|💧|🌍|💨)/.test(lab);

// um bloco de ELEMENTO com os 2 polos (🟢 equilibrado / 🔴 desequilibrado)
function elementBlock(b){
  const emoji = [...b.label][0];
  const color = EMOJI_COLOR[emoji] || '#888';
  const gEmo = getSub(b, /🟢.*emo/i), gCre = getSub(b, /🟢.*cren/i);
  const rEmo = getSub(b, /🔴.*emo/i), rCre = getSub(b, /🔴.*cren/i);
  const pole = (cls, head, emo, cre) => `
    <div class="pole ${cls}">
      <span class="pole-h">${head}</span>
      ${emo ? `<div class="pline"><span class="tag emo">emoções</span><span class="val">${inline(emo.text)}</span></div>` : ''}
      ${cre ? `<div class="pline"><span class="tag cre">crenças</span><span class="val">${inline(cre.text)}</span></div>` : ''}
    </div>`;
  return `<div class="ebl" style="--c:${color}">
    <div class="ebl-h"><span class="ebl-dot"></span>${esc(b.label)}</div>
    <div class="poles">
      ${pole('eq','🟢 equilibrado', gEmo, gCre)}
      ${pole('dq','🔴 desequilibrado', rEmo, rCre)}
    </div>
  </div>`;
}

function campoCard(c){
  const el = getBullet(c, /^Elemento/);
  const centro = getBullet(c, /^Centro/);
  const elemBlocks = c.bullets.filter(b => isElemLabel(b.label));
  const nota = c.bullets.find(b => /^Nota/i.test(b.label));
  // bullets soltos (moduladores/localizadores: Uso, Leitura, ou subs sem elemento)
  const loose = c.bullets.filter(b => !/^Elemento|^Centro|^Nota/i.test(b.label) && !isElemLabel(b.label));

  let looseHtml = '';
  if (loose.length){
    looseHtml = loose.map(b=>`<div class="nota"><b>${esc(b.label)}:</b> ${inline(b.text)}${b.sub.map(s=>`<br><b>${esc(s.label)}:</b> ${inline(s.text)}`).join('')}</div>`).join('');
  }

  return `<div class="campo" id="c-${c.name}">
    <div class="c-head">
      <code class="c-name">${esc(c.name)}</code>
      <span class="c-topo">${inline(c.topo)}</span>
    </div>
    ${el ? `<div class="c-elem">${elementBars(el.text)}<details class="deriv"><summary>derivação</summary><div>${inline(el.text)}</div></details></div>` : ''}
    ${centro ? `<div class="c-centro"><span>centro:</span> ${inline(centro.text)}</div>` : ''}
    ${elemBlocks.map(elementBlock).join('')}
    ${looseHtml}
    ${nota ? `<div class="nota"><b>Nota:</b> ${inline(nota.text)}</div>` : ''}
  </div>`;
}

const nav = groups.map(g =>
  `<a href="#g-${g.num}">${g.num}. ${esc(g.title)}</a>`
).join('');

const body = groups.map(g => `
  <section class="group" id="g-${g.num}">
    <h2><span class="gn">${g.num}</span> ${esc(g.title)}</h2>
    <div class="grid">${g.campos.map(campoCard).join('')}</div>
  </section>
`).join('');

// converte linhas markdown de tabela (|..|) em <table>
function mdTable(rows){
  const cells = rows.filter(r => !/^\|[\s:|-]+\|?\s*$/.test(r)).map(r =>
    r.replace(/^\||\|$/g,'').split('|').map(c => c.trim())
  );
  if (!cells.length) return '';
  const [head, ...body] = cells;
  const th = head.map(c => `<th>${inline(c)}</th>`).join('');
  const tr = body.map(r => `<tr>${r.map((c,i)=>`<td class="${i===0?'k':''}">${inline(c)}</td>`).join('')}</tr>`).join('');
  return `<table class="mdt"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}
// renderiza um bloco de intro (parágrafos, listas, tabelas)
function renderMd(arr){
  const out = []; let tbl = [];
  const flush = () => { if (tbl.length){ out.push(mdTable(tbl)); tbl=[]; } };
  for (const l of arr){
    if (/^\|/.test(l)){ tbl.push(l); continue; }
    flush();
    if (/^\s*$/.test(l) || /^-{3,}/.test(l)) continue;
    if (/^###?\s/.test(l)) out.push(`<h3>${inline(l.replace(/^#+\s*/,''))}</h3>`);
    else if (/^\d+\.\s/.test(l)) out.push(`<li>${inline(l.replace(/^\d+\.\s*/,''))}</li>`);
    else out.push(`<p>${inline(l)}</p>`);
  }
  flush();
  return out.join('\n');
}
// separa a ASSINATURA (chave-mestra) do resto do intro
let sigStart = introBlock.findIndex(l => /ASSINATURA DOS 4/i.test(l));
let sigEnd = introBlock.findIndex((l,i) => i>sigStart && /^##\s/.test(l));
if (sigEnd < 0) sigEnd = introBlock.length;
const sigBlock = sigStart>=0 ? introBlock.slice(sigStart+1, sigEnd) : [];
const restBlock = sigStart>=0 ? [...introBlock.slice(0,sigStart), ...introBlock.slice(sigEnd)] : introBlock;
const sigHtml = renderMd(sigBlock);
const introHtml = renderMd(restBlock);

const html = `<meta charset="utf-8">
<title>Tabela-lastro CANÔNICA — 38 campos</title>
<style>
:root{
  --paper:#fff;--ink:#1f3a3c;--soft:#5a6f6e;--faint:#8a9695;--line:#e6ded0;--line2:#d6cbb6;
  --teal:#0a7d84;--teal-deep:#0d5c63;--amber:#b5701a;
  --deseq:#b5432e;--equil:#2f7a54;
  --serif:"Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
}
*{box-sizing:border-box;}
body{margin:0;background:#ece5d6;color:var(--ink);font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.5;}
.wrap{max-width:1180px;margin:0 auto;padding:24px 18px 80px;}
h1{font-family:var(--serif);font-size:26px;line-height:1.15;margin:0 0 6px;color:var(--teal-deep);}
.sub{color:var(--soft);font-size:13.5px;max-width:80ch;margin:0 0 18px;}
.intro{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin:0 0 22px;font-size:13.5px;color:var(--soft);}
.intro h3{font-family:var(--serif);color:var(--teal-deep);font-size:15px;margin:14px 0 4px;}
.intro p{margin:6px 0;} .intro li{margin:3px 0;}
.sig{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 18px 6px;margin:0 0 16px;box-shadow:0 2px 10px rgba(40,35,25,.05);}
.sig-h{font-family:var(--serif);font-size:16px;color:var(--teal-deep);margin:0 0 10px;}
.sig-h span{font-family:var(--serif);font-weight:400;font-size:12.5px;color:var(--faint);font-style:italic;}
table.mdt{width:100%;border-collapse:collapse;font-size:12.5px;margin:4px 0 12px;}
table.mdt th{text-align:left;font-size:11px;color:var(--soft);border-bottom:1.5px solid var(--line2);padding:6px 10px;font-weight:700;}
table.mdt td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top;line-height:1.45;color:var(--ink);}
table.mdt td.k{font-weight:700;white-space:nowrap;}
.sig table.mdt td.k{font-size:13px;}
.overflow{overflow-x:auto;}
nav{position:sticky;top:0;z-index:5;background:#ece5d6;padding:10px 0;display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--line2);margin-bottom:18px;}
nav a{font-size:12px;text-decoration:none;color:var(--teal-deep);background:#fff;border:1px solid var(--line);border-radius:100px;padding:4px 11px;}
nav a:hover{background:var(--teal);color:#fff;border-color:var(--teal);}
.group{margin:26px 0;}
.group>h2{font-family:var(--serif);font-size:19px;color:var(--teal-deep);border-bottom:2px solid var(--line2);padding-bottom:6px;margin:0 0 14px;}
.gn{display:inline-grid;place-items:center;width:26px;height:26px;background:var(--teal);color:#fff;border-radius:50%;font-size:13px;margin-right:6px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;}
.campo{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:0 2px 10px rgba(40,35,25,.05);}
.c-head{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin-bottom:9px;}
.c-name{font-family:ui-monospace,monospace;font-size:13.5px;font-weight:700;color:var(--ink);background:#f2ede2;padding:2px 8px;border-radius:6px;}
.c-topo{font-size:11.5px;color:var(--faint);}
code{font-family:ui-monospace,monospace;font-size:.92em;background:#f2ede2;padding:1px 4px;border-radius:4px;color:#4a5f5e;}
.c-elem{margin:0 0 8px;}
.elem-bar{display:flex;height:11px;border-radius:100px;overflow:hidden;background:#eee;border:1px solid var(--line);}
.elem-bar .seg{display:block;height:100%;}
.elem-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}
.chip{font-size:11px;color:var(--c);border:1px solid color-mix(in srgb,var(--c) 40%,#fff);background:color-mix(in srgb,var(--c) 8%,#fff);border-radius:100px;padding:1px 8px;}
.chip b{color:var(--c);}
.elem-special{font-size:12px;color:var(--amber);font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
.deriv{margin-top:5px;} .deriv summary{font-size:11px;color:var(--faint);cursor:pointer;}
.deriv>div{font-size:12px;color:var(--soft);margin-top:4px;background:#faf8f2;border-radius:6px;padding:7px 9px;}
.c-centro{font-size:12px;color:var(--soft);margin:0 0 12px;} .c-centro span{color:var(--faint);text-transform:uppercase;font-size:10px;letter-spacing:.06em;}
/* bloco por ELEMENTO */
.ebl{border:1px solid color-mix(in srgb,var(--c) 30%,var(--line));border-radius:10px;margin:0 0 10px;overflow:hidden;}
.ebl-h{display:flex;align-items:center;gap:7px;font-weight:700;font-size:13px;color:var(--c);background:color-mix(in srgb,var(--c) 9%,#fff);padding:7px 12px;border-bottom:1px solid color-mix(in srgb,var(--c) 22%,var(--line));}
.ebl-dot{width:9px;height:9px;border-radius:50%;background:var(--c);}
.poles{display:grid;grid-template-columns:1fr 1fr;}
@media(max-width:520px){.poles{grid-template-columns:1fr;}}
.pole{padding:9px 12px;}
.pole.eq{background:color-mix(in srgb,var(--equil) 4%,#fff);}
.pole.dq{background:color-mix(in srgb,var(--deseq) 4%,#fff);border-left:1px solid var(--line);}
@media(max-width:520px){.pole.dq{border-left:0;border-top:1px solid var(--line);}}
.pole-h{display:block;font-size:11px;font-weight:700;margin-bottom:6px;}
.pole.eq .pole-h{color:var(--equil);} .pole.dq .pole-h{color:var(--deseq);}
.pline{margin:5px 0;font-size:12px;line-height:1.5;}
.tag{display:inline-block;font-size:9px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;padding:1px 5px;border-radius:100px;margin-right:4px;vertical-align:1px;}
.tag.emo{color:var(--teal-deep);background:color-mix(in srgb,var(--teal) 12%,#fff);}
.tag.cre{color:var(--amber);background:color-mix(in srgb,var(--amber) 12%,#fff);}
.val strong{color:var(--ink);} .val code{background:#f2ede2;}
.nota{font-size:11.5px;color:var(--soft);background:#faf8f2;border-left:2px solid var(--line2);border-radius:0 6px 6px 0;padding:6px 10px;margin-top:8px;}
.foot{margin-top:30px;font-size:12px;color:var(--faint);border-top:1px solid var(--line2);padding-top:14px;}
</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
  <p class="sub">Artefato de lastro <b>interno</b> (nunca vai ao cliente). O Stage 2 consulta como piso determinístico e intui por cima. Cores dos elementos: <b style="color:#d0a017">Fogo</b> · <b style="color:#159d90">Água</b> · <b style="color:#c0552a">Terra</b> · <b style="color:#1e6fa8">Ar</b>. Clique "derivação" pra ver a conta.</p>
  ${sigHtml ? `<div class="sig"><h3 class="sig-h">Assinatura dos 4 elementos <span>· chave-mestra: todo órgão herda os dois polos daqui</span></h3>${sigHtml}</div>` : ''}
  <details class="intro"><summary style="cursor:pointer;font-weight:700;color:var(--teal-deep)">Sobre / legenda de fontes / guardrails</summary>${introHtml}</details>
  <nav>${nav}</nav>
  ${body}
  <div class="foot">38 campos · gerado de <code>tabela-lastro-CANONICA.md</code> · off-prod, produção intocada.</div>
</div>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('OK ->', OUT, `(${(html.length/1024).toFixed(0)} kb)`);
console.log('grupos:', groups.length, '· campos:', groups.reduce((n,g)=>n+g.campos.length,0));
