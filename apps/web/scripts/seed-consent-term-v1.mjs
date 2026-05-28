// apps/web/scripts/seed-consent-term-v1.mjs
//
// Seeds consent_terms with v1 from apps/web/lib/consent/term-v1.md.
// Idempotent: upsert ON CONFLICT (version) + flip is_current OFF nas demais
// versões ANTES (índice parcial consent_terms_one_current garante 1 vigente).
//
// content_sha256 é calculado do BODY BRUTO do term-v1.md (com placeholders
// {{...}} intactos) — casa com o comentário da migration 0020
// (content_sha256 = "sha256 do body exibido — casado com term-v1.md no repo").
// O hash do termo HIDRATADO (por cliente) é recalculado em runtime no
// /api/consent/generate-pdf e gravado no footer do PDF (T-08-08-01).
//
// Uso:
//   cd apps/web
//   SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
//   SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
//   node scripts/seed-consent-term-v1.mjs
//
// Reads:    apps/web/lib/consent/term-v1.md
// Writes:   consent_terms (version='v1', is_current=true, content_sha256=...)
// Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TERM_PATH = resolve(__dirname, '../lib/consent/term-v1.md')

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const body = readFileSync(TERM_PATH, 'utf8')
const sha256 = createHash('sha256').update(body).digest('hex')

// Flip is_current OFF nas versões != 'v1' ANTES do upsert (idempotente em
// re-runs; o índice parcial consent_terms_one_current rejeitaria 2 vigentes).
const { error: flipErr } = await supabase
  .from('consent_terms')
  .update({ is_current: false })
  .neq('version', 'v1')
if (flipErr) {
  console.error('[seed-consent-term] flip error:', flipErr)
  process.exit(1)
}

const { error } = await supabase.from('consent_terms').upsert(
  {
    version: 'v1',
    body,
    content_sha256: sha256,
    is_current: true,
  },
  { onConflict: 'version' },
)

if (error) {
  console.error('[seed-consent-term] error:', error)
  process.exit(1)
}
console.log(`[seed-consent-term] v1 seeded; sha256=${sha256.slice(0, 16)}...`)
