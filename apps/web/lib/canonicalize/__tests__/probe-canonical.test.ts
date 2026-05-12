/**
 * Phase 07.1.6 D-06 — Gated integration test (golden fixture regression).
 *
 * Skip-by-default. Opt-in:
 *   CANONICAL_PROBE=1 pnpm --filter web test -- probe-canonical
 *
 * Mirrors Phase 7 ANTHROPIC_INTEGRATION=1 pattern (see
 * `lib/anthropic/__tests__/integration.test.ts`). Re-runs Sonnet 4.6 contra a
 * Nailli e85ea7de e compara bbox coords contra o golden fixture committed em
 * `scripts/output/landmarks-probe-sonnet-4-6.json` (frozen Sonnet output,
 * capture protocol commit f885462).
 *
 * Tolerance (CONTEXT.md D-06):
 *   ±5% absolute em center_x_pct / center_y_pct
 *   ±10% absolute em radius_pct
 *
 * Founder workflow:
 *   Run BEFORE merging PRs que tocam:
 *     - apps/web/lib/canonicalize/sonnet-bbox.ts (Sonnet call / prompt)
 *     - apps/web/app/api/capture/canonicalize/route.ts (orchestrator)
 *     - apps/web/lib/canonicalize/crop.ts (crop math)
 *
 * CI NÃO roda este test:
 *   - Custo Sonnet ~$0.05/run (6 calls × $0.008)
 *   - Latência: ~30-60s wall-clock (sequencial p/ Tier 1 5 RPM limit)
 *   - VLM flakiness exceeds CI noise budget (D-06 decision)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const RUN_PROBE = process.env.CANONICAL_PROBE === '1'
const maybeDescribe = RUN_PROBE ? describe : describe.skip

// Golden fixture identifier — see probe-haiku-iris-landmarks.mjs
// (NAILLI_E85EA7DE_GOLDEN). Reading capturada com protocol revisto.
const GOLDEN_READING_ID = 'e85ea7de-0e5f-4f49-a889-f886e4a05073'

// Path resolves from apps/web/ (vitest cwd) → scripts/output/landmarks-probe-sonnet-4-6.json.
const GOLDEN_FIXTURE_PATH = join(
  process.cwd(),
  'scripts/output/landmarks-probe-sonnet-4-6.json',
)

// D-06 tolerances: absolute deltas em fração [0..1].
const TOLERANCE_CENTER = 0.05 // ±5% center_x_pct, center_y_pct
const TOLERANCE_RADIUS = 0.10 // ±10% radius_pct

const STORAGE_BUCKET = 'iris-captures'

interface GoldenBbox {
  center_x_pct: number
  center_y_pct: number
  radius_pct: number
}

interface GoldenEntry {
  eye: string
  angle: string
  haiku_response?: {
    valid?: boolean
    iris_bbox?: GoldenBbox
  } | null
}

interface GoldenFixture {
  reading_id: string
  model: string
  results: GoldenEntry[]
}

function loadGolden(): GoldenFixture {
  const raw = readFileSync(GOLDEN_FIXTURE_PATH, 'utf8')
  return JSON.parse(raw) as GoldenFixture
}

maybeDescribe('lib/canonicalize — Sonnet bbox probe (CANONICAL_PROBE=1)', () => {
  it('golden fixture exists, matches Nailli e85ea7de, contains 6 results', () => {
    const golden = loadGolden()
    expect(golden.reading_id).toBe(GOLDEN_READING_ID)
    expect(golden.model).toBe('claude-sonnet-4-6')
    expect(golden.results.length).toBe(6)
    // Sanity: each result has iris_bbox with numeric coords.
    for (const r of golden.results) {
      expect(r.haiku_response?.iris_bbox).toBeDefined()
      expect(typeof r.haiku_response?.iris_bbox?.center_x_pct).toBe('number')
      expect(typeof r.haiku_response?.iris_bbox?.center_y_pct).toBe('number')
      expect(typeof r.haiku_response?.iris_bbox?.radius_pct).toBe('number')
    }
  })

  it(
    'live Sonnet bbox matches golden within tolerance per imagem',
    async () => {
      // Dynamic import — evita carregar module server-only quando gate is skipped.
      const { fetchIrisBbox } = await import('@/lib/canonicalize/sonnet-bbox')
      const sharp = (await import('sharp')).default

      const supabaseUrl =
        process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !serviceKey) {
        throw new Error(
          'CANONICAL_PROBE requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars',
        )
      }
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const golden = loadGolden()
      const { data: images, error } = await supabase
        .from('reading_images')
        .select('eye, angle, storage_path')
        .eq('reading_id', GOLDEN_READING_ID)
      if (error || !images || images.length === 0) {
        throw new Error(
          `Failed to load Nailli e85ea7de images: ${error?.message ?? 'no rows'}`,
        )
      }

      for (const img of images) {
        const goldenEntry = golden.results.find(
          r => r.eye === img.eye && r.angle === img.angle,
        )
        // Skip golden entries que Sonnet marcou valid:false ou sem iris_bbox.
        // (None hoje — todas 6 são valid:true — mas mantemos para robustez
        // se um refresh futuro flipar uma para invalid.)
        if (
          !goldenEntry?.haiku_response?.iris_bbox ||
          goldenEntry.haiku_response.valid === false
        ) {
          continue
        }
        const goldenBbox = goldenEntry.haiku_response.iris_bbox

        // Download original + bake EXIF orientation (probe convention).
        const { data: blob, error: dlError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(img.storage_path)
        if (dlError || !blob) {
          throw new Error(
            `Download failed for ${img.eye}_${img.angle}: ${dlError?.message ?? 'unknown'}`,
          )
        }
        const ab = await blob.arrayBuffer()
        const rawBuf = Buffer.from(ab)
        const baked = await sharp(rawBuf).rotate().toBuffer()

        const { bbox } = await fetchIrisBbox(baked)

        expect(
          bbox.valid,
          `${img.eye}_${img.angle} should remain valid vs golden`,
        ).toBe(true)
        expect(
          Math.abs(bbox.center_x_pct - goldenBbox.center_x_pct),
          `${img.eye}_${img.angle} center_x drift (golden=${goldenBbox.center_x_pct} live=${bbox.center_x_pct})`,
        ).toBeLessThanOrEqual(TOLERANCE_CENTER)
        expect(
          Math.abs(bbox.center_y_pct - goldenBbox.center_y_pct),
          `${img.eye}_${img.angle} center_y drift (golden=${goldenBbox.center_y_pct} live=${bbox.center_y_pct})`,
        ).toBeLessThanOrEqual(TOLERANCE_CENTER)
        expect(
          Math.abs(bbox.radius_pct - goldenBbox.radius_pct),
          `${img.eye}_${img.angle} radius drift (golden=${goldenBbox.radius_pct} live=${bbox.radius_pct})`,
        ).toBeLessThanOrEqual(TOLERANCE_RADIUS)
      }
    },
    90_000, // 90s timeout — 6 Sonnet calls + 6 Storage downloads sequenciais
  )
})
