#!/usr/bin/env node
// READ-ONLY: compare vision_features (vigente) vs vision_features_sam (SAM)
// for one reading, focused on the jaw/cervical zone. Writes NOTHING.
//   node --env-file=.env.local scripts/diag-sam-vs-vigente.mjs [readingId]

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('missing supabase env'); process.exit(2) }
const RID = process.argv[2] || 'eb818f3c-23ce-4817-9e26-7d1ab6ab3b71'
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const { data, error } = await sb
  .from('readings')
  .select('id, vision_features, vision_features_sam, sam_run_metadata')
  .eq('id', RID)
  .single()
if (error) { console.error(error.message); process.exit(1) }

const JAW_RE = /mand|cervic|tempor|têmpor|maxil|coluna|pescoç|tmj|atm|trigem|dent|bruxism/i

function eyeName(k) { return k === 'right_eye' ? 'OD (right)' : 'OE (left)' }

function dumpEye(label, eye) {
  if (eye == null) { console.log(`  ${label}: (null — sem bloco de olho)`); return }
  console.log(`  ${label}:`)
  console.log(`    constitution: ${JSON.stringify(eye.constitution)}`)
  console.log(`    iris_color  : ${JSON.stringify(eye.iris_color)}`)
  console.log(`    img_quality : ${JSON.stringify(eye.image_quality)}`)
  const sp = Array.isArray(eye.sectoral_pigments) ? eye.sectoral_pigments : []
  console.log(`    sectoral_pigments: len=${sp.length} ${sp.length ? JSON.stringify(sp) : ''}`)
  const sectors = Array.isArray(eye.sectors) ? eye.sectors : []
  let maxLac = { size: 0, hour: null, depth: null }
  for (const s of sectors) {
    const f = Array.isArray(s.findings) ? s.findings : []
    const zones = Array.isArray(s.zones) ? s.zones.join(' | ') : ''
    const jaw = JAW_RE.test(zones) ? '  ◀ JAW/CERVICAL' : ''
    const fstr = f.length
      ? f.map(x => `${x.type}${x.depth ? `/${x.depth}` : ''}${x.size_mm != null ? `/${x.size_mm}mm` : ''}${x.color ? `/${x.color}` : ''}${x.extension ? `/${x.extension}` : ''}`).join(', ')
      : '—'
    if (f.length || jaw) {
      console.log(`    h${String(s.hour).padStart(2)}: [${fstr}]  zones: ${zones}${jaw}`)
    }
    for (const x of f) {
      if (x.type === 'lacuna' && (x.size_mm ?? 0) > maxLac.size) {
        maxLac = { size: x.size_mm, hour: s.hour, depth: x.depth }
      }
    }
  }
  console.log(`    >> maior lacuna: ${maxLac.hour ? `h${maxLac.hour} ${maxLac.size}mm ${maxLac.depth}` : 'nenhuma'}`)
}

function dumpPipeline(name, vf) {
  console.log(`\n================ ${name} ================`)
  if (vf == null || typeof vf !== 'object') { console.log('  (ausente / null)'); return }
  console.log(`  model_version: ${vf?.processing_metadata?.model_version ?? '(?)'}`)
  console.log(`  warnings: ${JSON.stringify(vf?.processing_metadata?.warnings ?? [])}`)
  console.log(`  asymmetry_notes: ${JSON.stringify(vf?.asymmetry_notes ?? [])}`)
  for (const k of ['right_eye', 'left_eye']) dumpEye(eyeName(k), vf?.[k])
}

console.log(`reading ${RID}`)
console.log(`sam_run_metadata: ${JSON.stringify(data.sam_run_metadata ?? null)}`)
dumpPipeline('VIGENTE (vision_features)', data.vision_features)
dumpPipeline('SAM (vision_features_sam)', data.vision_features_sam)

// Direct diff: findings types per (eye,hour) — what SAM has that vigente lacks.
console.log('\n================ DIFF SAM vs VIGENTE (por olho/hora) ================')
const V = data.vision_features, S = data.vision_features_sam
function findingsMap(vf) {
  const m = {}
  for (const k of ['right_eye', 'left_eye']) {
    const e = vf?.[k]; if (!e) continue
    for (const s of (Array.isArray(e.sectors) ? e.sectors : [])) {
      const key = `${k} h${s.hour}`
      m[key] = (Array.isArray(s.findings) ? s.findings : []).map(x =>
        `${x.type}${x.color ? `:${x.color}` : ''}${x.depth ? `:${x.depth}` : ''}${x.size_mm != null ? `:${x.size_mm}mm` : ''}`)
    }
  }
  return m
}
if (V && S) {
  const vm = findingsMap(V), smp = findingsMap(S)
  const keys = [...new Set([...Object.keys(vm), ...Object.keys(smp)])].sort()
  for (const key of keys) {
    const v = (vm[key] || []).sort().join(', ') || '—'
    const s = (smp[key] || []).sort().join(', ') || '—'
    if (v !== s) console.log(`  ${key.padEnd(16)} VIGENTE:[${v}]   SAM:[${s}]`)
  }
} else {
  console.log('  (não dá pra diffar — um dos dois ausente)')
}
