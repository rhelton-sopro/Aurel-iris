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

// Prompt compacto com critérios MUTUAMENTE EXCLUSIVOS (UAT 03 round 12):
//   - muito_longe é SÓ sobre framing/tamanho — nunca sobre nitidez
//   - borrado é SÓ sobre nitidez — nunca sobre tamanho
//   - banda 'boa' alargada (12-25%) pra cobrir close típico de iPhone
//   - 'regular' agora cobre apenas reflexo parcial (não tamanho limítrofe)
const SYSTEM_PROMPT = `Avalie a foto para análise iridológica. Retorne APENAS JSON, sem markdown:
{"quality":"<ruim|regular|boa|excelente>","reason":"<reason>"}

quality "ruim" (com reason correspondente):
- sem_olho: sem olho humano na imagem
- dois_olhos: ambos os olhos visíveis (deve haver apenas um em close)
- muito_longe: íris ocupa <12% da menor dimensão da imagem. NÃO use este reason por causa de desfoque (use 'borrado'). NÃO use por contexto facial visível ao redor do olho — close-ups legítimos podem mostrar um pouco de bochecha ou sobrancelha; só importa o tamanho relativo da íris.
- olho_fechado: pálpebra fechada ou íris coberta
- reflexo_total: reflexo cobre >70% da área da íris
- borrado: fibras radiais da íris não são individualmente distinguíveis. TESTE CONCRETO: você consegue contar as fibras radiais como linhas separadas com bordas bem definidas? Se NÃO (fibras parecem fundidas, suaves, difusas, com blur por movimento ou foco), é 'borrado' — mesmo que o blur seja sutil. Nitidez é crítica para análise iridológica. Use SEMPRE este reason quando houver perda de definição, nunca 'muito_longe'.

caso contrário, reason "olho_detectado" e:
- excelente: íris ≥20% da menor dimensão E fibras radiais nítidas. Specular highlights localizados (pequenos pontos de luz da câmera) são OK e NÃO impedem 'excelente'.
- boa: íris ≥12% da menor dimensão E fibras radiais visíveis. Reflexo leve disperso é OK.
- regular: SOMENTE quando reflexo cobre pelo menos 30% da área da íris (mas <70%) e atrapalha a leitura.

REGRA DE PRECEDÊNCIA (não pule esta verificação):
ANTES de classificar quality, faça o teste concreto: as fibras radiais individuais têm bordas definidas e são distinguíveis umas das outras? Se você precisa duvidar disso, é 'borrado'. Nitidez tem precedência absoluta sobre tie-breaker de quality.

Em caso de dúvida APENAS entre excelente/boa/regular (com nitidez já confirmada), prefira 'boa'. Não rebaixe para 'regular' por reflexo pequeno.`

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
  'dois_olhos',
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

  // Diagnóstico de custo (UAT 03 round 13): verifica que o resize 512×512 do
  // client está chegando aqui. Esperado ~40-110KB pra JPEG quality 0.85 do
  // canvas 512×512. Se aparecer >300KB, o resize falhou e estamos enviando
  // o JPEG original 4K — explosão de tokens.
  console.log('[vlm] imageBase64 length (bytes):', body.imageBase64.length)

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

  // Diagnóstico de custo: log tokens efetivamente cobrados pelo Anthropic.
  // input_tokens = system prompt + image + user message wrapping
  // output_tokens = JSON retornado
  // cache_* = se prompt caching estiver ativo (não estamos usando ainda)
  // Esperado pra resize 512×512 + prompt atual: ~500-560 input + ~20 output.
  console.log('[vlm] usage:', response.usage, 'model:', response.model)

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
