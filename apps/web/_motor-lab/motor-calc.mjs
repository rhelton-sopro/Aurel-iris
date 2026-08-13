#!/usr/bin/env node
// MOTOR (protótipo determinístico) — calcula 3 centros + perfil de elementos
// a partir do output do Stage 1, cruzando com a tabela-lastro canônica.
// uso: node _motor-lab/motor-calc.mjs            (roda os 3 exames)
//      node _motor-lab/motor-calc.mjs self       (um só)
import fs from 'node:fs'
import path from 'node:path'
// BASE resolvida em RUNTIME (ver lab-dir.mjs): o MESMO motor serve o lab e o app Next,
// sem cópia paralela que deriva depois. NÃO voltar a usar import.meta.url aqui — o
// webpack o congela no caminho da máquina de build e isso dá ENOENT em produção.
import { LAB_DIR, REPO } from './lab-dir.mjs'

const LASTRO = path.join(LAB_DIR, 'lastro/tabela-lastro-CANONICA.md')
const FAMILIA_MD = path.join(LAB_DIR, 'lastro/emocao-familia.md')
const EXAM = (n) => path.join(REPO, `apps/web/_exame-${n}.json`)

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
// ⚠️ CALIBRÁVEL PARA MEDIÇÃO (2026-08-13): `IRIS_DECAY=0.8 node ...`. **Default 0.6 =
// comportamento vigente.** É ELE, e não o NUCLEO_CAP, que decide quais emoções chegam ao
// leque — medido: tirar o cap não muda nada, porque a decadência por rank já enterra a
// emoção tardia. Ver AUDITORIA-motor-2026-08-13.md §4.
const DECAY = Number(process.env.IRIS_DECAY) || 0.6
// ATENUADOR do reforço de família (decisão founder 2026-07-25): os achados SOMAM na
// família, mas cada membro SECUNDÁRIO entra atenuado por (intensidade/5)^2 — achado
// fraco (I2 → fator 0.16) quase não soma; achado forte (I4 → 0.64, I5 → 1.0) soma quase
// inteiro. O líder (mais forte) conta cheio. Efeito: fígado I3 + radii I2 fica em MÉDIA
// (~3.7, não "alta" como se fosse I4/I5), mas fígado I4 + radii I4 continua MUITO ALTA
// (~7.5). Um achado I3 nunca alcança o patamar de um I5.
const FAM_DAMP_EXP = 2

// ---------- ESCALA NORMALIZADA DA CARGA (decisão founder 2026-08-13) ----------
// O QUE ISTO CONSERTA. O score cru não tinha escala declarada. A régua desenhada é bipolar
// (−50 … 0 … +50) e o score ia de 1,00 até um teto que MUDAVA conforme a família — medido
// no exame máximo: 5,87 para uma família de 1 campo, 29,37 para "Medo" (5 campos). Eram
// onze escalas no mesmo desenho: 5,87 em "Nojo e aversão" é o MÁXIMO que aquela emoção
// consegue registrar; 5,87 em "Medo" é 20% do teto dela. Mesma agulha, sentidos opostos.
// E quatro famílias de 1 campo NUNCA alcançavam "muito alta" (teto 5,87 < corte 6,0) —
// impossível por construção, não por leitura.
//
// A ESCALA: 100% = UM achado sozinho na intensidade máxima (I5) = 5^γ = 5,873.
// É a referência que se explica numa frase: "quanto isso pesa, comparado a um achado no
// talo". Passar de 100% é legítimo e quer dizer MAIS DE UM achado apontando pra mesma
// coisa (o reforço de família). Máximo real observado até hoje: 150%.
const MAX_ACHADO = Math.pow(5, GAMMA) // 5,873 — um achado I5 sozinho = 100%
const normCarga = (s) => s / MAX_ACHADO
// CORTES colados na intensidade do achado (decisão founder 2026-08-13), pro rótulo ser
// leitura direta do que a íris mostrou: I1 17% · I2 37% · I3 57% · I4 78% · I5 100%.
//   baixa < 45% ≤ média < 70% ≤ alta < 90% ≤ muito alta
// ⇒ I1/I2 baixa · I3 média · I4 alta · I5 muito alta · 2ª emoção de um I5 (60%) média.
const CORTES = { media: 0.45, alta: 0.7, muitoAlta: 0.9 }
const nivelDe = (s) => {
  const n = normCarga(s)
  return n >= CORTES.muitoAlta ? 'muito alta' : n >= CORTES.alta ? 'alta' : n >= CORTES.media ? 'média' : 'baixa'
}
// AGULHA — LINEAR na escala normalizada. É o que torna a régua legível: 45% cai sempre no
// mesmo ponto da barra, em qualquer pêndulo, e por isso dá pra cravar a marca da faixa.
// Piso −6: um achado que EXISTE nunca desenha como neutro (regra antiga, preservada).
// 100% = −33, e sobra régua até −48 pro que passa de 100% — 150% cai em −46,5, sem cravar.
const PISO_CARGA = 6
const bipCarga = (s) => Math.max(-48, -(PISO_CARGA + 27 * normCarga(s)))
// posição na barra (0-100%), que é o que o render usa: 50 = meio da régua bipolar.
const leftCarga = (s) => 50 + bipCarga(s)
// ⚠️ A CORROBORAÇÃO NÃO TRAVA MAIS O RÓTULO NEM FREIA A AGULHA (decisão founder
// 2026-08-13). Antes, sem 2+ achados na família o rótulo tinha teto duro ("alta") e a
// agulha tinha freio macio (saturava em 70%) — dois freios diferentes pra mesma regra, que
// podiam discordar entre si. Agora medida é medida, e a corroboração aparece como a marca
// ⊕ ao lado do rótulo, do mesmo jeito que já aparece nas crenças.

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
  // mapeados em 2026-08-13 (auditoria): `baco` ~3:45-4:15h OE e `plexo_solar` ~3h OE caem
  // os dois na faixa temporal/medial 2-4h ⇒ Coração pela régua topográfica desta tabela.
  // Bate com o `Centro:` que ficou escrito no lastro deles (o fallback daria o mesmo).
  baco: ['coracao'], plexo_solar: ['coracao'],
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
    //
    // ⛔ TETO REMOVIDO em 2026-08-13 (decisão do founder, medida antes). O corte em 4 tornava
    // **33 emoções da canônica inalcançáveis** — e cortava por POSIÇÃO NA LISTA, não por
    // qualidade: `vergonha` (que dá nome a uma família), `desamparo`, `angústia`, `rejeição`,
    // `ciúme` e `rancor` estavam fora por terem sido digitadas em 5º lugar.
    // ⭐ E o medo que justificava o teto — Forer — NÃO se confirmou. Medido nas 60 leituras de
    // produção: com teto 4 · 8 · sem teto, a sobreposição média entre leituras fica em 21,7%
    // nos três, e o número de emoções que chegam ao leque não muda (55). Quem enterra a emoção
    // tardia é o `DECAY`, não o teto. Mais vocabulário deixa as leituras MAIS distintas
    // (decay 0,95 → 20,9%), não menos.
    // ⚠️ Pré-requisito que foi feito junto: as 33 precisavam de FAMÍLIA no `emocao-familia.md`,
    // que tinha sido construído sobre o vocabulário já cortado ("232 emoções", diz o cabeçalho).
    // Sem isso, tirar o teto criaria 33 emoções sem família e quebraria o reforço por família.
    // `IRIS_NUCLEO_CAP=4` reproduz o comportamento antigo, para comparar.
    const NUCLEO_CAP = Number(process.env.IRIS_NUCLEO_CAP) || Infinity
    const clean = (p) => p.replace(/\([^)]*\)/g, '').replace(/[*_`]/g, '').trim()
    const cargaByElem = { fogo: [], agua: [], terra: [], ar: [] }
    const recursoByElem = { fogo: [], agua: [], terra: [], ar: [] }
    const cargaCrencaByElem = { fogo: [], agua: [], terra: [], ar: [] } // crenças (forma cognitiva) — pro bloco C
    // A canônica anota, entre parênteses, A QUAL EMOÇÃO a crença pertence
    // ("coisa nova me embrulha o estômago" (pavor do novo — Hay)). 28% delas têm isso,
    // e o `clean` descartava — o que fazia a crença ser escolhida por POSIÇÃO.
    const cargaCrencaTagByElem = { fogo: [], agua: [], terra: [], ar: [] }
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
      if (ccm && curE) {
        const its = ccm[1].split('·').map((x) => x.trim()).filter((x) => clean(x).length > 2).slice(0, NUCLEO_CAP)
        cargaCrencaByElem[curE].push(...its.map(clean))
        cargaCrencaTagByElem[curE].push(...its.map((x) => ((x.match(/\(([^)]*)\)/) || [])[1] || '').split('—')[0].trim().toLowerCase()))
      }
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
      cargaCrenca: flat(cargaCrencaByElem), cargaCrencaTag: flat(cargaCrencaTagByElem), recursoCrenca: flat(recursoCrencaByElem),
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
    // ⚠️ NÃO tentar casar pela parte antes da seta (testado e descartado em 13/08).
    // Parece a correção óbvia para as emoções que o `emocao-familia.md` escreve como
    // `sintoma → emoção-base`, mas MEDIDO não resolve nenhum dos 2 casos abertos:
    // num deles a CANÔNICA é mais longa que a família (sufixo a mais), no outro a seta
    // está DENTRO das aspas do nome e o split quebra o próprio termo. O descasamento é
    // de DADO, não de busca — corrige-se no `emocao-familia.md`, não aqui.
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
// "o que é" de cada carga — a linha que explica o pêndulo ao cliente
const OQUE_CARGA = {}
{
  const md = fs.readFileSync(FAMILIA_MD, 'utf8')
  const sec = md.slice(md.indexOf('O que cada carga é'))
  for (const m of sec.matchAll(/^`([^`]+)`\s*=\s*(.+)$/gm)) OQUE_CARGA[normE(m[1])] = m[2].trim()
}
const oqueCargaDe = (emo) => OQUE_CARGA[normE(emo)] || null


// ---------- SUPORTE NUTRICIONAL (bloco 7 — decisão do founder 2026-08-02) ----------
// Lê o MAPA MÁQUINA de `tabela-carencias-LASTRO.md`. A lista é DETERMINÍSTICA: o Sonnet
// não escreve item nenhum, só a moldura. Foi assim que as crenças pararam de ser inventadas.
// ⛔ Campo fora do mapa NÃO gera suporte — falta de cobertura é teto da leitura.
const CARENCIAS_MD = path.join(LAB_DIR, 'lastro/tabela-carencias-LASTRO.md')
export function loadSuportes() {
  const md = fs.readFileSync(CARENCIAS_MD, 'utf8')
  const sec = md.slice(md.indexOf('## MAPA MÁQUINA'))
  const mapa = {}
  for (const linha of sec.split(/\r?\n/)) {
    const m = linha.match(/^\|\s*([a-z_]+)\s*\|(.+)\|(.+)\|(.+)\|\s*$/)
    if (!m) continue
    if (m[1] === 'campo') continue
    mapa[m[1]] = {
      suporte: m[2].split('·').map((x) => x.trim()).filter(Boolean),
      porque: m[3].trim(),
      leitura: m[4].trim(),
    }
  }
  return mapa
}
const SUPORTES = loadSuportes()

// porquê POR NUTRIENTE. Existe porque o texto por CAMPO fazia dois nutrientes sustentados
// pelo mesmo achado saírem com a MESMA frase (fígado explicava complexo B e magnésio
// igualzinho). O cliente lê a razão do nutriente; o campo continua sendo a evidência.
export function loadPorqueNutriente() {
  const md = fs.readFileSync(CARENCIAS_MD, 'utf8')
  const sec = md.slice(md.indexOf('## MAPA MÁQUINA — POR NUTRIENTE'))
  const out = {}
  for (const linha of sec.split(/\r?\n/)) {
    const m = linha.match(/^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/)
    if (!m || m[1] === 'nutriente' || /^-+$/.test(m[1])) continue
    out[m[1].toLowerCase()] = m[2]
  }
  return out
}
const PORQUE_NUTRIENTE = loadPorqueNutriente()

// TRADIÇÕES NOMEADAS — exceção do founder (2026-08-03) às 9 regras absolutas, válida SÓ
// para MTC e Ayurveda e SÓ neste bloco. Continua proibido erva, fórmula, prática e dose:
// elas explicam o padrão, não prescrevem.
export function loadTradicoes() {
  const md = fs.readFileSync(CARENCIAS_MD, 'utf8')
  const sec = md.slice(md.indexOf('## MAPA MÁQUINA — TRADIÇÕES'))
  const out = {}
  for (const linha of sec.split(/\r?\n/)) {
    const m = linha.match(/^\|\s*([a-z_]+)\s*\|([^|]*)\|([^|]*)\|\s*$/)
    if (!m || m[1] === 'campo') continue
    out[m[1]] = { mtc: m[2].trim(), ay: m[3].trim() }
  }
  return out
}
const TRADICOES = loadTradicoes()

// ESPECIFICAÇÃO: qual vitamina do grupo aquele campo aponta. O nutriente continua agregando
// (senão a convergência se dissolve — ver a nota na tabela); isto só diz, dos campos que
// dispararam, quais membros do grupo estão em jogo. ⛔ vitamina, NUNCA forma.
export function loadEspecificos() {
  const md = fs.readFileSync(CARENCIAS_MD, 'utf8')
  const sec = md.slice(md.indexOf('## MAPA MÁQUINA — ESPECIFICAÇÃO'))
  const out = {}
  for (const linha of sec.split(/\r?\n/)) {
    const m = linha.match(/^\|\s*([a-z_]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/)
    if (!m || m[1] === 'campo') continue
    ;(out[m[2].toLowerCase()] ||= {})[m[1]] = m[3].split('·').map((x) => x.trim()).filter(Boolean)
  }
  return out
}
const ESPECIFICOS = loadEspecificos()

// ---------- SUGESTÕES INTEGRATIVAS (bloco 8 — decisão do founder 2026-08-03) ----------
// Lê `tabela-integrativas-LASTRO.md`. Mesmo desenho do bloco 7: DETERMINÍSTICO, o Sonnet
// não escreve nada. ⛔ Categoria sem lastro nesta leitura não sai — nem com título.
const INTEG_MD = path.join(LAB_DIR, 'lastro/tabela-integrativas-LASTRO.md')
const chr10 = String.fromCharCode(10)
function secao(md, titulo) {
  const i = md.indexOf(titulo)
  if (i < 0) return ''
  const j = md.indexOf(chr10 + '## ', i + 5)
  return md.slice(i, j < 0 ? md.length : j)
}
function linhas3(sec) {
  const out = []
  for (const l of sec.split(/\r?\n/)) {
    const m = l.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/)
    // cabeçalho de tabela markdown: reconhecido pela 3ª coluna, que é sempre um rótulo fixo
    if (!m || /^-+$/.test(m[1]) || ['detalhe', 'para quem', 'específico'].includes(m[3].toLowerCase())) continue
    out.push([m[1], m[2], m[3]])
  }
  return out
}
export function loadIntegrativas() {
  const md = fs.readFileSync(INTEG_MD, 'utf8')
  const eixoDeCampo = {}
  for (const l of secao(md, '## 1. EIXO de cada campo').split(/\r?\n/)) {
    const m = l.match(/^\|\s*([a-z_]+)\s*\|\s*([a-z_]+)\s*\|\s*$/)
    if (m && m[1] !== 'campo') eixoDeCampo[m[1]] = m[2]
  }
  const porEixo = (titulo) => {
    const o = {}
    for (const [k, sug, det] of linhas3(secao(md, titulo))) (o[k] ||= []).push({ sug, det })
    return o
  }
  return {
    eixoDeCampo,
    nutricao: porEixo('## 2. NUTRIÇÃO'),
    corporais: porEixo('## 3. PRÁTICAS CORPORAIS'),
    contemplativas: porEixo('## 4. PRÁTICAS CONTEMPLATIVAS'),
    florais: porEixo('## 5. FLORAIS'),
    fito: porEixo('## 6. FITOTERAPIA'),
    adapto: porEixo('## 7. ADAPTÓGENOS'),
  }
}
const INTEG = loadIntegrativas()

// ---------- EXERCÍCIOS por FAMÍLIA EMOCIONAL (founder, 2026-08-03) ----------
// Lê `tabela-exercicios-LASTRO.md`. Substitui a §4 (práticas contemplativas por
// CALMAR/LIBERAR/ATIVAR), que entregava a MESMA lista para quase todo mundo: medido em
// 03/08, 5 das 6 leituras do lab recebiam os três mesmos exercícios, 67% de sobreposição
// média. A causa era a chave — 3 famílias × ~4 itens, com CALMAR de desempate.
//
// A chave agora é a FAMÍLIA EMOCIONAL (as 13 de `emocao-familia.md`, que vêm do mapa
// emocional e por isso são individuais) cruzada com a MODALIDADE. CALMAR/LIBERAR/ATIVAR
// não morre: vira TRAVA de segurança (ver `travaOk` abaixo).
const EXERC_MD = path.join(LAB_DIR, 'lastro/tabela-exercicios-LASTRO.md')
export function loadExercicios() {
  const md = fs.readFileSync(EXERC_MD, 'utf8')
  const out = {}
  for (const l of md.split(/\r?\n/)) {
    // 6 colunas: familia | modalidade | exercicio | detalhe | trava | fonte.
    // A tabela de MODALIDADES tem 2 colunas e a de TRAVAS tem 2 — não casam aqui.
    const m = l.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/)
    if (!m) continue
    const [, fam, mod, sug, det, trava, fonte] = m
    if (fam === 'família' || /^-+$/.test(fam)) continue // cabeçalho e separador
    ;(out[fam] ||= []).push({ sug, det, mod, trava: trava.toUpperCase(), fonte })
  }
  return out
}
const EXERCICIOS = loadExercicios()

// TRAVA — a única regra que pode BARRAR um exercício individualmente.
// ATIVAR só sai em padrão ATIVAR: ativar quem está exausto piora, e essa é a razão de
// CALMAR ser o desempate desde a v1 do bloco 8. O resto passa.
const travaOk = (trava, familiaPadrao) => trava !== 'ATIVAR' || familiaPadrao === 'ATIVAR'

// FAMÍLIA contemplativa — escolhida pelo PADRÃO (é a categoria que o dossiê considera a mais
// perigosa para Forer). Pontua as três e fica com a maior; EMPATE → CALMAR, porque baixar
// ativação não machuca ninguém e ATIVAR em quem está exausto piora.
const GATILHO = {
  LIBERAR: { campos: ['tireoide', 'boca_garganta', 'pulmoes'], emo: /raiva contida|voz sufocada|soltar|ressentimento|engol/i },
  CALMAR: { campos: ['adrenal', 'eixo_pituitario_adrenal', 'sistema_nervoso_autonomico', 'pineal_hipotalamica', 'coroa_simpatica'], emo: /alerta|ansiedade|não desliga|preocupa|urg[êe]ncia|vigil/i },
  ATIVAR: { campos: [], emo: /dispers|melancol|desânimo|desanimo|fadiga|exaur|apatia/i },
}


// ---------- resolve um campo do exame → chave da tabela + classe ----------
function classify(campo) {
  if (ALIAS[campo]) return { key: ALIAS[campo], klass: 'emocional' }
  if (VISTO[campo]) return { key: VISTO[campo], klass: 'visto', alvo: VISTO[campo] }
  if (MARCADOR.has(campo)) return { key: campo, klass: 'marcador' }
  if (MODULADOR.has(campo)) return { key: campo, klass: 'modulador' }
  return { key: campo, klass: 'emocional' }
}

// Aceita o EXAME como objeto (produção: vem de report_findings.exame_json) ou como
// nome (lab: lê _exame-<nome>.json). Mesmo motor nos dois caminhos.
function calc(exameOuNome, lastro) {
  const name = typeof exameOuNome === 'string' ? exameOuNome : (exameOuNome?.__nome || 'exame')
  const d = typeof exameOuNome === 'string'
    ? JSON.parse(fs.readFileSync(EXAM(exameOuNome), 'utf8'))
    : exameOuNome
  const achados = d.achados_de_atencao || []
  const preservados = d.sistemas_preservados || []

  const elem = { carga: { fogo: 0, agua: 0, terra: 0, ar: 0 }, recurso: { fogo: 0, agua: 0, terra: 0, ar: 0 } }
  const centro = { mente: { t: 0, l: 0 }, coracao: { t: 0, l: 0 }, corpo: { t: 0, l: 0 } }
  const emoCarga = {}, emoRecurso = {} // (B) mapa emocional — acumula score por emoção
  const emoCampos = {} // emoção → campos DISTINTOS que a emitiram (convergência)
  const crencaSrc = {} // crença → achados que a emitiram (CORROBORAÇÃO)
  const antiSrc = {} // emoção de carga → de onde puxar o 🟢 (campo de MAIOR peso que a emitiu)
  const achadoList = [] // TODOS os achados evidenciados (decisão founder: nada de colapsar em 1)
  const skipped = [], adjuvantes = []

  // DEDUPE POR CAMPO DO LASTRO — o Stage 1 emite o SINAL e o SISTEMA como achados
  // separados (`manchas_psoricas` + `sistema_imune`; `anel_nervoso` + `sistema_nervoso`;
  // `anel_sodico` + `sistema_circulatorio`), mas o ALIAS resolve os dois no MESMO campo.
  // Somar os dois era contar a mesma observação duas vezes: inflava a emoção (Miguel:
  // 5.87+2.14=8.01 em "baixa autoestima") e produzia CORROBORAÇÃO FALSA na crença.
  // Vale a maior intensidade — sinal e sistema são a mesma coisa vista de dois jeitos.
  const porChave = {}
  for (const a of achados) {
    const { key, klass } = classify(a.campo)
    if (klass !== 'emocional') continue
    const cur = porChave[key]
    if (!cur || (a.intensidade || 0) > (cur.intensidade || 0)) porChave[key] = a
  }
  const fundidos = Object.values(porChave)
  const achadosUnicos = achados.filter((a) => {
    const { klass } = classify(a.campo)
    return klass !== 'emocional' || fundidos.includes(a)
  })

  // SUPORTE NUTRICIONAL: nutriente → conjunto de campos INDEPENDENTES que o sustentam.
  // A convergência é o sinal (mesma régua da corroboração das crenças): um nutriente
  // apontado por 3 achados diferentes vale muito mais que um apontado por 1.
  const supCampos = {}   // nutriente → Set(campo)
  const supPeso = {}     // nutriente → soma das intensidades (desempate)
  const supDetalhe = {}  // campo → {porque, leitura} para o render citar a origem
  const eixoPeso = {}      // eixo → maior intensidade que o sustenta (bloco 8)
  const camposAtivos = []  // {key,int} — usado na escolha da família contemplativa

  // ACHADOS → carga (elemento) + tensão (centro)
  for (const a of achadosUnicos) {
    const { key, klass, alvo } = classify(a.campo)
    if (klass === 'marcador' || klass === 'modulador') { skipped.push(`${a.campo}(${klass})`); continue }
    if (klass === 'visto') { adjuvantes.push(`${a.campo}→${alvo}`); continue } // sem peso
    const t = lastro[key]
    if (!t) { skipped.push(`${a.campo}(SEM-LASTRO)`); continue }
    const w = Math.pow(a.intensidade || 0, GAMMA)
    const sup = SUPORTES[key]
    if (sup) {
      supDetalhe[key] = { porque: sup.porque, leitura: sup.leitura, int: a.intensidade || 0, ...(TRADICOES[key] || {}) }
    }
    {
      // EIXO do achado (bloco 8) — independe de haver suporte nutricional pro campo
      const eixo = INTEG.eixoDeCampo[key]
      if (eixo) eixoPeso[eixo] = Math.max(eixo in eixoPeso ? eixoPeso[eixo] : 0, a.intensidade || 0)
      camposAtivos.push({ key, int: a.intensidade || 0 })
      // ⚠️ `sup` PODE SER undefined — o comentário logo acima já dizia que este bloco
      // "independe de haver suporte nutricional pro campo", mas o laço abaixo lia
      // `sup.suporte` sem guarda. Nunca estourou porque, até 2026-08-13, TODO campo do
      // lastro tinha entrada em SUPORTES (os 9 sem entrada são marcador/modulador, que
      // saem no `continue` lá em cima). Ao mapear `baco` e `plexo_solar` — que entram no
      // cálculo e ainda não têm suporte nutricional — o `calc()` passou a estourar
      // `Cannot read properties of undefined (reading 'suporte')`. Achado antes de subir.
      for (const n of sup?.suporte ?? []) {
        ;(supCampos[n] ||= new Set()).add(key)
        supPeso[n] = (supPeso[n] || 0) + w
      }
    }
    for (const e of ['fogo', 'agua', 'terra', 'ar']) elem.carga[e] += w * (t.elem[e] || 0)
    const cs = TOPO_CENTRO[key] || t.centros // centro por ZONA topográfica (decisão founder)
    const cw = w / cs.length
    for (const c of cs) centro[c].t += cw
    t.carga.forEach((e, i) => {
      emoCarga[e] = (emoCarga[e] || 0) + w * Math.pow(DECAY, i) // (B) leque de carga com decaimento por rank
      ;(emoCampos[e] ||= new Set()).add(key) // quantos campos INDEPENDENTES apontam pra cá
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
    // CRENÇA do achado (bloco 6): UMA por achado. Escolhida pela ANOTAÇÃO da canônica
    // que casa com a emoção-núcleo — não pela posição. Sem anotação, cai na 1ª do campo.
    const nucleo = (breakdown[0]?.emo || t.carga[0] || '').toLowerCase()
    const tags = t.cargaCrencaTag || []
    let idx = tags.findIndex((tg) => tg && tg.length > 2 && (nucleo.includes(tg) || tg.includes(nucleo.split(/[\/,(—]/)[0].trim())))
    if (idx < 0) idx = 0
    const cr = (t.cargaCrenca || [])[idx]
    if (cr) (crencaSrc[cr] ||= []).push({ campo: key, int: a.intensidade || 0 })
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

  // ---- CRENÇAS (bloco 6) — o cálculo é DIFERENTE do das emoções, de propósito ----
  // (a) sem leque/decaimento: o campo emite UMA crença, não uma paleta — não há
  //     paleta genérica pra fazer decair;
  // (b) sem reforço por família: crença não tem família, tem CORROBORAÇÃO — a mesma
  //     regra vinda de 2 achados independentes está mais entranhada. É mais literal
  //     e mais válido que o reforço de família, porque crença é uma REGRA que a
  //     pessoa carrega, não um estado passageiro;
  // (c) ABSOLUTA (decisão founder): crença não tem polo oposto — não se balança pro
  //     contrário, se desmonta. Por isso não entra no modelo bipolar do pêndulo;
  // (d) ⛔ SEM MEDIDA PRÓPRIA: a crença É a forma cognitiva do achado, então HERDA a
  //     intensidade dele. Inventar uma métrica separada seria falsa precisão — o
  //     mesmo Forer-pela-matemática que fez a gente recusar abater carga com preservado.
  const BANDA = ['fraca', 'fraca', 'média', 'forte', 'muito forte'] // índice = intensidade−1
  const crencaList = Object.entries(crencaSrc).map(([texto, srcs]) => {
    const int = Math.max(...srcs.map((x) => x.int))
    let i = Math.min(Math.max(int, 1), 5) - 1
    const corroborada = srcs.length > 1
    if (corroborada) i = Math.min(i + 1, BANDA.length - 1) // +1 banda quando 2+ achados apontam a mesma regra
    return { texto, nivel: BANDA[i], forca: i + 1, int, corroborada, campos: srcs.map((x) => x.campo) }
  }).sort((a, b) => b.forca - a.forca || b.int - a.int)

  const rankedCarga = Object.entries(emoCarga).sort((a, b) => b[1] - a[1])
  const mapaCarga = rankedCarga.filter(([e]) => garantidas.has(e)) // 1º: as garantidas
  const N = Math.max(8, mapaCarga.length)
  for (const row of rankedCarga) { if (mapaCarga.length >= N) break; if (!garantidas.has(row[0])) mapaCarga.push(row) } // 2º: preenche
  mapaCarga.sort((a, b) => b[1] - a[1])
  const mapaRecurso = top(emoRecurso, 5)
  achadoList.sort((a, b) => b.w - a.w)
  // ---- lista final de SUPORTES, ordenada por CONVERGÊNCIA ----
  // Ordena por nº de achados independentes; empate desempata pelo peso somado. Um suporte
  // apontado por 1 campo só entra como "sinal isolado" — o render mostra a diferença, e o
  // texto NUNCA afirma falta: é hipótese a investigar.
  const suporteList = Object.entries(supCampos).map(([nutriente, set]) => {
    const campos = [...set]
    return {
      nutriente,
      campos,
      n: campos.length,
      peso: supPeso[nutriente] || 0,
      convergente: campos.length >= 2,
      porque: PORQUE_NUTRIENTE[nutriente.toLowerCase()] || '',
      // membros do grupo que ESTES campos apontam (dedup, ordem de aparição)
      especificos: [...new Set(campos.flatMap((c) => (ESPECIFICOS[nutriente.toLowerCase()] || {})[c] || []))],
      // a LEITURA (camada simbólica) vem do campo de MAIOR intensidade que o sustenta
      origem: campos.map((c) => ({ campo: c, ...supDetalhe[c] })).sort((a, b) => (b.int || 0) - (a.int || 0))[0] || null,
    }
  }).sort((a, b) => b.n - a.n || b.peso - a.peso)

  // ---- BLOCO 8: sugestões integrativas ----
  // Cada categoria por EIXO sai ordenada pela intensidade do achado que sustenta o eixo, com
  // teto de 3 (o mesmo que o dossiê já praticava). Eixo sem achado não gera nada.
  const eixosOrdenados = Object.entries(eixoPeso).sort((a, b) => b[1] - a[1])
  const porCategoria = (tabela, teto = 3) => {
    const out = []
    for (const [eixo] of eixosOrdenados) for (const it of tabela[eixo] || []) out.push({ ...it, eixo })
    return out.slice(0, teto)
  }

  // FAMÍLIA contemplativa: pontua as três pelos campos e pelas cargas; empate → CALMAR.
  const cargasTexto = Object.keys(emoCarga).join(' · ')
  const placar = {}
  for (const [fam, g] of Object.entries(GATILHO)) {
    let n = 0
    for (const c of camposAtivos) if (g.campos.includes(c.key)) n += 2
    if (g.emo.test(cargasTexto)) n += 1
    placar[fam] = n
  }
  const familia = Object.entries(placar).sort((a, b) => b[1] - a[1] || (a[0] === 'CALMAR' ? -1 : 1))[0]
  const familiaEscolhida = (familia && familia[1] > 0) ? familia[0] : 'CALMAR'

  // FLORAIS: cruzam com a EMOÇÃO, não com o campo — o mapa emocional já é individual.
  const floraisList = []
  for (const [emo] of Object.entries(emoCarga).sort((a, b) => b[1] - a[1])) {
    const chave = Object.keys(INTEG.florais).find((k) => normE(emo).includes(normE(k)) || normE(k).includes(normE(emo)))
    if (!chave) continue
    const it = INTEG.florais[chave][0]
    if (it && !floraisList.some((x) => x.sug === it.sug)) floraisList.push({ ...it, emo })
    if (floraisList.length >= 3) break
  }

  // ---- EXERCÍCIOS: família emocional × modalidade (2026-08-03) ----
  // DOIS eixos, os dois individuais — é o que impede a lista de repetir:
  //
  //   1. QUAL família emocional, na ordem do peso da carga (o mesmo rank do mapa emocional).
  //   2. QUAL modalidade dentro dela, pelo CENTRO mais carregado desta leitura — o mesmo
  //      mente/coração/corpo das agulhas que o cliente vê no bloco 2.
  //
  // Sem o eixo 2, duas pessoas com Raiva no topo recebiam o mesmo exercício de Raiva: medido,
  // "Empurrar a parede" saía em 6 de 6 leituras. Com ele, quem está carregado no CORPO entra
  // por movimento/somático e quem está carregado na MENTE entra por atenção/respiração —
  // pela porta que está aberta nesta pessoa.
  const MOD_POR_CENTRO = {
    corpo: ['somático', 'movimento', 'toque', 'respiração', 'atenção'],
    mente: ['atenção', 'respiração', 'somático', 'movimento', 'toque'],
    coracao: ['toque', 'movimento', 'atenção', 'respiração', 'somático'],
  }
  const centrosPorCarga = ['mente', 'coracao', 'corpo'].sort((a, b) => centro[b].t - centro[a].t)
  const prefMod = []
  for (const c of centrosPorCarga) for (const mo of MOD_POR_CENTRO[c]) if (!prefMod.includes(mo)) prefMod.push(mo)
  const rankMod = (mo) => { const i = prefMod.indexOf(mo); return i < 0 ? 99 : i }

  const exercicios = []
  const modUsadas = new Set()
  const famUsadas = new Set()
  const famsOrdenadas = []
  for (const [emo] of rankedCarga) {
    const f = familiaDe(emo)
    if (f && EXERCICIOS[f] && !famsOrdenadas.includes(f)) famsOrdenadas.push(f)
  }
  // 2 passadas: a 1ª pega no máximo um por família (espalha), a 2ª completa o teto.
  for (const soUmPorFamilia of [true, false]) {
    for (const f of famsOrdenadas) {
      if (exercicios.length >= 3) break
      if (soUmPorFamilia && famUsadas.has(f)) continue
      const candidatos = EXERCICIOS[f]
        .filter((ex) => travaOk(ex.trava, familiaEscolhida))
        .filter((ex) => !modUsadas.has(ex.mod))
        .filter((ex) => !exercicios.some((x) => x.sug === ex.sug))
        // ordem da tabela desempata — determinístico, nunca aleatório
        .sort((a, b) => rankMod(a.mod) - rankMod(b.mod))
      const escolhidos = soUmPorFamilia ? candidatos.slice(0, 1) : candidatos
      for (const ex of escolhidos) {
        if (exercicios.length >= 3) break
        if (modUsadas.has(ex.mod)) continue
        exercicios.push({ ...ex, familiaEmocional: f })
        modUsadas.add(ex.mod)
        famUsadas.add(f)
      }
    }
  }

  const integrativas = {
    familia: familiaEscolhida,
    exercicios,
    placar,
    eixos: eixosOrdenados.map(([e, i]) => ({ eixo: e, int: i })),
    nutricao: porCategoria(INTEG.nutricao),
    corporais: porCategoria(INTEG.corporais),
    contemplativas: (INTEG.contemplativas[familiaEscolhida] || []).slice(0, 3),
    florais: floraisList,
    fito: porCategoria(INTEG.fito),          // ⛔ só no guia do terapeuta
    // a chave da tabela é "CALMAR (hipervigilância…)", não "CALMAR" — casa por prefixo
    adapto: (() => {
      const k = Object.keys(INTEG.adapto).find((x) => x.trim().toUpperCase().startsWith(familiaEscolhida))
      return k ? [{ ...INTEG.adapto[k][0], eixo: familiaEscolhida }] : []
    })(),
  }

  return { name, elem, centro, pres, mapaCarga, mapaRecurso, antidoto, colisoes, crencaList, suporteList, integrativas,
    // nº de campos distintos por emoção — o EXTREMO da régua se ganha por CONVERGÊNCIA
    // (metodologia C do founder), não por um único achado forte. Sem isto, um I5 de
    // fonte única desenha igual a um I4 confirmado por três órgãos.
    nCampos: Object.fromEntries(Object.entries(emoCampos).map(([e, s2]) => [e, s2.size])),
    // achados distintos por FAMÍLIA. É o critério de convergência que vale: a mesma
    // emoção vinda de 2 órgãos quase nunca acontece, mas a mesma FAMÍLIA vinda de 2
    // acontece e é o que a metodologia C chama de "a família que repete".
    famN: Object.fromEntries(Object.entries(famMembers).map(([f, ms]) => [f, ms.length])), achadoList, famScore, domFam, skipped, adjuvantes, nAch: achados.length, nPres: preservados.length }
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
  // ⚠️ régua ÚNICA: `nivelDe` é o mesmo do serialize (prompt) e do render (cliente).
  // Antes existia uma cópia aqui, SEM a regra de corroboração — este dump mostrava
  // "muito alta" onde o cliente lia "alta", e é por ele que se calibra. Não duplicar.
  const nivel = nivelDe
  const maxE = (r.mapaCarga[0] || [0, 1])[1] || 1
  // metodologia C — família que REPETE entre achados carrega a soma (reforço SEM elemento)
  const famRank = Object.entries(r.famScore || {}).sort((a, b) => b[1] - a[1])
  if (famRank.length) {
    L.push('\n(C) REFORÇO POR FAMÍLIA (a que repete entre achados leva o líder ao extremo):')
    L.push('  ' + famRank.map(([f, s], i) => `${i === 0 ? '★' : '·'}${f} ${s.toFixed(1)}`).join('  ·  ') + `   → dominante: ${r.domFam}`)
  }
  L.push('\n(B) MAPA EMOCIONAL — leque de CARGA (100% = um achado I5 sozinho = 5,87):')
  for (const [emo, s] of r.mapaCarga) {
    const bar = '▓'.repeat(Math.round((s / maxE) * 16)).padEnd(16)
    const a = r.antidoto?.[emo]
    const pc = `${Math.round(normCarga(s) * 100)}%`.padStart(5)
    L.push(`    ${bar} ${s.toFixed(1).padStart(4)} ${pc} ${nivel(s).padEnd(9)} ${emo}`)
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
export { parseLastro, calc, classify, eixoDe, familiaDe, displayDe, oqueCargaDe, EIXOS, TOPO_CENTRO, GAMMA, K, BASELINE_LIVRE, DECAY, EXAM }
// ESCALA DA CARGA — fonte ÚNICA. O serialize (que alimenta o prompt) e o render (que o
// cliente lê) importam daqui. ⛔ Não recriar cópia local de nenhuma destas: a divergência
// entre as cópias foi exatamente o defeito corrigido em 2026-08-13.
export { MAX_ACHADO, CORTES, PISO_CARGA, normCarga, nivelDe, bipCarga, leftCarga }

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
