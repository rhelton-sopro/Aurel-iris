/**
 * ONE-SHOT — desliga notificationDisabled em TODOS os customers já existentes
 * no Asaas (os criados antes do fix em createAsaasCustomer). Zera a taxa de
 * mensageria (R$0,99/venda) retroativamente.
 *
 * notificationDisabled é flag DE CLIENTE. NÃO afeta o webhook Asaas→Iris Codex.
 *
 * Precisa de ASAAS_API_KEY (PRODUÇÃO) no apps/web/.env.local. Não está lá por
 * padrão (só ASAAS_WEBHOOK_*) — adicione temporariamente pra rodar e remova depois.
 *
 *   cd apps/web
 *   node scripts/asaas-disable-notifications.mjs        # DRY-RUN: só lista + conta
 *   APPLY=1 node scripts/asaas-disable-notifications.mjs # aplica o update em todos
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, 'utf8').split('\n')) {
    const t = l.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}

const API_KEY = process.env.ASAAS_API_KEY
const BASE = process.env.ASAAS_API_BASE_URL ?? 'https://api.asaas.com/v3'
const APPLY = process.env.APPLY === '1'

if (!API_KEY) {
  console.error(
    'ERRO: ASAAS_API_KEY ausente. Adicione a chave de PRODUÇÃO em apps/web/.env.local e rode de novo.',
  )
  process.exit(1)
}

const headers = { access_token: API_KEY, 'Content-Type': 'application/json' }

async function listAll() {
  const all = []
  let offset = 0
  const limit = 100
  for (;;) {
    const res = await fetch(`${BASE}/customers?limit=${limit}&offset=${offset}`, { headers })
    if (!res.ok) {
      console.error(`ERRO list offset=${offset} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      process.exit(1)
    }
    const json = await res.json()
    all.push(...(json.data ?? []))
    if (!json.hasMore) break
    offset += limit
  }
  return all
}

async function disableOne(id) {
  const res = await fetch(`${BASE}/customers/${id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ notificationDisabled: true }),
  })
  if (!res.ok) return { ok: false, status: res.status, detail: (await res.text()).slice(0, 150) }
  return { ok: true }
}

const customers = await listAll()
const alreadyOff = customers.filter((c) => c.notificationDisabled === true)
const toFix = customers.filter((c) => c.notificationDisabled !== true)

console.log(`\n=== Asaas customers ===`)
console.log(`total            : ${customers.length}`)
console.log(`já desabilitados : ${alreadyOff.length}`)
console.log(`a desabilitar    : ${toFix.length}`)
console.log(`modo             : ${APPLY ? 'APPLY (escrevendo)' : 'DRY-RUN (só listando — rode com APPLY=1 pra aplicar)'}\n`)

if (!APPLY) {
  for (const c of toFix.slice(0, 50))
    console.log(`  [pendente] ${c.id}  ${c.name ?? ''}  (ext=${c.externalReference ?? '—'})`)
  if (toFix.length > 50) console.log(`  … +${toFix.length - 50} outros`)
  process.exit(0)
}

let ok = 0
let fail = 0
for (const c of toFix) {
  const r = await disableOne(c.id)
  if (r.ok) {
    ok++
    console.log(`  ✓ ${c.id}  ${c.name ?? ''}`)
  } else {
    fail++
    console.log(`  ✗ ${c.id}  HTTP ${r.status} — ${r.detail}`)
  }
}
console.log(`\nConcluído: ${ok} atualizados, ${fail} falhas, ${alreadyOff.length} já estavam OK.`)
