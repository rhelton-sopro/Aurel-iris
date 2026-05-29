/**
 * ONE-SHOT — re-canonicaliza UMA leitura (prova do fix de visão no convite).
 *
 * Chama canonicalizeReading(readingId, therapistId) direto (service-role
 * interno, sem sessão) — exatamente o que o fix lazy do analyze/route passa a
 * fazer. Prova se as fotos do convite ACEITAM o crop (status ok) ou caem em
 * fallback (foto larga/ruim demais pro bbox achar a íris).
 *
 * Prod mutation: escreve canonical/* no bucket iris-captures + atualiza
 * reading_images.canonical_storage_path + readings.canonical_metadata.
 * Idempotente (D-05). Originais NUNCA tocados. Custo ~6 chamadas Sonnet bbox.
 *
 *   cd apps/web
 *   RECANON_READING_ID=<uuid> RECANON_THERAPIST_ID=<uuid> \
 *     npx vitest run --config scripts/recanonicalize-one.config.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { canonicalizeReading } from '@/lib/canonicalize'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  const envPath = resolve(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadEnvLocal()

const READING = process.env.RECANON_READING_ID
const THERAPIST = process.env.RECANON_THERAPIST_ID

describe.skipIf(!READING || !THERAPIST)('one-shot: re-canonicalize', () => {
  it('roda canonicalizeReading e reporta status + custo', async () => {
    const { results, metadata } = await canonicalizeReading(READING!, THERAPIST!)
    console.log('\n[recanon] status_summary:', JSON.stringify(metadata.status_summary))
    console.log(
      '[recanon] per-image:',
      results.map((r) => `${r.eye}/${r.angle}=${r.canonical_status}${r.cost_usd ? ` ($${r.cost_usd.toFixed(4)})` : ''}`).join('  '),
    )
    const totalCost = results.reduce((a, r) => a + (r.cost_usd ?? 0), 0)
    console.log(`[recanon] custo total bbox: $${totalCost.toFixed(4)}`)
    console.log('[recanon] metadata:', JSON.stringify(metadata).slice(0, 600))
    expect(results.length).toBeGreaterThan(0)
  })
})
