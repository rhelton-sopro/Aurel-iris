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
// 2026-05-22 round 3 (founder UAT: foto embaçada AINDA deu 'regular' com
// mensagem "reflexo parcial" — Haiku tava chamando o BLUR de reflexo).
// Causa raiz identificada: regular era rota de fuga porque blur e reflexo
// estavam mal-distinguidos no prompt. Fixes:
//   1) Distinção formal blur vs reflexo na definição de borrado (com texto
//      ATENÇÃO CRÍTICA): reflexo = ponto BRILHANTE específico com bordas
//      definidas; blur = mancha suave fundida SEM brilho específico.
//      Em dúvida → SEMPRE blur (borrado).
//   2) regular APERTADO: agora exige reflexo VERDADEIRO (brilho definido)
//      cobrindo 30-70% + ≥30 fibras (não mais 24). Mancha sem brilho =
//      borrado, não regular.
//   3) Bump fibras 24 → 30 (boa/borrado/regular), 28 → 36 (excelente).
//      Banda de dúvida 22-26 → 28-32. Calibração prática "40-60+ fibras
//      em smartphone moderno em foco" (era 30-50).
//   4) Novo tiebreaker: borrado vs regular → SEMPRE borrado.
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
// 2026-05-31 (founder UAT — foto borrada classificada 'boa'): o proxy de
// contagem de fibras vazou — Haiku "achou" 30 linhas numa íris desfocada e
// liberou. Founder: "não é fibras, é nitidez DA ÍRIS (não da imagem)". Fix:
// JULGAMENTO DIRETO DE FOCO adicionado no topo da Regra 1 (holístico, ANTES de
// contar) — íris globalmente mole/lavada/sem-definição = 'borrado' direto, não
// conta fibras. Imagem nítida + íris fora de foco ainda = 'borrado'.
// 2026-06-01 (founder UAT — dado empírico de capture_attempts: 60% das fotos do
// founder rejeitadas; 13/40 'borrado' + 7/40 'muito_longe' em fotos nítidas).
// Relaxe LEVE do gate de borrado (founder escolheu o grau): limiar mínimo de
// fibras baixado de trinta para vinte-e-cinco em TODOS os pontos (Regra 1, boa,
// regular, ESCOPO, tiebreakers) + as bandas dependentes (calibração "quase
// sempre borrada" e banda de dúvida) reduzidas proporcionalmente pra não dar
// sinal misto. Viés holístico (JULGAMENTO DIRETO DE FOCO) e 'hesitação=borrado'
// MANTIDOS (é relaxe leve, não remoção). 'muito_longe' rebaixado a soft-warning
// na UI (CapturePreview) — prompt do muito_longe intocado.
// 2026-06-29 (founder): muito_longe afrouxado ~10% — limiar de tamanho 1/8 → 1/9
// em TODOS os pontos (def, teste mental 8×→9×, boa, precedência #5, tiebreaker).
// Baixo risco: muito_longe é soft-warning (não bloqueia Confirmar), então afrouxar
// só reduz aviso, não muda o que entra no relatório. Independente da res 1536.
const SYSTEM_PROMPT = `Avalie a foto para análise iridológica. Retorne APENAS JSON, sem markdown:
{"quality":"<ruim|regular|boa|excelente>","reason":"<reason>"}

quality "ruim" (com reason correspondente):
- sem_olho: sem olho humano na imagem
- dois_olhos: AMBAS as íris estão claramente visíveis e identificáveis individualmente como duas íris separadas, ocupando regiões distintas da imagem. NÃO use este reason quando houver apenas uma íris e o restante seja sobrancelha, cílios, pálpebra do outro olho parcialmente visível, ou contexto facial. Só dispare 'dois_olhos' quando o terapeuta poderia legitimamente fotografar UMA íris só recortando metade da imagem — ou seja, há literalmente duas íris completas e nítidas.
- muito_longe: a íris é DRASTICAMENTE minúscula no frame — seu diâmetro visual é igual ou menor que 1/9 da menor dimensão da imagem. TESTE MENTAL: imagine empilhar a íris 9 vezes ao longo da menor dimensão; se ela couber 9× ou mais, é 'muito_longe'. NÃO USE este reason quando a íris é claramente identificável e dá pra distinguir a região colorida do disco — mesmo que apareça rosto inteiro com sobrancelhas, bochechas, nariz, pele ao redor. Smartphones em modo selfie capturam o rosto inteiro naturalmente; isso NÃO é "muito longe", isso é só "rosto enquadrado normalmente". Só dispare 'muito_longe' se você precisar FORÇAR a vista pra identificar onde está a íris. NÃO use por causa de desfoque (use 'borrado'). EM CASO DE DÚVIDA por tamanho (íris >1/9 da menor dim), prefira 'olho_detectado' (boa/regular) — não rejeite por distância.
- olho_fechado: a íris NÃO está visível na imagem — pálpebra fechada ou semi-cerrada ocultando o disco da íris. REGRA SIMPLES E DECISIVA: se você consegue ver o disco circular colorido da íris, NÃO é 'olho_fechado', INDEPENDENTE de haver dedos/mão sobre as pálpebras segurando o olho aberto. Mão/dedos segurando o olho aberto é uma TÉCNICA LEGÍTIMA de captura iridológica (cliente fotografa sozinho); o dedo está sobre a pálpebra, não sobre a íris. Cílios cruzando a íris também não disparam 'olho_fechado'. Reflexo grande na íris é 'reflexo_total', não 'olho_fechado'.
- reflexo_total: reflexo cobre >70% da área da íris
- borrado: as fibras radiais DA ÍRIS (linhas finas que partem da pupila em direção à borda externa, como raios de uma roda) NÃO são individualmente contáveis. TESTE QUANTITATIVO ESTRITO: olhe SOMENTE para a região circular colorida da íris e tente contar fibras radiais distintas como linhas individuais com bordas definidas (não manchas suaves, não regiões de transição borrada, não áreas onde só se vê cor uniforme). Se você NÃO consegue contar PELO MENOS 25 fibras radiais distintas em diferentes setores da íris, é 'borrado'. CALIBRAÇÃO PRÁTICA: em smartphones recentes (iPhone/Android flagship), uma foto VERDADEIRAMENTE nítida mostra 40-60+ fibras com facilidade; uma foto que mostra só ~18-22 fibras é quase sempre borrada com algum reflexo/sombra mascarando o estado real.

**ATENÇÃO CRÍTICA — DISTINÇÃO BLUR vs REFLEXO** (causa raiz de #1 confusão do gate):
- REFLEXO = ponto BRILHANTE ESPECÍFICO de luz da câmera/flash, com BORDAS DEFINIDAS, tipicamente pequeno (specular highlight). Tem CONTORNO claro: você consegue apontar exatamente onde começa e termina o brilho. Cor BRANCA ou cinza-MUITO-claro, intensidade alta.
- BLUR / EMBAÇAMENTO = região SUAVE/FUNDIDA/manchada onde as fibras se DISSOLVEM em cor uniforme, SEM brilho específico, SEM contorno definido. Pode cobrir áreas grandes da íris. Cor preserva o tom original mas em versão "achatada/lavada/macia".
- SE VOCÊ ESTÁ EM DÚVIDA SE É REFLEXO OU BLUR → É BLUR → é 'borrado'. Reflexo de verdade NÃO gera dúvida (o brilho é óbvio). Mancha suave que parece "área um pouco mais clara"? Isso é BLUR, NÃO reflexo. Marcar isso como 'regular' por "reflexo parcial" é ERRO — é borrado.

Qualquer suavização, fusão ou manchamento das fibras da íris = 'borrado', MESMO que a foto no geral pareça boa/bonita e o resto esteja nítido. NA HESITAÇÃO = 'borrado': se você precisa pensar duas vezes, forçar a vista, ou "quase consegue contar mas não tem certeza", a resposta já é 'borrado'. EM CASO DE DÚVIDA entre 'borrado' e 'boa' por contagem de fibras (~23-27 visíveis, ou fibras "quase nítidas mas não totalmente"), PREFIRA 'borrado' — falso negativo destrói toda a análise iridológica downstream (parser produz lixo, classificador produz lixo, terapeuta debug-loopa); falso positivo só pede pro terapeuta repetir uma foto.

caso contrário, reason "olho_detectado" e:
- excelente: íris é VISIVELMENTE GRANDE no frame (claramente maior que 1/3 da menor dimensão — "é o sujeito principal da foto, ocupa boa parte do quadro") E pelo menos 36 fibras radiais individualmente nítidas em todos os setores da íris. Specular highlights localizados (pequenos pontos de luz da câmera) são OK e NÃO impedem 'excelente'. Resto da imagem (pele, cílios) PODE estar fora de foco.
- boa: íris claramente maior que 1/9 da menor dimensão (passa no teste 'muito_longe' invertido — qualquer rosto enquadrado normalmente passa nisso) E pelo menos 25 fibras radiais individualmente contáveis (passa no teste 'borrado' invertido). Reflexo leve disperso é OK. Resto da imagem PODE estar fora de foco.
- regular: SOMENTE quando há um REFLEXO VERDADEIRO (ponto brilhante específico de luz da câmera com BORDAS DEFINIDAS — releia a distinção blur vs reflexo acima) cobrindo 30-70% da íris E a íris EM SI (fora da área do reflexo) tem ≥25 fibras radiais nítidas contáveis. Se você está marcando 'regular' por causa de "área um pouco mais clara" ou "mancha suave" SEM brilho específico de luz definido, isso É BLUR → use 'borrado', NUNCA 'regular'. Reflexo + íris borrada/suave = 'borrado', NUNCA 'regular'.

REGRAS DE PRECEDÊNCIA (ORDEM OBRIGATÓRIA — avalie nesta sequência, NÃO pule etapas):
1. **PRIMEIRO teste: BORRADO.** Olhe SOMENTE pra região circular colorida da íris. **JULGAMENTO DIRETO DE FOCO — FAÇA ISTO ANTES DE CONTAR QUALQUER COISA:** a íris COMO UM TODO está em foco nítido (as estruturas internas — fibras, criptas, anéis, relevo — têm bordas DEFINIDAS e separadas) ou está MOLE / LAVADA / SUAVE / FUNDIDA / SEM-DEFINIÇÃO (parece "amaciada", as estruturas escorrem umas nas outras)? Se a íris parece GLOBALMENTE fora de foco / molenga / sem definição de relevo — mesmo que você ache que "dá pra contar algumas linhas" — é 'borrado' DIRETO. NÃO tente contar fibras pra justificar 'boa': contar fibras numa íris desfocada é o ERRO Nº 1 do gate (o modelo "acha" 30 linhas numa mancha e libera foto borrada). A nitidez é da ÍRIS, não da imagem: a foto pode ter cílios/pele/borda do olho perfeitamente nítidos e AINDA assim a íris estar fora de foco → 'borrado'. SÓ prossiga pra contagem se a íris JÁ passou nítida nesse julgamento direto. Então: conta 25 fibras radiais distintas, NÍTIDAS, com bordas definidas? Se NÃO → é 'borrado'. PARE aqui. Não importa se há reflexo, não importa se a foto no geral é bonita, não importa se a íris parece OK à primeira vista. Falha no teste de 25 fibras = 'borrado', SEMPRE. Esta regra tem precedência ABSOLUTA sobre reflexo/regular. Um smartphone moderno em foco mostra 40-60+ fibras facilmente; se só conta ~18-22, é borrado, não regular. ANTES DE chamar 'regular', faça o teste de blur-vs-reflexo: se a "mancha" não tem brilho específico definido, é blur (borrado), NÃO reflexo (regular).
2. **SEGUNDO teste: olho_fechado.** Você consegue ver o disco circular colorido da íris? Se NÃO (pálpebra fechada/semi-cerrada cobrindo a íris) → 'olho_fechado'. Dedos sobre as pálpebras com íris visível NÃO contam.
3. **TERCEIRO teste: reflexo_total.** Reflexo cobre >70% da íris? → 'reflexo_total'.
4. **QUARTO teste: dois_olhos.** DUAS íris circulares completas e nítidas, ocupando regiões distintas? → 'dois_olhos'.
5. **QUINTO teste: muito_longe.** Íris ≤1/9 da menor dimensão E você precisa forçar a vista pra identificá-la? → 'muito_longe'. Rosto inteiro visível por si só NÃO é 'muito_longe'.
6. **SEXTO teste: sem_olho.** Sem olho humano na imagem.
7. Se passou em todos os testes acima → 'olho_detectado' + decide entre excelente/boa/regular conforme tamanho da íris e reflexo.

ESCOPO DE NITIDEZ (reforço da Regra 1): avalie nitidez SOMENTE na região circular colorida da íris. Ignore blur em pele, cílios, sobrancelha, e na esclera (branco do olho) — close-ups de smartphone têm profundidade de campo rasa que naturalmente deixa essas regiões fora de foco. MAS a íris EM SI deve passar no teste das 25 fibras radiais contáveis. Se a íris está suave/manchada/fundida/com-fibras-quase-mas-não-totalmente-nítidas, é 'borrado' INDEPENDENTE do resto da imagem estar nítido E INDEPENDENTE de haver "reflexo" presente (releia: mancha sem brilho específico = BLUR, não reflexo).

TIEBREAKERS (ordem importa):
- Em dúvida APENAS entre excelente/boa/regular (com nitidez DA ÍRIS já confirmada como ≥25 fibras): prefira 'boa'. Não rebaixe para 'regular' por reflexo pequeno.
- Em dúvida entre 'borrado' e 'boa' por contagem de fibras (~23-27 visíveis ou fibras quase-nítidas): prefira 'borrado'. Falso negativo destrói análise downstream.
- Em dúvida entre 'borrado' e 'regular' (foto tem "área mais clara" mas você não tem certeza se é reflexo ou blur): SEMPRE 'borrado'. Reflexo de verdade NÃO gera dúvida — o brilho específico é óbvio. Hesitação = blur = borrado.
- Em dúvida entre 'muito_longe' e 'boa' por tamanho da íris (~1/9 a 1/3 da menor dim): prefira 'boa'. Falso positivo de distância frustra terapeuta sem ganho. Rosto inteiro num frame de selfie NÃO é 'muito_longe' por padrão.
- Em dúvida entre 'olho_fechado' e qualquer outro reason: se você consegue ver o disco circular colorido da íris, NUNCA é 'olho_fechado'. Dedos sobre as pálpebras (cliente segurando o olho aberto pra fotografar sozinho) é técnica legítima — a íris fica visível, e isso é o único que importa.`

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

  // Sanity bound — 2026-06-29: VALIDATION_DIM subiu p/ 1536 (íris com fibras
  // visíveis, fim do "borrado" falso). 1536-lado-maior JPEG q0.85 fica em
  // ~250-700KB binário → base64 ~330-950KB. Limite 1.5MB cobre com folga e
  // ainda barra payload absurdo (JPEG 4K cru ~4-6MB) pra evitar abuse.
  if (body.imageBase64.length > 1_500_000) {
    return NextResponse.json({ error: 'imageBase64 too large' }, { status: 413 })
  }

  // Diagnóstico de custo: verifica o tamanho do resize que chega aqui.
  // Esperado ~330-950KB base64 pra JPEG q0.85 do canvas 1536-lado-maior.
  // Se aparecer >1.4MB, o resize falhou e estamos enviando o 4K cru.
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

  // Normaliza variantes cosméticas do VLM (pontuação/caixa/espaço: 'Boa', 'boa.',
  // ' ruim ') de volta pro valor canônico ANTES de comparar. Claude às vezes
  // formata o enum assim — o comentário antigo já documentava 'boa.'.
  const normalizeEnum = (raw: string, valid: readonly string[]): string | null => {
    const cleaned = raw.trim().toLowerCase().replace(/[.!,;:]+$/, '')
    return valid.includes(cleaned) ? cleaned : null
  }

  // FIX bug#3 (fail-SAFE): quality desconhecida/irreconhecível → 'ruim' (BLOQUEIA),
  // nunca 'regular' (o fallback antigo deixava passar — 'ruim.' virava 'regular' →
  // Confirmar habilitado → foto ruim VAZAVA). Variantes cosméticas de boa/excelente
  // são recuperadas pelo normalizeEnum, então foto BOA não trava — só o que o
  // servidor genuinamente não entende vira 'ruim'. Filosofia do gate: prefere
  // false-positive (pede refazer) a false-negative (envia foto-lixo, gasta crédito).
  const normalizedQuality = normalizeEnum(parsed.quality, VALID_QUALITY_VALUES)
  const quality = (normalizedQuality ?? 'ruim') as (typeof VALID_QUALITY_VALUES)[number]
  // reason: fallback 'olho_detectado' (neutro, dentro do check constraint 0023).
  // O bloqueio chaveia em quality==='ruim' (isVlmRejection), não no reason —
  // quality já clampada a 'ruim' bloqueia mesmo com reason neutro.
  const normalizedReason = normalizeEnum(parsed.reason, VALID_REASON_VALUES)
  const reason = (normalizedReason ?? 'olho_detectado') as (typeof VALID_REASON_VALUES)[number]

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
