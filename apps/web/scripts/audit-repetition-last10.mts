/**
 * AUDIT — repetição Stage 1 + Stage 2 nas últimas 10 leituras prod.
 *
 * Puxa últimas 10 readings com report_findings vigente + report_raw_text,
 * monta tabelas de:
 *  - Stage 1: distribuição de campo/natureza/intensidade/cor/trama, top achados,
 *    assinaturas visuais lado-a-lado.
 *  - Stage 2: top n-grams (3/4/5/6), frases exact-repeat cross-reading,
 *    abertura §0 lado-a-lado, lexical density.
 *
 * Saída: console + scripts/output/audit-repetition-<timestamp>.md
 *
 * Uso:  pnpm --filter web exec tsx scripts/audit-repetition-last10.mts
 *
 * NOTA: cwd = apps/web (relativo a scripts/).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const envText = readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
const env: Record<string, string> = Object.fromEntries(
  envText.split('\n').map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const LIMIT = 10
// STOPWORDS pra n-gram analysis — manter conteúdo, remover ruído.
const STOPWORDS = new Set([
  'a','o','as','os','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas',
  'por','pra','para','com','sem','sob','sobre','que','se','é','são','foi','foram','ser','estar',
  'ter','ter','tem','têm','e','ou','mas','também','não','sim','já','ainda','muito','muita','muitos',
  'muitas','pouco','pouca','poucos','poucas','seu','sua','seus','suas','meu','minha','meus','minhas',
  'esse','essa','esses','essas','este','esta','estes','estas','isso','isto','aquele','aquela','aqueles',
  'aquelas','aquilo','você','vocês','nós','eu','tu','ele','ela','eles','elas','onde','quando','como',
  'porque','quem','qual','quais','quanto','quanta','quantos','quantas','aí','aqui','ali','lá','então',
  'mesmo','mesma','mesmos','mesmas','ao','aos','à','às','pelo','pela','pelos','pelas','até','quase',
  'sempre','nunca','quase','assim','agora','depois','antes','já','enquanto','mais','menos','tão','tal',
  'mesma','outras','outro','outra','outros','outras','algo','alguém','algum','alguma','alguns','algumas',
  'tudo','todo','toda','todos','todas','nada','ninguém','nenhum','nenhuma','vai','vão','foi','será',
  'serem','sido','ter','terá','teve','tinha','tinham','há','havia','houve','será','estar','está','estão',
  'estava','estavam','estive','esteve','for','fora','for','fui','sou','é','ser','sido','sem','com',
  'caso','vez','vezes','dia','dias','ano','anos','mês','meses','hoje','ontem','amanhã','agora','já',
  'dentro','fora','perto','longe','entre','contra','sobre','sob','seguinte','seguintes','sim','não',
])

// Tokenizador simples pt-BR: minúsculas, remove pontuação básica, mantém acentos.
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    // remove markdown headers e bullets
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    // remove pontuação mantendo letras+acentos+ç
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w))
}

// N-gram extractor preserva palavras sem stopword filtering — anti-formula
// patterns geralmente são contínuos. Mas pula pontuação.
function nGramsFromText(text: string, n: number): string[] {
  const cleanTokens = text
    .toLowerCase()
    .normalize('NFC')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)
  const grams: string[] = []
  for (let i = 0; i + n <= cleanTokens.length; i++) {
    grams.push(cleanTokens.slice(i, i + n).join(' '))
  }
  return grams
}

// Frases (split por sentença, ponto-final ou quebra dupla).
function splitSentences(text: string): string[] {
  return text
    .replace(/^#{1,6}\s+.*$/gm, '') // remove headers
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 400)
}

function countMap(items: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1)
  return m
}

function topN<T>(m: Map<T, number>, n: number): Array<[T, number]> {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

type ReadingRow = {
  reading_id: string
  client_id: string | null
  client_name: string
  client_age: number | null
  is_self: boolean | null
  generated_at: string
  exame: any
  raw_text: string | null
  report_generated: any
  prompt_version_s1: string
  method_version: string
}

async function main() {
  console.log('=== AUDIT — repetição últimas 10 leituras prod ===\n')

  // 1) Pull últimas 10 report_findings vigentes (1 row por reading)
  const { data: findings, error: fErr } = await sb
    .from('report_findings')
    .select('reading_id, therapist_id, prompt_version, method_version, generated_at, exame_json, validation_status')
    .is('superseded_at', null)
    .eq('validation_status', 'valid')
    .order('generated_at', { ascending: false })
    .limit(LIMIT)

  if (fErr || !findings || findings.length === 0) {
    console.error('Falhou puxar report_findings:', fErr)
    process.exit(1)
  }
  console.log(`Pulled ${findings.length} report_findings (valid, vigentes).`)

  const readingIds = findings.map(f => f.reading_id)

  // 2) Pull readings.report_raw_text + report_generated + client_id
  const { data: readings, error: rErr } = await sb
    .from('readings')
    .select('id, client_id, report_raw_text, report_generated')
    .in('id', readingIds)
  if (rErr || !readings) {
    console.error('Falhou puxar readings:', rErr)
    process.exit(1)
  }
  const readingMap = new Map(readings.map(r => [r.id, r]))

  // 3) Pull client nome/idade/is_self
  const clientIds = [...new Set(readings.map(r => r.client_id).filter(Boolean) as string[])]
  const { data: clients, error: cErr } = await sb
    .from('clients')
    .select('id, full_name, birth_date, is_self')
    .in('id', clientIds)
  if (cErr) {
    console.error('Falhou puxar clients:', cErr)
    process.exit(1)
  }
  const clientMap = new Map((clients ?? []).map(c => [c.id, c]))

  // 4) Montar rows
  const rows: ReadingRow[] = findings.map(f => {
    const r = readingMap.get(f.reading_id)
    const c = r?.client_id ? clientMap.get(r.client_id) : null
    const age = c?.birth_date
      ? Math.floor((Date.now() - new Date(c.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null
    return {
      reading_id: f.reading_id,
      client_id: r?.client_id ?? null,
      client_name: c?.full_name ?? '(unknown)',
      client_age: age,
      is_self: c?.is_self ?? null,
      generated_at: f.generated_at,
      exame: f.exame_json,
      raw_text: r?.report_raw_text ?? null,
      report_generated: r?.report_generated ?? null,
      prompt_version_s1: f.prompt_version,
      method_version: f.method_version,
    }
  })

  // ─── STAGE 1 AUDIT ─────────────────────────────────────────────────────────
  console.log('\n=== STAGE 1 — distribuição cross-reading ===')

  // Per-row summary
  console.log('\n#### Per-reading (S1)')
  console.log('| # | Cliente | Idade | self | data | prompt_v | método_v | #achados | top3 campos (I) |')
  console.log('|---|---------|-------|------|------|----------|----------|----------|-----------------|')
  rows.forEach((row, i) => {
    const top3 = (row.exame.achados_de_atencao ?? [])
      .slice(0, 3)
      .map((a: any) => `${a.campo}(I=${a.intensidade})`)
      .join(', ')
    const date = row.generated_at.slice(0, 10)
    console.log(`| ${i + 1} | ${row.client_name.slice(0, 25)} | ${row.client_age ?? '—'} | ${row.is_self ? 'sim' : 'não'} | ${date} | ${row.prompt_version_s1} | ${row.method_version} | ${(row.exame.achados_de_atencao ?? []).length} | ${top3} |`)
  })

  // Frequência de campo em achados_de_atencao
  const allAchados = rows.flatMap(r => r.exame.achados_de_atencao ?? [])
  const campoFreq = countMap(allAchados.map((a: any) => a.campo))
  const naturezaFreq = countMap(allAchados.map((a: any) => a.natureza_da_carga))
  const intensidadeFreq = countMap(allAchados.map((a: any) => String(a.intensidade)))
  const lateralidadeFreq = countMap(allAchados.map((a: any) => a.lateralidade))

  console.log(`\n#### Campos em achados_de_atencao (N=${allAchados.length} total across ${rows.length} readings)`)
  console.log('| campo | ocorrências | % de readings |')
  console.log('|-------|-------------|---------------|')
  for (const [k, v] of topN(campoFreq, 20)) {
    const inHowMany = rows.filter(r => (r.exame.achados_de_atencao ?? []).some((a: any) => a.campo === k)).length
    console.log(`| ${k} | ${v} | ${inHowMany}/${rows.length} (${Math.round((inHowMany / rows.length) * 100)}%) |`)
  }

  console.log('\n#### natureza_da_carga (distribuição)')
  console.log('| natureza | ocorrências |')
  console.log('|----------|-------------|')
  for (const [k, v] of topN(naturezaFreq, 10)) console.log(`| ${k} | ${v} |`)

  console.log('\n#### intensidade (distribuição)')
  console.log('| I | ocorrências |')
  console.log('|---|-------------|')
  for (const [k, v] of topN(intensidadeFreq, 10)) console.log(`| ${k} | ${v} |`)

  console.log('\n#### lateralidade (distribuição)')
  console.log('| lateralidade | ocorrências |')
  console.log('|--------------|-------------|')
  for (const [k, v] of topN(lateralidadeFreq, 10)) console.log(`| ${k} | ${v} |`)

  // constituicao_base
  const corFreq = countMap(rows.map(r => r.exame.constituicao_base?.cor_predominante ?? '∅'))
  const tramaFreq = countMap(rows.map(r => r.exame.constituicao_base?.trama_fibras ?? '∅'))
  const pupilaFreq = countMap(rows.map(r => r.exame.constituicao_base?.pupila ?? '∅'))
  const anelInternoFreq = countMap(rows.map(r => r.exame.constituicao_base?.anel_interno ?? '∅'))

  console.log('\n#### constituicao_base (1 valor por leitura)')
  console.log('| campo | valor | freq |')
  console.log('|-------|-------|------|')
  for (const [k, v] of topN(corFreq, 5)) console.log(`| cor_predominante | ${k} | ${v}/${rows.length} |`)
  for (const [k, v] of topN(tramaFreq, 5)) console.log(`| trama_fibras | ${k} | ${v}/${rows.length} |`)
  for (const [k, v] of topN(pupilaFreq, 5)) console.log(`| pupila | ${k} | ${v}/${rows.length} |`)
  for (const [k, v] of topN(anelInternoFreq, 5)) console.log(`| anel_interno | ${k} | ${v}/${rows.length} |`)

  // assinatura visual lado-a-lado
  console.log('\n#### assinatura_visual_caracteristica lado-a-lado')
  rows.forEach((row, i) => {
    console.log(`\n[${i + 1}] ${row.client_name} (${row.generated_at.slice(0, 10)}):`)
    console.log(`   ${row.exame.assinatura_visual_caracteristica ?? '∅'}`)
  })

  // ─── STAGE 2 AUDIT ─────────────────────────────────────────────────────────
  console.log('\n\n=== STAGE 2 — repetição de linguagem cross-reading ===')

  const stage2Texts = rows.map(r => r.raw_text ?? '')
  const nonEmpty = stage2Texts.filter(t => t.length > 100)
  console.log(`\nStage 2 disponível: ${nonEmpty.length}/${rows.length} (raw_text ≥100 chars)`)

  // Per-reading stats
  console.log('\n#### Stage 2 — per-reading stats')
  console.log('| # | Cliente | chars | palavras | únicas | densidade |')
  console.log('|---|---------|-------|----------|--------|-----------|')
  rows.forEach((row, i) => {
    const t = row.raw_text ?? ''
    const words = tokenize(t)
    const unique = new Set(words).size
    const density = words.length > 0 ? (unique / words.length).toFixed(2) : '—'
    console.log(`| ${i + 1} | ${row.client_name.slice(0, 25)} | ${t.length} | ${words.length} | ${unique} | ${density} |`)
  })

  // N-gram cross-reading repetition (4-gram, 6-gram, 8-gram)
  function crossReadingNgrams(n: number, topK: number) {
    console.log(`\n#### Stage 2 — top ${n}-grams aparecendo em ≥2 leituras`)
    const perReadingGrams = nonEmpty.map(t => new Set(nGramsFromText(t, n)))
    // count quantas readings contém cada n-gram
    const docFreq = new Map<string, number>()
    perReadingGrams.forEach(setG => {
      for (const g of setG) docFreq.set(g, (docFreq.get(g) ?? 0) + 1)
    })
    const repeated = [...docFreq.entries()]
      .filter(([_, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
    console.log(`Total ${n}-grams distintos: ${docFreq.size} | em ≥2 leituras: ${[...docFreq.values()].filter(c => c >= 2).length}`)
    if (repeated.length === 0) {
      console.log('(nenhum)')
      return
    }
    console.log('| n-gram | aparece em N leituras |')
    console.log('|--------|----------------------|')
    for (const [gram, cnt] of repeated) {
      console.log(`| "${gram}" | ${cnt}/${nonEmpty.length} |`)
    }
  }

  crossReadingNgrams(4, 30)
  crossReadingNgrams(6, 25)
  crossReadingNgrams(8, 20)

  // Frases exact-match cross-reading
  console.log('\n#### Stage 2 — frases (sentenças) exact-match em ≥2 leituras')
  const perReadingSent = nonEmpty.map(t => new Set(splitSentences(t).map(s => s.toLowerCase().trim())))
  const sentDocFreq = new Map<string, number>()
  perReadingSent.forEach(setS => {
    for (const s of setS) sentDocFreq.set(s, (sentDocFreq.get(s) ?? 0) + 1)
  })
  const repeatedSent = [...sentDocFreq.entries()]
    .filter(([_, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
  if (repeatedSent.length === 0) {
    console.log('(nenhuma frase exact-match em ≥2 leituras)')
  } else {
    repeatedSent.forEach(([s, c]) => {
      console.log(`\n[${c}/${nonEmpty.length}] "${s.slice(0, 250)}${s.length > 250 ? '…' : ''}"`)
    })
  }

  // Abertura (§0 Em poucas palavras) lado-a-lado pra olho humano
  console.log('\n#### Abertura §0 lado-a-lado')
  rows.forEach((row, i) => {
    const txt = row.raw_text ?? ''
    // pega trecho que segue "## 0. Em poucas palavras" até a próxima section header
    const m = txt.match(/##\s*0\.[^\n]*\n+([\s\S]*?)(?=\n##\s|\Z)/)
    const aber = m?.[1]?.trim().slice(0, 500) ?? '(não encontrado)'
    console.log(`\n[${i + 1}] ${row.client_name} (${row.generated_at.slice(0, 10)}):`)
    console.log(`   ${aber.replace(/\n/g, '\n   ')}`)
  })

  // ─── DUMP em arquivo MD ────────────────────────────────────────────────────
  const outDir = path.join(process.cwd(), 'scripts', 'output')
  mkdirSync(outDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outPath = path.join(outDir, `audit-repetition-last10-${ts}.md`)

  const md: string[] = []
  md.push(`# Audit repetição — últimas ${rows.length} leituras (${new Date().toISOString().slice(0, 10)})\n`)
  md.push(`Pipeline: Sonnet 2x. Stage 1 = report_findings.exame_json; Stage 2 = readings.report_raw_text.\n`)
  md.push(`Universo: ${rows.length} report_findings vigentes (superseded_at IS NULL, validation_status=valid), ordenado por generated_at DESC.\n`)

  md.push(`## Per-reading (S1)\n`)
  md.push(`| # | Cliente | Idade | self | data | prompt_v | método_v | #achados | top3 campos (I) | constituição |`)
  md.push(`|---|---------|-------|------|------|----------|----------|----------|-----------------|--------------|`)
  rows.forEach((row, i) => {
    const top3 = (row.exame.achados_de_atencao ?? []).slice(0, 3)
      .map((a: any) => `${a.campo}(I=${a.intensidade})`)
      .join(', ')
    const cb = row.exame.constituicao_base ?? {}
    const constStr = `${cb.cor_predominante ?? '—'}/${cb.trama_fibras ?? '—'}/pupila=${cb.pupila ?? '—'}/anel=${cb.anel_interno ?? '—'}`
    md.push(`| ${i + 1} | ${row.client_name} | ${row.client_age ?? '—'} | ${row.is_self ? 'sim' : 'não'} | ${row.generated_at.slice(0, 10)} | ${row.prompt_version_s1} | ${row.method_version} | ${(row.exame.achados_de_atencao ?? []).length} | ${top3} | ${constStr} |`)
  })

  md.push(`\n## S1 — campo em achados_de_atencao (N=${allAchados.length})\n`)
  md.push(`| campo | ocorrências | em N leituras |`)
  md.push(`|-------|-------------|---------------|`)
  for (const [k, v] of topN(campoFreq, 30)) {
    const inHowMany = rows.filter(r => (r.exame.achados_de_atencao ?? []).some((a: any) => a.campo === k)).length
    md.push(`| ${k} | ${v} | ${inHowMany}/${rows.length} (${Math.round((inHowMany / rows.length) * 100)}%) |`)
  }

  md.push(`\n## S1 — natureza_da_carga\n`)
  md.push(`| natureza | ocorrências |`)
  md.push(`|----------|-------------|`)
  for (const [k, v] of topN(naturezaFreq, 10)) md.push(`| ${k} | ${v} |`)

  md.push(`\n## S1 — intensidade\n`)
  md.push(`| I | ocorrências |`)
  md.push(`|---|-------------|`)
  for (const [k, v] of topN(intensidadeFreq, 10)) md.push(`| ${k} | ${v} |`)

  md.push(`\n## S1 — lateralidade\n`)
  md.push(`| lateralidade | ocorrências |`)
  md.push(`|--------------|-------------|`)
  for (const [k, v] of topN(lateralidadeFreq, 10)) md.push(`| ${k} | ${v} |`)

  md.push(`\n## S1 — constituicao_base (1 valor/leitura)\n`)
  md.push(`| campo | valor | freq |`)
  md.push(`|-------|-------|------|`)
  for (const [k, v] of topN(corFreq, 10)) md.push(`| cor_predominante | ${k} | ${v}/${rows.length} |`)
  for (const [k, v] of topN(tramaFreq, 10)) md.push(`| trama_fibras | ${k} | ${v}/${rows.length} |`)
  for (const [k, v] of topN(pupilaFreq, 10)) md.push(`| pupila | ${k} | ${v}/${rows.length} |`)
  for (const [k, v] of topN(anelInternoFreq, 10)) md.push(`| anel_interno | ${k} | ${v}/${rows.length} |`)

  md.push(`\n## S1 — assinatura_visual_caracteristica lado-a-lado\n`)
  rows.forEach((row, i) => {
    md.push(`\n**[${i + 1}] ${row.client_name} (${row.generated_at.slice(0, 10)}):**`)
    md.push(`> ${row.exame.assinatura_visual_caracteristica ?? '∅'}`)
  })

  md.push(`\n## Stage 2 — per-reading stats\n`)
  md.push(`| # | Cliente | chars | palavras | únicas | densidade |`)
  md.push(`|---|---------|-------|----------|--------|-----------|`)
  rows.forEach((row, i) => {
    const t = row.raw_text ?? ''
    const words = tokenize(t)
    const unique = new Set(words).size
    const density = words.length > 0 ? (unique / words.length).toFixed(3) : '—'
    md.push(`| ${i + 1} | ${row.client_name} | ${t.length} | ${words.length} | ${unique} | ${density} |`)
  })

  function dumpNgramsToMd(n: number, topK: number) {
    md.push(`\n## Stage 2 — top ${n}-grams aparecendo em ≥2 leituras\n`)
    const perReadingGrams = nonEmpty.map(t => new Set(nGramsFromText(t, n)))
    const docFreq = new Map<string, number>()
    perReadingGrams.forEach(setG => {
      for (const g of setG) docFreq.set(g, (docFreq.get(g) ?? 0) + 1)
    })
    const repeated = [...docFreq.entries()]
      .filter(([_, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
    if (repeated.length === 0) {
      md.push(`(nenhum ${n}-gram repetido)`)
      return
    }
    md.push(`Total ${n}-grams distintos: ${docFreq.size} | em ≥2 leituras: ${[...docFreq.values()].filter(c => c >= 2).length}\n`)
    md.push(`| n-gram | leituras |`)
    md.push(`|--------|----------|`)
    for (const [gram, cnt] of repeated) md.push(`| \`${gram}\` | ${cnt}/${nonEmpty.length} |`)
  }
  dumpNgramsToMd(4, 50)
  dumpNgramsToMd(6, 40)
  dumpNgramsToMd(8, 30)

  md.push(`\n## Stage 2 — frases exact-match em ≥2 leituras\n`)
  if (repeatedSent.length === 0) {
    md.push(`(nenhuma)`)
  } else {
    repeatedSent.forEach(([s, c]) => {
      md.push(`\n**[${c}/${nonEmpty.length}]** "${s.slice(0, 400)}${s.length > 400 ? '…' : ''}"`)
    })
  }

  md.push(`\n## Stage 2 — abertura §0 lado-a-lado\n`)
  rows.forEach((row, i) => {
    const txt = row.raw_text ?? ''
    const m = txt.match(/##\s*0\.[^\n]*\n+([\s\S]*?)(?=\n##\s|\Z)/)
    const aber = m?.[1]?.trim() ?? '(não encontrado)'
    md.push(`\n**[${i + 1}] ${row.client_name} (${row.generated_at.slice(0, 10)})**`)
    md.push(``)
    md.push(`> ${aber.split('\n').join('\n> ').slice(0, 1500)}`)
  })

  writeFileSync(outPath, md.join('\n'), 'utf-8')
  console.log(`\n\nMarkdown auditoria salvo em: ${outPath}`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
