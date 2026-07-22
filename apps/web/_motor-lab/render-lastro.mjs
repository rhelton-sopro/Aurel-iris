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

// bloco desequilíbrio/equilíbrio
function sideBlock(bullet, kind){
  if (!bullet) return '';
  const emo = getSub(bullet, /Emo/i);
  const cre = getSub(bullet, /Cren/i);
  const parts = [];
  if (emo) parts.push(`<div class="line"><span class="tag emo">emoções</span><span class="val">${inline(emo.text)}</span></div>`);
  if (cre) parts.push(`<div class="line"><span class="tag cre">crenças</span><span class="val">${inline(cre.text)}</span></div>`);
  // caso sem sub (ex.: "Leitura", moduladores) -> mostra o texto do bullet
  if (!emo && !cre && bullet.text) parts.push(`<div class="line"><span class="val">${inline(bullet.text)}</span></div>`);
  return `<div class="side ${kind}"><h4>${kind==='deseq'?'🔴 Desequilíbrio':'🟢 Equilíbrio'}</h4>${parts.join('')}</div>`;
}

function campoCard(c){
  const el = getBullet(c, /^Elemento/);
  const centro = getBullet(c, /^Centro/);
  const deseq = getBullet(c, /DESEQUIL/i);
  const equil = getBullet(c, /EQUIL[IÍ]BRIO/i) && !/(DESEQUIL)/i.test(getBullet(c, /EQUIL[IÍ]BRIO/i).label) ? getBullet(c, /^🟢|EQUIL[IÍ]BRIO/i) : null;
  const eqBullet = c.bullets.find(b => /🟢/.test(b.label) || (/EQUIL/i.test(b.label) && !/DESEQ/i.test(b.label)));
  const dqBullet = c.bullets.find(b => /🔴/.test(b.label) || /DESEQUIL/i.test(b.label));
  const nota = c.bullets.find(b => /^Nota/i.test(b.label));
  const uso  = c.bullets.find(b => /^(Uso|Leitura)/i.test(b.label));

  const derivMatch = el ? el.text.match(/\*\*Deriva[çc][aã]o:\*\*([^]*?)(?:$)/i) : null;

  let sides = '';
  if (dqBullet || eqBullet){
    sides = `<div class="sides">${sideBlock(dqBullet,'deseq')}${sideBlock(eqBullet,'equil')}</div>`;
  }
  let extra = '';
  if (uso) extra += `<div class="nota"><b>${esc(uso.label)}:</b> ${inline(uso.text)}</div>`;
  if (nota) extra += `<div class="nota"><b>Nota:</b> ${inline(nota.text)}</div>`;
  // moduladores: leitura em sub-bullets sem emoji
  const looseSubs = c.bullets.filter(b => !/Elemento|Centro|🔴|🟢|DESEQ|EQUIL|^Nota|^Uso|^Leitura/i.test(b.label));

  return `<div class="campo" id="c-${c.name}">
    <div class="c-head">
      <code class="c-name">${esc(c.name)}</code>
      <span class="c-topo">${inline(c.topo)}</span>
    </div>
    ${el ? `<div class="c-elem">${elementBars(el.text)}<details class="deriv"><summary>derivação</summary><div>${inline(el.text)}</div></details></div>` : ''}
    ${centro ? `<div class="c-centro"><span>centro:</span> ${inline(centro.text)}</div>` : ''}
    ${sides}
    ${looseSubs.length ? looseSubs.map(b=>`<div class="nota"><b>${esc(b.label)}:</b> ${inline(b.text)}${b.sub.map(s=>`<br><b>${esc(s.label)}:</b> ${inline(s.text)}`).join('')}</div>`).join('') : ''}
    ${extra}
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

// intro em html simples
const introHtml = introBlock.map(l => {
  if (/^\s*$/.test(l)) return '';
  if (/^##\s/.test(l)) return `<h3>${inline(l.replace(/^##\s*/,''))}</h3>`;
  if (/^\|/.test(l)) return null; // pula tabela de legenda (renderizo à parte, simplificado)
  if (/^-{3,}/.test(l)) return '';
  if (/^\d+\.\s/.test(l)) return `<li>${inline(l.replace(/^\d+\.\s*/,''))}</li>`;
  return `<p>${inline(l)}</p>`;
}).filter(x=>x!==null).join('\n');

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
.c-centro{font-size:12px;color:var(--soft);margin:0 0 10px;} .c-centro span{color:var(--faint);text-transform:uppercase;font-size:10px;letter-spacing:.06em;}
.sides{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
@media(max-width:520px){.sides{grid-template-columns:1fr;}}
.side{border-radius:9px;padding:9px 11px;}
.side.deseq{background:color-mix(in srgb,var(--deseq) 5%,#fff);border:1px solid color-mix(in srgb,var(--deseq) 20%,var(--line));}
.side.equil{background:color-mix(in srgb,var(--equil) 5%,#fff);border:1px solid color-mix(in srgb,var(--equil) 20%,var(--line));}
.side h4{margin:0 0 7px;font-size:11.5px;letter-spacing:.03em;}
.side.deseq h4{color:var(--deseq);} .side.equil h4{color:var(--equil);}
.line{margin:5px 0;font-size:12.5px;line-height:1.5;}
.tag{display:inline-block;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;padding:1px 6px;border-radius:100px;margin-right:5px;vertical-align:1px;}
.tag.emo{color:var(--teal-deep);background:color-mix(in srgb,var(--teal) 12%,#fff);}
.tag.cre{color:var(--amber);background:color-mix(in srgb,var(--amber) 12%,#fff);}
.val strong{color:var(--ink);} .val code{background:#f2ede2;}
.nota{font-size:11.5px;color:var(--soft);background:#faf8f2;border-left:2px solid var(--line2);border-radius:0 6px 6px 0;padding:6px 10px;margin-top:8px;}
.foot{margin-top:30px;font-size:12px;color:var(--faint);border-top:1px solid var(--line2);padding-top:14px;}
</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
  <p class="sub">Artefato de lastro <b>interno</b> (nunca vai ao cliente). O Stage 2 consulta como piso determinístico e intui por cima. Cores dos elementos: <b style="color:#d0a017">Fogo</b> · <b style="color:#159d90">Água</b> · <b style="color:#c0552a">Terra</b> · <b style="color:#1e6fa8">Ar</b>. Clique "derivação" pra ver a conta.</p>
  <details class="intro"><summary style="cursor:pointer;font-weight:700;color:var(--teal-deep)">Sobre / legenda de fontes / guardrails</summary>${introHtml}</details>
  <nav>${nav}</nav>
  ${body}
  <div class="foot">38 campos · gerado de <code>tabela-lastro-CANONICA.md</code> · off-prod, produção intocada.</div>
</div>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('OK ->', OUT, `(${(html.length/1024).toFixed(0)} kb)`);
console.log('grupos:', groups.length, '· campos:', groups.reduce((n,g)=>n+g.campos.length,0));
