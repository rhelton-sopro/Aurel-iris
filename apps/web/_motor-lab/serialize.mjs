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
import { parseLastro, calc, classify, familiaDe as famDe, BASELINE_LIVRE, EXAM } from './motor-calc.mjs'

const α = BASELINE_LIVRE
const agulhaDe = (t, l) => Math.round(((l + α) / (t + l + 2 * α)) * 100)
const nivel = (s, conv = true) => (s >= 6 && conv ? 'muito alta' : s >= 4 ? 'alta' : s >= 2.5 ? 'média' : 'baixa')
const pende = (a) => (a < 40 ? 'mais tensão' : a <= 60 ? 'meio a meio' : 'mais livre')

// rótulo de cada lado do centro (o que o gráfico DIZ) — SPEC bloco 2
function centroLabel(c, agulha, sabor) {
  const livre = agulha >= 50
  if (c === 'mente') return livre ? 'pensa claro, sem ruminar' : 'cabeça que não desliga — rumina, antecipa'
  if (c === 'coracao') return livre ? 'sente com profundidade e demonstra — o afeto chega ao outro' : 'sente com profundidade, mas o afeto não sai: fica guardado'
  if (livre) return 'corpo tranquilo, responde sem disparar'
  return sabor === 'medo' ? 'reage se protegendo, em alerta' : 'ferve rápido, gatilho curto'
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
// 0.10 e 0.46 desenhavam igual). A curva nunca crava e nunca achata: sempre sobra
// régua pra quem vier mais forte, e o fundo continua distinguindo.
//   posição = -(6 + 42 · (1 - e^(-s/5.5)))     8.81 → -39.5 · 2.76 → -22.6 · 0.10 → -6.8
const bipCarga = (s) => -(6 + 42 * (1 - Math.exp(-s / 5.5)))
// O EXTREMO exige CONVERGÊNCIA (2+ achados na mesma família — metodologia C do founder):
// sem ela o fator satura em 0.70, ou seja, a agulha não passa de ~70% da régua. Um elo
// de fonte única não pode desenhar como conclusão fechada.
const bipC2 = (s, conv) => (conv ? bipCarga(s) : -(6 + 42 * Math.min(1 - Math.exp(-s / 5.5), 0.70)))
const bipC = bipCarga
  const bipR = (s) => clamp(Math.round(9 * s + 12), 24, 48)
  L.push('## Mapa emocional (escala −50 carregado ⟷ 0 ⟷ +50 livre — todo achado ruim representado)')
  L.push('**O que pesa hoje (cargas) — cada uma com o SEU lado-antídoto (o outro polo do mesmo pêndulo):**')
  for (const [emo, s] of r.mapaCarga) {
    const a = r.antidoto?.[emo]
    let anti = ''
    if (a) {
      const formul = a.pool.slice(0, 3)
      anti = ` ⟷ 🟢 **${a.principal}**${a.oque ? ` (${a.oque})` : ''}${formul.length ? ` _[formulações do eixo: ${formul.join(' · ')}]_` : ''}`
    }
    const conv = (r.famN?.[famDe(emo)] || 1) >= 2
    L.push(`- ${emo} — ${nivel(s, conv)} (${Math.round(bipC2(s, conv))})${conv ? ' ⊕ corroborada' : ''}${anti}`)
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
  if (r.skipped.length) L.push(`- (ignorados — marcador/modulador: ${r.skipped.join(', ')})`)
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
