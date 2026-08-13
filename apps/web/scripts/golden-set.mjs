// GOLDEN SET — congela o que o motor produz HOJE, para servir de régua depois.
//
// Por que existe: mexer no Stage 1 (endereço dos campos, peso do preservado, piso)
// reescreve os GRÁFICOS e pode reordenar os blocos determinísticos 6, 7 e 8 — que já
// estão no ar e aprovados. Sem uma régua congelada, "isso mexeu no que estava
// aprovado?" vira opinião. Com ela, é diff.
//
// ⛔ NÃO grava texto de relatório nem nome de cliente — só números, listas de rótulos
// e um hash do HTML. Serve para detectar mudança sem carregar dado de cliente no repo.
//
// uso:  node scripts/golden-set.mjs            → grava _motor-lab/golden/emocional-1.0.json
//       node scripts/golden-set.mjs comparar   → compara o estado atual com o arquivo
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { parseLastro, calc, familiaDe, BASELINE_LIVRE } from '../_motor-lab/motor-calc.mjs'
import { renderHTML } from '../_motor-lab/render-novo.mjs'

const ARQUIVO = '_motor-lab/golden/emocional-1.0.json'
const MODO = process.argv[2] === 'comparar' ? 'comparar' : 'gravar'

const env = Object.fromEntries(readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const lastro = parseLastro()

const { data: fnds } = await sb
  .from('report_findings')
  .select('reading_id, exame_json')
  .is('superseded_at', null)
  .order('generated_at', { ascending: false })
  .limit(60)

// O render carimba a data de HOJE no documento ("Leitura de 12 de agosto de 2026"), então
// hashear o HTML cru fazia a régua acusar "documento mudou" em TODA leitura com relatório,
// todo dia, sem nada ter mudado — 18 falsos positivos por dia, medido em 12/08. A régua tem
// que comparar CONTEÚDO, não calendário.
const MESES = 'janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro'
const semData = (html) => html
  .replace(new RegExp(`\\d{1,2}\\s+de\\s+(${MESES})\\s+de\\s+\\d{4}`, 'gi'), '«DATA»')
  .replace(/\d{2}\/\d{2}\/\d{4}/g, '«DATA»')
  .replace(/\d{4}-\d{2}-\d{2}/g, '«DATA»')

const α = BASELINE_LIVRE
const linhas = []
for (const f of fnds ?? []) {
  let c
  try { c = calc(f.exame_json ?? {}, lastro) } catch (e) { continue }

  const agulha = (ce) => Math.round(((c.centro[ce].l + α) / (c.centro[ce].t + c.centro[ce].l + 2 * α)) * 100)
  const fams = new Set()
  for (const a of c.achadoList || []) { const fam = familiaDe(a.breakdown?.[0]?.emo); if (fam) fams.add(fam) }

  // o markdown do Mapa do Ser, quando existe, pra hashear o documento inteiro
  const { data: r } = await sb.from('readings').select('report_emocional').eq('id', f.reading_id).maybeSingle()
  let htmlHash = null
  if (r?.report_emocional) {
    try {
      const { html } = renderHTML(r.report_emocional, f.exame_json ?? {}, 'Golden')
      htmlHash = createHash('sha1').update(semData(html)).digest('hex').slice(0, 12)
    } catch { htmlHash = 'ERRO_RENDER' }
  }

  linhas.push({
    id: String(f.reading_id).slice(0, 8),
    agulhas: { mente: agulha('mente'), coracao: agulha('coracao'), corpo: agulha('corpo') },
    nAch: c.nAch ?? 0,
    nPres: c.nPres ?? 0,
    familias: [...fams].sort(),
    domFam: c.domFam ?? null,
    suportes: (c.suporteList || []).map((s) => s.nutriente).sort(),
    integrativas: Object.entries(c.integrativas || {}).filter(([, v]) => Array.isArray(v) && v.length).map(([k]) => k).sort(),
    crencas: (c.crencaList || []).length,
    htmlHash,
  })
}
linhas.sort((a, b) => a.id.localeCompare(b.id))

if (MODO === 'gravar') {
  if (!existsSync('_motor-lab/golden')) mkdirSync('_motor-lab/golden', { recursive: true })
  writeFileSync(ARQUIVO, JSON.stringify({ versao: 'emocional-1.0', leituras: linhas.length, linhas }, null, 1))
  console.log(`golden set gravado: ${ARQUIVO} · ${linhas.length} leituras`)
  const m = linhas.map((l) => l.agulhas.mente), co = linhas.map((l) => l.agulhas.coracao), cp = linhas.map((l) => l.agulhas.corpo)
  const med = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length)
  console.log(`agulhas médias — mente ${med(m)} · coração ${med(co)} · corpo ${med(cp)}`)
} else {
  const antes = JSON.parse(readFileSync(ARQUIVO, 'utf8'))
  const mapa = new Map(antes.linhas.map((l) => [l.id, l]))
  let iguais = 0
  const difs = []
  for (const agora of linhas) {
    const old = mapa.get(agora.id)
    if (!old) { difs.push(`  ${agora.id}  NOVA (não estava no golden)`); continue }
    const d = []
    for (const ce of ['mente', 'coracao', 'corpo']) {
      if (old.agulhas[ce] !== agora.agulhas[ce]) d.push(`${ce} ${old.agulhas[ce]}→${agora.agulhas[ce]}`)
    }
    if (old.nAch !== agora.nAch) d.push(`achados ${old.nAch}→${agora.nAch}`)
    if (old.nPres !== agora.nPres) d.push(`preservados ${old.nPres}→${agora.nPres}`)
    if (old.domFam !== agora.domFam) d.push(`família dominante ${old.domFam}→${agora.domFam}`)
    if (old.suportes.join('|') !== agora.suportes.join('|')) d.push(`bloco 7 mudou (${old.suportes.length}→${agora.suportes.length} itens)`)
    if (old.integrativas.join('|') !== agora.integrativas.join('|')) d.push('bloco 8 mudou de categorias')
    if (old.htmlHash !== agora.htmlHash) d.push('documento mudou')
    if (d.length) difs.push(`  ${agora.id}  ${d.join(' · ')}`); else iguais++
  }
  console.log(`comparado com ${antes.versao}: ${iguais} idênticas · ${difs.length} com diferença\n`)
  for (const l of difs.slice(0, 40)) console.log(l)
  if (!difs.length) console.log('  (nada mudou)')
}
