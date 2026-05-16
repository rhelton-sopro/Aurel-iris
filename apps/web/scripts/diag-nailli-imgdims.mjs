#!/usr/bin/env node
// READ-ONLY: list Nailli reading images + their ORIGINAL dimensions / byte
// size, by reading JPEG/PNG headers from signed-URL bytes. Writes NOTHING.
//   node --env-file=.env.local scripts/diag-nailli-imgdims.mjs [readingId]

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('missing supabase env'); process.exit(2) }
const READING_ID = process.argv[2] || 'eb818f3c-23ce-4817-9e26-7d1ab6ab3b71'
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

function jpegDims(buf) {
  // scan SOFn markers
  let o = 2
  while (o < buf.length) {
    if (buf[o] !== 0xff) { o++; continue }
    const m = buf[o + 1]
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) }
    }
    o += 2 + buf.readUInt16BE(o + 2)
  }
  return null
}
function pngDims(buf) {
  if (buf.toString('ascii', 1, 4) === 'PNG') {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  return null
}

const { data: imgs, error } = await sb
  .from('reading_images')
  .select('eye, angle, storage_path, created_at')
  .eq('reading_id', READING_ID)
if (error) { console.error(error.message); process.exit(1) }
if (!imgs?.length) { console.error('no reading_images'); process.exit(1) }

const paths = imgs.map((i) => i.storage_path)
const { data: signed, error: se } = await sb.storage
  .from('iris-captures')
  .createSignedUrls(paths, 300)
if (se) { console.error(se.message); process.exit(1) }

console.log('================ NAILLI ORIGINAL IMAGE DIMENSIONS ================')
console.log(`reading ${READING_ID} — ${imgs.length} images\n`)
for (let i = 0; i < imgs.length; i++) {
  const meta = imgs[i]
  const u = signed[i]?.signedUrl
  if (!u) { console.log(`${meta.eye}/${meta.angle}: <no signed url>`); continue }
  const res = await fetch(u)
  const ab = Buffer.from(await res.arrayBuffer())
  const dims = jpegDims(ab) || pngDims(ab)
  const mp = dims ? ((dims.w * dims.h) / 1e6).toFixed(2) : '?'
  const ratio = dims ? (dims.w / dims.h).toFixed(3) : '?'
  console.log(
    `${meta.eye.padEnd(5)} ${String(meta.angle).padEnd(9)} ` +
    `${dims ? `${dims.w}x${dims.h}` : 'UNKNOWN'} ` +
    `(${mp} MP, AR ${ratio})  ${(ab.length / 1024).toFixed(0)} KB  ` +
    `${meta.storage_path.split('/').pop()}`
  )
}
console.log('\nNote: pipeline resizes long edge to <=1024 before Hough (detect + segment).')
