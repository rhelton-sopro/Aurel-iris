import Anthropic from '@anthropic-ai/sdk'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force Node.js runtime — Anthropic SDK não roda em Edge runtime.
export const runtime = 'nodejs'

// Modelo: Claude Haiku 4.5 (vision-capable, baixo custo, rápido).
// Não trocar pra modelos mais antigos sem re-validar accuracy do gate.
const MODEL = 'claude-haiku-4-5-20251001'

// max_tokens conservador — esperamos JSON curto. Margem pra raciocínio
// inline se Haiku decidir verbalizar antes do JSON.
const MAX_TOKENS = 256

// Timeout server-side independente do timeout client-side. Corta retransmissão
// se Anthropic ficar pendurado.
const REQUEST_TIMEOUT_MS = 8000

// Prompt compacto com critério clínico explícito de borrado e thresholds
// calibrados em UAT 03:
//   - round 8: "fibras radiais ilegíveis por desfoque" (era "suficientemente
//     nítida", muito frouxo)
//   - round 9: graduação 4 níveis vem do VLM (não do score binário)
//   - round 10: rejection 15→12%, excelente 30→25%, regular cobre 12-15%
//     (foto levemente mais distante mas boa qualidade caía em ruim antes)
const SYSTEM_PROMPT = `Avalie a foto para análise iridológica. Retorne APENAS JSON, sem markdown:
{"quality":"<ruim|regular|boa|excelente>","reason":"<reason>"}

quality "ruim" (com reason correspondente):
- sem_olho: sem olho humano na imagem
- muito_longe: íris ocupa <12% da menor dimensão OU fibras radiais não distinguíveis
- olho_fechado: pálpebra fechada ou íris coberta
- reflexo_total: reflexo cobre toda a área da íris
- borrado: fibras radiais da íris ilegíveis por desfoque

caso contrário, reason "olho_detectado" e:
- excelente: íris >25% da menor dimensão, fibras radiais nítidas, reflexo mínimo
- boa: íris 15-25%, fibras radiais visíveis (leve reflexo OK)
- regular: íris 12-15%, OU >=15% com leve borramento ou reflexo parcial`

interface ValidateRequestBody {
  imageBase64?: unknown
}

interface VLMJsonResponse {
  quality?: unknown
  reason?: unknown
}

const VALID_QUALITY_VALUES = ['ruim', 'regular', 'boa', 'excelente'] as const
const VALID_REASON_VALUES = [
  'olho_detectado',
  'sem_olho',
  'muito_longe',
  'borrado',
  'reflexo_total',
  'olho_fechado',
] as const

export async function POST(request: NextRequest) {
  // Auth gate — só terapeuta autenticado consome o endpoint (e a quota Anthropic).
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Parse + validate body.
  let body: ValidateRequestBody
  try {
    body = (await request.json()) as ValidateRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.imageBase64 !== 'string' || body.imageBase64.length === 0) {
    return NextResponse.json({ error: 'imageBase64 (string) required' }, { status: 400 })
  }

  // Sanity bound — 512×512 JPEG quality 0.85 fica em ~30-80KB, base64 ~40-110KB.
  // Rejeita payloads claramente fora do range esperado pra evitar abuse.
  if (body.imageBase64.length > 600_000) {
    return NextResponse.json({ error: 'imageBase64 too large' }, { status: 413 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 },
    )
  }

  const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS })

  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: body.imageBase64,
              },
            },
          ],
        },
      ],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[capture/validate] anthropic error:', msg)
    return NextResponse.json(
      { error: 'VLM provider error', detail: msg },
      { status: 502 },
    )
  }

  // Extrai texto da resposta (assistant message com text blocks).
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[capture/validate] no text block in response')
    return NextResponse.json({ error: 'VLM returned no text' }, { status: 502 })
  }

  // Parse do JSON. Haiku às vezes envolve em ```json — extrai bloco se houver.
  let parsed: VLMJsonResponse
  try {
    const raw = textBlock.text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as VLMJsonResponse
  } catch (err) {
    console.error('[capture/validate] parse error:', err, textBlock.text.slice(0, 200))
    return NextResponse.json(
      { error: 'VLM returned invalid JSON', text: textBlock.text.slice(0, 200) },
      { status: 502 },
    )
  }

  if (typeof parsed.quality !== 'string' || typeof parsed.reason !== 'string') {
    return NextResponse.json(
      { error: 'VLM JSON missing quality/reason', received: parsed },
      { status: 502 },
    )
  }

  // Clamp pra valores conhecidos. Claude às vezes retorna variantes ('boa.' com
  // ponto, ou tradução sutil); fallback pra 'regular' garante shape estável
  // pra UI sem quebrar pipeline.
  const quality = (VALID_QUALITY_VALUES as readonly string[]).includes(parsed.quality)
    ? (parsed.quality as (typeof VALID_QUALITY_VALUES)[number])
    : 'regular'
  const reason = (VALID_REASON_VALUES as readonly string[]).includes(parsed.reason)
    ? (parsed.reason as (typeof VALID_REASON_VALUES)[number])
    : 'olho_detectado'

  return NextResponse.json({ quality, reason })
}
