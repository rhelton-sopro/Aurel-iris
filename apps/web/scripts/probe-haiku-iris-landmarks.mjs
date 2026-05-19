#!/usr/bin/env node
// scripts/probe-haiku-iris-landmarks.mjs
//
// Phase 07.1.6 D-06 — golden fixture probe + regression baseline.
//
// Role:
//   - Re-runs Sonnet 4.6 (default explicit via --model) ou Haiku 4.5 (script
//     default) contra um reading_id real e gera (a) o JSON output em
//     scripts/output/landmarks-probe-<model>.json e (b) crops visuais em
//     scripts/output/crops-<model>/.
//   - Golden fixture commitado: scripts/output/landmarks-probe-sonnet-4-6.json
//     (Nailli e85ea7de, post-protocol commit f885462). Outros outputs continuam
//     .gitignored (apps/web/scripts/output/* wildcard + negation só pro golden).
//
// Usage (from apps/web/):
//   node --env-file=.env.local scripts/probe-haiku-iris-landmarks.mjs
//                                       # default model + default reading (NAILLI_E85EA7DE_GOLDEN)
//
//   node --env-file=.env.local scripts/probe-haiku-iris-landmarks.mjs <readingId>
//                                       # explicit readingId override
//
//   node --env-file=.env.local scripts/probe-haiku-iris-landmarks.mjs --model=claude-sonnet-4-6
//                                       # different model (Sonnet 4.6 é o que produz golden fixture)
//
// Required env vars (.env.local):
//   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY (eyJ prefix guarded at startup)
//   ANTHROPIC_API_KEY
//
// Output paths (suffixed with model slug to avoid clobber):
//   scripts/output/landmarks-probe-<modelSlug>.json
//   scripts/output/crops-<modelSlug>/{eye}_{angle}_crop.jpg
//
// Cost expectations (per 6-photo reading):
//   Sonnet 4.6: ~$0.05  (~1.8k input + ~170 output tokens × 6 fotos)
//   Haiku 4.5:  ~$0.006 (same shape, lower per-Mtok)
//
// Founder workflow (pre-PR validation):
//   1. Run probe com --model=claude-sonnet-4-6 contra Nailli golden reading
//   2. Open crops side-by-side; eyeball test (íris centrada? pálpebras horizontais?
//      nada importante cortado?)
//   3. Compare JSON output to scripts/output/landmarks-probe-sonnet-4-6.json (golden)
//      via gated integration test: CANONICAL_PROBE=1 pnpm test -- probe-canonical
//   4. CI NÃO roda este script — custo Sonnet + flakiness VLM tornam unsuitable for CI.
//
// Decision criteria (founder valida ground truth visualmente após rodar):
//   - iris_bbox center within ±5% of true center → bbox usable (D-06 tolerance)
//   - rotation_angle_deg: C-02 lock dropped — terapeuta orienta câmera
//   - canthus: unused downstream (CONTEXT.md "deferred" §eye_landmarks)
//
// Refresh golden fixture workflow (apenas quando Sonnet drift documentado):
//   1. Rodar `pnpm --filter web exec node --env-file=.env.local \
//      scripts/probe-haiku-iris-landmarks.mjs --model=claude-sonnet-4-6`
//   2. git diff apps/web/scripts/output/landmarks-probe-sonnet-4-6.json
//   3. Investigate drift causes (Sonnet prompt change? Capture protocol change?)
//   4. Commit explícito: `chore(07.1.6): refresh golden fixture (justification: ...)`

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

// Golden fixture role: Phase 07.1.6 regression baseline.
// Nailli e85ea7de = reading capturada com protocol revisto (commit f885462).
// Antiga (71a7bf1d) pre-protocol é mantida como referência historiográfica
// mas NÃO é o golden — corpus expansion é Phase 07.2 Wave C.
const NAILLI_E85EA7DE_GOLDEN = 'e85ea7de-0e5f-4f49-a889-f886e4a05073'
const MODEL_DEFAULT = 'claude-haiku-4-5-20251001'
// Send a larger thumbnail than the existing /api/capture/validate (512) — probe
// tests if more pixels improve landmark precision. ~1024 px long edge keeps
// image tokens around 1k while preserving sub-pixel canthus features.
const VLM_RESIZE_LONG_EDGE = 1024
const CROP_MULTIPLIER = 2.5
const CROP_OUT_SIZE = 800
const STORAGE_BUCKET = 'iris-captures'

// Anthropic pricing (USD per million tokens) — for cost estimate only.
// Conservative fallback if model not in map (Sonnet-tier).
const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-6-20251001': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
}
const PRICING_FALLBACK = { input: 3.0, output: 15.0 }

// Slugify a model id for filesystem paths (drop date suffix, replace dots).
function modelSlug(modelId) {
  // claude-haiku-4-5-20251001 -> haiku-4-5
  // claude-sonnet-4-6         -> sonnet-4-6
  return modelId
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/[^a-z0-9-]/gi, '-')
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

for (const [name, v] of [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
  ['ANTHROPIC_API_KEY', ANTHROPIC_API_KEY],
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

// Parse CLI args: positional <readingId> + optional --model=<id> in any order.
let readingId = NAILLI_E85EA7DE_GOLDEN
let model = MODEL_DEFAULT
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--model=')) {
    model = arg.slice('--model='.length).trim()
    if (!model) {
      console.error('--model= requires a non-empty value')
      process.exit(2)
    }
  } else if (!arg.startsWith('--')) {
    readingId = arg
  } else {
    console.error(`Unknown flag: ${arg}`)
    process.exit(2)
  }
}

const slug = modelSlug(model)
const OUT_JSON = `scripts/output/landmarks-probe-${slug}.json`
const CROPS_DIR = `scripts/output/crops-${slug}`
const pricing = PRICING[model] ?? PRICING_FALLBACK
if (!PRICING[model]) {
  console.warn(`[probe] no pricing entry for ${model} — using Sonnet-tier fallback for cost estimate`)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Você é um analisador visual de fotos de íris para iridologia. Examine a foto e retorne APENAS JSON (sem markdown, sem prefixo, sem texto fora do JSON):

{
  "valid": <true|false>,
  "iris_bbox": {
    "center_x_pct": <0.0-1.0>,
    "center_y_pct": <0.0-1.0>,
    "radius_pct": <0.0-0.5>
  },
  "rotation_angle_deg": <number>,
  "eye_landmarks": {
    "inner_canthus_x_pct": <0.0-1.0>,
    "inner_canthus_y_pct": <0.0-1.0>,
    "outer_canthus_x_pct": <0.0-1.0>,
    "outer_canthus_y_pct": <0.0-1.0>
  },
  "confidence": <0.0-1.0>,
  "iris_color": {
    "primary": <"castanho"|"azul"|"verde"|"misto"|"cinza"|"avela"|"acinzentado"|"verde_acinzentado"|"azul_acinzentado"|"castanho_acinzentado"|null>,
    "secondary": <string|null>,
    "dominant_pigments": [<string>, ...],
    "central_heterochromia": <true|false>,
    "confidence": <0.0-1.0>
  }
}

Definições (importante seguir exatamente):

- iris_bbox.center_x_pct, center_y_pct: coordenadas do CENTRO geométrico da íris (não da pupila — o centro da íris coincide com o centro da pupila), expressas como fração da largura e altura da imagem. Ex: 0.5/0.5 = centro perfeito da imagem.
- iris_bbox.radius_pct: raio da íris em fração da MENOR dimensão da imagem. Ex: 0.18 em uma imagem 1000x800 = raio de 144 px (0.18 * 800).
- rotation_angle_deg: graus para rotacionar a imagem no sentido HORÁRIO (clockwise) para deixar a linha imaginária entre o canto INTERNO e o canto EXTERNO do olho HORIZONTAL (paralela à borda inferior da imagem). Positivo = sentido horário. Negativo = anti-horário. Ex: se o canto interno está mais ALTO que o externo no momento (cabeça inclinada para a esquerda do cliente / direita do observador), retorne valor POSITIVO (rotacionar CW endireita).
- inner_canthus = canto INTERNO do olho (lado do nariz). outer_canthus = canto EXTERNO (lado da têmpora).
- confidence: sua confiança na precisão das coordenadas reportadas (0.0 = chute, 1.0 = certeza absoluta).
- iris_color.primary: cor predominante da íris em vocabulário iridológico. Escolha UMA, observando atentamente o tom da MAIOR parte da área visível da íris:
  - "castanho" (marrom em qualquer tom, sem nuance gray/dust)
  - "azul" (azul puro, vibrante, sem nuance gray)
  - "verde" (verde puro, vibrante, sem nuance gray)
  - "misto" (mistura clara de duas cores SEM dominância gray — ex: castanho central + verde periférico equilibrados)
  - "cinza" (acromático puro — sem dominância de verde, azul, ou castanho)
  - "avela" (avelã/hazel — castanho-claro com nuance verde-amarelada)
  - "acinzentado" (íris fundamentalmente gray-tinted, mas com cor base não identificável claramente — ex: gray puxando levemente pra azul-cinza ou verde-cinza sem dominância)
  - "verde_acinzentado" (íris verde com nuance cinza VISÍVEL — gray-green, comum em clientes com predominância biliar-linfática iridológica; distingue-se de "verde" puro pela presença de gray visível no estroma)
  - "azul_acinzentado" (íris azul com nuance cinza VISÍVEL — blue-gray, comum em constituição linfática iridológica pura)
  - "castanho_acinzentado" (íris castanha com nuance cinza VISÍVEL — brown-gray)
  Use null SOMENTE se a foto não permite ver cor (totalmente embaçada, sem foco, foto de pálpebra fechada).
  HEURÍSTICA: se você está em dúvida entre "verde" e "verde_acinzentado", escolha "verde_acinzentado" sempre que houver QUALQUER componente gray visível — é a categoria iridológica mais informativa. Pure "verde" reserva-se para íris vibrantes sem gray.
- iris_color.secondary: cor secundária visível se a íris tem segundo tom claro (ex: castanho central + verde periférico → secondary="verde"). Use null se monocromática.
- iris_color.dominant_pigments: lista de pigmentos visíveis em vocabulário iridológico. Inclua TODOS que você identifica entre: "pigmento_amarelo" (xantofila — manchas amarelas pequenas), "pigmento_marrom" (melanina concentrada — manchas marrom-escuras), "pigmento_alaranjado" (pigmento de coloração laranja, mais raro), "pigmento_psicológico" (manchas pequenas próximas à pupila), "anel_sódico" (anel branco/cinza na periferia). Lista vazia [] se íris uniforme sem pigmentação distintiva.
- iris_color.central_heterochromia: true se a região central da íris (~1/3 anel ao redor da pupila) tem cor distintamente diferente do anel periférico (ex: castanho central + azul periférico). false se monocromática ou só gradação suave.
- iris_color.confidence: 0.0-1.0 sua certeza na nomenclatura (0.0 = chute pesado, 1.0 = inequívoco). Considere iluminação, qualidade da foto, e ambiguidade entre categorias.

Se a foto NÃO tem um olho humano analisável (sem olho, fora de foco total, totalmente coberta, etc.): retorne valid:false e zere todas as coordenadas (0.5/0.5/0.0/0.0/0.0/0.0/0.0/0.0, confidence:0.0). iris_color.primary e iris_color.secondary devem ser null, dominant_pigments [], central_heterochromia false, iris_color.confidence 0.0. Não retorne null em campos numéricos da bbox/landmarks.

NÃO escreva nada fora do JSON. Sem markdown, sem cerca de código, sem prefixo "json:".`

/**
 * Rotate a point (x, y) in the original image around the image center by
 * angleDeg CLOCKWISE (sharp.rotate convention), then translate into the
 * auto-resized destination canvas. Verified by hand for 0°/90°/180°.
 */
function rotatePointAroundCenter(x, y, oldW, oldH, newW, newH, angleDeg) {
  const t = (angleDeg * Math.PI) / 180
  const xc = x - oldW / 2
  const yc = y - oldH / 2
  const xr = xc * Math.cos(t) - yc * Math.sin(t)
  const yr = xc * Math.sin(t) + yc * Math.cos(t)
  return { x: xr + newW / 2, y: yr + newH / 2 }
}

async function downloadImage(storagePath) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath)
  if (error || !data) {
    throw new Error(`Storage download failed for ${storagePath}: ${error?.message ?? 'unknown'}`)
  }
  const ab = await data.arrayBuffer()
  // Bake EXIF orientation into pixels so Haiku sees the same orientation the
  // user sees in their phone gallery. sharp.rotate() with no args = auto-rotate
  // from EXIF then strip the orientation flag (#2070 of sharp docs).
  return await sharp(Buffer.from(ab)).rotate().toBuffer()
}

async function resizeForVlm(buf, longEdge) {
  const meta = await sharp(buf).metadata()
  const ow = meta.width
  const oh = meta.height
  if (!ow || !oh) throw new Error('image metadata missing width/height')
  const scale = Math.max(ow, oh) > longEdge ? longEdge / Math.max(ow, oh) : 1
  const w = Math.max(1, Math.round(ow * scale))
  const h = Math.max(1, Math.round(oh * scale))
  const resized = await sharp(buf).resize(w, h, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer()
  return { base64: resized.toString('base64'), origW: ow, origH: oh, vlmW: w, vlmH: h }
}

async function callVlm(base64) {
  const t0 = Date.now()
  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [{
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
      }],
    }],
  })
  const durationMs = Date.now() - t0
  const textBlock = response.content.find((b) => b.type === 'text')
  const rawText = textBlock?.text ?? ''
  let parsed = null
  let parseError = null
  try {
    const m = rawText.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(m ? m[0] : rawText)
  } catch (e) {
    parseError = e.message
  }
  return { rawText, parsed, parseError, durationMs, usage: response.usage }
}

async function applyCrop(buf, origW, origH, parsed, outPath) {
  const { iris_bbox: bbox } = parsed
  const cxp = bbox.center_x_pct ?? 0.5
  const cyp = bbox.center_y_pct ?? 0.5
  const rp = bbox.radius_pct ?? 0
  const angleDeg = parsed.rotation_angle_deg ?? 0

  // iris center + radius in original-frame pixels (post-EXIF rotation)
  const cx = cxp * origW
  const cy = cyp * origH
  const r = rp * Math.min(origW, origH)

  if (r <= 1) throw new Error(`radius_pct ${rp} -> ${r}px too small to crop`)

  // Rotate first (canvas auto-expands to fit)
  let workBuf = buf
  let newW = origW
  let newH = origH
  if (Math.abs(angleDeg) > 0.01) {
    workBuf = await sharp(buf)
      .rotate(angleDeg, { background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .toBuffer()
    const rotMeta = await sharp(workBuf).metadata()
    newW = rotMeta.width
    newH = rotMeta.height
  }

  // Transform iris center to rotated frame
  const newCenter = rotatePointAroundCenter(cx, cy, origW, origH, newW, newH, angleDeg)

  // Crop box: square of side 2.5*r centered on iris
  let cropSide = Math.round(CROP_MULTIPLIER * r)
  // If crop is bigger than the rotated image, shrink to the smaller dim
  if (cropSide > newW) cropSide = newW
  if (cropSide > newH) cropSide = newH

  let left = Math.round(newCenter.x - cropSide / 2)
  let top = Math.round(newCenter.y - cropSide / 2)
  // Clamp to image bounds so extract() doesn't throw
  left = Math.max(0, Math.min(left, newW - cropSide))
  top = Math.max(0, Math.min(top, newH - cropSide))

  await mkdir(dirname(outPath), { recursive: true })
  await sharp(workBuf)
    .extract({ left, top, width: cropSide, height: cropSide })
    .resize(CROP_OUT_SIZE, CROP_OUT_SIZE, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toFile(outPath)

  return {
    iris_center_px: [Math.round(cx), Math.round(cy)],
    iris_radius_px: Math.round(r),
    rotation_applied_deg: angleDeg,
    rotated_dims: { width: newW, height: newH },
    rotated_iris_center_px: [Math.round(newCenter.x), Math.round(newCenter.y)],
    crop_box: { left, top, side: cropSide },
    output_size_px: CROP_OUT_SIZE,
  }
}

async function main() {
  console.log(`[probe-haiku] reading: ${readingId}`)
  console.log(`[probe-haiku] model:   ${model}`)
  console.log(`[probe-haiku] output:  ${OUT_JSON} + ${CROPS_DIR}/`)

  const { data: images, error } = await supabase
    .from('reading_images')
    .select('eye, angle, storage_path')
    .eq('reading_id', readingId)
    .order('eye', { ascending: true })
    .order('angle', { ascending: true })
  if (error) throw new Error(`reading_images query failed: ${error.message}`)
  if (!images || images.length === 0) throw new Error('no images for reading')
  console.log(`[probe-haiku] ${images.length} image(s) found\n`)

  let totalInputTokens = 0
  let totalOutputTokens = 0

  const results = []
  for (const img of images) {
    const tag = `${img.eye}_${img.angle}`
    process.stdout.write(`[probe-haiku] ${tag.padEnd(22)} ... `)
    const entry = {
      image_path: img.storage_path,
      eye: img.eye,
      angle: img.angle,
      original_dims: null,
      vlm_dims: null,
      haiku_raw_text: null,
      haiku_response: null,
      parse_error: null,
      usage: null,
      duration_ms: null,
      computed: null,
      crop_saved_path: null,
      error: null,
    }
    try {
      const buf = await downloadImage(img.storage_path)
      const { base64, origW, origH, vlmW, vlmH } = await resizeForVlm(buf, VLM_RESIZE_LONG_EDGE)
      entry.original_dims = { width: origW, height: origH }
      entry.vlm_dims = { width: vlmW, height: vlmH }
      const { rawText, parsed, parseError, durationMs, usage } = await callVlm(base64)
      entry.haiku_raw_text = rawText
      entry.haiku_response = parsed
      entry.model = model
      entry.parse_error = parseError
      entry.usage = usage
      entry.duration_ms = durationMs
      if (usage) {
        totalInputTokens += usage.input_tokens ?? 0
        totalOutputTokens += usage.output_tokens ?? 0
      }
      if (parsed && parsed.valid !== false && parsed.iris_bbox) {
        const cropPath = `${CROPS_DIR}/${tag}_crop.jpg`
        try {
          entry.computed = await applyCrop(buf, origW, origH, parsed, cropPath)
          entry.crop_saved_path = cropPath
        } catch (cropErr) {
          entry.error = `crop failed: ${cropErr.message}`
        }
      } else if (parsed && parsed.valid === false) {
        entry.error = 'haiku returned valid:false'
      } else {
        entry.error = parseError ?? 'iris_bbox missing in parsed response'
      }
      console.log(entry.crop_saved_path ? `OK (${durationMs}ms)` : `FAIL — ${entry.error ?? 'unknown'}`)
    } catch (e) {
      entry.error = e.message
      console.log(`ERROR — ${e.message}`)
    }
    results.push(entry)
  }

  // Cost estimate (per-model pricing)
  const costInput = (totalInputTokens / 1_000_000) * pricing.input
  const costOutput = (totalOutputTokens / 1_000_000) * pricing.output
  const costTotal = costInput + costOutput

  // Write JSON
  await mkdir(dirname(OUT_JSON), { recursive: true })
  await writeFile(
    OUT_JSON,
    JSON.stringify(
      {
        reading_id: readingId,
        model,
        run_at: new Date().toISOString(),
        pricing_per_mtok: pricing,
        token_totals: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          estimated_cost_usd: Number(costTotal.toFixed(6)),
        },
        results,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`\n[probe-haiku] JSON saved -> ${OUT_JSON}`)

  // Console table
  console.log('\n[probe-haiku] === results ===')
  const header = 'tag                    | center_x | center_y |  radius  |  angle°  |  conf | dur(ms)'
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const r of results) {
    const tag = `${r.eye}_${r.angle}`.padEnd(22)
    const h = r.haiku_response
    const fmt = (v, d = 3) => (typeof v === 'number' ? v.toFixed(d) : '   ---')
    const cx = fmt(h?.iris_bbox?.center_x_pct).padStart(8)
    const cy = fmt(h?.iris_bbox?.center_y_pct).padStart(8)
    const rad = fmt(h?.iris_bbox?.radius_pct).padStart(8)
    const rot = fmt(h?.rotation_angle_deg, 2).padStart(8)
    const conf = fmt(h?.confidence, 2).padStart(5)
    const dur = String(r.duration_ms ?? '---').padStart(7)
    console.log(`${tag} | ${cx} | ${cy} | ${rad} | ${rot} | ${conf} | ${dur}`)
  }

  const ok = results.filter((r) => r.crop_saved_path).length
  console.log(
    `\n[probe-haiku] ${ok}/${results.length} crops saved -> ${CROPS_DIR}/`,
  )
  console.log(
    `[probe-haiku] tokens: ${totalInputTokens} in + ${totalOutputTokens} out  ~$${costTotal.toFixed(4)} USD`,
  )
  console.log('[probe-haiku] open the crops side-by-side and validate visually:')
  console.log('  - íris centrada?')
  console.log('  - pálpebras horizontais?')
  console.log('  - nada importante cortado?')
}

main().catch((err) => {
  console.error('[probe-haiku] FAILED:', err.message)
  if (err.stack) console.error(err.stack)
  process.exit(1)
})
