// @vitest-environment node
/**
 * Manual runner for Column C (ANÁLISE DIRETA SONNET) — executed via vitest so
 * it reuses the EXACT production orchestrator (server-only modules, `@/`
 * alias, parser/audit) with zero duplication. It is NOT a unit test.
 *
 * It is SKIPPED in the normal suite (keeps CI green). To run it explicitly:
 *
 *   # dry-run (no DB write — works BEFORE migration 0017 is applied):
 *   cd apps/web
 *   RUN_SONNET_DIRECT_READING=36b5abd0-296d-4666-b1f0-8535f5a1ca5a \
 *     pnpm vitest run scripts/run-sonnet-direct.spec.ts
 *
 *   # persist (writes report_generated_sonnet_direct — AFTER 0017 applied):
 *   RUN_SONNET_DIRECT_READING=<id> RUN_SONNET_DIRECT_PERSIST=1 \
 *     pnpm vitest run scripts/run-sonnet-direct.spec.ts
 *
 * Needs ANTHROPIC_API_KEY + SUPABASE_* in apps/web/.env.local (loaded here —
 * vitest does not auto-load it). Needs NO Modal (Column C bypasses it).
 *
 * Phase 7.4 | Column C | calibration harness
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

// Load .env.local into process.env BEFORE any dynamic import of env-reading
// server modules (lib/anthropic/client throws at import if the key is unset).
function loadEnvLocal(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(__dirname, '..', '.env.local'),
  ]
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
        if (!m || line.trim().startsWith('#')) continue
        const key = m[1]
        let val = m[2]
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        if (process.env[key] === undefined) process.env[key] = val
      }
      return
    } catch {
      // try next candidate
    }
  }
}

loadEnvLocal()

const READING_ID = process.env.RUN_SONNET_DIRECT_READING
const PERSIST = process.env.RUN_SONNET_DIRECT_PERSIST === '1'

const maybe = READING_ID ? describe : describe.skip

maybe('Column C — Sonnet direct runner', () => {
  it(
    `generates for reading ${READING_ID} (persist=${PERSIST})`,
    async () => {
      const { createServiceClient } = await import('@/lib/supabase/service')
      const { generateSonnetDirectReport } = await import(
        '@/lib/calibration/generate-sonnet-direct'
      )

      const service = createServiceClient()
      const result = await generateSonnetDirectReport(
        service as never,
        READING_ID as string,
        'cli-runner',
        { persist: PERSIST, includeReport: true },
      )

      const { report, ...meta } = result
      console.log('\n===== COLUMN C RESULT =====\n', JSON.stringify(meta, null, 2))

      if (report) {
        const r = report as Record<string, string | undefined>
        const keys = Object.keys(r).filter(
          (k) => k !== 'encerramento_disclaimer' && k !== 'essence_phrase',
        )
        console.log('\n----- essence_phrase -----\n', r.essence_phrase ?? '(nenhuma)')
        // Full report dump → gitignored scripts/output/ for review.
        const outPath = path.resolve(
          process.cwd(),
          'scripts/output',
          `sonnet-direct-${READING_ID}.md`,
        )
        const body = ['## Em poucas palavras', '', r.essence_phrase ?? '(nenhuma)', '']
        for (const k of keys.sort((a, b) => {
          const na = parseInt(a, 10)
          const nb = parseInt(b, 10)
          return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb)
        })) {
          body.push(String(r[k] ?? ''), '')
        }
        try {
          require('node:fs').writeFileSync(outPath, body.join('\n'), 'utf8')
          console.log(`\n----- full report written -----\n${outPath}`)
        } catch (e) {
          console.log('full-report write failed:', (e as Error).message)
        }
        console.log('\n----- section keys -----\n', keys.join(', '))
      }

      expect(result.ok, result.error ?? 'generation failed').toBe(true)
      expect(result.sections ?? 0).toBeGreaterThan(0)
    },
    300_000,
  )
})
