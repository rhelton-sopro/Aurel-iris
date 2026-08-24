#!/usr/bin/env node
// RENDERIZADOR do relatório NOVO no estilo do MOCKUP aprovado (v2 — designs fiéis).
// Reusa o <style> do mockup; desenha agulhas/pêndulos dos NÚMEROS do motor;
// blocos 3 e 4 leem o formato ESTRUTURADO (@MARCO / @CAMPOS) do prompt.
// uso: node apps/web/_motor-lab/render-novo.mjs [self|daniel|miguel]
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
// BASE resolvida em RUNTIME (ver lab-dir.mjs) — NÃO usar import.meta.url: o webpack o
// congela no caminho da máquina de build e isso dá ENOENT em produção. Aqui doía dobrado,
// porque os readFileSync abaixo rodam no TOPO do módulo: derrubavam a página e o PDF
// já no carregamento, antes de qualquer request chegar ao handler.
import { LAB_DIR } from './lab-dir.mjs'
import { parseLastro, calc, eixoDe, displayDe, EIXOS, BASELINE_LIVRE, nivelDe, leftCarga, CORTES, PISO_CARGA } from './motor-calc.mjs'
import { METODO7, CONDUCT } from './metodo7.mjs'
import { familiaDe as famDe, oqueCargaDe } from './motor-calc.mjs'

const MOCK = readFileSync(path.join(LAB_DIR, 'relatorio-novo/relatorio-completo.html'), 'utf8')
const STYLE = MOCK.slice(MOCK.indexOf('<style>') + 7, MOCK.indexOf('</style>'))
const PROTO6 = readFileSync(path.join(LAB_DIR, 'relatorio-novo/b6-terapeuta-proto.html'), 'utf8')
const PROTO6_STYLE = PROTO6.slice(PROTO6.indexOf('<style>') + 7, PROTO6.indexOf('</style>'))
const B6CSS = ':root{--gold:#9a6a12;--amber-soft:#d69a4e;}\n' + PROTO6_STYLE.slice(PROTO6_STYLE.indexOf('.method-sub{'))
const B6HTML = PROTO6.slice(PROTO6.indexOf('<p class="method-sub">'), PROTO6.indexOf('</p>', PROTO6.indexOf('<p class="closing">')) + 4)

// ---------- RENDER como FUNÇÃO (produção) ----------
// Era um script (process.argv + writeFileSync). Virou função pra a rota do app poder
// renderizar o mesmo HTML sem passar por arquivo. O CLI do lab continua funcionando —
// ele só chama a função e grava. UM render, dois consumidores.
//   md    = markdown estruturado do Stage 2 emocional
//   exame = objeto do Stage 1 (produção) ou nome do exame (lab)
//   nome  = nome da pessoa, para o vocativo
//   opts  = { blocos } — OPCIONAL. Lista 1-based dos blocos que entram no documento
//           (ex.: [1,2,3,4,5,6] = versão do cliente sem o guia de sessão). Omitido =
//           todos, então lab e Mapa do Ser completo seguem byte a byte idênticos.
//           A numeração e as âncoras NÃO são recalculadas: o bloco 5 continua sendo
//           b5 mesmo se o 3 sair — link velho não passa a apontar pro bloco errado.
// Títulos dos 7 blocos. Moraram dentro de renderHTML até 2026-07-30; subiram para o
// escopo do módulo quando a barra de progresso da geração passou a precisar deles —
// a alternativa era uma segunda lista em lib/, e lista duplicada vira deriva (foi
// assim que o método de 7 movimentos ficou 7 dias aprovado sem chegar ao prompt).
// ⭐ 8 BLOCOS desde 2026-08-03: "Repertório de suporte" entrou como 7 e empurrou
// "Perguntas para a sua sessão" para 8 (decisão do founder).
// ⚠️ O MARKDOWN continua com 7 blocos — o Sonnet NÃO escreve o repertório. Ele é montado
// inteiro pelo render a partir do motor (lista determinística + moldura fixa), do mesmo
// jeito que as crenças. Duas consequências boas: leituras JÁ GERADAS ganham o bloco sem
// regerar, e não há como o modelo inventar carência.
// ⇒ índice do markdown (0..6) ≠ índice de exibição (0..7). Ver `diDe()` mais abaixo.
export const NUMS_BLOCOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
export const IDX_SUPORTE = 6 // posição de exibição do repertório
export const IDX_INTEG = 7  // posição de exibição das sugestões integrativas
export const TITULOS_BLOCOS = [
  'Em poucas palavras',
  'Mente, coração e corpo — a sua mistura',
  'O que cada tempo deixou em você',
  'O que talvez não tenha começado em você',
  // 2026-08-02 — era "Onde você está — e pra onde dá pra ir". ESTE título era o alvo real
  // da crítica do founder em 31/07 ("tá lá, 5, mapa emocional, onde você está? não acho
  // legal; 'onde' remete a estado") — eu tinha entendido que era a legendinha do gráfico,
  // troquei só ela, e a frase seguiu no H2, em corpo muito maior. Agora usa o mesmo
  // vocabulário aprovado da legenda: pesa / afrouxa.
  'O que pesa — e pra onde afrouxa',
  'As regras que você repete sem perceber',
  'Repertório de suporte',
  'Sugestões integrativas',
  'Perguntas para a sua sessão',
]

// Padrões de TÍTULO para tirar um bloco da versão do cliente, indexados pela posição de
// EXIBIÇÃO (0..8). Fonte única de quem-é-quem no filtro — a UI manda índices, o servidor
// converte aqui, e o casamento continua sendo por TÍTULO.
//
// ⚠️ Os seis primeiros casam com o título que o Sonnet escreve no MARKDOWN, que NÃO é o
// H2 de exibição ("Como você funciona por dentro" é exibido como "Mente, coração e corpo
// — a sua mistura"). Já 6 e 7 são os blocos que o render monta sozinho: não há markdown,
// então casam com o título de exibição.
//
// ⛔ Por que não filtrar por posição: documento com bloco faltando acontece de verdade
// (`out/novo-s5novo` saiu sem "Crenças"), e aí um filtro posicional entregaria o guia de
// sessão ao cliente exatamente no documento defeituoso. Prefixo curto porque o custo de
// errar por acento é maior que o de casar demais — nenhum prefixo colide com outro.
export const OMITIR_RX_POR_BLOCO = [
  '^em poucas palavras',
  '^como voc',
  '^linha do tempo',
  '^heran',
  '^mapa emocional',
  '^cren',
  '^repert', // montado pelo render
  '^sugest', // montado pelo render
  '^perguntas para a sua sess',
]
// markdown (0..6) → exibição (0..7): tudo a partir de "Perguntas" desloca um.
// markdown (0..6) → exibição (0..8): os DOIS blocos montados pelo render entram antes de
// "Perguntas", então tudo a partir dele desloca DOIS.
const diDe = (i) => (i < IDX_SUPORTE ? i : i + 2)

export function renderHTML(md, exame, nome, opts = {}) {
  const MD = md
  const NOME = nome || 'você'

// ---------- BLOCO 6 determinístico: reusa o guia de condução aprovado (proto) ----------
// O bloco 6 é um MÉTODO fixo (7 movimentos), então não passa pelo Sonnet — o render
// injeta o proto aprovado + o CSS dele. (self = proto atual; daniel/miguel = parametrizar depois.)

// ---------- números do motor ----------
const α = BASELINE_LIVRE
const lastro = parseLastro()
// `exame` vai DIRETO pro motor: o calc já aceita objeto (produção, vindo de
// report_findings.exame_json) ou nome (lab, que lê _exame-<nome>.json). Antes daqui saía
// um `name` derivado que virava a string literal 'exame' quando o argumento era objeto —
// o motor então procurava _exame-exame.json e estourava ENOENT. Só quebrava em produção:
// o lab passa string e sempre funcionou, então o refactor byte-a-byte não pegou.
const r = calc(exame, lastro)
const agu = (c) => Math.round(((r.centro[c].l + α) / (r.centro[c].t + r.centro[c].l + 2 * α)) * 100)
const AG = { mente: agu('mente'), coracao: agu('coracao'), corpo: agu('corpo') }
// CORROBORADA = 2+ achados na mesma família. Desde 2026-08-13 ela **não rebaixa mais o
// rótulo**: vira a marca ⊕ ao lado, como já é feito nas crenças. Medida é medida.
const convDe = (e) => (r.famN?.[famDe(e)] || 1) >= 2
// régua BIPOLAR −50 (totalmente carregado) ⟷ 0 (neutro) ⟷ +50 (antídoto/livre),
// mesmo modelo dos 3 centros. carga = negativo · recurso = positivo. track% = 50 + bip.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
// ⚠️ `nivel`, `bipCarga` e `leftCarga` vêm do motor-calc — FONTE ÚNICA (ver o bloco
// "ESCALA NORMALIZADA DA CARGA" lá). A curva saturante e o freio por convergência que
// moravam aqui saíram em 2026-08-13: a escala agora é normalizada (100% = um achado I5
// sozinho) e LINEAR, que é o que permite cravar a marca de cada faixa na barra.
// ⛔ Não recriar cópia local: a divergência entre as cópias era o defeito.
const nivel = (s) => nivelDe(s)
const bipRecurso = (s) => clamp(Math.round(9 * s + 12), 24, 48)
// ⛔ MARCAS DE FAIXA NA BARRA — TESTADAS E REPROVADAS (founder, 2026-08-13):
// "ficou uns tracinhos na régua, não ficou legal não... a gente não precisa colocar".
// Eram os limites 45/70/90 da escala cravados na barra (31,9% · 25,1% · 19,7%). A intenção
// era responder "deu 3, caiu em qual faixa?" no próprio desenho; o custo visual não pagou —
// traço vertical sobre a barra de gradiente suja o objeto mais bonito do relatório.
// A faixa continua dita em PALAVRA ao lado do rótulo, que é onde ela já funcionava.
// Se um dia voltar, que seja como entalhe curto na borda, nunca linha atravessando.
const MARCAS = [CORTES.media, CORTES.alta, CORTES.muitoAlta].map((n) => 50 + Math.max(-48, -(PISO_CARGA + 27 * n)))
void MARCAS // mantido só como registro dos pontos exatos, caso o desenho seja retomado
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
// RÓTULO DO CLIENTE de uma emoção de carga — régua ÚNICA, usada pelo bloco 5 (pêndulos)
// e pelo bloco 7 (cabeçalho dos Caminhos). Ordem: override do eixo (`chave :: rótulo`) >
// dicionário curado (PEND) > limpeza (short).
// ⚠️ Existe como função porque o bloco 7 monta o cabeçalho a partir do `nome=` ESCRITO
// PELO SONNET, e ele às vezes copia a CHAVE CRUA da canônica em vez do rótulo — caso real
// 2026-07-31, leitura c3841fbf: saiu `irritação que "sobe" do visceral ao mental` no lugar
// de `Irritação que sobe`. Passando pela mesma régua do bloco 5, a chave crua vira o
// rótulo limpo por REGRA (decisão founder), sem depender de o modelo obedecer o prompt.
function rotuloCarga(e) {
  if (!e) return e
  const dsp = displayDe(e)
  if (dsp) return cap(dsp)
  if (PEND[e]) return PEND[e][0]
  return short(e)
}
function pendData(e) {
  const a = r.antidoto?.[e]
  const anti = a ? { anti: a.principal, antiDesc: a.oque || '' } : { anti: '—', antiDesc: '' }
  // o "o que é" vem da TABELA (vale pras 30 que aparecem), com o dicionário antigo
  // como reserva. Antes só 13 emoções tinham explicação e o resto do mapa mostrava a
  // saída sem dizer o que estava pesando.
  const oq = oqueCargaDe(e)
  if (PEND[e]) return { lab: rotuloCarga(e), desc: oq || PEND[e][1], ...anti }
  return { lab: rotuloCarga(e), desc: oq || '', ...anti }
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
    // Chaves também no 'proc' (decisão founder): o que está em reorganização é onde a
    // pergunta ainda tem o que abrir. A nota de reorganização continua, antes das chaves.
    const procNota = m.status === 'proc' ? `<p class="mnote">Ainda em reorganização — não é ferida aberta, mas também não fechou de todo. Está se integrando.</p>` : ''
    const keys = procNota + ((m.status === 'ativo' || m.status === 'proc') && m.abre ? `<div class="keys"><p class="keys-lab">Chaves do tempo</p><div class="key"><span class="kind abre">Abre o estado</span><span class="q">${inl(m.abre)}</span></div>${m.resolucao ? `<div class="key"><span class="kind res">Resolução</span><span class="q">${inl(m.resolucao)}</span></div>` : ''}</div>` : '')
    const cls = m.status === 'ativo' ? 'on' : m.status === 'proc' ? 'proc' : ''
    return `<div class="moment ${cls}"><div class="moment-h"><span class="mage display">${esc(m.idade)}</span><span class="${m.status === 'ativo' ? 'mflag' : 'mproc'}">${flag(m.status)}</span></div>${rows}${keys}</div>`
  }).join('')
  // LEGENDA dos três estados (founder, 2026-08-20): o relatório mostrava "ainda ativo",
  // "em processo" e "fechado" sem dizer o que cada um significa — só o 'proc' tinha explicação,
  // e ela vinha solta no meio do texto. A legenda fica logo abaixo do trilho, onde o leitor
  // encontra os três rótulos pela primeira vez.
  // ⚠️ Só lista os estados que ESTA leitura tem — legenda de coisa que não aparece é ruído.
  const stats = new Set(marcos.map((m) => m.status))
  const GLOSSA = [
    ['ativo', 'ainda ativo', 'pede atenção hoje — é por onde a leitura sugere começar'],
    ['proc', 'em processo', 'já está se movendo: não é ferida aberta, mas também não fechou de todo'],
    ['fechado', 'fechado', 'a marca ficou, o peso não — é história, não é tarefa'],
  ].filter(([k]) => (k === 'fechado' ? [...stats].some((x) => x !== 'ativo' && x !== 'proc') : stats.has(k)))
  const legenda = GLOSSA.length > 1
    ? `<div class="tl-leg">${GLOSSA.map(([, rot, txt]) => `<p class="tl-leg-i"><span class="tl-leg-k">${rot}</span>${txt}</p>`).join('')}</div>`
    : ''
  return `<p class="snote">${inl(intro)}</p><div class="rail-wrap"><div class="rail" style="grid-template-columns:repeat(${Math.max(marcos.length, 1)},1fr)"><div class="rail-line"></div>${rail}</div></div>${legenda}${moments}`
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
  const gen = `<div class="genfig"><div class="gen"><div class="gen-line"></div>
    <div class="gcol pastcol"><div class="figs"><svg class="tree" viewBox="0 0 232 137" role="img"
    aria-label="Árvore de gerações: pais, avós, bisavós e trisavós">
    <g class="link"><path d="M11.0,14.0V24.0H25.0V14.0"/><path d="M18.0,24.0V34.0"/><path d="M39.0,14.0V24.0H53.0V14.0"/><path d="M46.0,24.0V34.0"/><path d="M67.0,14.0V24.0H81.0V14.0"/><path d="M74.0,24.0V34.0"/><path d="M95.0,14.0V24.0H109.0V14.0"/><path d="M102.0,24.0V34.0"/><path d="M123.0,14.0V24.0H137.0V14.0"/><path d="M130.0,24.0V34.0"/><path d="M151.0,14.0V24.0H165.0V14.0"/><path d="M158.0,24.0V34.0"/><path d="M179.0,14.0V24.0H193.0V14.0"/><path d="M186.0,24.0V34.0"/><path d="M207.0,14.0V24.0H221.0V14.0"/><path d="M214.0,24.0V34.0"/><path d="M18.0,49.6V59.6H46.0V49.6"/><path d="M32.0,59.6V69.6"/><path d="M74.0,49.6V59.6H102.0V49.6"/><path d="M88.0,59.6V69.6"/><path d="M130.0,49.6V59.6H158.0V49.6"/><path d="M144.0,59.6V69.6"/><path d="M186.0,49.6V59.6H214.0V49.6"/><path d="M200.0,59.6V69.6"/><path d="M32.0,89.4V99.4H88.0V89.4"/><path d="M60.0,99.4V109.4"/><path d="M144.0,89.4V99.4H200.0V89.4"/><path d="M172.0,99.4V109.4"/></g><g class="t-tri"><use href="#g-adulto" x="6.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="20.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="34.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="48.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="62.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="76.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="90.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="104.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="118.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="132.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="146.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="160.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="174.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="188.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="202.0" y="2.0" width="10" height="12.0"/><use href="#g-adulto" x="216.0" y="2.0" width="10" height="12.0"/></g><g class="t-bis"><use href="#g-adulto" x="11.5" y="34.0" width="13" height="15.6"/><use href="#g-adulto" x="39.5" y="34.0" width="13" height="15.6"/><use href="#g-adulto" x="67.5" y="34.0" width="13" height="15.6"/><use href="#g-adulto" x="95.5" y="34.0" width="13" height="15.6"/><use href="#g-adulto" x="123.5" y="34.0" width="13" height="15.6"/><use href="#g-adulto" x="151.5" y="34.0" width="13" height="15.6"/><use href="#g-adulto" x="179.5" y="34.0" width="13" height="15.6"/><use href="#g-adulto" x="207.5" y="34.0" width="13" height="15.6"/></g><g class="t-avo"><use href="#g-adulto" x="23.8" y="69.6" width="16.5" height="19.8"/><use href="#g-adulto" x="79.8" y="69.6" width="16.5" height="19.8"/><use href="#g-adulto" x="135.8" y="69.6" width="16.5" height="19.8"/><use href="#g-adulto" x="191.8" y="69.6" width="16.5" height="19.8"/></g><g class="t-pai"><use href="#g-adulto" x="49.5" y="109.4" width="21" height="25.2"/><use href="#g-adulto" x="161.5" y="109.4" width="21" height="25.2"/></g></svg></div><div class="glabel">O que veio de trás</div><div class="gcontent">${chips}</div></div>
    <div class="gcol"><div class="figs"><div class="tier t-you"><div class="you-wrap"><svg class="fg " width="30" height="36.0" viewBox="0 0 20 24"><use href="#g-adulto"/></svg></div></div></div><div class="glabel you">Em você — e só aqui muda</div><div class="gcontent"><p class="gtext">${inl(g('VOCE'))}</p></div></div>
    <div class="gcol"><div class="figs"><svg class="tree tree-dep" viewBox="0 0 232 42" role="img"
    aria-label="Quem vem depois: duas crianças descendo de você">
    <g class="link"><path d="M88,14V6H144V14"/><path d="M116,6V1"/></g>
    <g class="t-dep"><use href="#g-crianca" x="77.0" y="14" width="22" height="26.4" class=""/><use href="#g-crianca" x="133.0" y="14" width="22" height="26.4" class="far"/></g></svg></div><div class="glabel">Quem você liberta</div><div class="gcontent"><p class="gtext">${inl(g('DEPOIS'))}</p></div></div></div></div>`
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
    // aceita igualdade OU quando a escolha CONTÉM a formulação do eixo. O modelo nunca
    // inventou conteúdo — ele ACRESCENTA palavras (6 quedas seguidas, sempre assim).
    // Exigir igualdade exata rejeitava acerto de conteúdo por desvio de forma.
    const bate = (p, x) => nrm(p) === nrm(x) || (nrm(p).length > 8 && nrm(x).includes(nrm(p)))
    const casa = leque.find((p) => bate(p, escolha) || bate(p, limpo))
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
    // ⛔ MARCA ⊕ NO PÊNDULO — TESTADA E REPROVADA no mesmo dia em que nasceu (founder,
    // 2026-08-13): "tem um desenhozinho depois de cada palavra, também não ficou legal".
    // Ela dizia que 2+ achados independentes apontam pra mesma emoção. A informação NÃO se
    // perdeu: continua no bloco B do prompt (`serialize.mjs`), que é quem precisa dela pra
    // dosar a força do texto. O cliente não precisa ver metodologia no gráfico.
    // ⚠️ Só o pêndulo perdeu o símbolo — as CRENÇAS seguem com o ⊕ delas, que é anterior
    // a isto e nunca foi questionado. Não mexer lá sem pedir.
    const corr = ''
    void convDe
    return `<div class="pend"><div class="pend-labels"><span class="pl-carga">${esc(p.lab)} <span class="lv">${nivel(s)}${corr}</span></span><span class="pl-anti">${esc(p.anti)}</span></div><div class="pend-track"><i class="needle" style="left:${leftCarga(s)}%"></i></div>${desc}</div>`
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
    <!-- LEGENDA (decisão founder 2026-07-31): "onde você está" SAIU. "Onde" remete a
         ESTADO/lugar, e emoção não é lugar onde a pessoa mora — o cliente lia a bolinha
         como veredito de identidade. Agora a bolinha mede o PESO DE HOJE (passageiro) e o
         lado direito é "pra onde afrouxa" — direção, não destino, o que também casa com a
         regra de que o antídoto NÃO é força presente. ⛔ Só a terminologia mudou: o
         modelo bipolar, os pares carga⟷antídoto e o desenho continuam iguais. -->
    <div class="legend"><span><i class="gl"></i> <b>Bolinha</b> = quanto isso pesa hoje</span><span><b style="color:var(--amber)">Esquerda</b> = mais peso</span><span><b style="color:var(--good)">Direita</b> = pra onde afrouxa</span></div>
    <p class="grouplab carga"><span class="gd"></span>O que pesa hoje</p>${carga}
    <p class="grouplab livre"><span class="gd"></span>O que está leve — a sua força</p>${rec}
    ${f.REMEDIO ? `<div class="medicine"><p class="med-lab">O que já está livre é o seu remédio</p><p>${inl(f.REMEDIO)}</p></div>` : ''}`
}

// ---------- BLOCO 6 — guia de condução (determinístico, do proto aprovado) ----------
// BLOCO 6 — crenças. A LISTA vem do motor (determinística); o Sonnet só escreve
// @LEAD e @FECHO. Régua ABSOLUTA em 4 degraus — crença não tem polo oposto.
function block6(body) {
  const f = fields(body)
  const linhas = (r.crencaList || []).map((c) => {
    // 4 degraus REAIS. A força vai de 1 a 5 (fraca ocupa 1 e 2), então multiplicar por
    // 25 dava 125% na banda mais alta — estourava e ficava igual a "forte" na tela.
    const pct = { 1: 22, 2: 22, 3: 48, 4: 74, 5: 100 }[c.forca] || 22
    return `<div class="cren"><div class="cren-h"><span class="cren-txt">${esc(c.texto)}</span><span class="cren-lv f${c.forca}">${esc(c.nivel)}${c.corroborada ? '<i class="cren-corr" title="aparece em mais de um achado">⊕</i>' : ''}</span></div><div class="cren-track"><i class="cren-fill f${c.forca}" style="width:${pct}%"></i><i class="cren-dot f${c.forca}" style="left:${pct}%"></i></div></div>`
  }).join('')
  return `${f.LEAD ? `<p class="lead">${inl(f.LEAD)}</p>` : ''}
    <div class="crenlist">${linhas}</div>
    ${f.FECHO ? `<p class="deep">${inl(f.FECHO)}</p>` : ''}`
}
// BLOCO 7 — os 7 MOVIMENTOS do método (proto aprovado). O ESQUELETO é fixo e vem de
// metodo7.mjs; as FALAS ancoradas (movimentos 2, 3, 5, 6 e o micro-passo do 7) vêm do
// Sonnet. O método é igual pra todo mundo; a fala é da pessoa. Isso existia aprovado
// desde 21/07 num HTML e nunca tinha sido ligado — o bloco saía com 5 tempos rasos.

// ---------- BLOCO 8 — SUGESTÕES INTEGRATIVAS (100% determinístico) ----------
// Lastro: `lastro/tabela-integrativas-LASTRO.md`. Motor: `r.integrativas`.
// ⛔ QUEM LÊ O QUÊ (decisão do founder 2026-08-03): fitoterapia e adaptógenos NÃO vão ao
// cliente — erva tem interação farmacológica real (ashwagandha × medicação de tireoide).
// O sinalizador é o mesmo do guia de sessão: se "Perguntas para a sua sessão" foi omitido,
// é a versão do cliente.
// ⛔ Categoria sem lastro nesta leitura não sai — nem com título.
const H2_INTEG = 'Pequenas mudanças que cabem no seu dia'
const INTEG_LEAD = 'Caminhos que a leitura sugere experimentar. <b>Nada aqui é receita nem tratamento</b> — são possibilidades para você escolher, no seu ritmo, com quem acompanha a sua saúde.'
// 2026-08-03: a nota mudou junto com o critério. Antes ela dizia que as práticas eram
// "de descida" — o que deixou de ser verdade quando a escolha passou a ser pela emoção:
// em padrão CALMAR sai "Empurrar a parede", que é de soltar, e a nota contradizia a lista.
// O que a trava garante é só isto: nada que ATIVE quem está em alerta.
const FAMILIA_TXT = {
  CALMAR: 'A leitura aponta um corpo em alerta — nada aqui puxa para cima. Escolhidas pela emoção que mais pesa hoje.',
  ATIVAR: 'A leitura aponta queda de energia — aqui o caminho é religar o pulso, sem cobrança. Escolhidas pela emoção que mais pesa hoje.',
  LIBERAR: 'A leitura aponta expressão retida — aqui o caminho é soltar. Escolhidas pela emoção que mais pesa hoje.',
}
function blockIntegrativas(versaoCliente) {
  const I = r.integrativas
  if (!I) return null
  const cat = (titulo, itens, nota) => (itens && itens.length)
    ? `<p class="grouplab carga"><span class="gd"></span>${titulo}</p>${nota ? `<p class="sup-nota">${nota}</p>` : ''}`
      + itens.map((x) => `<div class="int-item"><p class="int-s">${esc(x.sug)}</p><p class="int-d">${esc(x.det)}</p></div>`).join('')
    : ''
  const corpo = [
    cat('Na alimentação', I.nutricao),
    cat('No corpo', I.corporais),
    // Exercícios por FAMÍLIA EMOCIONAL desde 2026-08-03 (antes: 3 fixos por padrão, que
    // davam a mesma lista para 5 de 6 leituras). `contemplativas` fica de rede: leitura sem
    // emoção de carga com exercício no lastro continua recebendo o bloco.
    cat(`Na prática diária · ${I.familia}`, I.exercicios?.length ? I.exercicios : I.contemplativas, FAMILIA_TXT[I.familia] || ''),
    cat('Florais', I.florais, 'Escolhidos pelo que pesa hoje, não pelo órgão.'),
    versaoCliente ? '' : cat('Fitoterapia tradicional', I.fito, 'Para você avaliar.'),
    // ADAPTOGENOS REMOVIDOS (founder, 2026-08-03). Era a unica categoria com interacao
    // farmacologica real, ja restrita ao terapeuta, e entregava UMA linha. O peso
    // regulatorio nao compensava o que acrescentava. A tabela fica no lastro se voltar.
  ].filter(Boolean).join('')
  if (!corpo) return null
  return `<p class="lead">${INTEG_LEAD}</p>${corpo}`
}
// ---------- BLOCO 7 — REPERTÓRIO DE SUPORTE (100% determinístico) ----------
// Lastro: `lastro/tabela-carencias-LASTRO.md`. Motor: `r.suporteList` (ordenado por
// CONVERGÊNCIA — nº de achados independentes que sustentam o nutriente).
//
// ⛔ GUARDRAILS que este código IMPLEMENTA (não são só comentário):
//   · sem dose, frequência, duração ou nome de exame — nada disso existe na tabela;
//   · sem FORMA do nutriente ("magnésio", nunca "magnésio glicinato") — decisão do
//     founder porque este bloco vai ao CLIENTE, e forma específica vira ordem de compra;
//   · nada aparece sem achado que sustente — a lista vem do motor, não de texto;
//   · bloco SOME por inteiro quando não há suporte sustentado (`if (!lista.length)`).
//     Sair curto, ou não sair, é resultado honesto.
const H2_SUPORTE = 'O que vale olhar com quem te acompanha'
const SUPORTE_LEAD = '<b>Não é diagnóstico nem receita</b> — é uma sugestão de investigação, para você levar a quem acompanha a sua saúde, que é quem pode avaliar se faz sentido no seu caso.'
// nota de BASE, separada da moldura (founder, 2026-08-03: "coloque que essas informações são
// com base nas tradições da Medicina Tradicional Chinesa e da Ayurveda, com base nos achados
// iridológicos — além do que já está lá em cima"). Fica UMA vez, no topo, em vez de repetida
// campo a campo, que era o que fazia o bloco virar catálogo.
const SUPORTE_BASE = 'Base: os achados desta leitura de íris, interpretados à luz da nutrição, da <b>Medicina Tradicional Chinesa</b> e do <b>Ayurveda</b>.'
const SUPORTE_FECHO = 'Nada aqui substitui avaliação profissional, e nenhuma dessas áreas deve virar suplemento por conta própria. A leitura aponta onde olhar; quem decide o que fazer é você, com apoio de quem te acompanha.'
function blockSuporte() {
  const lista = (r.suporteList || [])
  if (!lista.length) return null // sem achado que sustente, o bloco não existe
  const conv = lista.filter((s) => s.convergente)
  // ⚠️ TETO nos isolados. Sem ele saíam 8 nutrientes de sinal único junto com 4
  // convergentes — e uma lista longa de "pode ser isso, pode ser aquilo" é o formato que
  // serve pra qualquer pessoa (alarme Forer que as personas já dispararam uma vez).
  // Os convergentes NÃO têm teto: quanto mais achados independentes, mais legítimo.
  const CAP_ISOLADOS = 4
  const isoladosTodos = lista.filter((s) => !s.convergente)
  const isolados = isoladosTodos.slice(0, CAP_ISOLADOS)
  if (isoladosTodos.length > CAP_ISOLADOS) {
    console.log(`   · repertório: ${isoladosTodos.length - CAP_ISOLADOS} suporte(s) de sinal único omitido(s) pelo teto (${isoladosTodos.slice(CAP_ISOLADOS).map((x) => x.nutriente).join(', ')})`)
  }

  const item = (s) => {
    const forca = s.n >= 3 ? 'forte' : s.n === 2 ? 'moderado' : 'isolado'
    const o = s.origem || {}
    return `<div class="sup-item sup-${forca}">
      <div class="sup-h"><span class="sup-n">${esc(cap(s.nutriente))}</span>
</div>
      ${s.porque ? `<p class="sup-p">${esc(s.porque)}</p>` : ''}
      ${s.especificos && s.especificos.length ? `<p class="sup-esp">Nesta leitura, sobretudo ${esc(s.especificos.length > 1 ? s.especificos.slice(0, -1).join(', ') + ' e ' + s.especificos.slice(-1) : s.especificos[0])}.</p>` : ''}
    </div>`
  }
  const grupo = (titulo, itens, nota) => itens.length
    ? `<p class="grouplab carga"><span class="gd"></span>${titulo}</p>
       ${nota ? `<p class="sup-nota">${nota}</p>` : ''}${itens.map(item).join('')}`
    : ''

  // A leitura simbólica é do CAMPO, não do nutriente — vários nutrientes dividem o mesmo
  // campo, então dentro do item ela saía repetida (o mesmo "órgão do impulso" embaixo de
  // complexo B e de magnésio). Sai uma vez só, deduplicada, ordenada por intensidade.
  const vistas = []
  const jaVi = new Set()
  for (const s2 of lista) {
    const o = s2.origem
    if (!o || !o.leitura || jaVi.has(o.leitura)) continue
    jaVi.add(o.leitura); vistas.push(o)
  }
  vistas.sort((a, b) => (b.int || 0) - (a.int || 0))
  // ⚠️ A seção "o que as tradições leem no mesmo lugar" SAIU (founder, 2026-08-03: "essa
  // parte aqui eu não achei necessária"). A atribuição a MTC/Ayurveda passou para o
  // informativo de abertura — uma vez, em vez de repetida campo a campo, que fazia o bloco
  // virar catálogo. Os textos por campo continuam no lastro, prontos, se voltar a fazer falta.
  return `<p class="lead">${SUPORTE_LEAD}</p>
    <p class="sup-base">${SUPORTE_BASE}</p>
    ${grupo('O que a leitura mais sugere', conv, null)}
    ${grupo('O que a leitura sugere de forma pontual', isolados, null)}
    <div class="medicine"><p class="med-lab">Antes de fazer qualquer coisa com isto</p><p>${SUPORTE_FECHO}</p></div>`
}

// ---------- BLOCO 7 — DOIS FORMATOS, de propósito ----------
//
// 24/08: o founder tirou o Método Somático do relatório e pôs no lugar as PERGUNTAS
// ANCORADAS (o §12 do Dossiê). O método foi pra prateleira, não pro lixo.
//
// ⚠️ POR QUE O FORMATO ANTIGO CONTINUA AQUI: o markdown é o que se guarda no banco e o
// HTML é derivado na hora. Os ~30 relatórios já gerados trazem `@CAMINHO` dentro deles.
// Se este render passasse a ler só a lista numerada, todos perderiam o bloco 7 **em
// silêncio** — o pior modo de falha que existe neste projeto. Então o render escolhe o
// leitor pelo que o documento TEM, e os dois convivem. Foi decisão explícita do founder:
// "deixa a versão atual do relatório salva também".
//
// ⛔ Não apagar `block7Metodo` enquanto existir relatório com `@CAMINHO` no banco.
function block7(body) {
  return /^@CAMINHO /m.test(body) ? block7Metodo(body) : block7Perguntas(body)
}

// ---------- formato NOVO (24/08) — perguntas ancoradas em lista numerada ----------
//
// O Sonnet escreve `@PONTE:` + `1. … 2. …`. Aqui não há esqueleto fixo nem injeção do
// sistema: o valor está no texto, e o render só o veste. É o contrário do método, que era
// 80% esqueleto — e é por isso que este bloco agora pode ir para a CLIENTE.
function block7Perguntas(body) {
  const m = body.match(/^@PONTE:[ \t]*([\s\S]*?)(?=\n\s*\d+\.\s|\n@|$)/m)
  const ponte = m ? m[1].trim() : ''
  // `1.` no começo da linha; a pergunta segue até a próxima numerada (aceita quebra de
  // linha no meio, que é o que o modelo faz quando a pergunta é longa).
  const perguntas = [...body.matchAll(/^\s*(\d+)\.[ \t]+([\s\S]*?)(?=\n\s*\d+\.[ \t]|\n@|$)/gm)]
    .map((x) => x[2].trim().replace(/\s*\n\s*/g, ' '))
    .filter(Boolean)
  // Sem nenhuma pergunta reconhecida, devolve a prosa crua em vez de um bloco vazio: o
  // documento defeituoso tem que APARECER, nunca sumir.
  if (!perguntas.length) return prose(body)
  const lis = perguntas
    .map((p, i) => `<li class="qa-item"><span class="qa-n">${i + 1}</span><p>${inl(p)}</p></li>`)
    .join('')
  return (ponte ? `<p class="qa-ponte">${inl(ponte)}</p>` : '') + `<ol class="qa-list">${lis}</ol>`
}

// ---------- formato ANTIGO (até 23/08) — Método Somático de 7 movimentos ----------
// ⛔ NÃO É CÓDIGO MORTO: é o que mantém legíveis os relatórios já entregues. Ver a nota
// em `block7` acima.
function block7Metodo(body) {
  const out = [B6HTML.slice(0, B6HTML.indexOf('<div class="qsec"'))]
  const g1 = (k) => { const m = body.match(new RegExp(`^@${k}:[ \\t]*(.*)`, 'm')); return m ? m[1].trim() : '' }
  const blocos = body.split(/^@CAMINHO /m).slice(1)
  blocos.forEach((c, ci) => {
    const cab = c.split('\n')[0]
    const nome = (cab.match(/nome=(.*)/) || [])[1]?.trim() || ''
    // o lado da CARGA passa pela régua de rótulo do cliente (ver `rotuloCarga`): se o
    // Sonnet copiou a chave crua da canônica, ela vira o rótulo limpo aqui. O lado do
    // ANTÍDOTO não passa — ele já vem do EIXO, que é fonte curada.
    const [cargaRaw, antiTxt] = nome.split('→').map((x) => (x || '').trim())
    const cargaTxt = rotuloCarga(cargaRaw)
    const campo = (k) => (c.match(new RegExp(`^- ${k}:\\s*([\\s\\S]*?)(?=\\n- |\\n@|$)`, 'm')) || [])[1]?.trim() || ''
    const T = (t) => (t || '').replaceAll('{CARGA}', (cargaTxt || '').toLowerCase()).replaceAll('{ANTI}', (antiTxt || '').toLowerCase())
    const sub = campo('sub')
    const steps = METODO7.map((m) => {
      const falas = []
      // ⛔ NÃO emitir `m.labs[k]` aqui: cada texto de `m.fixo` JÁ ABRE com o seu
      // <span class="say-lab">. Somar o rótulo do render imprimia tudo DUAS vezes —
      // "Porta A", "Porta B", "Fechar" e o do movimento 7, ou seja 4 por Caminho, 20 no
      // documento (visto no PDF em 2026-07-31). Pior: o rótulo do render saía como <p>,
      // e dentro de `.say` o seletor `.say p` (serifada 17px itálica) tem especificidade
      // MAIOR que `.say-lab` e vencia — por isso a cópia de cima saía grande e serifada.
      // `m.labs` ficou sem uso; é a mesma informação que já vive dentro do texto fixo.
      if (m.fixo && m.fixo.length) {
        m.fixo.forEach((f) => { falas.push(`<div class="say">${T(f)}</div>`) })
      }
      const slot = m.slot || m.slot7
      if (slot) {
        const v = campo(slot)
        if (v) {
          // Era "Micro-passo" — mudou junto com o s7 (2026-07-29). O movimento 7 deixou de
          // prescrever tarefa e passou a PERGUNTAR ("tem algo hoje que você já pode…?"), então
          // um rótulo que anuncia "passo" contradiz o que vem escrito embaixo dele.
          // <span>, NÃO <p>: dentro de `.say` o seletor `.say p` vence `.say-lab` por
          // especificidade e o rótulo sairia serifado 17px, como os duplicados acima.
          const lab = m.n === 7 ? '<span class="say-lab">O que já dá pra agora</span>' : ''
          // depois da fala ancorada vem a CONTINUAÇÃO FIXA do método (varredura no
          // corpo, dar forma/submodalidades, "tem mais alguma coisa junto?") com as
          // deixas entre elas — sem isso o movimento saía pela metade.
          const cont = (m.depois || []).map((d) => d.pausa
            ? `<p class="pause">${esc(d.t)}</p>` : `<p>${T(d.t)}</p>`).join('')
          falas.push(`<div class="say">${lab}<p>${inl(v)}</p>${cont}</div>`)
        }
      }
      if (!falas.length) return ''
      return `<div class="step ${m.cls}"><span class="n">${m.n}</span><p class="st-name">${esc(T(m.nome))}</p>`
        + `<p class="exp">${T(m.exp)}</p>${falas.join('')}`
        + (m.cue ? `<p class="cue">${T(m.cue)}</p>` : '') + '</div>'
    }).join('')
    // mini-pêndulo do cabeçalho + nota de manejo só no Caminho de MAIOR carga
    const head = `<div class="qhead"><p class="q-eyebrow"><span class="pn">Caminho ${ci + 1} · </span>`
      + `<span class="carga">${esc(cargaTxt)}</span> <span class="arw"></span> <span class="anti">${esc(antiTxt)}</span></p>`
      + (sub ? `<p class="qtitle">${inl(sub)}</p>` : '') + '</div>'
    // ⚠️ CONDUCT JÁ TRAZ o <span class="conduct-lab">⚠ Carga alta</span> dentro dele
    // (metodo7.mjs). A versão anterior somava um span próprio e tentava tirar o do
    // CONDUCT com `.replace(/^⚠ Carga alta/,'')` — que nunca casava, porque a string
    // começa com a TAG, não com o texto. Resultado: o rótulo saía DUAS vezes na tela.
    const nota = ci === 0 && CONDUCT ? `<div class="conduct">${CONDUCT}</div>` : ''
    out.push(`<div class="qsec">${head}${steps}${nota}</div>`)
  })
  const fecho = g1('FECHO'); if (fecho) out.push(`<p class="qfecho">${inl(fecho)}</p>`)
  return out.join('\n')
}

// ---------- monta ----------
const NUMS = NUMS_BLOCOS
const H2 = TITULOS_BLOCOS
const blocks = MD.split(/^# /m).filter((b) => b.trim())

// Filtro da VERSÃO DO CLIENTE (2026-07-30) — por TÍTULO, nunca por posição.
//
// O documento canônico tem 7 blocos ("Crenças a serem trabalhadas" entrou em `90f35f2`,
// 27/07). Mesmo assim o filtro casa pelo TÍTULO, não pelo número: se algum dia faltar um
// bloco, um filtro posicional ("1 a 6") entregaria o guia de sessão ao cliente justamente
// no documento defeituoso — o oposto do que ele existe para impedir. Casar por título
// custa o mesmo e não tem esse modo de falha.
const omitirRx = Array.isArray(opts.omitirTitulos) ? opts.omitirTitulos : null
const tituloDe = (b) => b.slice(0, b.indexOf('\n')).trim()
// 2026-08-03: o filtro passou a valer TAMBÉM para os dois blocos que o render monta
// sozinho (repertório e sugestões integrativas). Antes só os blocos vindos do markdown
// podiam sair — com as caixinhas por entrega, o terapeuta escolhe os nove.
const omitidoTitulo = (t) => !!omitirRx && omitirRx.some((rx) => new RegExp(rx, 'i').test(t))
const omitido = (b) => omitidoTitulo(tituloDe(b))

const sections = blocks.map((b, i) => {
  if (omitido(b)) return null
  const nl = b.indexOf('\n'); const title = b.slice(0, nl).trim(); const body = b.slice(nl + 1)
  const di = diDe(i) // índice de EXIBIÇÃO (o markdown tem 7 blocos; o doc mostra 8)
  const eyebrow = `<p class="eyebrow"><span class="secnum">${NUMS[di] || ''}</span> &nbsp;${esc(title)}</p>`
  const h2 = (i === 0 || i === 6) ? '' : `<h2 class="display">${esc(H2[di] || title)}</h2>`
  let inner
  try {
    inner = i === 0 ? block1(body) : i === 1 ? block2(body) : i === 2 ? block3(body) : i === 3 ? block4(body) : i === 4 ? block5(body) : i === 5 ? block6(body) : block7(body)
  } catch (e) { inner = prose(body) + `<!-- render fallback: ${e.message} -->` }
  return `<section class="block" id="b${di + 1}">${eyebrow}${h2}${inner}</section>`
})
// ÍNDICE — gerado aqui, não pelo prompt: o render já sabe os 6 títulos, então não gasta
// token e não corre risco de o Sonnet inventar seção. Entra logo depois do bloco 1.
// O índice lista os blocos que EXISTEM neste documento. No caminho normal são os 7
// canônicos; a diferença aparece na versão do cliente (que omite o guia de sessão) e
// em documento defeituoso — antes, o índice fixo anunciava uma seção ausente e
// apontava para uma âncora inexistente.
const supHtml = omitidoTitulo(TITULOS_BLOCOS[IDX_SUPORTE]) ? null : blockSuporte()
// versão do cliente = toda geração que passa um filtro de blocos (mesmo vazio). É o que
// mantém a fitoterapia fora do documento do cliente, independente do que ele marcou.
const versaoCliente = !!omitirRx
const intHtml = omitidoTitulo(TITULOS_BLOCOS[IDX_INTEG])
  ? null
  : blockIntegrativas(versaoCliente)
const tocLinhas = blocks.map((b, i) => omitido(b) ? null : { di: diDe(i), t: H2[diDe(i)] || tituloDe(b) }).filter(Boolean)
// o repertório só entra no índice se o bloco existir de fato (pode não haver suporte sustentado)
if (supHtml) tocLinhas.push({ di: IDX_SUPORTE, t: H2[IDX_SUPORTE] })
if (intHtml) tocLinhas.push({ di: IDX_INTEG, t: H2[IDX_INTEG] })
tocLinhas.sort((a, b) => a.di - b.di)
const toc = `<nav class="toc"><p class="toc-lab">O que vem a seguir</p>${
  tocLinhas.map((x) => `<a class="toc-row" href="#b${x.di + 1}"><span class="toc-n">${NUMS[x.di] || x.di + 1}</span><span class="toc-t">${esc(x.t)}</span></a>`).join('')
}</nav>`
// bloco 7 (guia de condução) é método fixo — o render ANEXA, o Sonnet não escreve.
// Assim não depende de quantos blocos vieram do markdown e o modelo para de gastar
// token num bloco que era descartado de qualquer jeito.
//
// O índice entra depois do PRIMEIRO bloco presente — não em `sections[0]` fixo: com
// filtro de blocos aquele índice pode ter saído, e concatenar em null imprimia
// literalmente "null<nav…" no documento do cliente.
// o repertório é montado pelo RENDER (não vem do markdown), então entra aqui, na posição
// de exibição 6 — entre "Crenças" e "Perguntas".
const secSuporte = supHtml
  ? `<section class="block" id="b${IDX_SUPORTE + 1}"><p class="eyebrow"><span class="secnum">${NUMS[IDX_SUPORTE]}</span> &nbsp;${esc(TITULOS_BLOCOS[IDX_SUPORTE])}</p><h2 class="display">${esc(H2_SUPORTE)}</h2>${supHtml}</section>`
  : null
const secInteg = intHtml
  ? `<section class="block" id="b${IDX_INTEG + 1}"><p class="eyebrow"><span class="secnum">${NUMS[IDX_INTEG]}</span> &nbsp;${esc(TITULOS_BLOCOS[IDX_INTEG])}</p><h2 class="display">${esc(H2_INTEG)}</h2>${intHtml}</section>`
  : null
const comSuporte = [...sections]
comSuporte.splice(IDX_SUPORTE, 0, secSuporte, secInteg)
const presentes = comSuporte.filter(Boolean)
const sectionsHtml = presentes.length
  ? [presentes[0] + toc, ...presentes.slice(1)].join('\n<hr class="div">\n')
  : ''

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
/* legenda dos estados da linha do tempo (2026-08-20) — sóbria, no tom do resto */
.tl-leg{margin:12px 0 26px;padding:11px 15px;border-left:2px solid rgba(0,0,0,.10)}
.tl-leg-i{margin:0 0 6px;font-size:13px;line-height:1.55;color:#6b6357}
.tl-leg-i:last-child{margin-bottom:0}
.tl-leg-k{display:inline-block;min-width:96px;font-size:10.5px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:#2b2b2b}
/* perguntas ancoradas (24/08) — o bloco 7 novo. Sem esqueleto: a pergunta E o conteudo,
   entao o desenho so da ar e um numero discreto. Numero fora do fluxo do texto pra a
   pergunta poder respirar em varias linhas sem o numero descer junto. */
.qa-ponte{font-size:14.5px;line-height:1.62;color:var(--ink-soft,#6b6357);margin:0 0 26px;padding-left:15px;border-left:2px solid rgba(0,0,0,.10)}
.qa-list{list-style:none;margin:0;padding:0;counter-reset:qa}
.qa-item{position:relative;padding:0 0 0 40px;margin:0 0 22px;break-inside:avoid;page-break-inside:avoid}
.qa-item:last-child{margin-bottom:0}
.qa-item p{margin:0;font-size:16px;line-height:1.66}
.qa-n{position:absolute;left:0;top:1px;width:26px;text-align:right;font-size:12.5px;font-weight:600;letter-spacing:.04em;color:var(--amber,#a35a1c)}
.pend-desc{font-size:13px;line-height:1.5;color:var(--ink-soft,#6b6357);margin:5px 0 2px} .pend-desc b{color:#a35a1c;font-weight:600} .pend-desc b.anti{color:#2f7a54} .pend{margin-bottom:14px}
/* as regras .tick e .pend-corr sairam em 2026-08-13: marcas de faixa na barra e o simbolo
   depois do nivel foram reprovados pelo founder no mesmo dia em que entraram. Ver o
   comentario no codigo que gera o pendulo. A barra volta a ser so gradiente + agulha. */
.maieutica + .maieutica{margin-top:2px}
/* ===== faixa .gen com pictogramas — escopo .genfig ===== */
.genfig{--h:158px;margin:38px 0 26px;}
/* start = as três áreas de figura têm a MESMA altura, então os pés alinham sozinhos */
.genfig .gen{margin:0;align-items:start;}
/* a linha vira CHÃO: todo mundo pisa no mesmo tempo */
.genfig .gen-line{top:var(--h);bottom:auto;}
.genfig .gcol{padding:0 8px;}
/* padding-bottom = ar entre os pés e a linha · margin-bottom = ar entre a linha e o rótulo */
.genfig .figs{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
  gap:6px;height:var(--h);padding-bottom:15px;margin-bottom:27px;}
.genfig .tier{display:flex;align-items:flex-end;justify-content:center;}
.genfig .fg{display:block;fill:currentColor;}

/* a árvore é UM svg: só assim o ponto médio é exato e as ligações saem retas */
.genfig .tree{display:block;width:100%;max-width:232px;height:auto;margin:0 auto;}
.genfig .tree g[class^="t-"]{fill:currentColor;}
.genfig .link{fill:none;stroke:var(--line-strong);stroke-width:.8;opacity:.5;}
.genfig .tree-dep{max-width:232px;}
.genfig .t-dep .far{opacity:.42;}

/* profundidade geracional: quanto mais longe, menor e mais claro (4 degraus) */
.genfig .t-tri{color:var(--ink-faint);opacity:.40;gap:3px;}
.genfig .t-bis{color:var(--ink-faint);opacity:.58;gap:5px;}
.genfig .t-avo{color:var(--ink-faint);opacity:.80;gap:7px;}
/* com todas as fileiras na mesma largura, a profundidade passa a depender SÓ de
   tamanho+tinta — por isso os pais escurecem até --ink (o degrau mais próximo). */
.genfig .t-pai{color:var(--ink);gap:10px;}

/* VOCÊ — uma só, mas a de maior contraste: peso por CONTRASTE, não por contagem */
.genfig .you-wrap{display:grid;place-items:center;width:62px;height:62px;border-radius:50%;
  background:color-mix(in srgb,var(--amber) 13%,var(--paper));
  box-shadow:0 0 0 5px color-mix(in srgb,var(--amber) 11%,transparent);}
.genfig .t-you{color:var(--amber);}

/* DEPOIS — criança, e uma segunda menor atrás: "gerações", não uma pessoa */
.genfig .t-dep{color:var(--teal);gap:8px;align-items:flex-end;}
.genfig .t-dep .far{color:var(--teal);opacity:.42;}

.genfig .glabel{margin-top:0;}
.genfig .tier-lab{font-size:9px;letter-spacing:.09em;text-transform:uppercase;font-weight:700;
  color:var(--ink-faint);opacity:.75;margin-bottom:3px;text-align:center;}



/* 700px (e não 560): abaixo disso a coluna fica menor que a fileira de 16 e ela estouraria.
   A .gen do documento só quebra em 560, então aqui a faixa entra em modo empilhado antes. */
@media(max-width:700px){
  .genfig .gen{grid-template-columns:1fr;gap:26px;}
  .genfig .figs{height:auto;padding-bottom:0;margin-bottom:12px;align-items:flex-start;}
  .genfig .gen-line{display:none;}
  .genfig .gcol{text-align:left;padding:0;}
  .genfig .tier{justify-content:flex-start;flex-wrap:wrap;}
}
  color:var(--teal-deep);margin:0 0 4px;}
/* --- bloco 6 · crenças (régua ABSOLUTA, discreta) --- */
.crenlist{margin:20px 0 22px}
.cren{margin:0 0 17px}
.cren-h{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin:0 0 5px}
.cren-txt{font-family:var(--serif);font-size:16.5px;line-height:1.45;font-style:italic;color:var(--ink)}
.cren-lv{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint,#8a9695);white-space:nowrap;flex-shrink:0}
.cren-corr{font-style:normal;margin-left:5px;color:var(--amber);cursor:help}
.cren-track{position:relative;height:3px;border-radius:2px;background:rgba(0,0,0,.07);overflow:hidden}
.cren-fill{position:absolute;left:0;top:0;height:100%;border-radius:2px;background:var(--amber);opacity:.45}
.cren-fill.f3{opacity:.6} .cren-fill.f4{opacity:.75} .cren-fill.f5{opacity:.9}
.cren-dot{position:absolute;top:50%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:var(--amber);opacity:.5;box-shadow:0 0 0 2px var(--paper)}
.cren-dot.f3{opacity:.7} .cren-dot.f4{opacity:.85} .cren-dot.f5{opacity:1}
.cren-track{overflow:visible}
.cren-lv.f5{color:var(--amber)}
/* --- ajustes do founder (2026-07-27) --- */
/* o âmbar da tarja de seção estava pequeno demais pro peso que a marca tem */
/* título de seção em PRETO (decisão founder 2026-07-27): tira o âmbar do rótulo, que
   passava a significar duas coisas — carga emocional E "isto é uma etiqueta". */
.eyebrow{font-size:14px;letter-spacing:.16em;margin:0 0 12px;color:var(--ink)}
.eyebrow .secnum{color:var(--ink)}
.eyebrow .secnum{font-family:var(--serif);font-size:21px;font-weight:400;letter-spacing:0;vertical-align:-2px;margin-right:2px}
/* MAIS AR entre as seções — estava tudo colado */
section.block{margin:0} hr.div{margin:64px 0 60px;border:0;border-top:1px solid var(--line)}
section.block > h2.display{margin-top:6px;margin-bottom:22px}
/* índice */
.toc{margin:52px 0 4px;padding:22px 26px;background:#f7f3ea;border:1px solid var(--line);border-radius:10px}
.toc-lab{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint,#a99a87);font-weight:700;margin:0 0 12px}
.toc-row{display:flex;align-items:baseline;gap:14px;padding:7px 0;text-decoration:none;color:inherit;border-bottom:1px solid rgba(0,0,0,.05)}
.toc-row:last-child{border-bottom:0}
.toc-n{font-family:var(--serif);font-size:17px;color:var(--amber);min-width:16px}
.toc-t{font-family:var(--serif);font-size:16.5px;line-height:1.35}
.toc-row:hover .toc-t{color:var(--teal-deep)}
${B6CSS}
/* --- fecho --- */
.colofao{margin-top:64px;padding-top:26px;border-top:1px solid var(--line);text-align:center}
.cf-nome{font-family:var(--serif);font-size:19px;margin:0 0 2px}
.cf-meta{font-size:13px;color:var(--ink-soft,#6b6357);margin:0 0 16px}
.cf-marca{font-size:11px;letter-spacing:.2em;color:var(--teal-deep);font-weight:700;margin:0 0 14px}
.cf-nota{font-size:11.5px;line-height:1.6;color:var(--ink-faint,#a99a87);max-width:52ch;margin:0 auto}
/* --- CELULAR: a linha do tempo não estava empilhando --- (2026-07-31, visto em prod)
   O mockup JÁ tem @media(max-width:600px){.rail{grid-template-columns:1fr}}, e o gap dessa
   regra é aplicado — mas as colunas continuavam três, de ~95px, com os selos quebrando no
   meio da pílula ("EM / PROCESSO"). Como a mesma media query também faz .rail-line{display:none},
   o resultado era o pior dos dois mundos: espremido E sem a linha. Foi o que o founder viu
   no celular ("não tem a linha... está horrível").

   Aqui não se disputa a cascata do grid: em telas estreitas o trilho vira BLOCO. Empilhado,
   cada marco ganha a largura toda e a linha continua oculta — que é o certo, porque uma
   linha do tempo horizontal não sobrevive a 376px.

   ⚠️ Só abaixo de 600px: o PDF sai a ~816px e segue idêntico ao aprovado. */
@media(max-width:600px){
  .sheet .rail{display:block;position:relative;padding-left:30px}
  /* A LINHA continua existindo — vira VERTICAL. O mockup a esconde no mobile
     (.rail-line{display:none}), mas ela é o que faz a figura ser uma linha do tempo:
     sem ela sobram três blocos soltos. Mesmo degradê do trilho horizontal, do teal
     (o mais antigo) ao âmbar (o que ainda está ativo). */
  .sheet .rail::before{content:"";position:absolute;left:7px;top:9px;bottom:14px;width:2px;
    border-radius:2px;background:linear-gradient(180deg,var(--teal-deep),#c9b48f 55%,var(--amber))}
  .sheet .rail .node{position:relative;text-align:left;padding:0;margin:0 0 18px}
  .sheet .rail .node:last-child{margin-bottom:0}
  /* o marcador senta EM CIMA da linha, como no trilho horizontal */
  .sheet .rail .node .dot{position:absolute;left:-30px;top:1px;margin:0;z-index:1}
  /* a pílula de status não pode partir no meio ("EM / PROCESSO") */
  .sheet .rail .node .flag{white-space:nowrap}
}
/* --- CELULAR: o TRANSGERACIONAL também perdia o traço --- (2026-07-31)
   Mesmo defeito da linha do tempo: abaixo de 700px o .genfig empilha as gerações em coluna
   e o mockup faz .gen-line{display:none}. Sobravam três blocos soltos — sem o traço, some a
   ideia de LINHAGEM, que é o assunto do bloco (bisavós → avós → pais → você).
   O traço vira vertical, com um nó por geração, e mantém o degradê original: começa apagado
   (o que veio de longe) e chega no âmbar (você). */
@media(max-width:700px){
  .genfig .gen{position:relative;padding-left:26px}
  .genfig .gen::before{content:"";position:absolute;left:5px;top:12px;bottom:12px;width:2px;
    border-radius:2px;
    background:linear-gradient(180deg,color-mix(in srgb,var(--line-strong) 70%,transparent),var(--amber) 62%,var(--teal))}
  .genfig .gcol{position:relative}
  /* nó de cada geração, alinhado ao rótulo — senta EM CIMA do traço */
  .genfig .gcol::before{content:"";position:absolute;left:-26px;top:4px;width:12px;height:12px;
    border-radius:50%;background:var(--paper);border:2.5px solid var(--line-strong);z-index:1}
  /* a geração ATUAL (você) é a única em âmbar, como no traço horizontal.
     Por posição (fallback) e por conteúdo — o :has acerta mesmo se a ordem mudar;
     em regra separada porque seletor não suportado invalidaria o bloco inteiro. */
  .genfig .gcol:nth-last-child(2)::before{border-color:var(--amber);background:var(--amber);
    box-shadow:0 0 0 4px color-mix(in srgb,var(--amber) 18%,transparent)}
}
@media(max-width:700px){
  .genfig .gcol:has(.you-wrap)::before{border-color:var(--amber);background:var(--amber);
    box-shadow:0 0 0 4px color-mix(in srgb,var(--amber) 18%,transparent)}
  .genfig .gcol:not(:has(.you-wrap)):nth-last-child(2)::before{border-color:var(--line-strong);
    background:var(--paper);box-shadow:none}
}
/* --- IMPRESSÃO: o documento é pra imprimir e guardar. Sem isto, os cards partem
   no meio entre páginas — invisível na tela, fatal no papel. --- */
@media print{
  @page{margin:16mm 14mm}
  body{background:#fff;padding:0}
  .sheet{max-width:none;margin:0;border:0;border-radius:0;box-shadow:none}
  .pcard,.moment,.saybox,.step,.root,.gen,.toc,.pend,.objbox,.stresswrap,.resil,.medicine,
  .maieutica,.chave,.idrow,.facet,.colofao{break-inside:avoid;page-break-inside:avoid}
  /* 2026-07-31 — blocos coesos que estavam DESPROTEGIDOS e podiam partir entre páginas.
     Medidos na simulação de impressão (724×959px): o maior é 345px, bem abaixo de uma
     página, então protegê-los não corre o risco descrito na nota do .qsec (pedir avoid no
     que não cabe faz o Chromium empurrar e partir torto).
     O mais grave era o .say: são 15 no documento e é a FALA que o terapeuta lê em voz alta
     na sessão — partida no meio, ele perde a frase virando a página. */
  .say,.genfig,.ctr,.drain,.pattern,.tension,.key,.qhead{break-inside:avoid;page-break-inside:avoid}
  /* 2026-07-31 (2ª rodada, founder olhando o PDF impresso):
     .rail-wrap  — o TRILHO da linha do tempo. Partia com as idades numa folha e os selos
                   ("em processo / ainda ativo") na outra. É uma figura só; não pode partir.
     .cren       — cada crença com sua régua. Na virada de página "engolia o gráfico":
                   o texto ia numa folha e a barra ficava na outra, ou sumia no corte. */
  .rail-wrap,.rail,.cren{break-inside:avoid;page-break-inside:avoid}
  section.block{break-inside:auto}
  /* ⚠️ .qsec NÃO pode pedir avoid: cada Caminho mede ~2600-2800px (medido no Miguel) contra
     ~1072px de altura útil — quase 3 páginas. Pedir avoid no que é impossível de honrar faz
     o Chromium empurrar o bloco pra página nova, não caber, e partir torto: sobra meia
     página em branco e o corte cai em lugar ruim. Proteger a FOLHA, não o galho — os .step
     lá dentro (<=490px) seguem com avoid e são a unidade que de fato não pode partir. */
  .qsec{break-inside:auto;page-break-inside:auto}
  /* CADA CAMINHO COMEÇA NUMA PÁGINA (founder, 2026-07-31). Não conflita com a nota acima:
     aquilo é sobre não PARTIR o caminho no meio (impossível, ele mede ~3 páginas); isto é
     sobre onde ele COMEÇA. O :not(:first-of-type) evita uma página em branco antes do 1º. */
  .qsec:not(:first-of-type){break-before:page;page-break-before:always}

  /* ===== REVISÃO DO PDF (founder, 2026-07-31, olhando o PDF impresso) ===== */

  /* 1. CADA SEÇÃO COMEÇA NUMA PÁGINA. Motivo: "a linha do tempo começou numa página e
     terminou na outra, ficou ruim". Proteger só a seção não resolve — ela mede mais que
     uma página. Começar cada capítulo no topo resolve o caso dele e todos os iguais, e de
     quebra dá o respiro que ele pediu entre o fim de uma seção e o começo da outra.
     O bloco 7 também entra aqui, então o Caminho 1 já nasce em página nova. */
  section.block:not(:first-of-type){break-before:auto}

  /* 2. CABEÇALHOS MAIORES. O rótulo da seção estava em 11px e o título de capítulo caía em
     ~21px (o clamp resolve pela largura de 724px do PDF, não pelos 820px do mockup). */
  .eyebrow{font-size:18px;letter-spacing:.13em;margin-bottom:13px}
  .secnum{font-size:19px}
  h2.display{font-size:27px;line-height:1.14;margin:4px 0 18px}

  /* 2b. TEXTO DE CORPO. Histórico em DOIS passos, de propósito:
     · 2026-07-31 o founder disse "esse texto está muito pequeno... e assim para os demais"
       e tudo subiu ~10%;
     · 2026-08-01 ele reviu: "a fonte padrão ali de texto mesmo poderia diminuir um
       pouquinho" — junto com "37 páginas tá muita coisa".
     Desce ~7%, ficando ENTRE o valor original e o de ontem. Não é desfazer o pedido de
     ontem: os títulos e os rótulos continuam nos tamanhos novos; só a leitura corrida cede.
     (Comentários guardam o valor anterior pra próxima calibração não chutar do zero.) */
  .lead{font-size:18.5px}          /* era 20   */
  .snote{font-size:15px}           /* era 16   */
  .deep,.block-serif,.idq{font-size:17px} /* era 18 */
  .gtext{font-size:13.5px}         /* era 14   */
  .chip{font-size:13px}            /* era 13.5 */
  .pintro,.lead10{font-size:15.5px}/* era 16.5 */
  .turn{font-size:19px}            /* era 20.5 */
  .prose p{font-size:16.5px} /* era 17.5 */
  /* ⭐ "EM POUCAS PALAVRAS" IGUAL AO RELATÓRIO ANTIGO (founder, 2026-08-02): "em poucas
     palavras, eu quero que você deixe exatamente como era o nosso relatório antigo, no
     tamanho e cor também". Os valores vêm do DOSSIÊ, não de chute — ".section-body" em
     lib/pdf/report-print-document.tsx: 13.5pt (=18px), line-height 1.9, cor #2A2A2A
     (REPORT_COLORS.body). Antes era 16,5px em #26403f (verde-escuro).
     ⚠️ As PERGUNTAS (.maieutica) ficaram no teal atual de propósito: o relatório antigo não
     tem pergunta maiêutica no bloco 1, então não existe "como era" para elas. Se o founder
     quiser essas também na cor do antigo, é trocar o color desta regra. */
  .microfilme p{font-size:18px;line-height:1.9;color:#2A2A2A}

  /* 3. (o ar entre seções está na regra hr.div lá embaixo — aqui seria sobrescrito) */

  /* 4. BLOCO 5 — separar "o que pesa" de "o que está leve", e subir as duas fontes.
     O founder: "terminou o mapa emocional negativo, dá mais espaço pra começar o que está
     leve" — os dois grupos estavam colados e liam como uma lista só. */
  /* 2026-08-02 (founder, olhando o PDF): "o mapa emocional, a fonte está muito grande, pode
     diminuir uns dois pontos" + "os gráficos também dá uma diminuidazinha, está destoando
     do resto". Desce ~2px em cada rótulo e encolhe trilho e bolinha.
     ⚠️ SÓ no print: a tela mantém o mockup aprovado. Valores anteriores nos comentários. */
  /* 2ª rodada (founder viu o PDF de prod já reduzido: "ainda tá grande"). Histórico do
     tamanho, pra próxima calibração não chutar: 19 → 17 → 15 no rótulo da carga. */
  .grouplab{font-size:13.5px;letter-spacing:.11em}  /* 17 → 15 → 13,5 */
  .grouplab.livre{margin-top:72px}   /* respiro entre "o que pesa" e "o que está leve" (era 86) */
  .pl-carga,.pl-resource{font-size:15px}            /* 19 → 17 → 15 */
  .pl-anti{font-size:13.5px}                        /* 17 → 15 → 13,5 */
  .pl-shadow{font-size:13px}                        /* 16,5 → 14,5 → 13 */
  /* o GRÁFICO em si — sem override antes, herdava a tela (trilho 13px, bolinha 21px) e no
     papel ficava mais pesado que qualquer outro elemento da página. */
  .pend-track{height:8px}                           /* 13 → 10 → 8 */
  .needle{width:14px;height:14px;border-width:2.5px} /* 21 → 17 → 14 */
  .pend-desc{font-size:12.5px}   /* 15 → 13,5 → 12,5 (2026-08-02) */

  /* 5. BLOCO 7 — o subtítulo do método e o corpo dos caminhos estavam pequenos.
     .qtitle usa clamp com vw: a 724px ele encosta no piso de 19px. Fixo no print. */
  .method-sub{font-size:14px}
  /* 2026-08-01 — HIERARQUIA INVERTIDA (founder): o par "Caminho N · carga → antídoto"
     virou o TÍTULO do Caminho ("essa parte tem que crescer mais") e a frase em prosa
     virou o apoio ("diminua esse cabeçalho para todos"). Supera o "aumenta bastante" de
     31px do dia anterior, que valia enquanto a prosa ERA o título. */
  .qtitle{font-size:19px;line-height:1.3}   /* era 31 */
  .q-eyebrow{font-size:21px;letter-spacing:0;margin-bottom:7px}  /* era 17 */
  /* 3-4 enters entre o cabeçalho do bloco 7 e o Caminho 1 */
  .qsec:first-of-type{margin-top:74px;padding-top:0}
  .intro{font-size:17px}
  /* ⚠️ as classes reais do bloco 7 são .say / .say-lab / .st-name — st-txt e st-lab são do
     protótipo antigo e NÃO existem no HTML gerado (regra inerte). Conferido contando
     ocorrências no documento: say 51x · say-lab 45x · st-name 35x. */
  .say{font-size:17px;line-height:1.6}
  .say-lab{font-size:10.5px}
  .st-name{font-size:18.5px}

  /* AGULHAS: fora a sombra. No Chromium de impressão, box-shadow com BLUR num elemento com
     transform é rasterizada sem respeitar o border-radius — vira um quadrado cinza
     translúcido em volta da bolinha (founder viu no PDF, nas agulhas dos centros e nos
     pêndulos). Na tela a sombra fica; no papel ela não agrega e é o defeito. */
  .needle,.dv-needle,.e10-needle{box-shadow:none}
  h2.display,.eyebrow{break-after:avoid;page-break-after:avoid}
  /* O cabeçalho do Caminho não pode ficar SOZINHO no pé da página. Visto no PDF gerado
     localmente (pág. 17): o título "Da preocupação a uma confiança..." abria a página e o
     passo 1 pulava pra seguinte, deixando meia folha vazia — porque o .step tem avoid e é
     empurrado, mas nada prendia o cabeçalho a ele. */
  .qhead,.q-eyebrow,.qtitle{break-after:avoid;page-break-after:avoid}
  /* 2026-08-01 — NENHUM RÓTULO ÓRFÃO NO PÉ DA PÁGINA. Antes só os cabeçalhos de seção e do
     Caminho estavam protegidos, então qualquer outro rótulo podia ficar sozinho no rodapé
     com o conteúdo dele na página seguinte — visto no PDF: "Uma frase para dizer em voz
     alta" (.subhead) fechava a página 10 e a caixa começava na 11. Lista levantada das
     classes que REALMENTE aparecem no HTML gerado, não de memória. */
  /* 2026-08-02 (founder, no PDF): "aqueles quadradões da linha do tempo tomam muito espaço,
     poderiam ser menores — pode até diminuir o texto, mas essas caixas azuis diminuírem".
     Não havia NENHUM ajuste de impressão para elas: usavam os mesmos recuos generosos da
     tela (padding 20/22, .mrow 14,5px, .key .q 16,5px). ⚠️ A regra de 1 coluna do .mrow é
     de CELULAR (≤560px) e nunca valeu aqui — no papel a caixa sempre foi 2 colunas. */
  .moment{padding:12px 16px;margin:9px 0;border-radius:10px}
  .moment-h{margin-bottom:8px;gap:9px}
  .moment-h .mage{font-size:16px}
  .mrow{padding:4px 0;font-size:13px;grid-template-columns:100px 1fr;gap:10px}
  .mrow .k{font-size:9.5px}
  .keys{margin-top:10px;padding-top:9px}
  .key{margin:0 0 6px;grid-template-columns:88px 1fr;gap:10px}
  .key .q{font-size:14px;line-height:1.38}
  .key .kind{font-size:9px;padding:2px 6px}

  .subhead,.rootlab,.grouplab,.keys-lab,.method-sub,.st-name,.toc-lab,.dv-lab,.glabel,
  .ctr-name,.ctr-head,.rlab,.resumo-lab,.obj-lab,.minih,.med-lab,.guide-tag,.sayintro
  {break-after:avoid;page-break-after:avoid}
  /* ⛔ O SEPARADOR NÃO EXISTE NO PDF. Ele mora ENTRE as <section> (fora das duas), e como
     "section.block:not(:first-of-type){break-before:page}" faz toda seção começar em
     página nova, ele não separa coisa nenhuma aqui — só ocupa espaço. Com margem de
     56+50px, quando a seção anterior terminava perto do rodapé o <hr> transbordava e
     ganhava UMA FOLHA INTEIRA só pra ele: foi o que aconteceu entre a linha do tempo e as
     Heranças transgeracionais (página 9 em branco, pega pelo founder em 2026-08-01).
     ⚠️ Isto SUPERA o ajuste de margem 34/30 → 56/50 do dia anterior: o "ar entre seções"
     que o founder pediu passou a ser a própria virada de página. Na TELA o filete continua.
     Detector: node scripts/pdf-paginas-vazias.mjs */
  /* Espaçador INVISÍVEL, não display:none. Com display:none a margem some junto e as
     seções ficam coladas (founder, 2026-08-03). Com border:0 + height:0 ele não desenha
     nada, só separa — e o break-avoid dos dois lados impede que ele volte a ganhar uma
     folha inteira só pra si, que foi o bug de 01/08. */
  hr.div{display:block;border:0;height:0;margin:52px 0;break-before:avoid;break-after:avoid;page-break-before:avoid;page-break-after:avoid}
  /* 2026-08-03 (founder): "o que vem a seguir e o 2 estao juntos, tem que dar um espaco de
     saltar duas linhas, e pra todos os outros tambem". Efeito colateral de eu ter tirado a
     quebra de pagina por secao: elas passaram a fluir COLADAS. O ar volta como MARGEM da
     secao - e nao pelo <hr>, que podia ficar orfao numa folha inteira (bug de 01/08). */

  .toc-row{border-bottom-color:#ddd}
  a{color:inherit;text-decoration:none}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style></head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <symbol id="g-adulto" viewBox="0 0 20 24"><circle cx="10" cy="5.6" r="4.6"/>
    <path d="M1.6 24v-5.4C1.6 13.9 5.4 11 10 11s8.4 2.9 8.4 7.6V24Z"/></symbol>
  <symbol id="g-crianca" viewBox="0 0 20 24"><circle cx="10" cy="7.4" r="5.4"/>
    <path d="M3.6 24v-3.6c0-3.5 2.7-5.6 6.4-5.6s6.4 2.1 6.4 5.6V24Z"/></symbol>
</defs></svg>
<div class="sheet"><div class="pad">
  <div class="brand">IRIS CODEX</div>
  <div class="brand-sub">Mapa do Ser · ${NOME}</div>
  ${sectionsHtml}
  ${fecho}
</div></div>
</body></html>`
  return { html, AG }
}


// ---------- CLI do lab ----------
import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const nm = process.argv[2] || 'self'
  const NOMES = { self: 'Rhelton', s5novo: 'Rhelton', victor: 'Victor', daniel: 'Daniel', miguel: 'Miguel' }
  const mdCli = readFileSync(path.join(LAB_DIR, `out/novo-${nm}--sonnet-5.md`), 'utf8')
  const { html, AG } = renderHTML(mdCli, nm, NOMES[nm] || nm)
  writeFileSync(path.join(LAB_DIR, `out/novo-${nm}.html`), html)
  console.log(`→ out/novo-${nm}.html (${html.length} chars · agulhas M${AG.mente}/C${AG.coracao}/Corpo${AG.corpo})`)
}
