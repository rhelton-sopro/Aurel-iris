#!/usr/bin/env node
// scripts/recalibrate-centroids.mjs
// Read-only proposal tool: extracts LAB centroids per real_iris_color from
// calibration_annotations + reading_images, prints proposal table.
// Founder applies values manually to vision-service/pipeline/features.py:51-55
// (audit trail preserved in the diff).
//
// Graceful degradation: works with N>=1 fixture per category. Categories
// without any fixture keep their hardcoded centroids (script reports gap).
// Warns when n<3 (low confidence — corpus expansion recommended).
//
// Usage (from apps/web/):
//   node --env-file=.env.local scripts/recalibrate-centroids.mjs
//
// Required env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL),
//               SUPABASE_SERVICE_ROLE_KEY
//
// PLAN 07.1-02 task T4 (Wave B dogfooding calibration) — 2026-05-11.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}
if (!SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY appears malformed (no eyJ prefix)')
  process.exit(2)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Mirror of vision-service/pipeline/features.py:51-55 IRIS_COLOR_LAB_CENTROIDS.
const HARDCODED = {
  azul: [220, 130, 110],
  castanho: [90, 145, 160],
  'verde-mosaico': [140, 110, 145],
}

// Map calibration_annotations.real_iris_color values (per migration 0009 check
// constraint: 'azul','verde','castanho','mista_biliar','mista_hematogenea','outra')
// to vision pipeline IRIS_COLOR_LAB_CENTROIDS categories.
const COLOR_TO_CATEGORY = {
  azul: 'azul',
  verde: 'verde-mosaico',
  castanho: 'castanho',
  // Mistas are not standalone color categories in the centroid table —
  // they are constitution outcomes that derive from a verde-mosaico base
  // + sectoral pigments. Map mista_biliar to verde-mosaico (Nailli case).
  mista_biliar: 'verde-mosaico',
  // mista_hematogenea is castanho base + diffuse brown pigment.
  mista_hematogenea: 'castanho',
  outra: 'unknown',
}

async function fetchAnnotations() {
  const { data, error } = await client
    .from('calibration_annotations')
    .select('reading_id, real_iris_color')
  if (error) throw new Error(`annotations query failed: ${error.message}`)
  return Array.isArray(data) ? data : []
}

async function fetchImagesForReadings(readingIds) {
  if (!Array.isArray(readingIds) || readingIds.length === 0) return {}
  const { data, error } = await client
    .from('reading_images')
    .select('reading_id, eye, angle, storage_path')
    .in('reading_id', readingIds)
    .eq('angle', 'frontal') // frontal photos give the most stable LAB centroid
  if (error) throw new Error(`reading_images query failed: ${error.message}`)
  const byReading = {}
  for (const r of Array.isArray(data) ? data : []) {
    if (!byReading[r.reading_id]) byReading[r.reading_id] = []
    byReading[r.reading_id].push(r)
  }
  return byReading
}

// sRGB -> LAB conversion (D65 reference). Returns LAB in OpenCV uint8 scale:
//   L: L* * 255/100         (matches cv2.COLOR_RGB2LAB output L channel)
//   A: a* + 128
//   B: b* + 128
// This matches the scale used by IRIS_COLOR_LAB_CENTROIDS in features.py.
function rgbToLabCvScale(r, g, b) {
  // sRGB [0,1] -> linear
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  const lr = lin(r)
  const lg = lin(g)
  const lb = lin(b)
  // sRGB -> XYZ -> normalised by D65 white
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047
  const y = (lr * 0.2126 + lg * 0.7152 + lb * 0.0722) / 1.0
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const L = 116 * f(y) - 16
  const A = 500 * (f(x) - f(y))
  const B = 200 * (f(y) - f(z))
  return [Math.round((L * 255) / 100), Math.round(A + 128), Math.round(B + 128)]
}

async function downloadAndCentroid(storagePath) {
  // Download via service-role: bypass RLS (founder-local tool).
  const { data, error } = await client.storage.from('iris-captures').download(storagePath)
  if (error || !data) throw new Error(`download ${storagePath}: ${error?.message ?? 'no data'}`)
  const buf = Buffer.from(await data.arrayBuffer())

  const img = sharp(buf)
  const meta = await img.metadata()
  const W = meta.width
  const H = meta.height
  if (!W || !H) throw new Error(`no width/height for ${storagePath}`)

  // Crop central 60% to avoid eyelids/lashes + outer frame.
  const cropW = Math.floor(W * 0.6)
  const cropH = Math.floor(H * 0.6)
  const left = Math.floor((W - cropW) / 2)
  const top = Math.floor((H - cropH) / 2)

  const { data: pixels, info } = await sharp(buf)
    .extract({ left, top, width: cropW, height: cropH })
    .raw()
    .toBuffer({ resolveWithObject: true })

  let sumL = 0
  let sumA = 0
  let sumB = 0
  let n = 0
  const channels = info.channels // 3 (RGB) or 4 (RGBA)
  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i] / 255
    const g = pixels[i + 1] / 255
    const b = pixels[i + 2] / 255
    // Skip near-black (pupil + mask) and near-white (specular reflections).
    const sum = r + g + b
    if (sum < 0.05) continue
    if (sum > 2.85) continue
    const [L, A, B] = rgbToLabCvScale(r, g, b)
    sumL += L
    sumA += A
    sumB += B
    n++
  }
  if (n === 0) return null
  return [sumL / n, sumA / n, sumB / n].map((v) => Math.round(v))
}

function meanCentroid(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const dims = arr[0].lab.length
  const sums = Array(dims).fill(0)
  for (const x of arr) {
    for (let i = 0; i < dims; i++) sums[i] += x.lab[i]
  }
  return sums.map((s) => Math.round(s / arr.length))
}

function varianceCentroid(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const mean = meanCentroid(arr)
  const dims = arr[0].lab.length
  const sumsSq = Array(dims).fill(0)
  for (const x of arr) {
    for (let i = 0; i < dims; i++) sumsSq[i] += (x.lab[i] - mean[i]) ** 2
  }
  return sumsSq.map((s) => Math.round(s / arr.length))
}

async function main() {
  console.log('# recalibrate-centroids.mjs — PLAN 07.1-02 P0.4 first-pass\n')
  const annotations = await fetchAnnotations()
  console.log(`Found ${annotations.length} annotated reading(s).`)
  if (annotations.length === 0) {
    console.log('No fixtures available — no recalibration possible.')
    console.log('Keep IRIS_COLOR_LAB_CENTROIDS hardcoded.')
    return
  }

  const ids = annotations.map((a) => a.reading_id).filter(Boolean)
  const imagesByReading = await fetchImagesForReadings(ids)

  // Per-category aggregation
  const buckets = {}
  for (const a of annotations) {
    const cat = COLOR_TO_CATEGORY[a.real_iris_color] ?? 'unknown'
    if (!buckets[cat]) buckets[cat] = []
    const imgs = Array.isArray(imagesByReading[a.reading_id])
      ? imagesByReading[a.reading_id]
      : []
    if (imgs.length === 0) {
      console.warn(`  WARN: reading ${a.reading_id} has no frontal images — skipped`)
      continue
    }
    for (const img of imgs) {
      try {
        const lab = await downloadAndCentroid(img.storage_path)
        if (lab) {
          buckets[cat].push({ lab, source: `${a.reading_id} ${img.eye}` })
          console.log(`  ${cat} <- ${img.eye} (${a.reading_id.slice(0, 8)}): LAB ${lab.join(',')}`)
        } else {
          console.warn(`  WARN: zero valid pixels in ${img.storage_path}`)
        }
      } catch (err) {
        console.error(`  skip ${img.storage_path}: ${err.message}`)
      }
    }
  }

  console.log('\nProposal table:')
  console.log('category         |  n | proposed LAB        | hardcoded LAB       | delta')
  console.log('-----------------|----|---------------------|---------------------|-------------------')
  const categories = Object.keys(HARDCODED)
  for (const cat of categories) {
    const arr = buckets[cat] ?? []
    if (arr.length === 0) {
      console.log(
        `${cat.padEnd(16)} |  0 | (no fixtures)       | (${HARDCODED[cat].join(', ').padEnd(15)}) | KEEP hardcoded`,
      )
      continue
    }
    const n = arr.length
    const mean = meanCentroid(arr)
    const variance = varianceCentroid(arr)
    const hard = HARDCODED[cat]
    const delta = mean.map((v, i) => v - hard[i])
    console.log(
      `${cat.padEnd(16)} | ${String(n).padStart(2)} | (${mean.join(', ').padEnd(17)}) | (${hard.join(', ').padEnd(17)}) | (${delta.join(', ')})`,
    )
    console.log(`     intra-cluster variance (sq dev): (${variance.join(', ')})`)
    if (n < 3) {
      console.log(`     WARN: low confidence (n=${n} < 3). More fixtures recommended.`)
    }
  }

  if (buckets.unknown && buckets.unknown.length > 0) {
    console.log(
      `\nUngrouped (real_iris_color value not mapped — added 'outra' or new value?): n=${buckets.unknown.length}`,
    )
    for (const x of buckets.unknown) console.log(`  ${x.source}: LAB ${x.lab.join(',')}`)
  }

  console.log(
    '\nTo apply: update vision-service/pipeline/features.py:51-55 with the proposed values.',
  )
  console.log(
    'Sanity gate: only apply centroids with L in [50, 200]. Out-of-range = likely artefact.',
  )
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
