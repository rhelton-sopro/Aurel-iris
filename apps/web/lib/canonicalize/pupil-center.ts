/**
 * Localização da PUPILA para recorte centrado (método validado 2026-07-26).
 *
 * POR QUE ESTE MÓDULO EXISTE — o que a auditoria de 2026-07-26 mediu nas 6 fotos
 * do founder (leitura c3841fbf), contra geometria medida à mão:
 *
 *   - `sonnet-bbox.ts` pede CENTRO + RAIO da íris. O raio volta superestimado em
 *     6/6 fotos (+34% a +86%, mediana +57%) e a `confidence` volta constante em
 *     0.82 (não carrega informação). Motivo provável: o limbo está coberto por
 *     pálpebra/cílio em cima e embaixo, então o modelo estima uma borda que não vê.
 *   - Pedir os DOIS pontos de limbo na horizontal (onde a pálpebra não cobre) NÃO
 *     resolve: +25% a +187%. Medir o raio por aritmética a partir do centro também
 *     não (quebra quando o centro tem erro real de 100-160px).
 *   - Já o CENTRO DA PUPILA é confiável: pedindo SÓ a pupila, com instrução
 *     explícita sobre o reflexo do flash, o erro mediano de centro é 68px
 *     (Sonnet 5) — contra 245px do Sonnet 4.6 na mesma tarefa.
 *
 * CONCLUSÃO DE DESIGN (decisão founder): o recorte não usa raio nenhum. Centro
 * pela pupila + janela FIXA de ±500px na resolução cheia. Um raio errado propaga
 * erro; uma constante não propaga nada. Ver `cropAroundPupil` em ./crop.ts.
 *
 * MODELO: claude-sonnet-5 — 68px de erro mediano contra 245px do 4.6 na MESMA
 * tarefa e mesmo prompt. Não passamos `temperature` (Sonnet 5 rejeita valor
 * não-default com 400). `max_tokens` folgado porque no Sonnet 5 o thinking é
 * ligado por padrão e divide o mesmo orçamento da resposta — com 1024 o JSON
 * truncou em teste.
 *
 * NÃO substitui `sonnet-bbox.ts`: aquele segue sendo chamado por causa do
 * `iris_color` (alimenta vision_features) e do gate de observabilidade D-02.
 * O prompt de lá é byte-exato contra fixture golden (D-06) e o modelo é travado
 * (C-04) — por isso este módulo é NOVO em vez de uma edição lá.
 */
import 'server-only'
import sharp from 'sharp'
import {
  anthropicClient,
  PRICING_SONNET_4_6,
  estimateCostUsd,
} from '@/lib/anthropic/client'
import type { PupilCenter } from '@/lib/anthropic/types'

/** Sonnet 5: 68px de erro mediano de centro vs 245px do 4.6 (medido 2026-07-26). */
const PUPIL_MODEL = 'claude-sonnet-5' as const
const VLM_RESIZE_LONG_EDGE = 1024
const VLM_JPEG_QUALITY = 85
/** Sonnet 5 pensa por padrão e thinking + resposta dividem max_tokens. Com 1024 truncou. */
const MAX_TOKENS = 4000

/**
 * Prompt ENXUTO de propósito: pede só a pupila. Medido — a versão que pedia
 * pupila + 2 pontos de limbo junto errou mais o centro (103px) que esta (68px).
 * A instrução sobre o reflexo é obrigatória: em 3 das 6 fotos do teste o flash
 * cai sobre a pupila, e descentrado.
 */
const SYSTEM_PROMPT = `Você localiza a PUPILA em fotos de olho humano, para recorte automático. Retorne APENAS JSON:

{ "cx_pct": <0-1>, "cy_pct": <0-1>, "r_pct": <0-1>, "confianca": <0-1>, "reflexo_sobre_pupila": <true|false> }

- A pupila é o disco PRETO central — o objeto mais escuro e mais redondo da foto.
- cx_pct/cy_pct = centro do disco, como fração da largura/altura da imagem. r_pct = raio como fração da MENOR dimensão.
- ATENÇÃO AO REFLEXO: quase sempre há um ponto BRANCO brilhante do flash sobre a pupila, e às vezes ele fica descentrado dentro dela. O reflexo NÃO faz parte da borda: ignore-o e estime o centro do disco preto como se o reflexo não existisse. Marque reflexo_sobre_pupila=true quando ele estiver presente.
- Precisão do CENTRO é o que importa. Olhe a borda do disco preto nos quatro lados e ponha o centro no meio dela.
- Se a foto não tem um olho humano analisável (sem olho, fora de foco total, pálpebra fechada), retorne cx_pct 0.5, cy_pct 0.5, r_pct 0 e confianca 0.

Sem markdown, sem texto fora do JSON.`

export interface FetchPupilCenterResult {
  pupil: PupilCenter
  usage: { input_tokens: number; output_tokens: number }
  cost_usd: number
}

/**
 * Localiza a pupila numa imagem já com EXIF baked (caller faz
 * `sharp(raw).rotate().toBuffer()` ANTES, para as coordenadas baterem com o
 * frame que o crop vai extrair).
 *
 * Lança Error em falha de parse / resposta sem texto. Caller (index.ts) captura
 * per-imagem e cai pro caminho de fallback sem tombar o batch.
 */
export async function fetchPupilCenter(
  imageBuffer: Buffer,
): Promise<FetchPupilCenterResult> {
  const meta = await sharp(imageBuffer).metadata()
  const ow = meta.width
  const oh = meta.height
  if (!ow || !oh) {
    throw new Error('[pupil-center] image metadata missing width/height')
  }
  const longEdge = Math.max(ow, oh)
  const scale = longEdge > VLM_RESIZE_LONG_EDGE ? VLM_RESIZE_LONG_EDGE / longEdge : 1
  const resized = await sharp(imageBuffer)
    .resize(Math.max(1, Math.round(ow * scale)), Math.max(1, Math.round(oh * scale)), {
      fit: 'inside',
    })
    .jpeg({ quality: VLM_JPEG_QUALITY })
    .toBuffer()

  const response = await anthropicClient.messages.create({
    model: PUPIL_MODEL,
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
              data: resized.toString('base64'),
            },
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(
      `[pupil-center] no text block (stop=${response.stop_reason}, out=${response.usage?.output_tokens ?? 0} tok)`,
    )
  }
  const raw = textBlock.text.trim()
  let parsed: unknown
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(m ? m[0] : raw)
  } catch {
    throw new Error(`[pupil-center] invalid JSON: ${raw.slice(0, 200)}`)
  }

  // Type-check defensivo: defaults falham SEGURO (valid=false → caller usa fallback).
  const p = parsed as {
    cx_pct?: unknown
    cy_pct?: unknown
    r_pct?: unknown
    confianca?: unknown
    reflexo_sobre_pupila?: unknown
  }
  const cx = typeof p.cx_pct === 'number' ? p.cx_pct : NaN
  const cy = typeof p.cy_pct === 'number' ? p.cy_pct : NaN
  const r = typeof p.r_pct === 'number' ? p.r_pct : 0
  // Um centro fora do quadro, NaN, ou r_pct 0 (sinal de "não achei") = inválido.
  const valid =
    Number.isFinite(cx) && Number.isFinite(cy) && cx > 0 && cx < 1 && cy > 0 && cy < 1 && r > 0

  const pupil: PupilCenter = {
    center_x_pct: valid ? cx : 0.5,
    center_y_pct: valid ? cy : 0.5,
    radius_pct: r,
    confidence: typeof p.confianca === 'number' ? p.confianca : 0,
    reflex_over_pupil: p.reflexo_sobre_pupila === true,
    valid,
  }

  const usage = {
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
  }
  // Sonnet 5 tem o mesmo sticker do 4.6 ($3/$15). PRICING_SONNET_4_6 serve;
  // o preço promocional de entrada (até 31/08/2026) só torna a estimativa
  // conservadora (superestima), nunca otimista.
  return { pupil, usage, cost_usd: estimateCostUsd(usage, PRICING_SONNET_4_6) }
}
