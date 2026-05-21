import Anthropic from '@anthropic-ai/sdk'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPricingFor, computeCostUsd } from '@/lib/anthropic/pricing'
import { parseUserAgent } from '@/lib/admin/device-ua'
import { validateToken } from '@/lib/invite/tokens'

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

// Prompt — Phase 07.1.6 prep (2026-05-11): tightened blur criterion + qualitative
// distance threshold. Previous UAT 03 round 14 over-corrected on shallow DOF
// (3 escape clauses passed blurred fotos as 'boa'); current revision swings
// back to false-positive-tolerant on 'borrado' since false-negative destroys
// the entire downstream pipeline (parser sees pixel soup, classifier outputs
// garbage, terapeuta debug-loops indefinitely).
//
// Concrete changes vs UAT 03 round 14:
//   - 'borrado': quantitative test — ≥10 fibras radiais individualmente contáveis
//     OR foto é borrada. Tiebreaker inverted: in dúvida, prefer 'borrado'.
//   - 'muito_longe': qualitative threshold — íris ≤ 1/5 da menor dimensão.
//     Substitui o "<8%" anterior (mais intuitivo para o VLM que percentual
//     numérico). Tiebreaker mantido: in dúvida por tamanho, prefer 'boa'.
//   - 3 shallow-DOF escape clauses reduzidas a 1 parágrafo curto que mantém
//     o foco em "nitidez = só íris" mas remove o repeat-loop "ISSO NÃO É borrado"
//     que estava gerando falso-negativo.
//   - 'boa' e 'excelente' agora exigem contagem mínima de fibras (10 e 20).
//
// Downstream impact: BLOCKING_REASONS in validate-image.ts agora inclui
// 'borrado' e 'reflexo_total' — confirmar fica disabled (não só warning).
//
// 2026-05-19 (founder UAT): fotos boas recusadas por distância + borradas
// passando. Ajuste: 'muito_longe' afrouxado (1/5→1/6, 5×→6×, banda de
// dúvida→'boa' ~1/6–1/3) E rebaixado a soft-warning em validate-image.ts
// (não bloqueia mais — terapeuta decide). 'borrado' endurecido (10→14
// fibras; suavização/fusão = borrado mesmo com foto bonita) e SEGUE
// hard-block. 'dois_olhos' intocado (continua bloqueando).
//
// 2026-05-19 round 2 (founder UAT: o 10→14 acima foi INSUFICIENTE, ainda
// passa borrado): contagem mínima 14→18 E — causa raiz do underdelivery —
// removidas TODAS as referências stale a "10 fibras" que sobravam em
// ESCOPO/precedência/tiebreakers e contradiziam o limiar principal (o VLM
// recebia sinal misto e ancorava baixo). Agora 18 é consistente em todos
// os pontos. Banda de dúvida 13-15→16-19, sempre → 'borrado'. 'excelente'
// segue exigindo ≥20 (eixo separado, não é o gate de borrado).
//
// 2026-05-21 round 2 (founder UAT: foto embaçada AINDA deu 'regular' após
// o fix de precedência): bumpa threshold de borrado 18 → 24 fibras +
// excelente 20 → 28. Banda de dúvida 16-19 → 22-26. Adicionada calibração
// prática "smartphone moderno em foco mostra 30-50+ fibras". Filosofia:
// founder prefere false-positive borrado (pede pra refazer) over
// false-negative (parser/classifier engolem lixo, downstream debug-loop).
//
// 2026-05-21 (founder UAT — 2 fotos exemplo):
//   FOTO A (foto embaçada deu 'regular' em vez de 'borrado'): Haiku ancorou
//   no reflexo parcial e marcou regular SEM testar borrado primeiro. Fix:
//   reestruturação das PRECEDÊNCIAS — borrado vira REGRA 1 (top-level,
//   precedência absoluta), regular agora EXIGE que a íris já tenha passado
//   no teste de 18 fibras. ESCOPO DE NITIDEZ duplicado removido.
//   FOTO B (foto com rosto inteiro deu 'muito_longe'): Haiku interpretou
//   "rosto inteiro = câmera longe" mesmo com íris claramente identificável
//   (~1/4 da menor dim). Fix: muito_longe afrouxado de 1/6 → 1/8 + nota
//   explícita que rosto enquadrado em selfie NÃO é 'muito_longe'. boa
//   threshold também movido pra 1/8 pra consistência. Tiebreaker banda
//   de dúvida 1/6-1/3 → 1/8-1/3.
const SYSTEM_PROMPT = `Avalie a foto para análise iridológica. Retorne APENAS JSON, sem markdown:
{"quality":"<ruim|regular|boa|excelente>","reason":"<reason>"}

quality "ruim" (com reason correspondente):
- sem_olho: sem olho humano na imagem
- dois_olhos: AMBAS as íris estão claramente visíveis e identificáveis individualmente como duas íris separadas, ocupando regiões distintas da imagem. NÃO use este reason quando houver apenas uma íris e o restante seja sobrancelha, cílios, pálpebra do outro olho parcialmente visível, ou contexto facial. Só dispare 'dois_olhos' quando o terapeuta poderia legitimamente fotografar UMA íris só recortando metade da imagem — ou seja, há literalmente duas íris completas e nítidas.
- muito_longe: a íris é DRASTICAMENTE minúscula no frame — seu diâmetro visual é igual ou menor que 1/8 da menor dimensão da imagem. TESTE MENTAL: imagine empilhar a íris 8 vezes ao longo da menor dimensão; se ela couber 8× ou mais, é 'muito_longe'. NÃO USE este reason quando a íris é claramente identificável e dá pra distinguir a região colorida do disco — mesmo que apareça rosto inteiro com sobrancelhas, bochechas, nariz, pele ao redor. Smartphones em modo selfie capturam o rosto inteiro naturalmente; isso NÃO é "muito longe", isso é só "rosto enquadrado normalmente". Só dispare 'muito_longe' se você precisar FORÇAR a vista pra identificar onde está a íris. NÃO use por causa de desfoque (use 'borrado'). EM CASO DE DÚVIDA por tamanho (íris >1/8 da menor dim), prefira 'olho_detectado' (boa/regular) — não rejeite por distância.
- olho_fechado: a íris NÃO está visível na imagem — pálpebra fechada ou semi-cerrada ocultando o disco da íris. REGRA SIMPLES E DECISIVA: se você consegue ver o disco circular colorido da íris, NÃO é 'olho_fechado', INDEPENDENTE de haver dedos/mão sobre as pálpebras segurando o olho aberto. Mão/dedos segurando o olho aberto é uma TÉCNICA LEGÍTIMA de captura iridológica (cliente fotografa sozinho); o dedo está sobre a pálpebra, não sobre a íris. Cílios cruzando a íris também não disparam 'olho_fechado'. Reflexo grande na íris é 'reflexo_total', não 'olho_fechado'.
- reflexo_total: reflexo cobre >70% da área da íris
- borrado: as fibras radiais DA ÍRIS (linhas finas que partem da pupila em direção à borda externa, como raios de uma roda) NÃO são individualmente contáveis. TESTE QUANTITATIVO ESTRITO: olhe SOMENTE para a região circular colorida da íris e tente contar fibras radiais distintas como linhas individuais com bordas definidas (não manchas suaves, não regiões de transição borrada, não áreas onde só se vê cor uniforme). Se você NÃO consegue contar PELO MENOS 24 fibras radiais distintas em diferentes setores da íris, é 'borrado'. CALIBRAÇÃO PRÁTICA: em smartphones recentes (iPhone/Android flagship), uma foto VERDADEIRAMENTE nítida mostra 30-50+ fibras com facilidade; uma foto que mostra só ~20-24 fibras é quase sempre borrada com algum reflexo/sombra mascarando o estado real. Qualquer suavização, fusão ou manchamento das fibras da íris = 'borrado', MESMO que a foto no geral pareça boa/bonita e o resto esteja nítido. NA HESITAÇÃO = 'borrado': se você precisa pensar duas vezes, forçar a vista, ou "quase consegue contar mas não tem certeza", a resposta já é 'borrado'. EM CASO DE DÚVIDA entre 'borrado' e 'boa' por contagem de fibras (~22-26 visíveis, ou fibras "quase nítidas mas não totalmente"), PREFIRA 'borrado' — falso negativo destrói toda a análise iridológica downstream (parser produz lixo, classificador produz lixo, terapeuta debug-loopa); falso positivo só pede pro terapeuta repetir uma foto.

caso contrário, reason "olho_detectado" e:
- excelente: íris é VISIVELMENTE GRANDE no frame (claramente maior que 1/3 da menor dimensão — "é o sujeito principal da foto, ocupa boa parte do quadro") E pelo menos 28 fibras radiais individualmente nítidas em todos os setores da íris. Specular highlights localizados (pequenos pontos de luz da câmera) são OK e NÃO impedem 'excelente'. Resto da imagem (pele, cílios) PODE estar fora de foco.
- boa: íris claramente maior que 1/8 da menor dimensão (passa no teste 'muito_longe' invertido — qualquer rosto enquadrado normalmente passa nisso) E pelo menos 24 fibras radiais individualmente contáveis (passa no teste 'borrado' invertido). Reflexo leve disperso é OK. Resto da imagem PODE estar fora de foco.
- regular: SOMENTE quando reflexo cobre pelo menos 30% da área da íris (mas <70%) E a íris JÁ PASSOU no teste de 24 fibras radiais contáveis (ou seja, NÃO é 'borrado'). Reflexo + íris borrada/suave = 'borrado', NUNCA 'regular'.

REGRAS DE PRECEDÊNCIA (ORDEM OBRIGATÓRIA — avalie nesta sequência, NÃO pule etapas):
1. **PRIMEIRO teste: BORRADO.** Olhe SOMENTE pra região circular colorida da íris. Conta 24 fibras radiais distintas, NÍTIDAS, com bordas definidas? Se NÃO → é 'borrado'. PARE aqui. Não importa se há reflexo, não importa se a foto no geral é bonita, não importa se a íris parece OK à primeira vista. Falha no teste de 24 fibras = 'borrado', SEMPRE. Esta regra tem precedência ABSOLUTA sobre reflexo/regular. Um smartphone moderno em foco mostra 30-50+ fibras facilmente; se só conta ~20-24, é borrado, não regular.
2. **SEGUNDO teste: olho_fechado.** Você consegue ver o disco circular colorido da íris? Se NÃO (pálpebra fechada/semi-cerrada cobrindo a íris) → 'olho_fechado'. Dedos sobre as pálpebras com íris visível NÃO contam.
3. **TERCEIRO teste: reflexo_total.** Reflexo cobre >70% da íris? → 'reflexo_total'.
4. **QUARTO teste: dois_olhos.** DUAS íris circulares completas e nítidas, ocupando regiões distintas? → 'dois_olhos'.
5. **QUINTO teste: muito_longe.** Íris ≤1/8 da menor dimensão E você precisa forçar a vista pra identificá-la? → 'muito_longe'. Rosto inteiro visível por si só NÃO é 'muito_longe'.
6. **SEXTO teste: sem_olho.** Sem olho humano na imagem.
7. Se passou em todos os testes acima → 'olho_detectado' + decide entre excelente/boa/regular conforme tamanho da íris e reflexo.

ESCOPO DE NITIDEZ (reforço da Regra 1): avalie nitidez SOMENTE na região circular colorida da íris. Ignore blur em pele, cílios, sobrancelha, e na esclera (branco do olho) — close-ups de smartphone têm profundidade de campo rasa que naturalmente deixa essas regiões fora de foco. MAS a íris EM SI deve passar no teste das 24 fibras radiais contáveis. Se a íris está suave/manchada/fundida/com-fibras-quase-mas-não-totalmente-nítidas, é 'borrado' INDEPENDENTE do resto da imagem estar nítido E INDEPENDENTE de haver reflexo presente.

TIEBREAKERS (ordem importa):
- Em dúvida APENAS entre excelente/boa/regular (com nitidez DA ÍRIS já confirmada como ≥24 fibras): prefira 'boa'. Não rebaixe para 'regular' por reflexo pequeno.
- Em dúvida entre 'borrado' e 'boa' por contagem de fibras (~22-26 visíveis ou fibras quase-nítidas): prefira 'borrado'. Falso negativo destrói análise downstream.
- Em dúvida entre 'muito_longe' e 'boa' por tamanho da íris (~1/8 a 1/3 da menor dim): prefira 'boa'. Falso positivo de distância frustra terapeuta sem ganho. Rosto inteiro num frame de selfie NÃO é 'muito_longe' por padrão.
- Em dúvida entre 'olho_fechado' e qualquer outro reason: se você consegue ver o disco circular colorido da íris, NUNCA é 'olho_fechado'. Dedos sobre as pálpebras (cliente segurando o olho aberto pra fotografar sozinho) é técnica legítima — a íris fica visível, e isso é o único que importa.`

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

interface ValidateBody {
  imageBase64?: unknown
  /**
   * Auth alternativo p/ path PÚBLICO /convite/[token]/capturar.
   * Quando presente, valida o token em vez de exigir sessão Supabase.
   * therapist_id atribuído ao log = token.therapist_id (não auth.uid()).
   */
  inviteToken?: unknown
}

export async function POST(request: NextRequest) {
  // Parse body cedo pra ler inviteToken antes do auth (path público
  // /convite/[token]/capturar não tem sessão).
  let body: ValidateBody
  try {
    body = (await request.json()) as ValidateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Auth: ou sessão de terapeuta OU inviteToken válido.
  // therapist_id pra log = uid da sessão OU therapist_id do token.
  let therapistId: string | null = null
  if (typeof body.inviteToken === 'string' && body.inviteToken.length > 0) {
    const validation = await validateToken(body.inviteToken)
    if (validation.status !== 'ok') {
      return NextResponse.json(
        { error: `Token ${validation.status}` },
        { status: validation.status === 'not_found' ? 404 : 410 },
      )
    }
    therapistId = validation.token.therapist_id
  } else {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
    therapistId = user.id
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
  const anthropicStart = Date.now()
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

  // Log best-effort em capture_attempts (migration 0023+0024) — alimenta
  // o /admin/relatorios (taxa de aproveitamento, custo Haiku, top reasons
  // de recusa por terapeuta, aproveitamento por dispositivo). NUNCA
  // bloqueia a resposta: erro no insert só vai pro console.
  const tokens_in = response.usage?.input_tokens ?? null
  const tokens_out = response.usage?.output_tokens ?? null
  const model_version = response.model ?? MODEL
  // Preço VIGENTE NA HORA da chamada (lookup em ai_model_pricing,
  // fallback hardcoded se 0024 pendente). Custo persistido é o real
  // daquela data — histórico fica congelado.
  const pricing = await getPricingFor(model_version, new Date())
  const cost_estimate_usd = computeCostUsd(tokens_in, tokens_out, pricing)
  // UA parsing (0024): habilita o bloco "Aproveitamento por dispositivo".
  // Pré-0024 (sem as colunas), o insert ignora os campos extra silenciosamente.
  const ua = request.headers.get('user-agent')
  const parsedUa = parseUserAgent(ua)
  try {
    const service = createServiceClient()
    // `as never` porque types/database.ts ainda não tem capture_attempts
    // (founder regenera os types após aplicar 0023/0024). Insert continua
    // validado pelos check constraints da migration.
    const { error: logErr } = await service.from('capture_attempts' as never).insert({
      therapist_id: therapistId,
      vlm_quality: quality,
      vlm_reason: reason,
      accepted: quality !== 'ruim',
      image_bytes: body.imageBase64.length,
      latency_ms: Date.now() - anthropicStart,
      tokens_in,
      tokens_out,
      cost_estimate_usd,
      model_version,
      user_agent: ua,
      device_type: parsedUa.device_type,
      os_family: parsedUa.os_family,
      browser_family: parsedUa.browser_family,
    } as never)
    if (logErr) {
      // Tabela ainda não existe (0023 não aplicada) OU RLS bloqueou
      // service-role (não deveria — service bypassa). Não-fatal.
      console.error('[capture/validate] capture_attempts insert falhou:', logErr.message)
    }
  } catch (err) {
    console.error('[capture/validate] capture_attempts log skipped:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ quality, reason })
}
