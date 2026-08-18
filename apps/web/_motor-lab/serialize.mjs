#!/usr/bin/env node
// SERIALIZADOR — transforma o output do motor + o leque da canônica nos BLOCOS
// B e C que entram no prompt Stage 2 novo (ver prompts/stage2-relatorio-novo-DRAFT.md).
//   B = DADOS DA LEITURA (números já calculados — o LLM usa, não recalcula)
//   C = LEQUE (emoções + crenças por área — o LLM seleciona, nunca inventa fora)
// uso: node _motor-lab/serialize.mjs [self|daniel|miguel]
import fs from 'node:fs'
import path from 'node:path'
// BASE resolvida em RUNTIME (ver lab-dir.mjs) — NÃO usar import.meta.url: o webpack o
// congela no caminho da máquina de build e isso dá ENOENT em produção.
import { LAB_DIR, REPO } from './lab-dir.mjs'
import { parseLastro, calc, classify, familiaDe as famDe, BASELINE_LIVRE, EXAM, nivelDe, normCarga, bipCarga } from './motor-calc.mjs'

const α = BASELINE_LIVRE
const agulhaDe = (t, l) => Math.round(((l + α) / (t + l + 2 * α)) * 100)
// ⛔ NÃO recriar `nivel` aqui. A régua é uma só e mora no motor-calc — este arquivo
// alimenta o PROMPT e o render alimenta o CLIENTE; se as duas cópias divergirem, o modelo
// escreve num nível e o gráfico mostra outro. Foi o que aconteceu até 2026-08-13.
const nivel = (s) => nivelDe(s)
const pende = (a) => (a < 40 ? 'mais tensão' : a <= 60 ? 'meio a meio' : 'mais livre')

// rótulo de cada lado do centro (o que o gráfico DIZ) — SPEC bloco 2
function centroLabel(c, agulha, sabor) {
  const livre = agulha >= 50
  if (c === 'mente') return livre ? 'pensa claro, sem ruminar' : 'cabeça que não desliga — rumina, antecipa'
  if (c === 'coracao') return livre ? 'sente com profundidade e demonstra — o afeto chega ao outro' : 'sente com profundidade, mas o afeto não sai: fica guardado'
  if (livre) return 'corpo tranquilo, responde sem disparar'
  return sabor === 'medo' ? 'reage se protegendo, em alerta' : 'ferve rápido, gatilho curto'
}


// ---------- RODÍZIO DE ÂNGULOS (experimento B, 2026-08-17) ----------
// PROBLEMA: o prompt entregava a frase pronta por movimento; com 4-5 Caminhos, a mesma frase
// saía 5 vezes. Medido em 25 relatórios: s6 com 67% de igualdade interna e 85% entre clientes.
// IDEIA: o motor SABE quantos Caminhos vão sair e em que ordem. Então ele atribui, por Caminho,
// um ÂNGULO diferente para cada movimento — variação GARANTIDA, sem depender do modelo lembrar.
// Mesma lógica que derrubou a sobreposição dos exercícios de 67% para 13%.
const ANGULOS = {
  s2: ['uma cena RECENTE em que isso apareceu',
       'a última vez em que isso se REPETIU (não a primeira, a mais recente que se repetiu)',
       'o GATILHO — o que costuma acender isso',
       'a ANTECIPAÇÃO — o momento em que ela percebe que vem vindo',
       'o DEPOIS — como o corpo fica quando aquilo passa'],
  s3: ['o que essa sensação DIRIA se tivesse voz',
       'o que ela PEDE (não o que ela reclama)',
       'o que ela IMPEDE de acontecer',
       'HÁ QUANTO TEMPO ela está por ali',
       'COM QUEM ela aprendeu a ficar'],
  s5: ['uma vez em que ela CONSEGUIU o outro lado, mesmo pequena',
       'a PESSOA com quem isso não acontece',
       'o LUGAR ou a situação onde aquilo afrouxa sozinho',
       'a HORA DO DIA em que aquilo pesa menos',
       'quem PERCEBEU a mudança nela antes dela mesma'],
  // ⚠️ s7 e sub ENTRARAM na 2ª rodada (17/08): sem ângulo, eles PIORARAM enquanto os outros melhoravam
  // — s7 foi de 31% pra 61% interno e de 42% pra 81% entre clientes, porque a regra do "já pode"
  // trocou um molde fixo por outro molde fixo. A lição: molde fixo repete, sempre. Não importa qual.
  // ⚠️ 3ª rodada (17/08): o s7 tinha virado pergunta hipotética e o passo SUMIU — medido,
  // 30 de 33 caminhos de produção entregavam ação concreta contra 2 de 29 nos novos.
  // Bob: "era a única coisa que o cliente levava embora para fazer". O defeito nunca foi a ação
  // ser ação; era a MESMA frase de abertura cinco vezes. Então: a ação volta, e o que roda é o
  // TIPO de passo — cada Caminho pede uma natureza de gesto diferente.
  s7: ['DIZER algo — uma frase que ela costuma engolir, dita no momento em que aparece',
       'PARAR algo — uma coisa pequena que ela faz no automático e pode interromper uma vez',
       'NOTAR sem mudar nada — só reparar quando acontece, sem corrigir',
       'um gesto do CORPO — algo físico e curto, no momento em que aquilo aperta',
       'ESCOLHER um momento fixo da semana para deixar aquilo de lado de propósito'],
  sub: ['o MOVIMENTO: de onde para onde',
        'o que ela GANHA do outro lado',
        'o CUSTO que para de ser pago',
        'a IMAGEM concreta do outro lado',
        'o que ficava IMPEDIDO e passa a caber'],
  s6: ['de que aquilo estava PROTEGENDO',
       'o que teria acontecido SEM aquilo',
       'QUANDO aquilo foi útil de verdade',
       'DE QUEM ela aprendeu a se cuidar assim',
       'o que aquilo JÁ NÃO precisa mais segurar'],
}

// `exameOuNome` = objeto (produção) ou nome (lab). `nomePessoa` sobrepõe o mapa do lab.
function serialize(exameOuNome, nomePessoa) {
  const lastro = parseLastro()
  const r = calc(exameOuNome, lastro)
  const ehNome = typeof exameOuNome === 'string'
  const d = ehNome ? JSON.parse(fs.readFileSync(EXAM(exameOuNome), 'utf8')) : exameOuNome
  const NOME = nomePessoa
    || (ehNome ? ({ self: 'Rhelton', s5novo: 'Rhelton', victor: 'Victor', daniel: 'Daniel', miguel: 'Miguel' }[exameOuNome] || exameOuNome) : 'você')

  // sabor do Corpo (2 motores): raiva/luta vs medo/fuga — pelo elemento de carga dominante
  const sabor = r.elem.carga.fogo >= r.elem.carga.agua ? 'raiva' : 'medo'

  const L = []
  // ======================= BLOCO B =======================
  L.push('# BLOCO B — DADOS DA LEITURA (pré-calculados)')
  L.push('> ⚠️ INTERNO. São os números do motor — **use, não recalcule**. NUNCA copie termo técnico/nome de área daqui pro texto do cliente.')
  L.push(`> Pessoa: **${NOME}** · achados=${r.nAch} · preservados=${r.nPres}`)
  L.push('')

  L.push('## Como funciona por dentro (3 centros · escala −50 tensão ⟷ 0 equilíbrio ⟷ +50 livre)')
  const centros = ['mente', 'coracao', 'corpo']
  const nomeC = { mente: 'Mente (como pensa)', coracao: 'Coração (como sente)', corpo: 'Corpo (como age)' }
  const ag = {}, bip = {}
  for (const c of centros) { ag[c] = agulhaDe(r.centro[c].t, r.centro[c].l); bip[c] = ag[c] - 50 } // bipolar centrado no 0
  const sig = (v) => (v > 0 ? `+${v}` : `${v}`)
  // RANKING de tensão (mais negativo = mais tenso). SÓ o 1º é "o mais tenso".
  const porTensao = centros.slice().sort((x, y) => bip[x] - bip[y])
  const rankTxt = {}
  porTensao.forEach((c, i) => {
    rankTxt[c] = bip[c] >= 5 ? 'LIVRE (força — NÃO é tenso)' : i === 0 ? '★ O MAIS tenso (só ESTE é "o mais")' : `também tenso, mas MENOS (${i + 1}º)`
  })
  for (const c of centros) L.push(`- **${nomeC[c]}**: ${sig(bip[c])} — ${rankTxt[c]} → "${centroLabel(c, ag[c], sabor)}"`)
  const nm = (c) => nomeC[c].split(' ')[0]
  L.push(`- **RANKING de tensão (use exatamente esta ordem):** 1º ${nm(porTensao[0])} (${sig(bip[porTensao[0]])}) · 2º ${nm(porTensao[1])} (${sig(bip[porTensao[1]])}) · 3º ${nm(porTensao[2])} (${sig(bip[porTensao[2]])}). ⚠️ só o 1º é "o mais tenso"; NÃO chame dois centros de "o mais".`)
  L.push(`- **Tensão dominante × secundário:** ${nm(porTensao[0])} (mais tenso) × ${nm(porTensao[1])}`)
  if (sabor) L.push(`- Sabor do Corpo: **${sabor === 'medo' ? 'medo/fuga (alerta)' : 'raiva/luta (ferve rápido)'}**`)
  L.push('')

  L.push('## Achados evidenciados (todos — ordenados por peso; nada colapsa)')
  r.achadoList.forEach((a, i) => {
    const tag = i === 0 ? ' [PRINCIPAL]' : i === 1 ? ' [2º]' : i === 2 ? ' [3º]' : ''
    const emos = a.breakdown.map((x) => x.emo).join(' + ') // emoção, SEM %elemento (decisão founder: mapa/achados sem elemento)
    L.push(`${i + 1}. ‹${a.campo}› ${nivel(Math.pow(a.int, 1.1))} — ${emos}${tag}`)
  })
  L.push('→ **BLOCO 1 "Em poucas palavras": teça os 3 MAIORES (PRINCIPAL + 2º + 3º) como emoção — SEMPRE os 3, o maior abre. É o punch.**')
  L.push('')

  // régua bipolar −50 (carregado) ⟷ 0 ⟷ +50 (livre) CONTÍNUA — cada emoção seu número
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  // ESCALA SATURANTE (calibração 2026-07-27, medida em 49 scores de 6 exames).
// A linear com trava tinha dois defeitos: CRAVAVA em cima (o Daniel, 8.81, ficava
// idêntico a um hipotético 15) e ACHATAVA embaixo (tudo abaixo de 1.1 virava -6, então
// ⚠️ A curva saturante e o freio por convergência que moravam aqui SAÍRAM (2026-08-13).
// A escala agora é normalizada e LINEAR, e vem de `motor-calc.mjs` — fonte única, para o
// que o prompt lê e o que o cliente vê nunca mais divergirem. Ver o bloco de comentário
// "ESCALA NORMALIZADA DA CARGA" lá.
  const bipR = (s) => clamp(Math.round(9 * s + 12), 24, 48)
  L.push('## Mapa emocional (0% = nada ⟷ 100% = o máximo da escala: um achado no talo (I5), ou vários apontando pra mesma coisa)')
  L.push('**O que pesa hoje (cargas) — cada uma com o SEU lado-antídoto (o outro polo do mesmo pêndulo):**')
  for (const [emo, s] of r.mapaCarga) {
    const a = r.antidoto?.[emo]
    let anti = ''
    if (a) {
      const formul = a.pool.slice(0, 3)
      anti = ` ⟷ 🟢 **${a.principal}**${a.oque ? ` (${a.oque})` : ''}${formul.length ? ` _[formulações do eixo: ${formul.join(' · ')}]_` : ''}`
    }
    const conv = (r.famN?.[famDe(emo)] || 1) >= 2
    // ⛔ TESTADO E REPROVADO (A/B de 20 leituras, 40 gerações, US$ 9,10 — 13/08).
    // A ideia era oferecer aqui as emoções IRMÃS do mesmo campo, para o modelo escolher
    // pela `descricao_visual` em vez de aceitar a que o motor escolheu por POSIÇÃO na
    // tabela. MEDIDO: sobreposição entre os 20 relatórios 40,4% → 40,2% — ruído, não
    // efeito. Ver AUDITORIA-motor-2026-08-13.md §6 antes de tentar de novo.
    L.push(`- ${emo} — ${nivel(s)} · ${Math.round(normCarga(s) * 100)}% da escala (agulha ${Math.round(bipCarga(s))})${conv ? ' ⊕ corroborada' : ''}${anti}`)
  }
  // ⭐ ÂNGULOS POR CAMINHO — cada Caminho recebe um ângulo DIFERENTE em cada movimento.
  // O deslocamento por movimento evita que os Caminhos fiquem "em fase" (todos no ângulo 1, depois todos no 2).
  {
    // ---------- UM CAMINHO POR TEMA (2026-08-17) ----------
    // PROBLEMA (laudo do Bob + medição): em 58 das 60 leituras, 2+ dos cinco primeiros pêndulos são da
    // MESMA FAMÍLIA — quatro nomes para o mesmo fenômeno. O cliente recebia CINCO exercícios para TRÊS
    // temas, e reclamou de repetição. Consertar só a redação dos Caminhos não resolvia: "o leitor vai
    // continuar fazendo quatro exercícios para o mesmo problema, com quatro nomes diferentes".
    // REGRA: um Caminho por família, o de maior carga. Piso de 3 (senão uma leitura cairia a 2).
    // ⚠️ O MAPA (bloco 5) continua mostrando TODOS os pêndulos — lá a função é painel, e ver as emoções
    // vizinhas da mesma família é informação. Quem deduplica é só o bloco dos Caminhos.
    const caminhos = []
    {
      const vistas = new Set()
      for (const [emo, sc] of r.mapaCarga) {
        const k = famDe(emo) || `__${emo}`
        if (vistas.has(k)) continue
        vistas.add(k); caminhos.push([emo, sc])
        if (caminhos.length >= 5) break
      }
      // ⛔⛔ NÃO REPOR PISO AQUI. Tentei um piso de 3 em 17/08 e ele DESFEZ a própria dedup:
      // numa leitura com só 2 temas reais, o piso completou o 3º puxando um SINÔNIMO do 1º
      // ("sobrecarga mental" e depois "tagarelice mental rotativa", ambos de Ansiedade e
      // preocupação, os dois indo para "Sossego"). O laudo pegou em produção: "2 dos 3 Caminhos
      // vão para Sossego" — pior que antes do conserto.
      // A regra é: quem tem 2 temas recebe 2 Caminhos. Dois Caminhos verdadeiros valem mais que
      // três com um inventado — é a doença inteira que estamos curando. Afeta 1 leitura em 60.
    }
    const nCam = caminhos.length
      // ⚠️ 2ª rodada mostrou: com todo mundo começando no mesmo ângulo, o Caminho 1 de TODO cliente
      // recebia o mesmo — a repetição saía de dentro do relatório e reaparecia ENTRE clientes (s7 a 75%).
      // O ponto de partida agora vem da PRÓPRIA leitura: determinístico (a mesma íris dá sempre o mesmo
      // resultado, então o golden continua estável) e diferente de pessoa para pessoa.
      const semente = (d.achados_de_atencao || []).reduce((acc, a2) =>
        acc + (a2.intensidade || 0) + String(a2.campo || '').length, (d.achados_de_atencao || []).length)
    if (nCam >= 2) {
      L.push('')
      L.push(`## ⭐ OS CAMINHOS DESTA LEITURA — são EXATAMENTE estes ${nCam}, nesta ordem`)
      L.push('> ⛔ **NÃO escolha os Caminhos você.** A lista abaixo já foi deduplicada por TEMA: o mapa acima')
      L.push('> mostra emoções vizinhas da mesma família (ex.: sobrecarga mental · ruminação · preocupação),')
      L.push('> e escrever um Caminho para cada uma faria a pessoa repetir o mesmo exercício com outro nome.')
      L.push(`> ⛔ Não acrescente Caminho, não troque, não reordene. São ${nCam} — e ${nCam} é a resposta certa`)
      L.push('> para esta pessoa, mesmo que o mapa liste mais emoções.')
      L.push('')
      L.push('## ⭐ ÂNGULO DE CADA CAMINHO — obrigatório, é o que impede os Caminhos de saírem iguais')
      L.push('> Um ângulo por movimento, por Caminho. **Dois Caminhos nunca recebem o mesmo ângulo no mesmo movimento.**')
      L.push('> Se um ângulo não couber nesta pessoa, troque por OUTRO que não esteja em uso — nunca repita o de outro Caminho.')
      const desloc = { sub: 0, s2: 1, s3: 2, s5: 3, s6: 4, s7: 0 }
      for (let i = 0; i < nCam; i++) {
        const emo = caminhos[i][0]
        const partes = ['sub', 's2', 's3', 's5', 's6', 's7'].map((k) => {
          const banco = ANGULOS[k]
          return `\`${k}\` → ${banco[(semente + i + desloc[k]) % banco.length]}`
        })
        L.push(`- **Caminho ${i + 1} · ${emo}** — ${partes.join(' · ')}`)
      }
      L.push('')
    }
  }
  L.push('> ⚠️ O 🟢 acima é o **antídoto** = a DIREÇÃO de saída daquela carga, não uma força que a pessoa já tem. Use-o pra mostrar a saída ("o outro lado disso é…"), **nunca** pra afirmar que ela já está assim. O que ela JÁ tem livre é só a lista abaixo.')
  L.push('> **O nome em negrito é o termo do EIXO — já está em 8ª série, use-o.** As "formulações do eixo" são variações da MESMA saída: escolha a que encaixa nesta pessoa, e quanto mais forte a carga, mais forte a formulação. NÃO invente antídoto fora do eixo.')
  // colisão de eixo: as duas pontas do mesmo pêndulo, uma como carga e outra como força
  const vc = new Set(r.mapaCarga.map(([e]) => e)), vr = new Set(r.mapaRecurso.map(([e]) => e))
  const col = (r.colisoes || []).filter((c) => vc.has(c.carga) && vr.has(c.recurso))
  if (col.length) {
    L.push('> ⚠️⚠️ **COLISÃO DE EIXO — leia antes de escrever:** a mesma régua aparece dos dois lados abaixo:')
    for (const c of col) L.push(`> - eixo **${c.eixo}**: pesa como \`${c.carga}\` e ao mesmo tempo está livre como \`${c.recurso}\`.`)
    L.push('> Isso **não** é contradição a esconder — é uma distinção real: a pessoa é assim numa área da vida e o oposto em outra. **Diga em que cada lado se aplica** (ex.: dura no critério, solta no corpo). ⛔ NUNCA escreva as duas pontas soltas, sem dizer onde cada uma vale — o cliente lê como erro.')
  }
  L.push('**O que está leve — força (recursos, das DUAS fontes):**')
  for (const [emo, s] of r.mapaRecurso) L.push(`- ${emo} — ${s >= 2 ? 'vital' : 'livre'} (+${bipR(s)})`)
  L.push('')

  L.push('## Força / recursos preservados')
  for (const p of r.pres) L.push(`- ‹${p.campo}›${p.pol === 'vital_ativo' ? ' (vital)' : ' (livre)'}`)
  const cb = d.constituicao_base || {}
  const consti = []
  if (cb.pupila === 'centrada_regular') consti.push('centramento (um chão por dentro)')
  if (cb.trama_fibras === 'compacta_densa') consti.push('vitalidade de base')
  if (cb.bordas_pupilares === 'regulares') consti.push('estabilidade')
  if (consti.length) L.push(`- constituição: ${consti.join(' · ')}`)
  if (r.adjuvantes.length) L.push(`- (adjuvantes, sem peso próprio — reforçam a área-alvo: ${r.adjuvantes.join(', ')})`)
  // ⚠️ SEPARADO em 2026-08-13 (auditoria): esta linha dizia "ignorados — marcador/modulador"
  // e engolia junto os campos SEM LASTRO, que não são nem uma coisa nem outra — são achados
  // que o Stage 1 tem permissão de emitir e o motor não sabe interpretar, então descarta.
  // Medido nas 60 de produção: 8 ocorrências (`plexo_solar` 6 · `baco` 2) em 8 leituras.
  // Rotular os dois com o mesmo nome escondia o furo de quem lê o bloco B pra calibrar.
  const porDesenho = r.skipped.filter((s) => !s.includes('SEM-LASTRO'))
  const semLastro = r.skipped.filter((s) => s.includes('SEM-LASTRO'))
  if (porDesenho.length) L.push(`- (ignorados por desenho — marcador/modulador: ${porDesenho.join(', ')})`)
  if (semLastro.length) L.push(`- ⚠️ (DESCARTADOS — o Stage 1 emitiu e o motor não tem lastro pra interpretar: ${semLastro.join(', ')})`)
  L.push('')

  // linha do tempo (bloco 3) — passa cru, o LLM traduz pra emoção/comportamento
  if ((d.linha_temporal || []).length) {
    L.push('## Linha do tempo (marcos — traduza p/ emoção + comportamento; idade em formato LIVRE, simbólica)')
    for (const m of d.linha_temporal) L.push(`- [${m.status}] ${m.idade_aproximada || '?'} — ${m.tipo_provavel}`)
    L.push('')
  }
  if ((d.correlacoes_observadas || []).length) {
    L.push('## Correlações (teça 2 emoções na narrativa; nudge pequeno)')
    for (const c of d.correlacoes_observadas) L.push(`- ${(c.campos || []).join(' + ')}: ${c.natureza || ''}`)
    L.push('')
  }

  // ======================= BLOCO C =======================
  L.push('# BLOCO C — LEQUE (emoções + crenças por área)')
  L.push('> ⚠️ Selecione o que ENCAIXA nesta pessoa — **não use tudo**; **nunca invente** emoção/crença fora daqui. As crenças são a forma cognitiva da emoção (o que a pessoa "acredita" por dentro). Cada área = pêndulo: 🔴 carga ⟷ 🟢 antídoto.')
  L.push('')

  // campos em jogo = achados (carga ativa) + preservados (recurso ativo), sem duplicar
  const seen = new Set()
  const rows = []
  for (const a of (d.achados_de_atencao || [])) rows.push({ campo: a.campo, role: 'carga ativa (achado)' })
  for (const p of (d.sistemas_preservados || [])) rows.push({ campo: p.campo, role: 'recurso ativo (preservado)' })
  for (const row of rows) {
    const { key, klass } = classify(row.campo)
    if (klass !== 'emocional') continue // pula marcador/modulador/visto
    const t = lastro[key]
    if (!t || seen.has(key)) continue
    seen.add(key)
    L.push(`### ‹${key}› — ${row.role}`)
    if (t.carga.length) L.push(`- 🔴 emoções: ${t.carga.join(' · ')}`)
    if (t.cargaCrenca.length) L.push(`- 🔴 crenças: ${t.cargaCrenca.join(' · ')}`)
    if (t.recurso.length) L.push(`- 🟢 emoções: ${t.recurso.join(' · ')}`)
    if (t.recursoCrenca.length) L.push(`- 🟢 crenças: ${t.recursoCrenca.join(' · ')}`)
    L.push('')
  }
  return L.join('\n')
}

export { serialize }

import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(serialize(process.argv[2] || 'self'))
}
