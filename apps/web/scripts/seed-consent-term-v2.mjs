// apps/web/scripts/seed-consent-term-v2.mjs
//
// Seeds consent_terms com v2 a partir de apps/web/lib/consent/term-v2.md.
// v2 (2026-06-03): reconcilia o termo com o ciclo de vida real da foto —
// imagens da íris apagadas na geração / em até 24h, não retidas (§4b + §6).
// O v1 é PRESERVADO (append-only): só flipa is_current OFF nele; consentimentos
// v1 já assinados continuam válidos (a nova política é mais protetiva).
//
// content_sha256 = sha256 do BODY BRUTO do term-v2.md (placeholders {{...}}
// intactos), igual ao v1. Idempotente: upsert ON CONFLICT (version).
//
// Uso:
//   cd apps/web
//   SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
//   SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
//   node scripts/seed-consent-term-v2.mjs

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TERM_PATH = resolve(__dirname, '../lib/consent/term-v2.md')
const VERSION = 'v2'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const body = readFileSync(TERM_PATH, 'utf8')
const sha256 = createHash('sha256').update(body).digest('hex')

// Flip is_current OFF nas versões != v2 ANTES do upsert (o índice parcial
// consent_terms_one_current rejeitaria 2 vigentes).
const { error: flipErr } = await supabase
  .from('consent_terms')
  .update({ is_current: false })
  .neq('version', VERSION)
if (flipErr) {
  console.error('[seed-consent-term-v2] flip error:', flipErr)
  process.exit(1)
}

const { error } = await supabase.from('consent_terms').upsert(
  {
    version: VERSION,
    body,
    content_sha256: sha256,
    is_current: true,
  },
  { onConflict: 'version' },
)

if (error) {
  console.error('[seed-consent-term-v2] error:', error)
  process.exit(1)
}
console.log(`[seed-consent-term-v2] ${VERSION} seeded; sha256=${sha256.slice(0, 16)}...`)
