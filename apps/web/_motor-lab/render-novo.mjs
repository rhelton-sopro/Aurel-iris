#!/usr/bin/env node
// RENDERIZADOR do relatório NOVO no estilo do MOCKUP aprovado (v2 — designs fiéis).
// Reusa o <style> do mockup; desenha agulhas/pêndulos dos NÚMEROS do motor;
// blocos 3 e 4 leem o formato ESTRUTURADO (@MARCO / @CAMPOS) do prompt.
// uso: node apps/web/_motor-lab/render-novo.mjs [self|daniel|miguel]
import { readFileSync, writeFileSync } from 'node:fs'
import { parseLastro, calc, eixoDe, displayDe, EIXOS, BASELINE_LIVRE } from './motor-calc.mjs'

const name = process.argv[2] || 'self'
const MD = readFileSync(`apps/web/_motor-lab/out/novo-${name}--sonnet-5.md`, 'utf8')
const MOCK = readFileSync('apps/web/_motor-lab/relatorio-novo/relatorio-completo.html', 'utf8')
const STYLE = MOCK.slice(MOCK.indexOf('<style>') + 7, MOCK.indexOf('</style>'))
const NOME = { self: 'Rhelton', s5novo: 'Rhelton', victor: 'Victor', daniel: 'Daniel', miguel: 'Miguel' }[name] || name

// ---------- BLOCO 6 determinístico: reusa o guia de condução aprovado (proto) ----------
// O bloco 6 é um MÉTODO fixo (7 movimentos), então não passa pelo Sonnet — o render
// injeta o proto aprovado + o CSS dele. (self = proto atual; daniel/miguel = parametrizar depois.)
const PROTO6 = readFileSync('apps/web/_motor-lab/relatorio-novo/b6-terapeuta-proto.html', 'utf8')
const PROTO6_STYLE = PROTO6.slice(PROTO6.indexOf('<style>') + 7, PROTO6.indexOf('</style>'))
const B6CSS = ':root{--gold:#9a6a12;--amber-soft:#d69a4e;}\n' + PROTO6_STYLE.slice(PROTO6_STYLE.indexOf('.method-sub{'))
const B6HTML = PROTO6.slice(PROTO6.indexOf('<p class="method-sub">'), PROTO6.indexOf('</p>', PROTO6.indexOf('<p class="closing">')) + 4)

// ---------- números do motor ----------
const α = BASELINE_LIVRE
const lastro = parseLastro()
const r = calc(name, lastro)
const agu = (c) => Math.round(((r.centro[c].l + α) / (r.centro[c].t + r.centro[c].l + 2 * α)) * 100)
const AG = { mente: agu('mente'), coracao: agu('coracao'), corpo: agu('corpo') }
const nivel = (s) => (s >= 6 ? 'muito alta' : s >= 4 ? 'alta' : s >= 2.5 ? 'média' : 'baixa')
// régua BIPOLAR −50 (totalmente carregado) ⟷ 0 (neutro) ⟷ +50 (antídoto/livre),
// mesmo modelo dos 3 centros. carga = negativo · recurso = positivo. track% = 50 + bip.
// CONTÍNUA (não bucketizada): cada emoção tem seu número; só empata quem é igual de verdade.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const bipCarga = (s) => clamp(Math.round(-7.5 * s), -48, -6)
const bipRecurso = (s) => clamp(Math.round(9 * s + 12), 24, 48)
const leftCarga = (s) => 50 + bipCarga(s)
// PÊNDULO por emoção de carga: [rótulo limpo, o-que-é (carga), antídoto, o-que-é (antídoto)]
const PEND = {
  'raiva contida': ['Raiva contida', 'a raiva que você segura pra dentro, pra não virar briga', 'Serenidade', 'sentir e deixar passar, sem explodir'],
  'irritação que "sobe" do visceral ao mental': ['Irritação que sobe', 'a irritação que sobe do corpo pra cabeça e embaça o que você pensa', 'Calma', 'a irritação baixa e a cabeça clareia'],
  'dificuldade de soltar': ['Dificuldade de soltar', 'o apego ao que já passou — mágoa, controle, o que você não larga', 'Leveza', 'soltar o que já cumpriu seu papel'],
  '"tagarelice mental rotativa" — mente que não desliga': ['Mente que não desliga', 'a cabeça que fica girando, sem conseguir parar', 'Calma mental', 'a mente descansa quando há segurança'],
  ressentimento: ['Ressentimento', 'a mágoa antiga guardada, esperando ser reconhecida', 'Perdão', 'deixar a mágoa ir — por você, não pelo outro'],
  'dispersão mental': ['Dispersão', 'a atenção que se espalha quando a tensão sobe', 'Foco', 'a energia junta vira atenção'],
  'medo estrutural de base': ['Medo de base', 'um medo de fundo, de que o chão pode faltar', 'Segurança', 'confiar que você tem base pra se sustentar'],
  'urgência constante': ['Urgência constante', 'a sensação de precisar sempre fazer mais, sem poder parar', 'Ritmo próprio', 'escolher o que importa e sustentar o passo'],
  frustração: ['Frustração', 'a energia que trava quando algo não anda', 'Fluidez', 'a energia volta a correr'],
  'irritabilidade de fundo': ['Irritabilidade de fundo', 'aquela irritação baixa e constante, sem alvo claro', 'Serenidade', 'o fundo aquieta'],
  'apego ao passado': ['Apego ao passado', 'ficar preso ao que já foi', 'Presença', 'viver o que é agora'],
  'baixa autoestima': ['Baixa autoestima', 'a sensação de não valer o bastante', 'Autovalor', 'saber que você já basta'],
  'medo de soltar': ['Medo de soltar', 'o medo de perder se largar o controle', 'Confiança', 'confiar que o essencial fica'],
}
// RECURSO (força): [rótulo limpo, o-que-é, sombra (o polo carregado do outro lado)]
const REC = {
  'flexibilidade ativa para mudar de direção quando preciso': ['Flexibilidade', 'mudar de direção quando precisa, sem travar', 'Rigidez'],
  'alegria/júbilo': ['Alegria', 'sentir prazer e leveza no que a vida traz', 'Desânimo'],
  'leveza depois de elaborar a perda, "respirar aliviado"': ['Leveza', 'respirar aliviado depois de elaborar o que doeu', 'Peso'],
  'empatia que nutre em vez de esgotar': ['Empatia que nutre', 'se importar com o outro sem se esgotar', 'Sobrecarga do outro'],
  'firmeza / base vital — força que sustenta sem endurecer': ['Firmeza', 'uma base que te sustenta sem precisar endurecer', 'Fragilidade'],
}
const SHADOW = [['firmeza', 'Fragilidade'], ['flexibilidade', 'Rigidez'], ['centr', 'Dispersão'], ['alegria', 'Desamor'], ['fôlego', 'Sufoco'], ['leveza', 'Peso'], ['empatia', 'Sobrecarga do outro'], ['limite', 'Sobrecarga do outro'], ['segur', 'Medo']]
const shadowOf = (e) => (SHADOW.find(([k]) => e.toLowerCase().includes(k)) || [null, '—'])[1]
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
// limpa o rótulo (fallback quando não está no dicionário) — SEM cortar com "…"
function short(e) {
  let s = e.replace(/["']/g, '').replace(/\s*\(.*?\)/g, '').trim()
  s = s.split(/\s*[—–]\s|,\s/)[0].trim()
  return cap(s)
}
// dados do pêndulo de CARGA: dicionário curado primeiro; fallback = rótulo limpo +
// ANTÍDOTO VINDO DO MOTOR (o 🟢 do mesmo campo na canônica). Antes o fallback cravava
// "—" e o pêndulo saía manco sempre que a emoção não estava no dicionário acima.
// FONTE ÚNICA do lado 🟢 = o EIXO (emocao-familia.md). O dicionário curado abaixo só
// serve pro lado 🔴 (rótulo + o-que-é da carga); os campos de antídoto dele ficaram
// obsoletos — duas palavras pra mesma saída ("Calma mental" vs "Paz mental") é
// exatamente a divergência que o eixo veio matar.
function pendData(e) {
  const a = r.antidoto?.[e]
  const anti = a ? { anti: a.principal, antiDesc: a.oque || '' } : { anti: '—', antiDesc: '' }
  // rótulo do cliente: override do eixo (`chave :: rótulo`) > dicionário curado > limpeza
  const dsp = displayDe(e)
  if (PEND[e]) return { lab: dsp ? cap(dsp) : PEND[e][0], desc: PEND[e][1], ...anti }
  return { lab: dsp ? cap(dsp) : short(e), desc: '', ...anti }
}
// FORÇA: mesma fonte única. O rótulo é o nome do EIXO (8ª série) e a sombra é a ponta
// 🔴 do MESMO eixo — não mais o chute da lista SHADOW. Foi o que matou
// "abertura que se mantém firme sem endurecer" (agora: Flexibilidade ⟷ Rigidez).
function recData(e) {
  const x = eixoDe(e)
  if (x) {
    const carga = (EIXOS.find((y) => y.nome === x.eixo)?.carga) || []
    return { lab: x.rotulo, desc: x.oque || '', shadow: carga.length ? short(carga[0]) : '—' }
  }
  if (REC[e]) return { lab: REC[e][0], desc: REC[e][1], shadow: REC[e][2] }
  return { lab: short(e), desc: '', shadow: shadowOf(e) }
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

// extrai campos @RÓTULO: valor (multi-linha até o próximo @ ou #)
function fields(body) {
  const map = {}; const re = /^@([A-Z]+):[ \t]*(.*(?:\n(?!@|#).*)*)/gm; let m
  while ((m = re.exec(body))) map[m[1]] = m[2].replace(/\n+[-*_]{3,}\s*$/, '').trim() // corta o separador --- que o Sonnet põe entre blocos
  return map
}
// ---------- BLOCO 1 — microfilme + maiêutica (formato @) ----------
function block1(body) {
  const f = fields(body)
  const voc = (f.VOCATIVO || '').trim()
  const paras = (f.MICRO || body).split(/\n{2,}|\n/).map((s) => s.trim()).filter((s) => s && !/^@|^#/.test(s))
  const micro = paras.map((p, i) => {
    let h = inl(p) // escapa PRIMEIRO
    if (i === 0 && voc) h = h.replace(new RegExp(`^(${voc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},?)`), '<span class="voc">$1</span>') // envolve o vocativo depois
    return `<p>${h}</p>`
  }).join('')
  // pergunta em 2 tempos: tempo1 / (respira) / tempo2
  const perg = (f.PERGUNTA || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) =>
    /^\(?respira/i.test(l) ? '<p class="respira">— respira —</p>' : `<p class="maieutica">${inl(l)}</p>`).join('')
  return `<div class="microfilme">${micro}</div>${perg}`
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
function pcard(paras, resumoHtml = '') {
  const nomes = { mente: ['Mente', 'modo de pensar'], coracao: ['Coração', 'modo de sentir'], corpo: ['Corpo', 'modo de agir'] }
  const ctr = (c) => `<div class="ctr"><div class="ctr-head"><span class="ctr-name ${c}">${nomes[c][0]}</span><span class="ctr-fn ${c}">${nomes[c][1]}</span></div>
    <div class="dv"><span class="dv-lab a">tensão</span><div class="dv-track"><i class="dv-needle" style="left:${AG[c]}%"></i></div><span class="dv-lab b">livre</span></div>
    <p class="ctr-txt">${inl(paras[c] || '')}</p></div>`
  return `<div class="pcard">${ctr('mente')}${ctr('coracao')}${ctr('corpo')}${resumoHtml}</div>` // resumo DENTRO do pcard (igual mockup)
}
// facetas coloridas por centro + destaque {{gift}}/[[cost]] nas raízes
// cor da faceta = ESTADO no termostato (agulha): tenso=âmbar · livre=verde · meio=neutro
const tensCls = (c) => { const a = AG[c]; return a < 45 ? 'tenso' : a > 55 ? 'livre' : 'meio' }
const facetKey = (label) => {
  const l = label.toLowerCase()
  if (/pensa/.test(l)) return { cls: tensCls('mente'), disp: 'Mente · como pensa' }
  if (/sente/.test(l)) return { cls: tensCls('coracao'), disp: 'Coração · como sente' }
  if (/age/.test(l)) return { cls: tensCls('corpo'), disp: 'Corpo · como age' }
  return { cls: 'n', disp: label }
}
const rootInl = (s) => inl(s).replace(/\{\{(.+?)\}\}/g, '<span class="gift">$1</span>').replace(/\[\[(.+?)\]\]/g, '<span class="cost">$1</span>')
function block2(body) {
  const f = fields(body)
  const facetas = (f.FACETAS || '').split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter((l) => l.includes('|')).map((l) => { const [k, v] = l.split('|'); return { k: k.trim(), v: v.trim() } })
  const acende = (f.ACENDE || '').split('|').map((s) => s.trim()).filter(Boolean)
  const apaga = (f.APAGA || '').split('|').map((s) => s.trim()).filter(Boolean)
  const roots = (f.RAIZ || '').split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean).map((l) => `<div class="root">${rootInl(l)}</div>`).join('')
  const resumoHtml = f.RESUMO ? `<div class="resumo"><p class="resumo-lab">Em resumo</p><p>${inl(f.RESUMO)}</p></div>` : ''
  return [
    f.ANTES ? `<div class="objbox"><p class="obj-lab">Antes de ler</p><p class="obj-txt">${inl(f.ANTES)}</p></div>` : '',
    f.INTRO ? `<p class="pintro">${inl(f.INTRO)}</p>` : '',
    pcard({ mente: f.MENTE, coracao: f.CORACAO, corpo: f.CORPO }, resumoHtml),
    f.TENSAO ? `<p class="tension">${inl(f.TENSAO)}</p>` : '',
    facetas.length ? `<p class="rootlab">Veja como cada centro aparece no seu dia a dia</p><div class="facets">${facetas.map((x) => { const fk = facetKey(x.k); return `<div class="facet"><span class="fk ${fk.cls}">${esc(fk.disp)}</span><span class="fv">${inl(x.v)}</span></div>` }).join('')}</div>` : '',
    roots ? `<p class="rootlab">A mesma raiz, dois lados</p><div class="roots">${roots}</div>` : '',
    f.MALENTENDIDO ? `<p class="rootlab">O mal-entendido sobre você</p><p class="block-serif">${inl(f.MALENTENDIDO)}</p>` : '',
    f.APERTA ? `<p class="rootlab">Quando aperta, você vira…</p><div class="stresswrap"><p class="block-serif">${inl(f.APERTA)}</p></div>` : '',
    (acende.length || apaga.length) ? `<p class="rootlab">O que te acende &nbsp;·&nbsp; o que te apaga</p><div class="drains"><div class="drain up"><h4>Te acende</h4><ul>${acende.map((x) => `<li>${inl(x)}</li>`).join('')}</ul></div><div class="drain down"><h4>Te apaga</h4><ul>${apaga.map((x) => `<li>${inl(x)}</li>`).join('')}</ul></div></div>` : '',
    f.FECHO ? `<p class="tension">${inl(f.FECHO)}</p>` : '',
  ].filter(Boolean).join('\n')
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
  return `<p class="snote">${inl(intro)}</p><div class="rail-wrap"><div class="rail" style="grid-template-columns:repeat(${Math.max(marcos.length, 1)},1fr)"><div class="rail-line"></div>${rail}</div></div>${moments}`
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
// CONTRATO @PENDULO (decisão founder 2026-07-26): o Sonnet ESCOLHE a formulação de cada
// antídoto (encaixe fino na pessoa e na intensidade) e o render VALIDA contra o eixo.
// Escolha dentro do eixo → vale. Inventou → cai no rótulo canônico e sai no log.
// Assim inventar deixa de ser POSSÍVEL, em vez de ser só proibido no papel.
const nrm = (s = '') => s.replace(/[*_`"]/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
function escolhasPendulo(body) {
  const ok = {}, fora = []
  for (const m of body.matchAll(/^@PENDULO:?\s*(.+?)\s*::\s*(.+?)\s*$/gm)) {
    const [, alvoRaw, escolha] = m
    const hit = r.mapaCarga.find(([e]) => nrm(e) === nrm(alvoRaw) || nrm(e).includes(nrm(alvoRaw)) || nrm(alvoRaw).includes(nrm(e)))
    if (!hit) { fora.push(`${alvoRaw} → emoção não está no mapa desta pessoa`); continue }
    const a = r.antidoto?.[hit[0]]
    // aceita a forma do cliente, o texto cru da canônica E a própria explicação do eixo
    const leque = a ? [a.principal, a.oque, ...(a.pool || []), ...(a.poolChaves || [])].filter(Boolean) : []
    // o Sonnet costuma prefixar o nome do eixo ("Sossego — a cabeça organiza"). É acerto
    // de conteúdo com desvio de formato: tira o prefixo antes de validar, não rejeita.
    const i = escolha.indexOf(' — ')
    const limpo = i > 0 ? escolha.slice(i + 3) : escolha
    const casa = leque.find((p) => nrm(p) === nrm(escolha) || nrm(p) === nrm(limpo))
    if (casa) ok[hit[0]] = casa
    else fora.push(`${alvoRaw} :: "${escolha}" → fora do eixo ${a?.eixo || '?'}`)
  }
  if (fora.length) console.log(`   ⚠️ @PENDULO rejeitado (caiu no rótulo do eixo):\n${fora.map((x) => '      · ' + x).join('\n')}`)
  return ok
}

function block5(body) {
  const f = fields(body)
  const escolha = escolhasPendulo(body)
  const carga = r.mapaCarga.slice(0, 9).map(([e, s]) => {
    const p = pendData(e)
    const a0 = r.antidoto?.[e]
    // A ESCOLHA DO SONNET VAI PRA BARRA (decisão founder: três cargas no mesmo eixo têm
    // que mostrar as três saídas, não a mesma palavra 3x). Isso só é possível porque as
    // formulações passaram pela auditoria e hoje estão no registro do cliente — antes
    // eram texto cru da canônica e quebravam a barra. O EIXO a que ela pertence continua
    // visível, na descrição.
    if (escolha[e]) { p.anti = cap(escolha[e].replace(/"/g, '')); p.antiEixo = a0?.principal; p.antiDesc = a0?.oque || '' }
    const bits = []
    if (p.desc) bits.push(`<b>${esc(p.lab)}</b>: ${esc(p.desc)}`)
    // sem descrição curada, o antídoto entra sozinho como "A saída" (não fica linha vazia)
    if (p.antiDesc) bits.push(p.antiEixo ? `<b class="anti">A saída</b>: ${esc(p.antiDesc)}` : `<b class="anti">${esc(p.anti)}</b>: ${esc(p.antiDesc)}`)
    const desc = bits.length ? `<p class="pend-desc">${bits.join(' &nbsp;·&nbsp; ')}</p>` : ''
    return `<div class="pend"><div class="pend-labels"><span class="pl-carga">${esc(p.lab)} <span class="lv">${nivel(s)}</span></span><span class="pl-anti">${esc(p.anti)}</span></div><div class="pend-track"><i class="needle" style="left:${leftCarga(s)}%"></i></div>${desc}</div>`
  }).join('')
  // DEDUPE por EIXO: duas entradas distintas da canônica podem cair no mesmo eixo e,
  // desde que o rótulo passou a vir do eixo, imprimiam a MESMA linha duas vezes
  // (bug real: "Inflexibilidade / rigidez → Flexibilidade" 2x). Fica a de maior score.
  const vistoEixo = new Set()
  const recUnico = r.mapaRecurso.filter(([e]) => {
    const k = eixoDe(e)?.eixo || e
    if (vistoEixo.has(k)) return false
    vistoEixo.add(k); return true
  })
  const rec = recUnico.slice(0, 5).map(([e, s], i) => {
    const p = recData(e)
    const desc = p.desc ? `<p class="pend-desc"><b class="anti">${esc(p.lab)}</b>: ${esc(p.desc)}</p>` : ''
    return `<div class="pend"><div class="pend-labels"><span class="pl-shadow">${esc(p.shadow)}</span><span class="pl-resource">${esc(p.lab)} <span class="lv">${s >= 2 ? 'vital' : 'livre'}</span></span></div><div class="pend-track"><i class="needle free" style="left:${50 + bipRecurso(s)}%"></i></div>${desc}</div>`
  }).join('')
  return `${f.LEAD ? `<p class="lead">${inl(f.LEAD)}</p>` : ''}
    <div class="legend"><span>● <b>Bolinha</b> = onde você está</span><span><b style="color:var(--amber)">Esquerda</b> = carregado</span><span><b style="color:var(--good)">Direita</b> = a saída</span></div>
    <p class="grouplab carga"><span class="gd"></span>O que pesa hoje</p>${carga}
    <p class="grouplab livre"><span class="gd"></span>O que está leve — a sua força</p>${rec}
    ${f.REMEDIO ? `<div class="medicine"><p class="med-lab">O que já está livre é o seu remédio</p><p>${inl(f.REMEDIO)}</p></div>` : ''}`
}

// ---------- BLOCO 6 — guia de condução (determinístico, do proto aprovado) ----------
function block6() { return B6HTML }

// ---------- monta ----------
const NUMS = ['1', '2', '3', '4', '5', '6']
const H2 = ['Em poucas palavras', 'Mente, coração e corpo — a sua mistura', 'O que cada tempo deixou em você', 'O que talvez não tenha começado em você', 'Onde você está — e pra onde dá pra ir', 'Perguntas para a sua sessão']
const blocks = MD.split(/^# /m).filter((b) => b.trim())
const sections = blocks.map((b, i) => {
  const nl = b.indexOf('\n'); const title = b.slice(0, nl).trim(); const body = b.slice(nl + 1)
  const eyebrow = `<p class="eyebrow"><span class="secnum">${NUMS[i] || ''}</span> &nbsp;${esc(title)}</p>`
  const h2 = (i === 0 || i === 5) ? '' : `<h2 class="display">${esc(H2[i] || title)}</h2>`
  let inner
  try {
    inner = i === 0 ? block1(body) : i === 1 ? block2(body) : i === 2 ? block3(body) : i === 3 ? block4(body) : i === 4 ? block5(body) : block6(body)
  } catch (e) { inner = prose(body) + `<!-- render fallback: ${e.message} -->` }
  return `<section class="block" id="b${i + 1}">${eyebrow}${h2}${inner}</section>`
})
// ÍNDICE — gerado aqui, não pelo prompt: o render já sabe os 6 títulos, então não gasta
// token e não corre risco de o Sonnet inventar seção. Entra logo depois do bloco 1.
const toc = `<nav class="toc"><p class="toc-lab">O que vem a seguir</p>${
  H2.map((t, i) => `<a class="toc-row" href="#b${i + 1}"><span class="toc-n">${NUMS[i]}</span><span class="toc-t">${esc(t)}</span></a>`).join('')
}</nav>`
const sectionsHtml = [sections[0] + toc, ...sections.slice(1)].join('\n<hr class="div">\n')

// FECHO — nome, data e natureza do documento. Um doc "pra guardar" não pode terminar
// numa instrução de manejo; precisa fechar como peça.
const DATA = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const fecho = `<div class="colofao">
  <p class="cf-nome">${esc(NOME)}</p>
  <p class="cf-meta">Leitura de ${DATA}</p>
  <p class="cf-marca">IRIS CODEX · Mapa do Ser</p>
  <p class="cf-nota">Este documento é uma leitura de emoções e comportamentos. Não é diagnóstico, não substitui acompanhamento de saúde e não prescreve tratamento.</p>
</div>`

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório · ${NOME}</title><style>${STYLE}
.mdul{margin:6px 0 14px 0;padding-left:20px} .mdul li{margin:4px 0} .minih{font-weight:600;margin:16px 0 4px}
.chave{margin:6px 0;padding:8px 14px;border-left:3px solid var(--amber);background:#faf6ee;font-style:italic}
.qfecho{margin:16px 0;font-style:italic;color:var(--ink-soft)}
.sheet .pcard{margin-bottom:18px} .sheet .resumo{margin-bottom:2px} .microfilme p b{color:var(--teal-deep);font-weight:600}
.facet .fk.tenso{color:#b5701a} .facet .fk.livre{color:#2f7a54} .facet .fk.meio{color:#8a7d63}
.respira{text-align:center;font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint,#a99);margin:2px 0 6px}
.pend-desc{font-size:13px;line-height:1.5;color:var(--ink-soft,#6b6357);margin:5px 0 2px} .pend-desc b{color:#a35a1c;font-weight:600} .pend-desc b.anti{color:#2f7a54} .pend{margin-bottom:14px}
.maieutica + .maieutica{margin-top:2px}
/* --- ajustes do founder (2026-07-27) --- */
/* o âmbar da tarja de seção estava pequeno demais pro peso que a marca tem */
/* título de seção em PRETO (decisão founder 2026-07-27): tira o âmbar do rótulo, que
   passava a significar duas coisas — carga emocional E "isto é uma etiqueta". */
.eyebrow{font-size:14px;letter-spacing:.16em;margin:0 0 12px;color:var(--ink)}
.eyebrow .secnum{color:var(--ink)}
.eyebrow .secnum{font-family:Palatino,Georgia,serif;font-size:21px;font-weight:400;letter-spacing:0;vertical-align:-2px;margin-right:2px}
/* MAIS AR entre as seções — estava tudo colado */
section.block{margin:0} hr.div{margin:64px 0 60px;border:0;border-top:1px solid var(--line)}
section.block > h2.display{margin-top:6px;margin-bottom:22px}
/* índice */
.toc{margin:52px 0 4px;padding:22px 26px;background:#f7f3ea;border:1px solid var(--line);border-radius:10px}
.toc-lab{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint,#a99a87);font-weight:700;margin:0 0 12px}
.toc-row{display:flex;align-items:baseline;gap:14px;padding:7px 0;text-decoration:none;color:inherit;border-bottom:1px solid rgba(0,0,0,.05)}
.toc-row:last-child{border-bottom:0}
.toc-n{font-family:Palatino,Georgia,serif;font-size:17px;color:var(--amber);min-width:16px}
.toc-t{font-family:Palatino,Georgia,serif;font-size:16.5px;line-height:1.35}
.toc-row:hover .toc-t{color:var(--teal-deep)}
${B6CSS}
/* --- fecho --- */
.colofao{margin-top:64px;padding-top:26px;border-top:1px solid var(--line);text-align:center}
.cf-nome{font-family:Palatino,Georgia,serif;font-size:19px;margin:0 0 2px}
.cf-meta{font-size:13px;color:var(--ink-soft,#6b6357);margin:0 0 16px}
.cf-marca{font-size:11px;letter-spacing:.2em;color:var(--teal-deep);font-weight:700;margin:0 0 14px}
.cf-nota{font-size:11.5px;line-height:1.6;color:var(--ink-faint,#a99a87);max-width:52ch;margin:0 auto}
/* --- IMPRESSÃO: o documento é pra imprimir e guardar. Sem isto, os cards partem
   no meio entre páginas — invisível na tela, fatal no papel. --- */
@media print{
  @page{margin:16mm 14mm}
  body{background:#fff;padding:0}
  .sheet{max-width:none;margin:0;border:0;border-radius:0;box-shadow:none}
  .pcard,.moment,.saybox,.step,.root,.gen,.toc,.pend,.objbox,.stresswrap,.resil,.medicine,
  .maieutica,.chave,.qsec,.idrow,.facet,.colofao{break-inside:avoid;page-break-inside:avoid}
  section.block{break-inside:auto}
  h2.display,.eyebrow{break-after:avoid;page-break-after:avoid}
  hr.div{margin:34px 0 30px}
  .toc-row{border-bottom-color:#ddd}
  a{color:inherit;text-decoration:none}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style></head><body>
<div class="sheet"><div class="pad">
  <div class="brand">IRIS CODEX</div>
  <div class="brand-sub">Mapa do Ser · ${NOME}</div>
  ${sectionsHtml}
  ${fecho}
</div></div>
</body></html>`
writeFileSync(`apps/web/_motor-lab/out/novo-${name}.html`, html)
console.log(`→ out/novo-${name}.html (${html.length} chars · agulhas M${AG.mente}/C${AG.coracao}/Corpo${AG.corpo})`)
