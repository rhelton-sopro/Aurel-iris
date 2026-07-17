#!/usr/bin/env node
/**
 * Auditoria do gate de captura — taxa de recusa REAL vs recusa por FORMATO.
 *
 * Por que existe: em 2026-07-17 a auditoria mostrou que 35,4% das fotos eram
 * recusadas por ERRO DE FORMATO (o Haiku divagava a 1536px → reason fora do
 * enum → clamp), não por qualidade. O painel /admin/relatorios contava isso
 * como "recusa" e mascarava o ganho real da resolução 1536. Este script separa
 * as duas coisas.
 *
 * Uso (de dentro de apps/web, que resolve o node_modules):
 *   cd apps/web && node ../../scripts/audit-capture-gate.mjs [YYYY-MM-DD]
 *
 * O argumento é o marco de corte (default = deploy do fix tool_use, 2026-07-17).
 * Compara a janela ANTES vs DEPOIS dele.
 *
 * ⚠️ LEITURA DA TELEMETRIA (pegadinhas que já custaram um diagnóstico errado):
 *  - `olho_detectado` é AMBÍGUO: é o reason legítimo de foto BOA *e* o fallback
 *    do clamp de falha. SEMPRE cruzar com vlm_quality — 'ruim'+'olho_detectado'
 *    = o servidor não entendeu a resposta; qualquer outra quality = foto aceita.
 *  - capture_attempts só grava se o VLM respondeu E o parse passou. Timeout/502
 *    é INVISÍVEL aqui (viés de sobrevivência).
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web')
const require = createRequire(resolve(WEB, 'package.json'))
const { createClient } = require('@supabase/supabase-js')

const env = {}
for (const line of readFileSync(resolve(WEB, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em apps/web/.env.local')
  process.exit(1)
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CUTOFF = new Date(`${process.argv[2] ?? '2026-07-17'}T00:00:00Z`)
const isClamp = (r) => r.vlm_quality === 'ruim' && r.vlm_reason === 'olho_detectado'
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : '0.0')
const med = (a) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

let rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('capture_attempts')
    .select('vlm_quality,vlm_reason,accepted,image_bytes,latency_ms,tokens_out,cost_estimate_usd,created_at')
    .order('created_at', { ascending: true })
    .range(from, from + 999)
  if (error) {
    console.error('ERRO:', error.message)
    process.exit(1)
  }
  rows = rows.concat(data)
  if (data.length < 1000) break
}

function report(label, set) {
  if (!set.length) return console.log(`\n===== ${label} =====\n(sem dados)`)
  const acc = set.filter((r) => r.accepted).length
  const clamp = set.filter(isClamp).length
  const valid = set.filter((r) => !isClamp(r))
  const accValid = valid.filter((r) => r.accepted).length
  console.log(`\n===== ${label} =====`)
  console.log(`janela: ${set[0].created_at.slice(0, 10)} → ${set[set.length - 1].created_at.slice(0, 10)} | n=${set.length}`)
  console.log(`aceite (todas)          : ${pct(acc, set.length)}%   | fotos por aceita: ${acc ? (set.length / acc).toFixed(2) : 'N/A'}`)
  console.log(`🔴 recusa por FORMATO   : ${pct(clamp, set.length)}%   (clamp ruim+olho_detectado — NÃO é veredito sobre a foto)`)
  console.log(`✅ aceite (só válidas)  : ${pct(accValid, valid.length)}%   [n=${valid.length}] <- o número honesto do gate`)
  const by = {}
  for (const r of valid.filter((r) => !r.accepted)) by[r.vlm_reason] = (by[r.vlm_reason] || 0) + 1
  console.log('motivos de recusa REAL (% das válidas):')
  for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1]))
    console.log(`   ${k.padEnd(14)} ${String(v).padStart(4)}  ${pct(v, valid.length)}%`)
  console.log(`latência p50: ${med(set.map((r) => r.latency_ms))}ms | >5s: ${pct(set.filter((r) => r.latency_ms > 5000).length, set.length)}% | tokens_out p50: ${med(set.map((r) => r.tokens_out || 0))}`)
  console.log(`image_bytes p50: ${(med(set.map((r) => r.image_bytes)) / 1024).toFixed(0)}KB | custo: US$ ${set.reduce((s, r) => s + Number(r.cost_estimate_usd || 0), 0).toFixed(2)}`)
}

report(`ANTES do corte (${CUTOFF.toISOString().slice(0, 10)})`, rows.filter((r) => new Date(r.created_at) < CUTOFF))
report(`DEPOIS do corte (${CUTOFF.toISOString().slice(0, 10)})`, rows.filter((r) => new Date(r.created_at) >= CUTOFF))

console.log('\n===== POR DIA =====')
const days = {}
for (const r of rows) {
  const d = r.created_at.slice(0, 10)
  days[d] ??= { n: 0, acc: 0, clamp: 0 }
  days[d].n++
  if (r.accepted) days[d].acc++
  if (isClamp(r)) days[d].clamp++
}
console.log('dia          n   aceite   formato(clamp)')
for (const [d, v] of Object.entries(days).sort().slice(-21))
  console.log(`${d}  ${String(v.n).padStart(3)}   ${pct(v.acc, v.n).padStart(5)}%   ${pct(v.clamp, v.n).padStart(5)}%${d >= CUTOFF.toISOString().slice(0, 10) ? '  <- pós-fix' : ''}`)

console.log('\nEsperado pós tool_use+strict: clamp/formato ~0-2%. Se seguir alto, o fix não pegou.')
