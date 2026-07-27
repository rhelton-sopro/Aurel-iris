#!/usr/bin/env node
// Puxa o Stage 1 (report_findings.exame_json) de uma leitura de PRODUÇÃO e grava como
// apps/web/_exame-<slug>.json, pra rodar o Stage 2 novo em cima de um exame real.
// uso: node apps/web/_motor-lab/pull-exame.mjs <busca-por-nome> [slug]
// ⚠️ dado de cliente real — imprime só o mínimo pra identificar a leitura certa.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// .env.local do apps/web (não usa dotenv pra não depender de pacote)
const envPath = path.resolve('apps/web/.env.local')
for (const ln of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('faltou SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

const busca = process.argv[2]
const slug = process.argv[3] || (busca || '').toLowerCase().replace(/[^a-z0-9]/g, '')
if (!busca) { console.error('uso: pull-exame.mjs <nome> [slug]'); process.exit(1) }

const { data: clients, error: e1 } = await db
  .from('clients').select('id, full_name, email, is_self, created_at').ilike('full_name', `%${busca}%`)
if (e1) { console.error('erro clients:', e1.message); process.exit(1) }
if (!clients?.length) { console.error(`nenhum cliente com "${busca}"`); process.exit(1) }
console.log(`clientes encontrados: ${clients.length}`)
for (const c of clients) console.log(`  · ${c.full_name}  (${c.id})  criado ${String(c.created_at).slice(0, 10)}`)

const ids = clients.map((c) => c.id)
const { data: readings, error: e2 } = await db
  .from('readings').select('id, client_id, status, created_at')
  .in('client_id', ids).order('created_at', { ascending: false })
if (e2) { console.error('erro readings:', e2.message); process.exit(1) }
if (!readings?.length) { console.error('nenhuma leitura'); process.exit(1) }
console.log(`\nleituras: ${readings.length}`)
for (const r of readings) console.log(`  · ${r.id}  ${r.status}  ${String(r.created_at).slice(0, 16)}`)

// pega a mais recente que TENHA exame_json
for (const r of readings) {
  const { data: rf } = await db
    .from('report_findings').select('reading_id, exame_json, prompt_version, generated_at')
    .eq('reading_id', r.id).maybeSingle()
  if (!rf?.exame_json || !Object.keys(rf.exame_json).length) continue
  const ex = rf.exame_json
  const out = path.resolve(`apps/web/_exame-${slug}.json`)
  fs.writeFileSync(out, JSON.stringify(ex, null, 2))
  console.log(`\n✅ → _exame-${slug}.json  (leitura ${r.id} · ${rf.prompt_version || '?'})`)
  console.log(`   achados=${(ex.achados_de_atencao || []).length} · preservados=${(ex.sistemas_preservados || []).length} · marcos=${(ex.linha_temporal || []).length}`)
  process.exit(0)
}
console.error('\nnenhuma leitura com exame_json preenchido')
process.exit(1)
