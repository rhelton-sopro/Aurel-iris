// Render genérico de markdown -> HTML (Iris Codex), p/ docs do motor-lab.
// uso: node _motor-lab/render-md.mjs <arquivo.md> <saida.html> "Título"
import fs from 'node:fs'
import path from 'node:path'

const [srcArg, outArg, titleArg] = process.argv.slice(2)
const SRC = path.resolve(srcArg)
const OUT = path.resolve(outArg)
const md = fs.readFileSync(SRC, 'utf8')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function inline(s) {
  let h = esc(s)
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>')
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>')
  return h
}
function mdTable(rows) {
  const cells = rows.filter((r) => !/^\|[\s:|-]+\|?\s*$/.test(r)).map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
  if (!cells.length) return ''
  const [head, ...body] = cells
  const th = head.map((c) => `<th>${inline(c)}</th>`).join('')
  const tr = body.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'k' : ''}">${inline(c)}</td>`).join('')}</tr>`).join('')
  return `<div class="tw"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`
}

const lines = md.split(/\r?\n/)
const out = []
let i = 0
let tbl = [], list = null
const flushT = () => { if (tbl.length) { out.push(mdTable(tbl)); tbl = [] } }
const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${list.t}>`); list = null } }
while (i < lines.length) {
  const l = lines[i]
  if (/^```/.test(l)) { // code fence
    flushT(); flushL()
    const buf = []
    i++
    while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
    out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`)
    i++; continue
  }
  if (/^\|/.test(l)) { flushL(); tbl.push(l); i++; continue }
  flushT()
  if (/^\s*$/.test(l)) { flushL(); i++; continue }
  if (/^#{1,4}\s/.test(l)) { flushL(); const lvl = l.match(/^#+/)[0].length; out.push(`<h${lvl}>${inline(l.replace(/^#+\s*/, ''))}</h${lvl}>`); i++; continue }
  if (/^>\s?/.test(l)) { flushL(); out.push(`<blockquote>${inline(l.replace(/^>\s?/, ''))}</blockquote>`); i++; continue }
  if (/^-{3,}\s*$/.test(l)) { flushL(); out.push('<hr>'); i++; continue }
  const um = l.match(/^(\s*)[-*]\s+(.*)$/)
  const om = l.match(/^(\s*)\d+\.\s+(.*)$/)
  if (um || om) {
    const t = om ? 'ol' : 'ul'
    if (!list || list.t !== t) { flushL(); list = { t, items: [] } }
    list.items.push((um || om)[2])
    i++; continue
  }
  flushL()
  out.push(`<p>${inline(l)}</p>`)
  i++
}
flushT(); flushL()

const title = titleArg || path.basename(SRC)
const html = `<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
:root{--paper:#fff;--ink:#1f3a3c;--soft:#5a6f6e;--faint:#8a9695;--line:#e6ded0;--line2:#d6cbb6;--teal:#0a7d84;--teal-deep:#0d5c63;--amber:#b5701a;--serif:"Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;}
*{box-sizing:border-box;}
body{margin:0;background:#ece5d6;color:var(--ink);font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.6;}
.wrap{max-width:900px;margin:0 auto;padding:30px 20px 90px;}
h1{font-family:var(--serif);font-size:27px;color:var(--teal-deep);line-height:1.15;margin:0 0 18px;}
h2{font-family:var(--serif);font-size:21px;color:var(--teal-deep);border-bottom:2px solid var(--line2);padding-bottom:6px;margin:34px 0 12px;}
h3{font-family:var(--serif);font-size:17px;color:var(--ink);margin:22px 0 8px;}
h4{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--amber);margin:16px 0 6px;}
p{margin:9px 0;} strong{color:var(--ink);} em{color:var(--teal-deep);font-style:italic;}
code{font-family:ui-monospace,"Cascadia Code",monospace;font-size:.88em;background:#f2ede2;padding:1px 5px;border-radius:4px;color:#4a5f5e;}
pre{background:#1f3a3c;color:#e9e2d3;border-radius:10px;padding:14px 16px;overflow-x:auto;font-size:12.5px;line-height:1.5;}
pre code{background:none;color:inherit;padding:0;font-size:inherit;}
blockquote{border-left:3px solid var(--teal);background:color-mix(in srgb,var(--teal) 5%,#fff);margin:14px 0;padding:10px 16px;border-radius:0 8px 8px 0;color:#26403f;}
blockquote strong{color:var(--teal-deep);}
.tw{overflow-x:auto;margin:12px 0;}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid var(--line);border-radius:8px;}
th{text-align:left;font-size:11px;color:var(--soft);background:#faf8f2;border-bottom:1.5px solid var(--line2);padding:8px 11px;font-weight:700;}
td{padding:8px 11px;border-bottom:1px solid var(--line);vertical-align:top;line-height:1.5;}
td.k{font-weight:600;white-space:nowrap;color:var(--ink);}
ul,ol{margin:9px 0;padding-left:22px;} li{margin:4px 0;}
hr{border:0;border-top:1px solid var(--line2);margin:24px 0;}
</style>
<div class="wrap">${out.join('\n')}</div>`
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, html, 'utf8')
console.log('OK ->', OUT, `(${(html.length / 1024).toFixed(0)} kb)`)
