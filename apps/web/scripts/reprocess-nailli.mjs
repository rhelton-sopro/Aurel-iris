#!/usr/bin/env node
// scripts/reprocess-nailli.mjs
// One-shot: find Nailli's most recent reading and re-trigger the Modal
// vision pipeline (post B1a fix deploy 2026-05-11).
//
// Mirrors apps/web/app/api/readings/[id]/process/route.ts steps 3-7, but
// uses service-role and skips the auth/ownership gate (this is a founder-
// local recovery script, not an authenticated endpoint).
//
// Usage (from apps/web/):
//   node --env-file=.env.local scripts/reprocess-nailli.mjs
//
// Optional override: pass a reading id explicitly:
//   node --env-file=.env.local scripts/reprocess-nailli.mjs <readingId>

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MODAL_ENDPOINT = process.env.MODAL_ANALYZE_ENDPOINT_URL
const MODAL_TOKEN_ID = process.env.MODAL_TOKEN_ID
const MODAL_TOKEN_SECRET = process.env.MODAL_TOKEN_SECRET

for (const [name, v] of [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
  ['MODAL_ANALYZE_ENDPOINT_URL', MODAL_ENDPOINT],
  ['MODAL_TOKEN_ID', MODAL_TOKEN_ID],
  ['MODAL_TOKEN_SECRET', MODAL_TOKEN_SECRET],
]) {
  if (!v) {
    console.error(`Missing env var: ${name}`)
    process.exit(2)
  }
}
if (!SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY appears malformed (no eyJ prefix)')
  process.exit(2)
}

const SIGNED_URL_TTL_SECONDS = 600

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findReading() {
  const argv = process.argv[2]
  if (argv) {
    const { data, error } = await client
      .from('readings')
      .select('id, status, therapist_id, client_id')
      .eq('id', argv)
      .single()
    if (error || !data) throw new Error(`reading not found: ${argv} (${error?.message ?? ''})`)
    return data
  }

  const { data: clients, error: cErr } = await client
    .from('clients')
    .select('id, name')
    .ilike('name', '%nailli%')
  if (cErr) throw new Error(`clients query failed: ${cErr.message}`)
  if (!clients || clients.length === 0) throw new Error('no client matching "nailli"')
  console.log(`Found ${clients.length} client(s) matching "nailli":`)
  for (const c of clients) console.log(`  - ${c.name} (${c.id})`)

  const clientIds = clients.map((c) => c.id)
  const { data, error } = await client
    .from('readings')
    .select('id, status, therapist_id, client_id, created_at')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`readings query failed: ${error.message}`)
  if (!data || data.length === 0) throw new Error('no readings for Nailli')
  return data[0]
}

async function main() {
  console.log('[reprocess-nailli] starting…')

  const reading = await findReading()
  console.log(`Reading: ${reading.id}`)
  console.log(`  status: ${reading.status}`)
  console.log(`  therapist_id: ${reading.therapist_id}`)
  console.log(`  client_id: ${reading.client_id}`)

  // Fetch images
  const { data: images, error: imgErr } = await client
    .from('reading_images')
    .select('eye, angle, storage_path')
    .eq('reading_id', reading.id)
  if (imgErr) throw new Error(`images query failed: ${imgErr.message}`)
  if (!images || images.length === 0) throw new Error('no images for reading')
  console.log(`  images: ${images.length}`)

  // Signed URLs (TTL 600s — same as production route)
  const paths = images.map((i) => i.storage_path)
  const { data: signed, error: signErr } = await client.storage
    .from('iris-captures')
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signed) throw new Error(`signed urls failed: ${signErr?.message ?? 'unknown'}`)

  const imageUrls = images.map((img, idx) => {
    const u = signed[idx]?.signedUrl
    if (!u) throw new Error(`missing signed URL for ${img.storage_path}`)
    return { eye: img.eye, angle: img.angle, url: u }
  })

  // Pre-spawn: status='processing' + placeholder
  const { error: preErr } = await client
    .from('readings')
    .update({
      status: 'processing',
      vision_features: { processing_metadata: { modal_call_id: 'pending' } },
    })
    .eq('id', reading.id)
  if (preErr) throw new Error(`pre-spawn update failed: ${preErr.message}`)

  // POST to Modal
  console.log(`[reprocess-nailli] POST ${MODAL_ENDPOINT}`)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 30_000)
  let callId
  try {
    const res = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        'Modal-Key': MODAL_TOKEN_ID,
        'Modal-Secret': MODAL_TOKEN_SECRET,
      },
      body: JSON.stringify({ reading_id: reading.id, image_urls: imageUrls }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`Modal ${res.status} ${res.statusText} — ${txt.slice(0, 300)}`)
    }
    const json = await res.json()
    callId = json.call_id
    if (!callId) throw new Error('Modal response missing call_id')
  } catch (err) {
    console.error('[reprocess-nailli] Modal call failed — rolling back to failed status')
    await client
      .from('readings')
      .update({
        status: 'failed',
        vision_features: {
          processing_metadata: {
            modal_call_id: 'failed',
            error_summary: 'Falha temporária no processamento — tente novamente',
          },
        },
      })
      .eq('id', reading.id)
    throw err
  } finally {
    clearTimeout(timer)
  }

  // Post-spawn: replace placeholder with real call_id
  const { error: postErr } = await client
    .from('readings')
    .update({
      vision_features: { processing_metadata: { modal_call_id: callId } },
    })
    .eq('id', reading.id)
  if (postErr) throw new Error(`post-spawn update failed: ${postErr.message}`)

  console.log(`[reprocess-nailli] success — call_id=${callId}`)
  console.log('Pipeline running. Watch dashboard or query readings.status until ready.')
}

main().catch((err) => {
  console.error('[reprocess-nailli] FAILED:', err.message)
  process.exit(1)
})
