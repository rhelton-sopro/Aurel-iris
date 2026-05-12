/**
 * Phase 07.1.6 — single-image Sonnet 4.6 iris bbox fetcher.
 *
 * C-04: claude-sonnet-4-6 hardcoded via `SONNET_BBOX_MODEL` literal-type
 *       constant (não env-overridable, não Haiku, não Opus). C-05: call
 *       independente do Haiku validate path (`app/api/capture/validate/`),
 *       2 calls Anthropic mantidas.
 *
 * Fluxo:
 *   1. sharp.metadata() pra obter origW/origH (pós-EXIF-bake do caller)
 *   2. resize long-edge → 1024 (probe pattern, ~1.8k input tokens)
 *   3. JPEG quality 85 → base64 → Anthropic messages.create
 *   4. parse JSON via regex `\{[\s\S]*\}` (mesmo padrão validate/route.ts L179)
 *   5. type-check each field defensively (T-07.1.6-10 mitigation: Tampering
 *      via Sonnet response → defaults sane se parse drift)
 *   6. estimateCostUsd com PRICING_SONNET_4_6
 *
 * Custo esperado: ~1.8k input × $3/MTok + ~170 output × $15/MTok ≈ $0.008/foto;
 * 6 fotos/reading ≈ $0.05/reading (PROJECT.md envelope).
 *
 * Phase 07.1.6 | Plan 03 Task 2 | Decisions: C-04, C-05; threat T-07.1.6-09/10
 */
import 'server-only'
import sharp from 'sharp'
import {
  anthropicClient,
  SONNET_BBOX_MODEL,
  PRICING_SONNET_4_6,
  estimateCostUsd,
} from '@/lib/anthropic/client'
import type { IrisBbox, IrisColorPerPhoto } from '@/lib/anthropic/types'

const VLM_RESIZE_LONG_EDGE = 1024
// Bumped from 512 → 768 to fit iris_color block addition (~50 extra tokens). Output
// usage measured on real readings stays well under 300 tokens; floor doubled for headroom.
const MAX_TOKENS = 768
const VLM_JPEG_QUALITY = 85

/**
 * SYSTEM_PROMPT — byte-exact copy de
 * `apps/web/scripts/probe-haiku-iris-landmarks.mjs` lines 116-145, para
 * preservar golden fixture comparability (D-06: Plan 07 regression test
 * compara este prompt contra `landmarks-probe-sonnet-4-6.json`).
 *
 * Mantemos `eye_landmarks` (canthus) + `rotation_angle_deg` no schema do prompt
 * mesmo que C-02 lock dropping rotation e o canthus seja unused downstream —
 * remover seria divergência do probe e quebraria a comparação golden.
 * O parser abaixo SÓ extrai `valid` + `iris_bbox.*` + `confidence` (campos
 * que o IrisBbox interface declara).
 */
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
- rotation_angle_deg: graus para rotacionar a imagem no sentido HORÁRIO (clockwise) para deixar a linha imaginária entre o canto INTERNO e o canto EXTERNO do olho HORIZONTAL (paralela à borda inferior da imagem). Positivo = sentido horário. Negativo = anti-horário. Ex: se o canto interno está mais ALTO que o externo no momento (cabeça inclinada para a esquerda do paciente / direita do observador), retorne valor POSITIVO (rotacionar CW endireita).
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
  - "verde_acinzentado" (íris verde com nuance cinza VISÍVEL — gray-green, comum em pacientes com predominância biliar-linfática iridológica; distingue-se de "verde" puro pela presença de gray visível no estroma)
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

export interface FetchBboxResult {
  bbox: IrisBbox
  /**
   * Iris color extracted in the SAME Sonnet call as bbox (zero extra cost —
   * Phase 07.1.6 UAT item 2). null when Sonnet returned valid:false OR when
   * the response was missing iris_color (defensive — pre-prompt-update readings).
   */
  iris_color: IrisColorPerPhoto | null
  usage: { input_tokens: number; output_tokens: number }
  cost_usd: number
}

/**
 * Single-image bbox fetch. Caller responsabilidades:
 *   - download original do Storage (service client, BUCKET=iris-captures)
 *   - sharp(buf).rotate().toBuffer() pra bake EXIF antes de chamar este
 *     (sharp default lê EXIF na primeira pipeline; passar buffer já-baked
 *     garante que origW/origH lidos aqui batem com as coordenadas do bbox)
 *   - Promise.all sobre 6 imagens (index.ts orchestrator)
 *   - passar resultado.bbox + peers ao isCanonicalAccepted (sanity.ts)
 *
 * NÃO retornamos rotation_angle_deg nem canthus — C-02 lock dropping rotation
 * e o canthus está unused downstream (CONTEXT.md "deferred" §`eye_landmarks`).
 *
 * Em caso de erro de parse / response inesperado: lança Error. Caller (index.ts)
 * captura per-image e marca status='fallback' sem propagar pro Promise.all.
 */
export async function fetchIrisBbox(imageBuffer: Buffer): Promise<FetchBboxResult> {
  // 1. Resize to 1024 long-edge — probe convention; mantém ~1.8k image tokens
  const meta = await sharp(imageBuffer).metadata()
  const ow = meta.width
  const oh = meta.height
  if (!ow || !oh) {
    throw new Error('[sonnet-bbox] image metadata missing width/height')
  }
  const longEdge = Math.max(ow, oh)
  const scale = longEdge > VLM_RESIZE_LONG_EDGE ? VLM_RESIZE_LONG_EDGE / longEdge : 1
  const w = Math.max(1, Math.round(ow * scale))
  const h = Math.max(1, Math.round(oh * scale))
  const resizedBuf = await sharp(imageBuffer)
    .resize(w, h, { fit: 'inside' })
    .jpeg({ quality: VLM_JPEG_QUALITY })
    .toBuffer()
  const base64 = resizedBuf.toString('base64')

  // 2. Anthropic Sonnet 4.6 call — module-scope singleton (D-T2 Phase 7 convention)
  const response = await anthropicClient.messages.create({
    model: SONNET_BBOX_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          },
        ],
      },
    ],
  })

  // 3. Extract text block from response
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('[sonnet-bbox] no text block in Sonnet response')
  }

  // 4. Parse JSON (regex fallback for accidental markdown / preamble)
  const raw = textBlock.text.trim()
  let parsed: unknown
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
  } catch (err) {
    console.error('[sonnet-bbox] parse error:', err, raw.slice(0, 200))
    throw new Error(`[sonnet-bbox] Sonnet returned invalid JSON: ${raw.slice(0, 200)}`)
  }

  // 5. Defensive type-check (T-07.1.6-10 Tampering mitigation) — defaults
  //    falham seguros pra sanity gate (radius=0 → isGeometricallySane=false →
  //    'fallback'; center=0.5/0.5 com radius=0 cai em radius-floor).
  const p = parsed as {
    valid?: unknown
    iris_bbox?: { center_x_pct?: unknown; center_y_pct?: unknown; radius_pct?: unknown }
    confidence?: unknown
    iris_color?: {
      primary?: unknown
      secondary?: unknown
      dominant_pigments?: unknown
      central_heterochromia?: unknown
      confidence?: unknown
    }
  }
  const valid = p.valid === true
  const bbox: IrisBbox = {
    center_x_pct:
      typeof p.iris_bbox?.center_x_pct === 'number' ? p.iris_bbox.center_x_pct : 0.5,
    center_y_pct:
      typeof p.iris_bbox?.center_y_pct === 'number' ? p.iris_bbox.center_y_pct : 0.5,
    radius_pct:
      typeof p.iris_bbox?.radius_pct === 'number' ? p.iris_bbox.radius_pct : 0,
    confidence: typeof p.confidence === 'number' ? p.confidence : 0,
    valid,
  }

  // iris_color: opcional pra backward-compat com responses pre-prompt-update.
  // Quando ausente (legacy ou parse drift) retornamos null → orchestrator pula
  // este photo na agregação per-eye. Quando bbox.valid=false retornamos null
  // (sem cor mensurável). Outros defaults são sane: primary null, sem
  // pigments, sem heterocromia, confidence 0.
  const iris_color: IrisColorPerPhoto | null = !valid || !p.iris_color
    ? null
    : {
        primary: typeof p.iris_color.primary === 'string' ? p.iris_color.primary : null,
        secondary: typeof p.iris_color.secondary === 'string' ? p.iris_color.secondary : null,
        dominant_pigments: Array.isArray(p.iris_color.dominant_pigments)
          ? p.iris_color.dominant_pigments.filter((x): x is string => typeof x === 'string')
          : [],
        central_heterochromia: p.iris_color.central_heterochromia === true,
        confidence:
          typeof p.iris_color.confidence === 'number' ? p.iris_color.confidence : 0,
      }

  // 6. Cost estimate
  const usage = {
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
  }
  const cost_usd = estimateCostUsd(usage, PRICING_SONNET_4_6)

  return { bbox, iris_color, usage, cost_usd }
}
