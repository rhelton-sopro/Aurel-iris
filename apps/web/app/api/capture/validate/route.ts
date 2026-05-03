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

const SYSTEM_PROMPT = `Você é um classificador de fotos para um app de iridologia. Sua única tarefa é decidir se a foto enviada contém um olho humano com a íris claramente visível e adequada para análise iridológica.

Critérios para "valid: true":
- Existe um olho humano visivelmente presente na foto
- A íris (parte colorida) está claramente visível e ocupa parcela significativa do enquadramento
- A foto não está borrada a ponto de impedir a leitura de texturas/cores da íris
- Não há reflexo grande cobrindo a área central da íris

Critérios para "valid: false":
- Foto não contém olho humano (objetos, paisagens, mesa, parede, etc.)
- Olho presente mas íris obscurecida (pálpebra muito fechada, oclusão)
- Foto muito distante (rosto inteiro, contexto amplo, íris pequena demais)
- Foto borrada/desfocada
- Reflexo/glare muito grande cobrindo a íris

Responda EXCLUSIVAMENTE com um objeto JSON sem markdown e sem prefixo, no formato exato:
{"valid": <boolean>, "reason": "<one of: 'olho detectado' | 'sem olho' | 'muito longe' | 'borrado' | 'reflexo excessivo' | 'outro'>"}`

interface ValidateRequestBody {
  imageBase64?: unknown
}

interface VLMJsonResponse {
  valid?: unknown
  reason?: unknown
}

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

  if (typeof parsed.valid !== 'boolean' || typeof parsed.reason !== 'string') {
    return NextResponse.json(
      { error: 'VLM JSON missing valid/reason', received: parsed },
      { status: 502 },
    )
  }

  return NextResponse.json({ valid: parsed.valid, reason: parsed.reason })
}
