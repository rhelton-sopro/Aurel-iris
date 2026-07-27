#!/usr/bin/env node
// MOTOR (protótipo determinístico) — calcula 3 centros + perfil de elementos
// a partir do output do Stage 1, cruzando com a tabela-lastro canônica.
// uso: node _motor-lab/motor-calc.mjs            (roda os 3 exames)
//      node _motor-lab/motor-calc.mjs self       (um só)
import fs from 'node:fs'
import path from 'node:path'

const LASTRO = path.resolve('apps/web/_motor-lab/lastro/tabela-lastro-CANONICA.md')
const FAMILIA_MD = path.resolve('apps/web/_motor-lab/lastro/emocao-familia.md')
const EXAM = (n) => path.resolve(`apps/web/_exame-${n}.json`)

// ---------- parâmetros (calibráveis — calibração 2026-07-22) ----------
const GAMMA = 1.1
const K = 6 // saturação squash S/(S+k)
const W_PRES = { vital_ativo: 2.0, neutro: 1.5 }
const squash = (s) => s / (s + K)
// AGULHA dos centros: prior de suavização (Laplace) que tira os extremos 0/100.
// posicao_livre = (livre + α) / (tensão + livre + 2α). Ajustado p/ bater o
// mockup aprovado (Helton ~26/83/21) sem cravar 0 nem 100.
const BASELINE_LIVRE = 1.2 // α
// MAPA emocional: decaimento por rank DENTRO do campo — a emoção-núcleo do
// órgão domina, a paleta genérica cai (quebra o empate 4.6 sem mapa de família
// frágil, que reintroduziria o Forer da emoção ubíqua). rank0=1 · r1=.6 · r2=.36…
const DECAY = 0.6
// ATENUADOR do reforço de família (decisão founder 2026-07-25): os achados SOMAM na
// família, mas cada membro SECUNDÁRIO entra atenuado por (intensidade/5)^2 — achado
// fraco (I2 → fator 0.16) quase não soma; achado forte (I4 → 0.64, I5 → 1.0) soma quase
// inteiro. O líder (mais forte) conta cheio. Efeito: fígado I3 + radii I2 fica em MÉDIA
// (~3.7, não "alta" como se fosse I4/I5), mas fígado I4 + radii I4 continua MUITO ALTA
// (~7.5). Um achado I3 nunca alcança o patamar de um I5.
const FAM_DAMP_EXP = 2

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
    // Emoções POR ELEMENTO (não só flat) — o founder: o órgão carrega 2+
    // elementos e cada um tem sua emoção (fígado = 🔥raiva + 💧guardar). Núcleo
    // = as ~4 primeiras de cada bloco (corta paleta genérica/Forer).
    const NUCLEO_CAP = 4
    const clean = (p) => p.replace(/\([^)]*\)/g, '').replace(/[*_`]/g, '').trim()
    const cargaByElem = { fogo: [], agua: [], terra: [], ar: [] }
    const recursoByElem = { fogo: [], agua: [], terra: [], ar: [] }
    const cargaCrencaByElem = { fogo: [], agua: [], terra: [], ar: [] } // crenças (forma cognitiva) — pro bloco C
    const recursoCrencaByElem = { fogo: [], agua: [], terra: [], ar: [] }
    let curE = null
    for (const line of b.split('\n')) {
      const em = line.match(/^- \*\*(🔥|💧|🌍|💨)/)
      if (em) curE = ELEM_KEY[em[1]]
      const cm = line.match(/🔴 emoções:\*\*\s*(.*)/)
      const rm = line.match(/🟢 emoções:\*\*\s*(.*)/)
      const ccm = line.match(/🔴 crenças:\*\*\s*(.*)/)
      const rcm = line.match(/🟢 crenças:\*\*\s*(.*)/)
      if (cm && curE) cargaByElem[curE].push(...cm[1].split('·').map(clean).filter((p) => p.length > 2).slice(0, NUCLEO_CAP))
      if (rm && curE) recursoByElem[curE].push(...rm[1].split('·').map(clean).filter((p) => p.length > 2).slice(0, NUCLEO_CAP))
      if (ccm && curE) cargaCrencaByElem[curE].push(...ccm[1].split('·').map(clean).filter((p) => p.length > 2).slice(0, NUCLEO_CAP))
      if (rcm && curE) recursoCrencaByElem[curE].push(...rcm[1].split('·').map(clean).filter((p) => p.length > 2).slice(0, NUCLEO_CAP))
    }
    // ordena o leque pela PREDOMINÂNCIA do elemento no campo → a emoção-núcleo
    // do elemento dominante fica no rank 0 (recebe o peso cheio no decaimento).
    const order = ['fogo', 'agua', 'terra', 'ar'].sort((a, b) => (elem[b] || 0) - (elem[a] || 0))
    const flat = (o) => order.flatMap((e) => o[e] || [])
    // PROCEDÊNCIA de cada emoção de carga no arquivo: em que bloco ela estava e em que
    // posição. Serve SÓ pra casar 🔴[k] com o 🟢[k] que a canônica escreveu ao lado dele
    // (o antídoto do pêndulo). NÃO é modelo de elemento — nada disso aparece em mapa,
    // prompt ou doc; é só o endereço do dado no arquivo (decisão founder 2026-07-26).
    const flatSrc = (o) => order.flatMap((e) => (o[e] || []).map((_, k) => ({ e, k })))
    map[name] = {
      elem, centros: centros.length ? centros : ['corpo'],
      carga: flat(cargaByElem), recurso: flat(recursoByElem), cargaByElem, recursoByElem,
      cargaSrc: flatSrc(cargaByElem),
      cargaCrenca: flat(cargaCrencaByElem), recursoCrenca: flat(recursoCrencaByElem),
    }
  }
  return map
}

// ---------- emoção → FAMÍLIA (metodologia C: reforço por família, SEM elemento) ----------
// A tabela emocao-familia.md foi construída a partir das MESMAS emoções do parseLastro
// (232 carga + 146 recurso), então os rótulos casam (cobertura medida: 230/232 carga).
function loadFamilias() {
  const md = fs.readFileSync(FAMILIA_MD, 'utf8').split(/\r?\n/)
  const clean = (p) => p.replace(/\*\(alt:[^)]*\)\*/g, '').replace(/[*_`]/g, '').split('→')[0].replace(/\([^)]*\)/g, '').trim().toLowerCase()
  const fam = {}
  let cur = ''
  for (const ln of md) {
    const h = ln.match(/^### \d+\.\s*(.+)$/); if (h) { cur = h[1].trim(); continue }
    const m = ln.match(/^\*\*(?:🔴 Carga|🟢 Recurso) \(\d+\):\*\*\s*(.*)$/)
    if (!m || !cur) continue
    if (/^—/.test(m[1].trim())) continue
    for (const item of m[1].split(' · ')) { const k = clean(item); if (k.length > 2 && !(k in fam)) fam[k] = cur }
  }
  return fam
}
const EMO_FAMILIA = loadFamilias()
const familiaDe = (emo) => EMO_FAMILIA[(emo || '').toLowerCase()] || null

// ---------- EIXOS DO PÊNDULO (decisão founder 2026-07-26) ----------
// O par carga⟷antídoto é propriedade da EMOÇÃO, escrito à mão por eixo — NÃO se deriva
// do 🟢 do órgão (aquele responde "como é este órgão quando está bem", que é outra
// pergunta; daí saía `preocupação ⟷ curiosidade e apetite pelo novo`).
// O rótulo do eixo obedece a LEI DA 8ª SÉRIE — é o termo que chega ao cliente.
export function loadEixos() {
  const md = fs.readFileSync(FAMILIA_MD, 'utf8')
  const sec = md.slice(md.indexOf('## Eixos do pêndulo'))
  const eixos = []
  for (const b of sec.split(/^### Eixo · /m).slice(1)) {
    const nome = b.split('\n')[0].trim()
    if (/^Fora do pêndulo/.test(nome)) continue
    const anti = (b.match(/\*\*🟢 Antídoto:\*\*\s*(.*)/) || [])[1] || ''
    const [rotulo, oque] = anti.split(' — ').map((s) => (s || '').replace(/\*/g, '').trim())
    // `chave :: rótulo` — a ESQUERDA é o texto da canônica (a chave de busca, imexível);
    // a DIREITA é o que o cliente lê. Serve quando o termo da fonte não passa na lei da
    // 8ª série ou lê como virtude (`obstinação` → "obstinação compulsiva").
    const lista = (re) => {
      const raw = (b.match(re) || [])[1] || ''
      if (raw.trim() === '—') return []
      return raw.split(' · ').map((s) => s.trim()).filter(Boolean).map((s) => {
        const [k, d] = s.split(' :: ')
        return { k: k.trim(), d: (d || '').trim() }
      })
    }
    const c = lista(/\*\*🔴 Cargas:\*\*\s*(.*)/), rr = lista(/\*\*🟢 Recursos:\*\*\s*(.*)/)
    const display = Object.fromEntries([...c, ...rr].filter((x) => x.d).map((x) => [x.k, x.d]))
    // VARIAÇÕES: formulações SÓ do cliente — não são entradas da canônica, então ficam
    // FORA da conferência de cobertura (que segue 1:1 com a fonte). Existem porque eixo
    // com uma formulação só faz o Sonnet PARAFRASEAR por falta de opção — medido em
    // Sossego e Tranquilidade. Dar escolha é mais seguro que afrouxar a validação.
    const variacoes = lista(/\*\*🟢 Variações:\*\*\s*(.*)/).map((x) => x.k)
    eixos.push({ nome, rotulo: rotulo || nome, oque: oque || '', carga: c.map((x) => x.k), recurso: rr.map((x) => x.k), variacoes, display })
  }
  return eixos
}
// índice emoção→eixo. A entrada do eixo pode trazer o sufixo "→ emoção-base" do princípio
// psicossomático; a canônica não traz. Indexo pelas DUAS formas pra casar dos dois lados.
const EIXOS = loadEixos()
const normE = (s) => (s || '').replace(/[*_`]/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
const EIXO_DE = {}
for (const x of EIXOS) {
  for (const [lado, itens] of [['carga', x.carga], ['recurso', x.recurso]]) {
    for (const e of itens) {
      const k = normE(e)
      EIXO_DE[k] = { eixo: x.nome, rotulo: x.rotulo, oque: x.oque, lado }
      const semSeta = k.split(' → ')[0].trim()
      if (semSeta !== k && !(semSeta in EIXO_DE)) EIXO_DE[semSeta] = EIXO_DE[k]
    }
  }
}
const eixoDe = (emo) => EIXO_DE[normE(emo)] || null
// rótulo do CLIENTE pra uma emoção de carga, quando o texto da canônica não serve
const DISPLAY_DE = {}
for (const x of EIXOS) for (const [k, d] of Object.entries(x.display || {})) DISPLAY_DE[normE(k)] = d
const displayDe = (emo) => DISPLAY_DE[normE(emo)] || null

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
  const antiSrc = {} // emoção de carga → de onde puxar o 🟢 (campo de MAIOR peso que a emitiu)
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
    t.carga.forEach((e, i) => {
      emoCarga[e] = (emoCarga[e] || 0) + w * Math.pow(DECAY, i) // (B) leque de carga com decaimento por rank
      // ANTÍDOTO (decisão founder 2026-07-26): toda emoção de carga puxa o 🟢 DO MESMO
      // CAMPO. Antes o polo 🟢 só existia se o campo estivesse em sistemas_preservados —
      // por isso preocupação/rigidez/inquietação saíam MANCAS (o campo é só carga).
      // Se duas áreas emitem a mesma emoção, vale a de maior peso.
      if (!antiSrc[e] || antiSrc[e].w < w) antiSrc[e] = { key, i, w }
    })
    // cada achado com sua COMPOSIÇÃO (2 elementos: predominante + secundário),
    // cada elemento com sua emoção-núcleo — o órgão não colapsa em 1 (founder).
    const els = ['fogo', 'agua', 'terra', 'ar'].filter((e) => (t.elem[e] || 0) > 0).sort((x, y) => t.elem[y] - t.elem[x])
    const breakdown = els.slice(0, 2).map((e) => ({ e, pct: Math.round((t.elem[e] || 0) * 100), emo: (t.cargaByElem[e] || [])[0] || (t.carga[0] || '?') }))
    achadoList.push({ campo: a.campo, int: a.intensidade, breakdown, w })
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
      t.recurso.forEach((e, i) => { emoRecurso[e] = (emoRecurso[e] || 0) + w * Math.pow(DECAY, i) }) // (B) leque de recurso com decaimento
    }
  }
  // CONSTITUIÇÃO → livre (recursos constitucionais — SPEC passo 3b; a força NÃO
  // vem só dos preservados). Liga a "constituicao_base" do Stage 1 aos centros.
  const CB = d.constituicao_base || {}
  if (CB.pupila === 'centrada_regular') centro.mente.l += 1.5 // centramento / eixo organizado
  if (CB.trama_fibras === 'compacta_densa') centro.corpo.l += 1.5 // vitalidade constitucional
  if (CB.bordas_pupilares === 'regulares') for (const c of ['mente', 'coracao', 'corpo']) centro[c].l += 0.3 // estabilidade
  // ZONA QUIETA: centro sem tensão nenhuma = preservado (livre)
  for (const c of ['mente', 'coracao', 'corpo']) if (centro[c].t === 0) centro[c].l += 1.0

  // REFORÇO POR FAMÍLIA (metodologia C — decisão founder, SEM elemento): cada achado
  // joga só o seu NÚCLEO na família (cap anti-Forer); a família que REPETE entre achados
  // acumula a soma dos pesos; o LÍDER dessa família (emoção mais forte do leque) vai ao
  // extremo. Ex.: raiva contida sobe ao topo porque a família Raiva repete (fígado+radii),
  // e você continua vendo irritação/ressentimento separadas no leque (granularidade da A).
  // coleta os membros de cada família (peso + intensidade de cada achado)
  const famMembers = {}
  for (const a of achadoList) {
    const f = familiaDe(a.breakdown[0]?.emo)
    if (f) (famMembers[f] ||= []).push({ w: a.w, int: a.int })
  }
  // famScore = líder cheio + demais ATENUADOS por (int/5)^FAM_DAMP_EXP (achado fraco
  // quase não soma; achado forte soma quase inteiro). Teto natural: I3 não vira I5.
  const famScore = {}
  for (const f in famMembers) {
    const ms = famMembers[f].sort((a, b) => b.w - a.w)
    let s = ms[0].w
    for (let i = 1; i < ms.length; i++) s += ms[i].w * Math.pow(ms[i].int / 5, FAM_DAMP_EXP)
    famScore[f] = s
  }
  const domFam = Object.keys(famScore).sort((a, b) => famScore[b] - famScore[a])[0] || null
  if (domFam) {
    const naFamilia = Object.keys(emoCarga).filter((e) => familiaDe(e) === domFam)
    if (naFamilia.length) {
      const lider = naFamilia.sort((a, b) => emoCarga[b] - emoCarga[a])[0]
      emoCarga[lider] = Math.max(emoCarga[lider], famScore[domFam]) // líder da família dominante vai ao extremo
    }
  }

  const pres = preservados.map((p) => ({ campo: p.campo, pol: p.polaridade_funcional }))
  // (E) seleção: todo achado GARANTE seu núcleo (todo achado ruim aparece — decisão
  // founder); achado FORTE (w≥4 = I4/I5) ganha a 2ª emoção também (a pessoa se
  // identifica forte → "raiva E ressentimento"). Depois preenche os slots restantes.
  const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
  const garantidas = new Set()
  for (const a of achadoList) {
    if (a.breakdown[0]?.emo) garantidas.add(a.breakdown[0].emo) // núcleo (sempre)
    if (a.w >= 4 && a.breakdown[1]?.emo) { // 2ª emoção se forte (a pessoa se identifica com as duas)
      garantidas.add(a.breakdown[1].emo)
      emoCarga[a.breakdown[1].emo] = Math.max(emoCarga[a.breakdown[1].emo] || 0, a.w * 0.6) // lê ~1 nível abaixo do núcleo, não "baixa"
    }
  }
  // ---- PÊNDULO COMPLETO: cada carga com o seu lado-antídoto (🟢 do MESMO campo) ----
  // `principal` = o 🟢 que a canônica escreveu na MESMA posição do 🔴 (é o par que a
  // fonte já pareou: preocupação ⟷ "digerir a vida com gosto"). `pool` = TODAS as 🟢
  // do campo, sem distinção — o prompt escolhe qual encaixa nesta pessoa.
  // ⚠️ o antídoto é DIREÇÃO, não força presente: NÃO entra em emoRecurso (o trilho dos
  // preservados é o único que afirma "isto já está livre em você").
  const antidoto = {}
  for (const e in antiSrc) {
    const x = eixoDe(e)
    if (!x) continue // sem eixo = furo na tabela; check-eixos.mjs acusa
    const { key } = antiSrc[e]
    // pool = as 🟢 do MESMO EIXO (o Sonnet escolhe a formulação que encaixa nesta
    // pessoa e nesta intensidade — força casa com força, decisão founder).
    // pool oferecido ao Sonnet = a forma que o CLIENTE lê (lei da 8ª série). O texto cru
    // da canônica fica só como chave — aceito na validação, mas nunca sugerido.
    const ex = EIXOS.find((y) => y.nome === x.eixo)
    const chaves = ex?.recurso || []
    const pool = [...chaves.map((k) => ex.display?.[k] || k), ...(ex?.variacoes || [])]
    antidoto[e] = { principal: x.rotulo, oque: x.oque, eixo: x.eixo, pool, poolChaves: chaves, campo: key }
  }

  // ---- COLISÃO DE EIXO: carga e recurso PRESERVADO nas duas pontas do mesmo pêndulo ----
  // Caso real do founder: `rigidez/intolerância` (achado, intestino delgado) vs
  // `flexibilidade ativa…` (preservado, musculoesquelético) — mesmo eixo, lados opostos
  // da página. Só DETECTA e reporta; o que fazer é decisão do founder na frente do caso.
  const colisoes = []
  for (const [emoC] of Object.entries(emoCarga)) {
    const xc = eixoDe(emoC)
    if (!xc) continue
    for (const [emoR] of Object.entries(emoRecurso)) {
      const xr = eixoDe(emoR)
      if (xr && xr.eixo === xc.eixo) colisoes.push({ eixo: xc.eixo, carga: emoC, recurso: emoR, sc: emoCarga[emoC], sr: emoRecurso[emoR] })
    }
  }

  const rankedCarga = Object.entries(emoCarga).sort((a, b) => b[1] - a[1])
  const mapaCarga = rankedCarga.filter(([e]) => garantidas.has(e)) // 1º: as garantidas
  const N = Math.max(8, mapaCarga.length)
  for (const row of rankedCarga) { if (mapaCarga.length >= N) break; if (!garantidas.has(row[0])) mapaCarga.push(row) } // 2º: preenche
  mapaCarga.sort((a, b) => b[1] - a[1])
  const mapaRecurso = top(emoRecurso, 5)
  achadoList.sort((a, b) => b.w - a.w)
  return { name, elem, centro, pres, mapaCarga, mapaRecurso, antidoto, colisoes, achadoList, famScore, domFam, skipped, adjuvantes, nAch: achados.length, nPres: preservados.length }
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
  L.push('\nTODOS OS ACHADOS EVIDENCIADOS (cada órgão com seus 2 elementos — nada colapsa):')
  r.achadoList.forEach((a, i) => {
    const tag = i === 0 ? 'PRINCIPAL' : i === 1 ? '2º' : i === 2 ? '3º' : ''
    const comp = a.breakdown.map((x) => `${emoji[x.e]}${x.pct}% "${x.emo}"`).join('  +  ')
    L.push(`  ${i === 0 ? '★' : '·'} I${a.int} ${a.campo.padEnd(26)} ${comp}  ${tag}`)
  })
  const elems3 = [...new Set(r.achadoList.slice(0, 4).flatMap((a) => a.breakdown.map((x) => x.e)))]
  L.push(`  → elementos na narrativa: ${elems3.map((e) => emoji[e] + e).join(' + ')}`)

  L.push('\nFORÇA / RECURSOS (trilho separado — dos preservados, NÃO entra no elemento):')
  for (const p of r.pres) L.push(`    ✓ ${p.campo}${p.pol === 'vital_ativo' ? ' (vital)' : ''}`)

  // (B) mapa emocional — o leque que o prompt seleciona
  // limiares alinhados ao SPEC (intensidade→nível): I5≈5.9→muito alta · I4≈4.6→alta ·
  // I3≈3.3→média · abaixo→baixa. (reforço entre campos da mesma emoção sobe o nível.)
  const nivel = (s) => (s >= 6 ? 'muito alta' : s >= 4 ? 'alta' : s >= 2.5 ? 'média' : 'baixa')
  const maxE = (r.mapaCarga[0] || [0, 1])[1] || 1
  // metodologia C — família que REPETE entre achados carrega a soma (reforço SEM elemento)
  const famRank = Object.entries(r.famScore || {}).sort((a, b) => b[1] - a[1])
  if (famRank.length) {
    L.push('\n(C) REFORÇO POR FAMÍLIA (a que repete entre achados leva o líder ao extremo):')
    L.push('  ' + famRank.map(([f, s], i) => `${i === 0 ? '★' : '·'}${f} ${s.toFixed(1)}`).join('  ·  ') + `   → dominante: ${r.domFam}`)
  }
  L.push('\n(B) MAPA EMOCIONAL — leque de CARGA (score=Σ intensidade^γ · o prompt seleciona):')
  for (const [emo, s] of r.mapaCarga) {
    const bar = '▓'.repeat(Math.round((s / maxE) * 16)).padEnd(16)
    const a = r.antidoto?.[emo]
    L.push(`    ${bar} ${s.toFixed(1).padStart(4)} ${nivel(s).padEnd(9)} ${emo}`)
    L.push(`    ${' '.repeat(16)}      ⟷ 🟢 ${a ? a.principal : '(SEM ANTÍDOTO — furo na canônica)'}`)
  }
  L.push('   leque de RECURSO (força — dos preservados):')
  for (const [emo, s] of r.mapaRecurso) L.push(`    · ${s.toFixed(1).padStart(4)}  ${emo}`)
  L.push('\n3 CENTROS (escala −50 tensão ⟷ 0 equilíbrio ⟷ +50 livre):')
  for (const c of ['mente', 'coracao', 'corpo']) {
    const { t, l } = r.centro[c]
    const agulha = Math.round(((l + BASELINE_LIVRE) / (t + l + 2 * BASELINE_LIVRE)) * 100) // suavizado (prior Laplace α)
    const bipolar = agulha - 50 // centrado no 0 (decisão founder — backstage)
    const pos = Math.round(agulha / 5)
    const track = ('·'.repeat(pos) + '◉' + '·'.repeat(20 - pos)).slice(0, 21)
    L.push(`  ${c.padEnd(8)} −50${track}+50   score=${bipolar > 0 ? '+' : ''}${bipolar}  (t ${t.toFixed(1)} / l ${l.toFixed(1)})`)
  }
  return L.join('\n')
}

// ---------- exports (usados pelo serialize.mjs) ----------
export { parseLastro, calc, classify, eixoDe, displayDe, EIXOS, TOPO_CENTRO, GAMMA, K, BASELINE_LIVRE, DECAY, EXAM }

// ---------- CLI (só quando rodado direto: node motor-calc.mjs) ----------
import { pathToFileURL } from 'node:url'
const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href
if (isMain) {
  const lastro = parseLastro()
  const which = process.argv[2] ? [process.argv[2]] : ['self', 'daniel', 'miguel']
  console.log(`MOTOR protótipo · γ=${GAMMA} k=${K} · pesos pres vital=${W_PRES.vital_ativo}/neutro=${W_PRES.neutro} · α=${BASELINE_LIVRE} decay=${DECAY}`)
  console.log(`campos no lastro: ${Object.keys(lastro).length}`)
  for (const n of which) console.log(fmt(calc(n, lastro)))
}
