#!/usr/bin/env node
// scripts/diag-nailli-pigments.mjs
// READ-ONLY diagnostic — H1 (detector under-detection) vs H2 (injection
// regression) for FIX 13. Fetches vision_features for the Nailli reading and
// prints, per eye, the top-level sectoral_pigments + any type:"pigmentacao"
// entries inside sectors[].findings + asymmetry_notes. Writes NOTHING.
//
//   node --env-file=.env.local scripts/diag-nailli-pigments.mjs [readingId]

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(2)
}

const READING_ID = process.argv[2] || 'eb818f3c-23ce-4817-9e26-7d1ab6ab3b71'
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await supabase
  .from('readings')
  .select('id, status, vision_features')
  .eq('id', READING_ID)
  .single()

if (error) {
  console.error('Fetch failed:', error.message)
  process.exit(1)
}

let vf = data.vision_features
if (typeof vf === 'string') {
  try { vf = JSON.parse(vf) } catch { /* leave as-is */ }
}

console.log('================ NAILLI PIGMENT DIAGNOSTIC ================')
console.log('reading id :', data.id)
console.log('status     :', data.status)
console.log('vf top keys:', vf && typeof vf === 'object' ? Object.keys(vf).join(', ') : `(non-object: ${typeof vf})`)
console.log('model_ver  :', vf?.processing_metadata?.model_version ?? '(absent)')
console.log('proc_meta  :', JSON.stringify(vf?.processing_metadata ?? null))
console.log('asym_notes :', JSON.stringify(vf?.asymmetry_notes ?? null))
console.log()

function dumpEye(label, eye) {
  console.log(`---------------- ${label} ----------------`)
  if (eye == null) {
    console.log('  (eye block is null — eye failed/absent)')
    return
  }
  console.log('  iris_color  :', JSON.stringify(eye.iris_color))
  console.log('  constitution:', JSON.stringify(eye.constitution))
  console.log('  fiber_dens  :', JSON.stringify(eye.fiber_density))
  console.log('  img_quality :', JSON.stringify(eye.image_quality))

  const sp = Array.isArray(eye.sectoral_pigments) ? eye.sectoral_pigments : null
  console.log(`  >> TOP-LEVEL sectoral_pigments: ${sp == null ? '(key absent / not array)' : `len=${sp.length}`}`)
  if (sp && sp.length) console.log('     ' + JSON.stringify(sp, null, 0))

  const sectors = Array.isArray(eye.sectors) ? eye.sectors : []
  let pigInFindings = 0
  const findingTypeCounts = {}
  for (const s of sectors) {
    const f = Array.isArray(s.findings) ? s.findings : []
    for (const x of f) {
      findingTypeCounts[x.type] = (findingTypeCounts[x.type] || 0) + 1
      if (x.type === 'pigmentacao') pigInFindings++
    }
  }
  console.log(`  >> sectors[].findings type histogram: ${JSON.stringify(findingTypeCounts)}`)
  console.log(`  >> count of type:"pigmentacao" in sectors[].findings: ${pigInFindings}`)

  const s7 = sectors.find((s) => s.hour === 7)
  console.log('  >> sector 7 (hour 7) findings:', JSON.stringify(s7?.findings ?? '(no hour-7 sector)'))
}

dumpEye('OD (right_eye)', vf?.right_eye)
console.log()
dumpEye('OE (left_eye)', vf?.left_eye)

console.log()
console.log('================ VERDICT ================')
const od = vf?.right_eye, oe = vf?.left_eye
const odSP = Array.isArray(od?.sectoral_pigments) ? od.sectoral_pigments.length : 0
const oeSP = Array.isArray(oe?.sectoral_pigments) ? oe.sectoral_pigments.length : 0
const totalSP = odSP + oeSP
let pigInFindingsTotal = 0
for (const eye of [od, oe]) {
  for (const s of (Array.isArray(eye?.sectors) ? eye.sectors : [])) {
    for (const x of (Array.isArray(s.findings) ? s.findings : [])) {
      if (x.type === 'pigmentacao') pigInFindingsTotal++
    }
  }
}
console.log(`total sectoral_pigments (OD+OE): ${totalSP}  | total pigmentacao-in-findings: ${pigInFindingsTotal}`)
if (totalSP === 0) {
  console.log('=> H1 CONFIRMED: sectoral_pigments empty for both eyes — chromatic')
  console.log('   detector (detect_sectoral_pigments) under-detecting. Injection')
  console.log('   code has nothing to inject. Fix = LAB threshold recalibration.')
} else if (pigInFindingsTotal === 0) {
  console.log('=> H2 CONFIRMED: sectoral_pigments NON-empty but zero type:"pigmentacao"')
  console.log('   in sectors[].findings — injection (extract_all) not running on the')
  console.log('   persisted data (deploy/path regression). Code present in repo, so')
  console.log('   suspect stale Modal image or a non-extract_all code path.')
} else {
  console.log('=> NEITHER pure H1 nor H2 — pigments present AND injected. Re-read')
  console.log('   the founder symptom report against this data (per-sector mismatch?).')
}
