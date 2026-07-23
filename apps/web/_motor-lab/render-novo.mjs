#!/usr/bin/env node
// RENDERIZADOR do relatório NOVO no estilo do MOCKUP aprovado (v2 — designs fiéis).
// Reusa o <style> do mockup; desenha agulhas/pêndulos dos NÚMEROS do motor;
// blocos 3 e 4 leem o formato ESTRUTURADO (@MARCO / @CAMPOS) do prompt.
// uso: node apps/web/_motor-lab/render-novo.mjs [self|daniel|miguel]
import { readFileSync, writeFileSync } from 'node:fs'
import { parseLastro, calc, BASELINE_LIVRE } from './motor-calc.mjs'

const name = process.argv[2] || 'self'
const MD = readFileSync(`apps/web/_motor-lab/out/novo-${name}--sonnet-5.md`, 'utf8')
const MOCK = readFileSync('apps/web/_motor-lab/relatorio-novo/relatorio-completo.html', 'utf8')
const STYLE = MOCK.slice(MOCK.indexOf('<style>') + 7, MOCK.indexOf('</style>'))
const NOME = { self: 'Helton', daniel: 'Daniel', miguel: 'Miguel' }[name] || name

// ---------- números do motor ----------
const α = BASELINE_LIVRE
const lastro = parseLastro()
const r = calc(name, lastro)
const agu = (c) => Math.round(((r.centro[c].l + α) / (r.centro[c].t + r.centro[c].l + 2 * α)) * 100)
const AG = { mente: agu('mente'), coracao: agu('coracao'), corpo: agu('corpo') }
const nivel = (s) => (s >= 6 ? 'muito alta' : s >= 4 ? 'alta' : s >= 2.5 ? 'média' : 'baixa')
const leftCarga = (s) => Math.max(12, Math.min(44, Math.round(46 - s * 3.4)))
const ANTIDOTO = {
  'raiva contida': 'Serenidade', 'irritação que "sobe" do visceral ao mental': 'Calma',
  'dificuldade de soltar': 'Leveza', '"tagarelice mental rotativa" — mente que não desliga': 'Calma mental',
  frustração: 'Fluidez', 'irritabilidade de fundo': 'Serenidade', 'medo estrutural de base': 'Segurança',
  'apego ao passado': 'Presença', 'baixa autoestima': 'Autovalor', ressentimento: 'Perdão',
  'desilusão/trauma localizado': 'Sentido', 'rigidez/intolerância': 'Flexibilidade',
}
const SHADOW = [['firmeza', 'Fragilidade'], ['flexibilidade', 'Rigidez'], ['centr', 'Dispersão'], ['alegria', 'Desamor'], ['fôlego', 'Sufoco'], ['leveza', 'Peso'], ['empatia', 'Sobrecarga do outro'], ['limite', 'Sobrecarga do outro'], ['segur', 'Medo']]
const shadowOf = (e) => (SHADOW.find(([k]) => e.toLowerCase().includes(k)) || [null, '—'])[1]
function short(e) {
  let s = e.replace(/["']/g, '').replace(/\s*\(.*?\)/g, '').trim()
  s = s.split(/\s*[—–]\s|,\s/)[0].trim()
  if (s.length > 32) s = s.slice(0, 30).replace(/\s\S*$/, '') + '…'
  return s
}

// ---------- markdown inline ----------
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inl = (s = '') => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>')

// ---------- prosa genérica (blocos sem design próprio) ----------
function prose(md) {
  const out = []; let ul = null
  const flush = () => { if (ul) { out.push(`<ul class="mdul">${ul.join('')}</ul>`); ul = null } }
  for (const line of md.split('\n')) {
    const t = line.trim()
    if (!t) { flush(); continue }
    if (t.startsWith('`[') || /^\|/.test(t) || /^[-*_]{3,}$/.test(t)) continue
    if (t.startsWith('> ')) { flush(); out.push(`<blockquote class="chave">${inl(t.slice(2))}</blockquote>`); continue }
    if (t.startsWith('- ')) { (ul = ul || []).push(`<li>${inl(t.slice(2))}</li>`); continue }
    flush()
    const m = t.match(/^\*\*(.+?):\*\*\s*(.*)$/)
    if (m) { out.push(`<p class="rootlab">${esc(m[1])}</p>`); if (m[2]) out.push(`<p class="block-serif">${inl(m[2])}</p>`); continue }
    if (/^\*\*(.+?)\*\*$/.test(t)) { out.push(`<p class="minih">${inl(t)}</p>`); continue }
    out.push(`<p>${inl(t)}</p>`)
  }
  flush(); return out.join('\n')
}

// ---------- BLOCO 1 — microfilme + maiêutica ----------
function block1(body) {
  const paras = body.split('\n').map((l) => l.trim()).filter(Boolean)
  const q = paras[paras.length - 1]
  const micro = paras.slice(0, -1).map((p, i) => {
    if (i === 0) p = p.replace(/^([^,]+,)/, '<span class="voc">$1</span>') // vocativo
    return `<p>${inl(p).replace(/<span class="voc">(.+?)<\/span>/, (m) => m)}</p>`
  }).join('')
  return `<div class="microfilme">${micro}</div><p class="maieutica">${inl(q)}</p>`
}

// ---------- BLOCO 2 — pcard(agulhas) + facetas/raízes/drains ----------
function centerParas(block) {
  const p = {}; const map = { mente: /Mente\b/i, coracao: /Cora[çc][ãa]o\b/i, corpo: /Corpo\b/i }
  const lines = block.split('\n')
  for (const c of ['mente', 'coracao', 'corpo']) {
    const i = lines.findIndex((l) => /^\*\*/.test(l.trim()) && map[c].test(l))
    if (i < 0) continue
    for (let j = i + 1; j < lines.length; j++) { const t = lines[j].trim(); if (!t || t.startsWith('`[') || /^\*\*/.test(t)) { if (p[c]) break; else continue } p[c] = t; break }
  }
  return p
}
function pcard(paras) {
  const nomes = { mente: ['Mente', 'modo de pensar'], coracao: ['Coração', 'modo de sentir'], corpo: ['Corpo', 'modo de agir'] }
  const ctr = (c) => `<div class="ctr"><div class="ctr-head"><span class="ctr-name ${c}">${nomes[c][0]}</span><span class="ctr-fn ${c}">${nomes[c][1]}</span></div>
    <div class="dv"><span class="dv-lab a">tensão</span><div class="dv-track"><i class="dv-needle" style="left:${AG[c]}%"></i></div><span class="dv-lab b">livre</span></div>
    <p class="ctr-txt">${inl(paras[c] || '')}</p></div>`
  return `<div class="pcard">${ctr('mente')}${ctr('coracao')}${ctr('corpo')}</div>`
}
function block2(body) {
  const paras = centerParas(body)
  const hi = body.search(/\*\*Mente/i)
  const head = hi >= 0 ? body.slice(0, hi) : body
  const restStart = body.search(/\*\*(Em resumo|A tensão|Como isso aparece)/i)
  const rest = restStart >= 0 ? body.slice(restStart) : ''
  const out = []; const lines = rest.split('\n'); let i = 0
  const grabPara = () => { const p = []; while (i < lines.length) { const t = lines[i].trim(); if (!t) { i++; break } if (/^\*\*|^[-|]/.test(t)) break; p.push(t); i++ } return p.join(' ') }
  const grabList = () => { const it = []; while (i < lines.length && lines[i].trim().startsWith('- ')) { it.push(lines[i].trim().slice(2)); i++ } return it }
  const grabTable = () => { const rows = []; while (i < lines.length && lines[i].trim().startsWith('|')) { const c = lines[i].trim().split('|').map((s) => s.trim()).filter((s) => s.length); i++; if (c.every((x) => /^-+$/.test(x))) continue; rows.push(c) } return rows }
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t || /^[-*_]{3,}$/.test(t)) { i++; continue }
    const hm = t.match(/^\*\*(.+?):?\*\*\s*(.*)$/)
    if (!hm) { i++; out.push(`<p class="tension">${inl(t)}</p>`); continue } // parágrafo solto (fecho) = tension
    i++
    const lab = hm[1].trim(); const inline = (hm[2] || '').trim()
    if (/facetas/i.test(lab)) {
      const items = grabList()
      out.push(`<p class="rootlab">Veja como cada centro aparece no seu dia a dia</p><div class="facets">${items.map((it) => { const mm = it.match(/^\*?(.+?):\*?\s*(.*)$/); return `<div class="facet"><span class="fk n">${esc(mm ? mm[1].replace(/\*/g, '') : '')}</span><span class="fv">${inl(mm ? mm[2] : it)}</span></div>` }).join('')}</div>`)
    } else if (/acende/i.test(lab)) {
      let acende = [], apaga = []
      const rows = grabTable()
      if (rows.length) { for (const rw of rows.slice(1)) { if (rw[0]) acende.push(rw[0]); if (rw[1]) apaga.push(rw[1]) } }
      else if (inline) { acende = inline.split('·').map((s) => s.trim()).filter(Boolean); const n = lines[i]?.trim().match(/apaga.*?\*\*\s*(.*)/i); if (n) { apaga = n[1].split('·').map((s) => s.trim()).filter(Boolean); i++ } }
      out.push(`<p class="rootlab">O que te acende &nbsp;·&nbsp; o que te apaga</p><div class="drains"><div class="drain up"><h4>Te acende</h4><ul>${acende.map((x) => `<li>${inl(x)}</li>`).join('')}</ul></div><div class="drain down"><h4>Te apaga</h4><ul>${apaga.map((x) => `<li>${inl(x)}</li>`).join('')}</ul></div></div>`)
    } else if (/mesma raiz/i.test(lab)) {
      out.push(`<p class="rootlab">A mesma raiz, dois lados</p><div class="roots"><div class="root">${inl(inline || grabPara())}</div></div>`)
    } else if (/em resumo/i.test(lab)) {
      out.push(`<div class="resumo"><p class="resumo-lab">Em resumo</p><p>${inl(inline || grabPara())}</p></div>`)
    } else if (/quando aperta/i.test(lab)) {
      out.push(`<p class="rootlab">${esc(lab)}</p><div class="stresswrap"><p class="block-serif">${inl(inline || grabPara())}</p></div>`)
    } else if (/tensão/i.test(lab)) {
      out.push(`<p class="tension">${inl(inline || grabPara())}</p>`)
    } else {
      out.push(`<p class="rootlab">${esc(lab)}</p><p class="block-serif">${inl(inline || grabPara())}</p>`)
    }
  }
  return `<div class="objbox"><p class="obj-lab">Antes de ler</p><p class="obj-txt">Você já deve ter feito um teste de personalidade — respondeu, marcou opções, ganhou um rótulo. Aqui é diferente: <b>você não respondeu nada</b>. Isto foi lido no que os seus olhos carregam.</p></div>${prose(head)}${pcard(paras)}${out.join('\n')}`
}

// ---------- BLOCO 3 — trilho + momentos (formato @MARCO) ----------
function block3(body) {
  const intro = body.split('@MARCO')[0].trim()
  const marcos = body.split(/^@MARCO /m).slice(1).map((c) => {
    const head = c.split('\n')[0]
    const g = (k) => (head.match(new RegExp(`${k}=([^|]+)`)) || [])[1]?.trim()
    const f = (k) => (c.match(new RegExp(`^- ${k}:\\s*(.*)`, 'm')) || [])[1]?.trim()
    return { idade: g('idade'), fase: g('fase'), status: g('status'), emocao: f('emoção'), comportamento: f('comportamento'), situacoes: f('situações'), abre: f('abre'), resolucao: f('resolução') }
  })
  const flag = (s) => (s === 'ativo' ? 'ainda ativo' : s === 'proc' ? 'em processo' : 'fechado')
  const rail = marcos.map((m) => `<div class="node ${m.status === 'ativo' ? 'active' : m.status === 'proc' ? 'proc' : ''}"><div class="dot"></div><div class="age">${esc(m.idade)}</div><div class="ph">${esc(m.fase || '')}</div><span class="flag ${m.status === 'proc' ? 'proc' : ''}">${flag(m.status)}</span></div>`).join('')
  const moments = marcos.map((m) => {
    const rows = [['Emoção', m.emocao], ['Comportamento', m.comportamento], ['Situações', m.situacoes]].filter(([, v]) => v).map(([k, v]) => `<div class="mrow"><span class="k">${k}</span><span class="v">${inl(v)}</span></div>`).join('')
    const keys = m.status === 'ativo' && m.abre ? `<div class="keys"><p class="keys-lab">Chaves do tempo</p><div class="key"><span class="kind abre">Abre o estado</span><span class="q">${inl(m.abre)}</span></div>${m.resolucao ? `<div class="key"><span class="kind res">Resolução</span><span class="q">${inl(m.resolucao)}</span></div>` : ''}</div>` : (m.status === 'proc' ? `<p class="mnote">Ainda em reorganização — não é ferida aberta, mas também não fechou de todo. Está se integrando.</p>` : '')
    const cls = m.status === 'ativo' ? 'on' : m.status === 'proc' ? 'proc' : ''
    return `<div class="moment ${cls}"><div class="moment-h"><span class="mage display">${esc(m.idade)}</span><span class="${m.status === 'ativo' ? 'mflag' : 'mproc'}">${flag(m.status)}</span></div>${rows}${keys}</div>`
  }).join('')
  return `<p class="snote">${inl(intro)}</p><div class="rail-wrap"><div class="rail"><div class="rail-line"></div>${rail}</div></div>${moments}`
}

// ---------- BLOCO 4 — corrente + padrões + identificação + frases ----------
function block4(body) {
  const g = (k) => { const m = body.match(new RegExp(`^@${k}:[ \\t]*(.*(?:\\n(?!@|#).*)*)`, 'm')); return m ? m[1].trim() : '' }
  const padroes = g('PADROES').split('|').map((s) => s.trim()).filter(Boolean)
  const idBlock = (body.match(/@IDENTIFICACAO:([\s\S]*?)(?=\n@|\n#|$)/) || [])[1] || ''
  const idrows = idBlock.split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter((l) => l.includes('|')).map((l) => { const [p, q] = l.split('|'); return { pat: p.trim(), q: q.trim() } })
  const frBlock = (body.match(/@FRASES:([\s\S]*?)(?=\n@|\n#|$)/) || [])[1] || ''
  const frases = frBlock.split('\n').map((l) => l.replace(/^-\s*/, '').replace(/^["“]+|["”]+$/g, '').trim()).filter(Boolean)
  const chips = padroes.map((p) => `<span class="chip">${esc(p)}</span>`).join('')
  const gen = `<div class="gen"><div class="gen-line"></div>
    <div class="gcol pastcol"><div class="gring past">antes</div><div class="glabel">O que veio de trás</div><div class="gcontent">${chips}</div></div>
    <div class="gcol"><div class="gring you">você</div><div class="glabel you">Em você — e só aqui muda</div><div class="gcontent"><p class="gtext">${inl(g('VOCE'))}</p></div></div>
    <div class="gcol"><div class="gring next">depois</div><div class="glabel">Quem você liberta</div><div class="gcontent"><p class="gtext">${inl(g('DEPOIS'))}</p></div></div></div>`
  const idlist = idrows.length ? `<p class="subhead">De quem isso pode ter vindo?</p><p class="idintro">Antes de soltar, olhe pra trás. Para cada padrão, veja se reconhece alguém:</p><div class="idlist">${idrows.map((x) => `<div class="idrow"><span class="idpat">${esc(x.pat)}</span><p class="idq">${inl(x.q)}</p></div>`).join('')}</div>` : ''
  const saybox = frases.length ? `<p class="subhead" style="color:var(--teal-deep)">Uma frase para dizer em voz alta</p><div class="saybox"><p class="sayintro">Uma frase muda mais quando o corpo entra antes da fala. Antes de dizer, se dê um instante:</p><ol class="rsteps"><li>Faça <b>três respirações fundas</b>, bem devagar.</li><li>Leve a <b>atenção ao centro do peito</b>.</li><li>Apoie a <b>mão dominante</b> ali, sobre o peito.</li></ol><p class="rsay">Então, lentamente, diga — a que ressoar com você:</p>${frases.map((f) => `<p class="sayline">&ldquo;${esc(f)}&rdquo;</p>`).join('')}<p class="rnote">Na sessão, o seu terapeuta conduz esse momento. Em casa, você pode repetir do seu jeito — sempre sem pressa.</p></div>` : ''
  return `<p class="lead">${inl(g('LEAD'))}</p>${gen}
    <div class="pattern"><p>${inl(g('PADRAO_DETALHE'))}</p></div>
    <p class="subhead">Por que às vezes é difícil largar</p><p class="deep">${inl(g('DIFICIL'))}</p>
    <p class="turn">${inl(g('VIRADA'))}</p>
    <div class="resil"><p class="rlab">E não é só o peso</p><p>${inl(g('RESILIENCIA'))}</p></div>
    ${idlist}${saybox}`
}

// ---------- BLOCO 5 — pêndulos + legenda + remédio ----------
function block5(body) {
  const carga = r.mapaCarga.slice(0, 6).map(([e, s]) => `<div class="pend"><div class="pend-labels"><span class="pl-carga">${esc(short(e))} <span class="lv">${nivel(s)}</span></span><span class="pl-anti">${ANTIDOTO[e] || '—'}</span></div><div class="pend-track"><i class="needle" style="left:${leftCarga(s)}%"></i></div></div>`).join('')
  const rec = r.mapaRecurso.slice(0, 5).map(([e, s], i) => `<div class="pend"><div class="pend-labels"><span class="pl-shadow">${esc(shadowOf(e))}</span><span class="pl-resource">${esc(short(e))} <span class="lv">${s >= 2 ? 'vital' : 'livre'}</span></span></div><div class="pend-track"><i class="needle free" style="left:${90 - i * 3}%"></i></div></div>`).join('')
  const med = body.match(/pulo do gato[:\s]*([\s\S]*)/i) || body.match(/rem[ée]dio[\s\S]{0,4}([\s\S]*)/i)
  const medTxt = med ? med[1].replace(/^\**.*?\**:/, '').trim() : ''
  const lead = body.split(/\n/).find((l) => l.trim() && !/^#|^\*\*|^\||^-/.test(l.trim())) || ''
  return `<p class="lead">${inl(lead)}</p>
    <div class="legend"><span>● <b>Bolinha</b> = onde você está</span><span><b style="color:var(--amber)">Esquerda</b> = carregado</span><span><b style="color:var(--good)">Direita</b> = a saída</span></div>
    <p class="grouplab carga"><span class="gd"></span>O que pesa hoje</p>${carga}
    <p class="grouplab livre"><span class="gd"></span>O que está leve — a sua força</p>${rec}
    ${medTxt ? `<div class="medicine"><p class="med-lab">O que já está livre é o seu remédio</p><p>${inl(medTxt)}</p></div>` : ''}`
}

// ---------- BLOCO 6 — perguntas em cards de processo (formato @CAMINHO) ----------
function block6(body) {
  const out = ['<p class="method-sub">Método somático · Sopro da Origem</p>']
  const g1 = (k) => { const m = body.match(new RegExp(`^@${k}:[ \\t]*(.*)`, 'm')); return m ? m[1].trim() : '' }
  const intro = g1('INTRO'); if (intro) out.push(`<p class="intro">${inl(intro)}</p>`)
  const TEMPOS = [['chegar', 'Chegar', ''], ['tocar', 'Tocar — onde isso mora no corpo', 'carga'], ['deixar', 'Deixar falar', ''], ['outro', 'Trazer o outro lado', 'recurso'], ['passo', 'O que isso pede — pra sua sessão', 'passo']]
  for (const c of body.split(/^@CAMINHO /m).slice(1)) {
    const nome = (c.split('\n')[0].match(/nome=(.*)/) || [])[1]?.trim() || ''
    const steps = TEMPOS.map(([k, lab, cls], idx) => {
      const v = (c.match(new RegExp(`^- ${k}:\\s*(.*)`, 'm')) || [])[1]?.trim()
      return v ? `<div class="step ${cls}"><span class="dot">${idx + 1}</span><p class="st-lab">${esc(lab)}</p><div class="card"><p class="st-txt">${inl(v)}</p></div></div>` : ''
    }).join('')
    out.push(`<div class="qsec"><div class="qhead">${esc(nome)}</div>${steps}</div>`)
  }
  const fecho = g1('FECHO'); if (fecho) out.push(`<p class="qfecho">${inl(fecho)}</p>`)
  return out.join('\n')
}

// ---------- monta ----------
const NUMS = ['1', '2', '3', '4', '5', '6']
const H2 = ['Em poucas palavras', 'Mente, coração e corpo — a sua mistura', 'O que cada tempo deixou em você', 'O que talvez não tenha começado em você', 'Onde você está — e pra onde dá pra ir', 'Perguntas para a sua sessão']
const blocks = MD.split(/^# /m).filter((b) => b.trim())
const sections = blocks.map((b, i) => {
  const nl = b.indexOf('\n'); const title = b.slice(0, nl).trim(); const body = b.slice(nl + 1)
  const eyebrow = `<p class="eyebrow"><span class="secnum">${NUMS[i] || ''}</span> &nbsp;${esc(title)}</p>`
  const h2 = i === 5 ? '' : `<h2 class="display">${esc(H2[i] || title)}</h2>`
  let inner
  try {
    inner = i === 0 ? block1(body) : i === 1 ? block2(body) : i === 2 ? block3(body) : i === 3 ? block4(body) : i === 4 ? block5(body) : block6(body)
  } catch (e) { inner = prose(body) + `<!-- render fallback: ${e.message} -->` }
  return `<section class="block">${eyebrow}${h2}${inner}</section>`
}).join('\n<hr class="div">\n')

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório · ${NOME}</title><style>${STYLE}
.mdul{margin:6px 0 14px 0;padding-left:20px} .mdul li{margin:4px 0} .minih{font-weight:600;margin:16px 0 4px}
.chave{margin:6px 0;padding:8px 14px;border-left:3px solid var(--amber);background:#faf6ee;font-style:italic}
.qfecho{margin:16px 0;font-style:italic;color:var(--ink-soft)}
</style></head><body>
<div class="sheet"><div class="pad">
  <div class="brand">IRIS CODEX</div>
  <div class="brand-sub">Leitura emocional · ${NOME}</div>
  ${sections}
</div></div>
</body></html>`
writeFileSync(`apps/web/_motor-lab/out/novo-${name}.html`, html)
console.log(`→ out/novo-${name}.html (${html.length} chars · agulhas M${AG.mente}/C${AG.coracao}/Corpo${AG.corpo})`)
