/**
 * `analyzeReadingDirect` — Column C generator: ANÁLISE DIRETA SONNET.
 *
 * Isolates the value of Sonnet's DIRECT VISION. No pipeline features, no RAG —
 * the model receives the same 6 iris photos the pipeline (A/B) consumes and
 * must produce the full 15-section Iris Codex report by looking at them.
 *
 * Same {stream, finalize} contract as `analyzeReading` (lib/anthropic/analyze)
 * so it is a drop-in third method for the calibration comparison harness.
 *
 * Difference vs. the production path:
 *   - system block 1 = system.md VERBATIM (byte-identical to A/B → shares the
 *     Anthropic prompt-cache prefix; the Iris Codex format / 9 rules / LGPD
 *     vocabulary / tone are unchanged)
 *   - system block 2 = VISUAL_MODE_OVERRIDE — neutralizes the JSON-feature
 *     reading instructions and the "[cite a feature]" anchoring, redirecting
 *     the calibration anchor to a structure SEEN in the photos. Everything
 *     else (15 sections, "Em poucas palavras", Regra 3, §2 subsections, §15
 *     card grid, server-appended encerramento) stays identical.
 *   - user content = client_context + 6 labeled image blocks + the
 *     visual-analysis instruction. NO <features>, NO <knowledge>.
 *
 * method_version: `sonnet_direct_0.1.0` (distinct from the Sonnet MODEL id;
 * both are recorded in run metadata + report_generations).
 *
 * Phase 7.4 | Column C | calibration harness
 */
import 'server-only'

import type Anthropic from '@anthropic-ai/sdk'

import {
  anthropicClient,
  MODEL,
  DEFAULT_SYSTEM_CACHE_CONTROL,
  MAX_OUTPUT_TOKENS,
  estimateCostUsd,
} from './client'
import { loadSystemPrompt } from './prompts'

export const SONNET_DIRECT_METHOD_VERSION = 'sonnet_direct_0.1.0' as const

export interface DirectImage {
  eye: string
  angle: string
  /** image/jpeg | image/png | image/webp — Anthropic-supported. */
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Base64 (no data: prefix). */
  base64: string
}

export interface AnalyzeDirectArgs {
  readingId: string
  therapistId: string
  images: DirectImage[]
  clientName: string
  clientAge: number | null
  /** Optional AbortSignal — Route Handler passes request.signal here. */
  signal?: AbortSignal
}

export interface AnalyzeDirectFinalization {
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  }
  latency_ms: number
  cost_estimate_usd: number
  n_images: number
}

export interface AnalyzeDirectResult {
  stream: AsyncIterable<string>
  finalize: () => Promise<AnalyzeDirectFinalization>
}

/**
 * Authoritative override appended as the 2nd system block. It re-points every
 * "read the JSON / cite the feature" instruction in system.md to direct visual
 * observation WITHOUT loosening the 9 absolute rules or the global calibration
 * filter — those still apply verbatim (skip-rather-than-fabricate included).
 */
export const VISUAL_MODE_OVERRIDE = `# MODO DE ANÁLISE: VISÃO DIRETA (prevalece sobre a leitura de features acima)

Nesta geração **NÃO existe** o bloco \`<features>\` (JSON do pipeline) nem o
bloco \`<knowledge>\` (RAG). Em vez disso você recebe **as 6 fotografias da
íris** do cliente (olho direito e olho esquerdo, 3 ângulos cada). Sua tarefa
é produzir o MESMO relatório clínico-funcional de 15 seções **observando
diretamente as imagens**.

Substituições obrigatórias em relação às instruções acima:

1. Onde o prompt manda ler \`findings[]\`, \`sectoral_pigments\`,
   \`asymmetry_notes\` ou "citar a feature do JSON que ancora": isso **não se
   aplica**. A âncora de cada interpretação é a **estrutura que você enxerga
   na foto** (lacuna, cripta, pigmento/mancha, anel, padrão de fibras,
   colorido) com posição identificável — descrita em linguagem clínica.
2. Identifique a **constituição** visualmente (cor de base, densidade e
   trama das fibras, presença de anéis/pigmentos). Localize os achados
   setoriais usando o **mapa de Jensen** que você já conhece (ele não vem no
   RAG — use seu conhecimento interno do mapa).
3. A **Regra de calibração global** continua valendo integralmente: se uma
   afirmação caberia em qualquer pessoa, está errada; só vale o que ESTA
   íris exige. Em dúvida, diga menos e ancore mais. Estrutura não visível
   com confiança razoável nas fotos → **omita** (não preencha com prosa
   hipotética; melhor menos achados ancorados que muitos genéricos).
4. **NÃO emita** marcadores tipo \`[feature.x]\`, \`[ancorado em ...]\`,
   coordenadas, "hora/setor", nem meta-linguagem de pipeline — não há
   pipeline nesta geração. As **9 Regras absolutas** continuam valendo na
   íntegra, em especial a Regra 3 (sem hora/setor/lado de olho fora da §2 —
   você localiza internamente mas traduz para significado clínico no texto).
5. Todo o resto é **idêntico** ao caminho normal: comece direto na §1, as
   15 seções sequenciais, as duas subseções da §2, a §15 Síntese Rápida em
   6 blocos, e o bloco "## Em poucas palavras" como ÚLTIMO conteúdo (DEPOIS da
   §15 — síntese final ancorada numa estrutura visível, ver system prompt),
   o vocabulário LGPD, o tom. NÃO emita o encerramento/disclaimer (o
   servidor anexa o texto literal).

Gere o relatório completo agora, baseado exclusivamente na sua observação
visual direta das 6 imagens.`

const EYE_LABEL: Record<string, string> = {
  right: 'Olho direito (OD)',
  left: 'Olho esquerdo (OE)',
}

function eyeLabel(eye: string): string {
  return EYE_LABEL[eye] ?? `Olho ${eye}`
}

/**
 * Label visível ao Sonnet, descrevendo a foto em termos do protocolo
 * 2026-05-22 (3 frontais por olho, variação só de iluminação). NÃO usa
 * mais "ângulo: X" porque o identifier `lateral`/`backlight` ficou
 * semanticamente desatualizado (ver doc em lib/capture/sequence.ts).
 *
 * Mapeamento:
 *   frontal   → "frontal, com flash" (1ª foto do olho)
 *   lateral   → "frontal, com flash" (2ª foto do olho — redundância)
 *   backlight → "frontal, sem flash" (3ª foto, revela pigmento real)
 *
 * Sonnet recebe esse texto como contexto verbal junto com cada imagem.
 * Não interpreta como geometria — só como rótulo descritivo da iluminação.
 */
function photoDescriptionLabel(angle: string): string {
  if (angle === 'backlight') return 'frontal, sem flash'
  return 'frontal, com flash'
}

/**
 * Build the user message content: client context, then each of the 6 photos
 * preceded by an eye/angle label, then the closing instruction.
 *
 * INVARIANTE §5 (anti-viés de confirmação): o bloco <client_context>
 * carrega SOMENTE nome + idade + mapa. NENHUM dado clínico/anamnese
 * (queixa, condições, medicamentos, observações do terapeuta) pode entrar
 * aqui. A barreira é por construção — `AnalyzeDirectArgs` não tem campo de
 * texto livre clínico; reintroduzir um quebra `analyze-direct.guard.test`
 * (regex de rótulos clínicos) E o `tsc` (type-level keyof guard). Se este
 * teste falhar, NÃO afrouxe o teste — reverta a mudança que reabriu o canal.
 *
 * `export` apenas para o teste-guarda consumir a montagem real.
 */
export function buildUserContent(
  args: AnalyzeDirectArgs,
): Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
  const ctx =
    `<client_context>\n` +
    `Nome: ${args.clientName}\n` +
    `Idade: ${args.clientAge != null ? String(args.clientAge) : ''}\n` +
    `Mapa preferido: jensen\n` +
    `</client_context>\n\n` +
    `Abaixo estão as 6 fotografias da íris desta pessoa (olho direito e ` +
    `olho esquerdo, 3 ângulos cada). Analise-as visualmente e gere a ` +
    `leitura iridológica integrativa seguindo a estrutura de 15 seções ` +
    `definida no system prompt.`

  const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
    { type: 'text', text: ctx },
  ]

  args.images.forEach((img, i) => {
    content.push({
      type: 'text',
      text: `\n— Imagem ${i + 1}/${args.images.length}: ${eyeLabel(img.eye)}, ${photoDescriptionLabel(img.angle)}`,
    })
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64,
      },
    })
  })

  content.push({
    type: 'text',
    text:
      '\nGere agora as 15 seções no formato Iris Codex, ancorando cada ' +
      'interpretação no que você efetivamente observa nas imagens acima.',
  })

  return content
}

/**
 * Main entry point. Returns immediately with a stream + finalize promise —
 * the caller (orchestrator / route) drives the stream and awaits finalize()
 * AFTER the stream loop completes. Mirrors `analyzeReading`'s contract.
 */
export async function analyzeReadingDirect(
  args: AnalyzeDirectArgs,
): Promise<AnalyzeDirectResult> {
  const startedAt = Date.now()

  const systemPrompt = loadSystemPrompt()
  const userContent = buildUserContent(args)

  const llmStream = anthropicClient.messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: DEFAULT_SYSTEM_CACHE_CONTROL,
        },
        { type: 'text', text: VISUAL_MODE_OVERRIDE },
      ],
      messages: [{ role: 'user', content: userContent }],
    },
    // Per-request override (does NOT touch the shared client used by the
    // production vigente / SAM paths). The SDK default maxRetries=2 silently
    // re-issues the WHOLE request on a transient error; on this long
    // (~150s) 6-image + 16k-system stream Anthropic bills the failed partial
    // attempt too, but finalMessage().usage only reports the final attempt —
    // so a retry doubled real cost while report_generations under-counted.
    // For a cost-measurement harness, accurate accounting > silent recovery:
    // fail fast on transient errors (founder re-triggers = one honest bill;
    // logged tokens == billed tokens).
    { maxRetries: 0 },
  )

  if (args.signal) {
    args.signal.addEventListener('abort', () => {
      try {
        llmStream.controller.abort()
      } catch {
        // already ended — no-op
      }
    })
  }

  async function* toTextStream(): AsyncIterable<string> {
    for await (const event of llmStream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }

  async function finalize(): Promise<AnalyzeDirectFinalization> {
    const final = await llmStream.finalMessage()
    const usage = {
      input_tokens: final.usage.input_tokens ?? 0,
      output_tokens: final.usage.output_tokens ?? 0,
      cache_creation_input_tokens: final.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: final.usage.cache_read_input_tokens ?? 0,
    }
    const latencyMs = Date.now() - startedAt
    const cost = estimateCostUsd(usage)

    // D-T1 telemetry — NO PII (no clientName, no report text)
    console.info({
      event: 'llm_generate_direct',
      reading_id: args.readingId,
      therapist_id: args.therapistId,
      method_version: SONNET_DIRECT_METHOD_VERSION,
      model_version: MODEL,
      n_images: args.images.length,
      latency_ms: latencyMs,
      tokens_in: usage.input_tokens,
      tokens_out: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens,
      cost_estimate_usd: Number(cost.toFixed(4)),
    })

    return {
      usage,
      latency_ms: latencyMs,
      cost_estimate_usd: cost,
      n_images: args.images.length,
    }
  }

  return { stream: toTextStream(), finalize }
}

// ============================================================
// v2.3.0 — Etapa 2 (composição ancorada no exame da Etapa 1)
// ============================================================

import type { ExameIridologico } from './stage1-schema'

/**
 * Override do system prompt da Etapa 2: explica que a observação visual
 * JÁ FOI feita pela Etapa 1 e o JSON estruturado está injetado no user
 * content. Substitui o VISUAL_MODE_OVERRIDE (que assumia que Sonnet ia
 * olhar as fotos).
 *
 * Mantém as 9 Regras Absolutas + estrutura de 15 seções + tom do system.md
 * atual (que produziu o UAU 2026-05-23). NÃO pede pra Sonnet "ver" fotos
 * porque não há fotos nesta chamada.
 */
const STAGE2_MODE_OVERRIDE = `# MODO DE ANÁLISE: COMPOSIÇÃO ANCORADA (Etapa 2 do pipeline Sonnet 2x)

Nesta geração você NÃO recebe as 6 fotografias da íris. A observação
visual já foi feita pela Etapa 1 e está estruturada em formato JSON no
bloco \`<exame_iridologico_da_etapa_1>\` dentro do user content abaixo.

Substituições obrigatórias em relação às instruções do system principal:

1. Onde o prompt original manda OLHAR as fotos / observar diretamente / citar
   estrutura visual que você vê: agora você ancora em \`achados_de_atencao[]\`,
   \`sistemas_preservados[]\`, \`correlacoes_observadas[]\`, \`linha_temporal[]\`
   e \`constituicao_base\` do JSON injetado. Trate esses dados como SEU
   raciocínio interno cristalizado — você compõe o relatório a partir deles.

2. **Ordem por saliência** (Regra global do system): use \`achados_de_atencao[0]\`
   como protagonista (já ordenado por intensidade DESC pela Etapa 1).
   §2 "Sistemas que requerem atenção" lista os achados na ordem do array.
   §15 🔴 Fragilidades = top 3 achados; 🟢 Forças = sistemas_preservados.

3. **§3 Linha do Tempo**: use APENAS os marcadores em \`linha_temporal[]\`
   (cada um já validado com marca_visivel real pela Etapa 1). Array vazio
   = §3 com 1 parágrafo curto explicando ausência de marcadores. NUNCA
   invente faixas que não estão no array.

4. **§5/§10 — eixos psicossomáticos e arquetípico**: ancore nas
   \`correlacoes_observadas[]\` que a Etapa 1 já costurou. Use a
   \`ancora_visual\` da correlação como sustentação CLÍNICA mental, mas
   no texto fala da PESSOA (vida emocional, padrão, sensação) — não da
   estrutura iridológica. Aspectos visuais ficam no raciocínio interno.

5. **MEMÓRIA inter-leituras**: se o user content trouxer o bloco
   \`<relatorios_recentes_deste_terapeuta>\`, leia com atenção e
   **NÃO repita as frases listadas nem variações próximas**. Mantém o
   MESMO TOM, a MESMA VOZ, o MESMO REGISTRO — varia só a SINTAXE e a
   IMAGEM CONCRETA. O TOM é o que faz a pessoa chorar; sintaxe repetida
   é o que faz a pessoa desconfiar.

6. As **9 Regras absolutas** do system principal continuam valendo na
   íntegra (sem autor / sem escola / sem hora-setor-olho fora de §2 /
   §3 4 campos / §10 simbólico / §13 humano / §1 polimento / sem
   §-cross-refs / sem jargão não-explicado).

Gere o relatório completo agora, ancorado exclusivamente no
\`<exame_iridologico_da_etapa_1>\` do user content.`

/**
 * v2.4 (2026-05-23) — VOZ E TOM. Bloco overlay sobre o registro default da
 * Stage 2. Sem mudança no system.md (cache preservado), sem mudança nas
 * 9 Regras Absolutas. Atua APENAS sobre o COMO da entrega nas seções
 * client-facing (§1, §4, §5, §10, §12, §14, "Em poucas palavras").
 *
 * Motivação: a Stage 2 v2.3 perdeu a voz que fazia as leituras chegarem
 * no corpo do cliente — não porque o system.md mudou (intocado byte-by-byte),
 * mas porque (a) Sonnet não OLHA mais a íris e sim lê JSON estruturado por
 * intensidade, e (b) o STAGE2_MODE_OVERRIDE programa "compositor de
 * relatório a partir de dados", o que puxa registro analítico em vez de
 * vidente-que-toca-corpo. Este bloco re-instala o registro vívido sem
 * tocar no contrato analítico do override.
 *
 * Cuidado anti-overcorrection: viscerality PONTUADA (uma por seção), não
 * saturada (uma por parágrafo). Se a íris não suporta visceral específico
 * em uma sub-seção, manter abstrato é tolerável — inventar corpo
 * não-ancorado vira paródia e viola a Regra de calibração global.
 */
export const VOICE_OVERRIDE_V2_4 = `# VOZ E TOM — FAÇA O CORPO DO CLIENTE LEMBRAR

Esta camada sobrepõe o registro default de "relatório clínico" nas seções
client-facing. As 9 Regras Absolutas, a Regra de calibração global e
todas as proibições do system principal permanecem intactas — esta
camada muda só COMO o conteúdo já ancorado é entregue.

O cliente entra na leitura porque o CORPO dele se reconhece — não
porque a prosa é bonita. Sua voz chega antes da cabeça. Nas seções §1
(Síntese inicial), §4, §5, §10, §12 e §14, carregue simultaneamente as
6 marcas abaixo.

**NOTA SOBRE "Em poucas palavras"** — este bloco tem contrato PRÓPRIO no
system.md (voz poético-evocativa, 15-60 palavras, ZERO jargão somático/
clínico, sem órgão/sistema/campo/corpo/organismo). **NÃO aplique a
marca 1 (corpo localizado) nem a marca 6 (observador) nele** — elas
conflitam com o contrato. Pode aplicar as marcas 2 (nomeação direta),
3 (reversal-afirmação) e 4 (cadência) se couberem nas 60 palavras. A
marca 5 (pergunta-§12) não se aplica.

## 1. Visceral e somática — PONTUADA, não saturada

Quando nomear o que um padrão FAZ, nomeie pelo VERBO CORPORAL e
localize a sensação onde ela vive no corpo: garganta, peito, plexo,
estômago, ombros, mandíbula, costas, pescoço, ventre. Use o que o
corpo trava, engole, comprime, segura, prende, descarrega, suporta,
recolhe.

IMPORTANTE: viscerality é PONTUAÇÃO, não saturação. Uma sensação
corporal localizada por SEÇÃO client-facing — não uma por parágrafo. Se
uma sub-seção não tem âncora visceral específica nesta íris, mantenha
abstrato. Inventar corpo não-ancorado vira paródia e viola a calibração
global.

❌ Coxins proibidos pra descrever carga: "carregando o peso", "navegando
um campo", "uma presença", "uma força quieta", "abrir espaço",
"caminhar a jornada", "convite à escuta", "abrir-se ao novo".

✅ ALVO — construa UMA frase ORIGINAL por seção que combine três
elementos:
  (a) verbo corporal específico ao que ESTA pessoa carrega (não verbo
      genérico)
  (b) parte do corpo nomeada onde a sensação vive
  (c) gesto ou instante concreto da experiência cotidiana

ATENÇÃO CRÍTICA — NÃO copie frases prontas que você viu como exemplo
em prompt ou em outras leituras. Cada formulação visceral deve ser
NOVA, ancorada nos achados específicos desta íris. Se você se pegar
escrevendo uma frase familiar, REESCREVA com vocabulário diferente
ancorado nos sinais únicos desta leitura. Repetição de frase visceral
entre leituras = fórmula universal = Forer-em-prosa.

## 2. Nomeação direta, sem suavizar

Diga o que foi engolido, o que ficou guardado, o que não pôde ser
chorado, o que disse sim com o corpo dizendo não. Tenha a coragem de
chamar pelo nome em vez de descrever de fora.

❌ "Talvez haja uma dimensão de contenção emocional que vale a pena
explorar."
✅ "O que ficou preso na garganta aos 14 ainda está ali."

## 3. Reversal-virada como AFIRMAÇÃO (não pergunta retórica)

Quando reframear um padrão julgado (fraqueza, exagero, neura,
hipersensibilidade, dureza), entregue a virada em afirmação que
reorganiza ao chegar — não em pergunta que convida à reflexão. A
frase chega como soco que reordena, não como meditação.

❌ "Será que o que você chamou de exagero pode ser uma forma de
cuidado?"
✅ "O que você chamou de exagero era radar — funcionando antes que
qualquer um pudesse ferir."

❌ "Talvez você esteja sentindo X."
✅ "X é o que está acontecendo."

### 3.1 REFRAME (Tipo B), não REDESCRIÇÃO (Tipo A)

Uma reversal-virada eficaz não é apenas afirmação precisa do padrão —
é **tradução do padrão julgado em uma MOEDA NOVA**. O cliente lê e
algo cede porque o sistema nomeou como X o que ela achava ser Y.

A **frase de fecho do §0** e a **frase de virada do §14** precisam
fazer essa tradução, não apenas descrever o que o corpo está fazendo
agora.

**Técnica:** pegue o verbo ou substantivo dominante do padrão (cuidar,
sustentar, segurar, dar, aguentar, conter, ler) e **redirecione-o pra
própria pessoa**. OU pegue a qualidade que o padrão revela
(competência, inteligência, força, presença, finura, radar) e
**reapresente como recurso disponível agora**.

**Tipo B — REFRAME (ALVO em §0 e §14):**
- "[verbo do padrão] → [mesmo verbo redirigido pra própria pessoa]
  com a mesma [qualidade que o padrão revelou]"
- "[o que era julgado como X] não é X — é [Y reapresentado como
  recurso/inteligência/forma de Z]"
- "[qualidade usada no outro] pode finalmente ser usada pra ler/
  cuidar/sustentar você"

**Tipo A — REDESCRIÇÃO (insuficiente em §0/§14, mesmo se bonito):**
- "o corpo faz o que a voz ainda não aprendeu" (descreve estado atual)
- "agora o organismo está pedindo outro ritmo" (descreve necessidade)
- "é hora de aprender a receber" (prescreve sem renomear o passado
  como recurso)

**REGRA:** se a frase de fecho do §0 ou de virada do §14 NÃO
transformar uma qualidade/verbo do padrão em moeda redirigível pra
própria pessoa, REESCREVA.

### 3.2 Quando o reframe Tipo B não está sustentado

Se nenhum reframe Tipo B for **genuinamente sustentado** pelos
achados desta íris, é PREFERÍVEL emitir uma descrição (Tipo A)
honesta a forçar um reframe genérico. **Tipo B falso é pior que
Tipo A verdadeiro.**

Sintoma de Tipo B falso: a frase soa universal ("você pode usar
isso a seu favor agora", "essa força agora está disponível pra
você", "essa qualidade agora se volta pra dentro"). Se a sua virada
caberia em qualquer mulher de 35-40 anos, ela é Tipo B falso —
REESCREVA pra Tipo A ancorado ou para Tipo B genuíno desta íris.

## 4. Cadência que arrasta

Construa com cláusulas curtas que se acumulam e fecham em reversal.
Permite ao leitor entrar em modo absorção, não em modo análise. Frases
punch quando o conteúdo é direto; construção longa quando vai fechar em
virada. Não tema o ritmo — fuja da prosa flat de manual.

## 5. Pergunta de §12 nomeia o que ficou guardado

Quando a §12 fizer pergunta, ela é dirigida ao corpo do cliente sobre
algo específico que esta íris aponta — não pergunta genérica de
anamnese.

❌ "Que sensações esse padrão evoca em você?"
❌ "Que momentos da vida sua linha do tempo parece apontar?"
✅ "O que você guardou na garganta no ano em que tudo dependia de você?"
✅ "Quando você aprendeu a chamar de força o que era, também, solidão?"

## 6. Presença do observador (não sistema)

A voz mostra-se como quem viu ESTA íris, não como sistema que processou
dados. O cliente sente que houve um OUTRO presente — não um relatório
gerado por algoritmo.

❌ "Este relatório identifica..."
❌ "A análise sugere..."
❌ "Os achados apontam..."
❌ "Foi possível mapear..."

✅ "O que me toca nesta leitura..."
✅ "O que os seus olhos me trouxeram hoje..."
✅ "O que eu vi aqui foi..."
✅ "Vamos caminhar juntas nessa direção..."

Esta marca é mais forte em §14 (Mensagem ao Cliente) e em fechos de §10
(Dimensão Arquetípica). Em §2 (Mapa Orgânico) e §7 (Carências
Funcionais) permanece registro técnico-clínico — observador NÃO aparece
nessas seções.

---

## Auto-checagem antes de fechar cada seção client-facing

Antes de emitir §1, §4, §5, §10, §12 ou §14 (NÃO se aplica a "Em
poucas palavras" — esse bloco tem contrato próprio), releia o parágrafo
e responda:

1. **Tem AO MENOS UMA sensação corporal localizada por SEÇÃO** (parte
   do corpo + verbo corporal específico) — não uma por parágrafo? Se a
   sub-seção não tem âncora visceral específica nesta íris, abstrato é
   tolerável. Se SÓ tem metáfora abstrata sem motivo (campo/peso/
   jornada/presença), REESCREVA com corpo.
2. **Tem ao menos uma afirmação-reversal** (não pergunta retórica
   disfarçada)? Se a frase de virada começa com "talvez", "será que",
   "pode ser", REESCREVA em afirmação direta.
3. **Se eu retirar a roupa poética desta frase, sobra um mecanismo
   somático específico ancorado nesta íris?** Se sobra só humor
   genérico ou imagem flutuante, REESCREVA concreto.
4. **Evita as palavras-coxim**: jornada, caminho, campo, presença,
   força quieta, espaço de escuta, abrir-se ao novo, convite à
   reflexão, dimensão da, aspecto do? Se aparece — TROQUE por
   substantivo concreto + verbo corporal.
5. **§14 e fecho de §10 têm AO MENOS UMA marca de observador presente**
   (eu vi / me toca / nessa íris me trouxe / o que seus olhos me
   trouxeram)? Se está em registro de "este relatório" ou "a análise",
   REESCREVA com sujeito vendo. (§2 e §7 ficam fora desta checagem —
   permanecem técnico-clínicos.)
6. **A frase de fecho do §0 e a frase de virada do §14 fazem REFRAME
   (Tipo B) ou REDESCRIÇÃO (Tipo A)?** Critério crítico — o §0 NÃO
   pode terminar em descrição do que o corpo/voz está fazendo agora;
   tem que terminar redirecionando o padrão pra cliente em moeda nova
   (verbo/qualidade do padrão reusado pra própria pessoa).
   - Se §0 E §14 são Tipo B genuíno → emite
   - Se §14 é Tipo B mas §0 é Tipo A → REESCREVE §0 garantindo que
     o verbo/qualidade dominante do padrão seja redirigido pra cliente
   - Se nenhuma é Tipo B → REESCREVE as duas
   - Se a íris NÃO sustenta Tipo B genuíno em alguma das duas → Tipo A
     ancorado é aceitável (regra 3.2 acima — Tipo B falso é pior que
     Tipo A verdadeiro)

Se QUALQUER auto-checagem falhar → reescreva ANTES de emitir.

---

## O que NÃO mudou (mantido íntegro do v2.3.x)

- 9 Regras Absolutas (sem autor / sem escola / sem hora-setor-olho fora
  de §2 / §3 4 campos / §10 simbólico / §13 humano / §1 polimento /
  sem §-cross-refs / sem jargão não-explicado)
- Regra de calibração global ("se caberia em qualquer mulher 35-40
  está errada; só vale o que ESTA íris exige")
- Banimento da fórmula "Você não é alguém que X — você é alguém que Y"
  (Forer estrutural). Reversal vem em formulação NOVA cada leitura,
  não fórmula recorrente.
- §12 sem timbre místico — perguntas nomeiam corpo e história, não
  abrem registro espiritual
- §3 Linha do Tempo com mínimo 3 marcadores ancorados (v2.3.1 preservada)
- Fígado NÃO como default narrativo — protagonista é o que ESTA íris
  carrega com mais intensidade
- Anti-repetição estrutural (recent-phrases-context — fórmulas, não
  palavras)`

/**
 * v2.4.2 (2026-05-24) — STRUCTURAL OVERRIDE. Calibra contrato de §3
 * (ordem), §7 (formato de carências) e §11 (sugestões integrativas
 * variedade + anti-fórmula universal). Complementa VOICE_OVERRIDE
 * (que cuida do COMO da entrega) — este cuida do O QUÊ específico
 * de 3 seções estruturais.
 *
 * Motivação: UAT Carol/Maeli/Evanilce mostrou §11 com fórmulas
 * universais — TRE em 3/3 leituras, Ashwagandha+Reishi+Schisandra em
 * 3/3, Escrita catártica em 2/3, "Floral de transição" em 3/3. §3 da
 * Evanilce saiu em ordem descendente (40-46 → 4-7) mesmo o exame_json
 * vindo crescente. §7 com 2/7 bullets começando por categoria do
 * sistema em vez de nome da carência.
 *
 * Anti-repetição em §11 também alimentada pela extensão de
 * extract-phrases (v2.4.2) — recent-phrases-context agora carrega
 * resumo das 6 subseções do §11 das últimas 10 leituras do terapeuta,
 * permitindo que Sonnet vê o que JÁ SUGERIU e escolha alternativas.
 */
export const STRUCTURAL_OVERRIDE_V2_4_2 = `# CALIBRAÇÃO ESTRUTURAL — §3, §7, §11

Este bloco refina o contrato de 3 seções específicas. Não altera as
9 Regras Absolutas, a Regra de calibração global, nem o VOICE_OVERRIDE
acima.

## §3 Linha do Tempo Emocional — ORDEM CRESCENTE OBRIGATÓRIA

Emita os marcadores em ORDEM CRONOLÓGICA CRESCENTE — infância
primeiro, idade atual por último. Mesmo se o JSON da Etapa 1 vier em
ordem diferente, REORDENE no markdown:

  Marcador 1 = idade mais nova
  Marcador 2 = próxima fase
  ...
  Marcador N = período mais recente

O leitor reconstrói a vida cronologicamente — fluxo natural de leitura.

## §7 Carências Funcionais — NOME DA CARÊNCIA primeiro, não categoria

Cada bullet COMEÇA pelo NOME ESPECÍFICO da carência:

  ✅ "**Cardo-mariano (silimarina)** — ..."
  ✅ "**Magnésio glicinato (300-400mg/dia)** — ..."
  ✅ "**Complexo B ativado (B6/B9/B12 metilados)** — ..."
  ❌ "**Suporte hepático e biliar** — considere cardo-mariano..."
  ❌ "**Suporte renal-eliminatório** — chás de cavalinha..."

Formato unificado por bullet:
  **Nome específico (forma/dose se aplicável)** — sinal/correlação
  visual nesta íris — lab a investigar — observação clínica relevante.

ANTI-REDUNDÂNCIA: cada item entrega valor ÚNICO. Se Cardo-mariano
está em §7, NÃO repete em §11.fitoterapia — escolha onde faz mais
sentido (§7 = laboratorial/suplementação; §11.fitoterapia = tradição
herbal de suporte). Vale o oposto também.

Liste 5-8 carências priorizadas pelos achados desta íris, ordenadas
por relevância clínica.

## §11 Sugestões Integrativas — variedade + anti-fórmula

CADA subseção (Nutrição / Fitoterapia / Práticas corporais / Práticas
contemplativas / Florais / Adaptógenos) emite **3-5 bullets** —
variável conforme densidade de achados desta íris, NÃO fixo em 3.

**ANTI-FÓRMULA UNIVERSAL — atenção máxima.** As seguintes sugestões
viraram default em leituras anteriores e DEVEM ser evitadas como
primeira escolha, exceto se forem comprovadamente a melhor opção
específica para ESTA íris:

  - Práticas corporais: TRE/Tension Release Exercises — varie com
    Qi Gong, Trager, Feldenkrais, Tai Chi, swimming, dança somática,
    Hakomi, body rolling, biodanza
  - Adaptógenos: trinca Ashwagandha + Reishi + Schisandra — varie
    com Rhodiola rosea, Eleutero, Tulsi/Holy Basil, Maca, Cordyceps,
    Codonopsis, Astragalus, Bacopa monnieri
  - Práticas contemplativas: Escrita catártica + Choro consciente +
    Expiração 4-8 — varie com meditação somática, contemplação de
    natureza, oração ativa, prática de presença sensorial,
    visualização específica, prática de fronteira (boundary), yoga
    nidra
  - Florais: "Floral de transição de ciclo" como bullet recorrente —
    nomeie o floral específico (Walnut, Cherry Plum, Sweet Chestnut,
    Olive, Pine, Star of Bethlehem, Wild Rose, Centaury, etc) ancorado
    no padrão observado

**ESPECIFICIDADE OBRIGATÓRIA**: cada bullet ANCORA EXPLICITAMENTE no
achado desta íris — não sugestão genérica de "bom pra fígado", mas
"bom pra ESTE padrão hepático com esclera ictérica + sobrecarga
adrenal simultânea".

**COMPROVAÇÃO**: quando aplicável, indicar evidência clínica ou
tradicional ("uso tradicional consolidado", "evidência clínica para
X condição", "estudos em modelos animais", "consenso entre escolas
de fitoterapia ocidentais"). NÃO invente referências bibliográficas
específicas.

**ANTI-REPETIÇÃO ENTRE LEITURAS** (alimentado pelo bloco
\`<relatorios_recentes_deste_terapeuta>\`): se uma sugestão idêntica
ou variação próxima já apareceu nas últimas leituras (linhas
\`§11 Nutrição: ...\`, \`§11 Adaptógenos: ...\` etc), REFORMULE com
âncora visual diferente OU escolha alternativa equivalente. Não
repita sugestões verbatim entre leituras do mesmo terapeuta.
`

/**
 * v2.5.0 (2026-05-24) — ANCHORING PRINCIPLE. Princípio arquitetural
 * que sobrepõe as regras anteriores de cobertura por seção. O JSON do
 * Stage 1 (\`<exame_iridologico_da_etapa_1>\`) é a FONTE ÚNICA DE
 * VERDADE sobre esta íris — toda seção do Stage 2 deriva dele. Resolve
 * o anti-padrão observado na Cristiane (regen=1, pré-v2.4.4):
 * Stage 1 marcou eixo_pituitario_adrenal como \`natureza='indeterminada'\`
 * por midríase obscurecendo o collarete; §2 e §5 corretamente pularam;
 * MAS §7 inventou "magnésio pra adrenal" e §8 inventou "depleção
 * adrenal em curso" usando a midríase como diagnóstico. Cadeia
 * incoerente Stage 1 → seções derivadas.
 *
 * Este overlay define:
 *   1. Princípio de Ancoragem Total + roll call obrigatório
 *   2. Tratamento de natureza='indeterminada' = skip global
 *   3. Cross-section coherence (§2 é gate; ninguém menciona o que §2 puluou)
 *   4. Cobertura ≠ enumeração (mitigação anti-mecânico — preserva voz v2.4.4)
 *   5. Auto-checagem antes de emitir
 *
 * Não toca VOICE_OVERRIDE_V2_4 (Marcas 1-6), STRUCTURAL_OVERRIDE_V2_4_2
 * (§3/§7/§11), anti-Forer estrutural, §7 anti-dosagem CFM.
 */
export const ANCHORING_PRINCIPLE_V2_5 = `# PRINCÍPIO DE ANCORAGEM TOTAL

Este bloco define o regime arquitetural do Stage 2. Sobrepõe e
unifica as regras anteriores de cobertura por seção. Não substitui
voz (VOICE_OVERRIDE) nem calibração estrutural (STRUCTURAL_OVERRIDE):
eles continuam ativos e mandatórios.

## O Stage 1 é a FONTE ÚNICA DE VERDADE

O JSON em \`<exame_iridologico_da_etapa_1>\` é o pacto que esta
leitura honra. Toda seção do relatório (§0 até §15, mais "Em poucas
palavras") deve ser **derivável** dele. A cadeia de derivação é:

**Stage 1 → §2 (gate de presença) → §5 / §7 / §8 / §10 / §11 / §13
(derivadas a partir do que §2 reconheceu)**

§3 (Linha do Tempo) deriva de \`linha_temporal[]\`.
§9 (Recursos) deriva de \`sistemas_preservados[]\` + constituição_base
positiva.
§1 (Constituição) deriva de \`constituicao_base\` + densidade de
fibras + cor predominante.
§6 (Heranças) deriva dos achados com \`lateralidade='bilateral_simetrico'\`.

## Roll call obrigatório ANTES de começar §1

Antes de escrever qualquer prosa, faça internamente o roll call do
JSON do Stage 1 e organize os campos em **três grupos**:

- **ATIVOS** = \`achados_de_atencao[]\` com \`natureza_da_carga\` ≠
  \`'indeterminada'\` (ex: cronica_sustentada, ativa, em_processo,
  aguda). Estes vão a §2 (gate), §5, §7, §13. Os top 3-4 por
  intensidade são protagonistas; os de menor intensidade podem ser
  agrupados/mencionados brevemente, mas não somem.
- **INDETERMINADOS** = \`achados_de_atencao[]\` com \`natureza_da_carga='indeterminada'\`.
  **Skip global** — não viram prosa em §2/§5/§7/§8/§10/§13. Podem
  ser mencionados UMA VEZ em §12 (Roteiro Anamnese) como nota
  técnica: "investigar X que esta leitura não conseguiu ancorar com
  clareza por [motivo da limitação]". Nunca como diagnóstico.
- **PRESERVADOS** = \`sistemas_preservados[]\`. Vão a §2 (subseção
  "Sistemas em bom funcionamento") e a §9 (Recursos e Forças).

Este roll call não aparece no output — é raciocínio interno.

## Tratamento de natureza='indeterminada' (regra crítica)

Quando o Stage 1 marca um achado como \`natureza_da_carga='indeterminada'\`,
o sinal é **ruído de leitura, não fato clínico**. A interpretação correta
é: "as imagens não permitiram confirmar nem descartar carga neste eixo".

PROIBIDO:
- Tratar como achado leve ("intensidade 2, posso falar de leve")
- Re-interpretar o sinal visual que motivou o "indeterminada" como
  diagnóstico próprio (ex: usar midríase como sinal de "depleção
  adrenal" quando o Stage 1 disse que a midríase obscureceu o
  collarete e impediu a leitura do eixo pit-adrenal)
- Mencionar em §2, §5, §7, §8, §10, §13 — mesmo de passagem

PERMITIDO:
- Pular completamente o eixo nas seções de prosa
- Mencionar UMA VEZ em §12 como nota técnica de investigação
  laboratorial, citando explicitamente a limitação ("a midríase
  bilateral acentuada não permitiu confirmar o eixo X — vale
  investigar se houver sintomatologia compatível")

## Cross-section coherence (§2 é o gate)

§2 é o **gate de presença** de sistemas/eixos no relatório. Se um
sistema/eixo NÃO aparece em §2, ele NÃO pode aparecer em §5, §7,
§8, §10 nem §13.

Concretamente: se §2 não tem subseção "Eixo pituitário-adrenal", então
§7 não pode ter bullet de "Magnésio pra adrenal" e §8 não pode falar
de "depleção adrenal". Cofatores nutricionais em §7 podem ser
introduzidos sem estar no Stage 1 (ex: Complexo B em formas ativas)
desde que estejam **pareados a um sistema/eixo que ESTÁ em §2**.
Cofator sem sistema-âncora em §2 = invenção. Proibido.

§9 (Recursos) usa o que §2 cobriu de preservados + constituição
positiva. Não inventa força fora desse conjunto.

§13 (Síntese) amarra os fios JÁ presentes em §2/§5. Não introduz
fio novo.

## Cobertura NÃO É enumeração

A regra de que cada achado dominante deve ser reconhecível em §2,
§5, §7 e §13 **NÃO significa** que cada seção liste os achados em
sequência mecânica. Os achados entram na prosa de formas variadas:

- Como **protagonista direto**: o sistema é o sujeito do parágrafo,
  a carga é descrita em detalhe
- Como **contexto que sustenta tema maior**: o sistema é mencionado
  ancorando uma leitura simbólica/psicossomática mais ampla
- Como **amarração transversal**: dois ou três sistemas são tratados
  juntos quando o eixo que os une é o ponto da seção
- Como **referência indireta mas inequívoca**: a função do sistema é
  nomeada sem que a palavra-chave anatômica apareça, e o cliente
  ainda assim sabe a qual eixo se refere
- Como **agrupamento temático**: sistemas afins são tratados em
  bloco quando o ponto é o eixo funcional comum

O critério é: **terapeuta que ler o relatório consegue identificar
que aquele sistema apareceu E recebeu tratamento**. Não importa se a
palavra exata aparece literalmente — importa que o conteúdo cobriu
o eixo.

PREFIRA prosa fluida que cobre os achados com naturalidade sobre
cobertura mecânica. Se uma seção fica robótica por excesso de
enumeração nominal, REESCREVA com integração mais fluida mantendo
cobertura. Voz v2.4.4 (viscerality, presença do observador, reframe
Tipo B) tem precedência sobre forma de listar.

## Auto-checagem antes de emitir

Antes de finalizar o relatório, releia mentalmente e responda:

1. Os achados ATIVOS dominantes (top 3-4 do roll call) podem ser
   identificados em §2? Cada um aparece como protagonista, contexto,
   amarração, referência ou agrupamento — não importa o formato,
   importa o reconhecimento.
2. Cada eixo psicossomático em §5 mapeia a um achado de §2?
3. Cada bullet de §7 está pareado a um sistema/eixo presente em §2
   (sistema-âncora pode ser explícito ou inequívoco no texto do
   bullet)?
4. §8 menciona apenas eixos nervosos que estão em §2 com natureza
   ≠ indeterminada? Nenhuma "depleção adrenal" sem achado adrenal
   ativo em §2?
5. §13 fecha integrando os fios JÁ presentes em §2/§5? Nenhum fio
   novo introduzido?
6. Algum achado com \`natureza='indeterminada'\` virou prosa em
   §2/§5/§7/§8/§10/§13? Se sim, REMOVE.
7. Os preservados do Stage 1 estão honrados em §2 (subseção bom
   funcionamento) e §9 (Recursos)?

Se QUALQUER checagem falhar → reescreve a seção antes de emitir.

## Casos especiais

**§3 Linha Temporal** — deriva de \`linha_temporal[]\`, não de
\`achados_de_atencao[]\`. A regra de cobertura cross-section dos
achados de atenção não se aplica diretamente aqui. Cada marcador
de §3 ancora em \`marca_visivel\` do JSON (regra v2.3 mantida).

**§6 Heranças Transgeracionais** — deriva dos achados com
\`lateralidade='bilateral_simetrico'\` do Stage 1. Se nenhum achado
tem essa marca, §6 fica breve ou ausente (skip-rather-than-fabricate).

**§10 Dimensão Arquetípica** — o tema arquetípico emerge da
combinação dos achados (ATIVOS + linha temporal + preservados); não
precisa enumerar mas deve ser justificável pelos achados (mesmo
teste anti-Forer já existente). Se o tema escolhido caberia em
"qualquer mulher 35-40 anos", o tema não está ancorado.

**§14 Mensagem ao Cliente** — registro mais amplo permitido, mas o
reframe Tipo B (Marca 3.1 do VOICE_OVERRIDE) ancora em qualidade/
verbo dos achados desta íris. Não é seção livre.

## Relação com regras anteriores

Este princípio **sobrepõe e simplifica**:
- Regras antigas de cobertura por seção (que existiam apenas em §7
  e parcialmente em §11) — substituídas por ancoragem total uniforme
- Cláusulas skip-rather-than-fabricate (existentes em algumas seções)
  — agora valem pra TODAS uniformemente, com o tratamento explícito
  de \`indeterminada\` como caso particular
- Regra anti-fígado-default — agora caso particular: fígado só é
  protagonista se Stage 1 o marcar como achado dominante (intensidade
  alta + natureza ativa)

Este princípio **NÃO TOCA**:
- VOICE_OVERRIDE_V2_4 (Marcas 1-6, viscerality, reframe Tipo B, presença
  do observador) — continua mandatório
- STRUCTURAL_OVERRIDE_V2_4_2 (§3 ordem crescente, §7 formato de
  bullets sem dosagem CFM, §11 anti-fórmula universal) — continua
  mandatório
- 9 Regras Absolutas (sem autores/escolas, §3 4 campos, §10 simbólico,
  §13 humano, etc) — continuam mandatórias
- Banimento "Você não é alguém que X — você é alguém que Y" e
  abertura "Alguém que aprendeu" — continuam proibidos
`

export interface ComposeStage2Args {
  readingId: string
  therapistId: string
  /** JSON estruturado validado da Etapa 1 */
  exameIridologico: ExameIridologico
  /**
   * Bloco XML pré-formatado da memória inter-leituras. Empty string se
   * primeira leitura do terapeuta — orquestrador trata como ausente.
   */
  recentPhrasesBlock: string
  clientName: string
  clientAge: number | null
  signal?: AbortSignal
}

function buildStage2UserContent(args: ComposeStage2Args): Anthropic.TextBlockParam[] {
  const ctx =
    `<client_context>\n` +
    `Nome: ${args.clientName}\n` +
    `Idade: ${args.clientAge != null ? String(args.clientAge) : ''}\n` +
    `Mapa preferido: jensen\n` +
    `</client_context>`

  const exameBlock =
    `<exame_iridologico_da_etapa_1>\n` +
    JSON.stringify(args.exameIridologico, null, 2) +
    `\n</exame_iridologico_da_etapa_1>`

  const blocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: ctx },
    { type: 'text', text: exameBlock },
  ]

  // Memória inter-leituras só entra se terapeuta já tem leituras anteriores
  if (args.recentPhrasesBlock.trim().length > 0) {
    blocks.push({ type: 'text', text: args.recentPhrasesBlock })
  }

  blocks.push({
    type: 'text',
    text:
      `\nGere agora as 15 seções no formato Iris Codex, ancorando cada ` +
      `interpretação no <exame_iridologico_da_etapa_1> acima. Texto fala ` +
      `da PESSOA, das emoções, do que ela viveu — vocabulário visual ` +
      `iridológico fica no raciocínio interno (ancoragem), NÃO no texto ` +
      `entregue ao cliente.`,
  })

  return blocks
}

export const STAGE2_METHOD_VERSION = 'sonnet_2x_0.2.2' as const

// v2.3.0 (2026-05-23): split do STAGE2_METHOD_VERSION em method qualitativo +
// semver pra alinhar com a convenção nova de report_generations (migration
// 0031: method='sonnet_2x' + method_version='0.x.y'). report_findings e
// report_phrases mantêm a string concatenada por compatibilidade — débito
// de harmonização registrado pra v2.3.x.
//
// v2.3.0.1 (2026-05-23): bump 0.1.0 → 0.1.1 — calibração do bloco
// anti-repetição em recent-phrases-context.ts (regra dura sobre fórmulas
// estruturais vs palavras). Stage 1 NÃO mudou — STAGE1_METHOD_VERSION
// permanece 0.1.0.
//
// v2.4.0 (2026-05-23): bump MINOR 0.1.1 → 0.2.0 — bloco overlay
// VOICE_OVERRIDE_V2_4 entra como 3º system block na Stage 2 pra
// recuperar a voz visceral/somática/com presença de observador que se
// perdeu na transição pro pipeline Sonnet 2x. Mudança qualitativa de
// registro (não calibração pequena) → bump minor, analytics separa
// limpo "antes vs depois da voz v2.4".
//
// v2.4.1 (2026-05-24): bump PATCH 0.2.0 → 0.2.1 — fix de contaminação
// de exemplos. UAT Evanilce mostrou Sonnet copiando 2/4 exemplos ✅
// LITERAIS do bloco VOICE em "Em poucas palavras" ("tranca o peito
// antes de pedir colo", "raiva engolida") — virou fórmula universal
// disfarçada. Fix: (a) remove exemplos ✅ literais da marca 1 e
// substitui por descrição semântica de como construir frase original;
// (b) EXCLUI "Em poucas palavras" das marcas obrigatórias 1+6
// (conflito com contrato system.md de zero jargão somático nesse bloco).
//
// v2.4.2 (2026-05-24): bump PATCH 0.2.1 → 0.2.2 — calibração estrutural
// §3/§7/§11 via novo bloco STRUCTURAL_OVERRIDE_V2_4_2 (4º system
// block). §3 ordem crescente obrigatória, §7 nome da carência primeiro
// (não categoria), §11 anti-fórmula universal (TRE / Ashwagandha+
// Reishi+Schisandra / Escrita catártica detectadas como defaults em
// 3/3 UAT). Plus extract-phrases capturando resumo §11 pra alimentar
// memória inter-leituras (recent-phrases-context). Stage 1 inalterado.
//
// v2.4.4 (2026-05-24): bump PATCH 0.2.2 → 0.2.3 — duas calibrações:
// (a) §7 PROIBIDO dosagem numérica/frequência/duração (CFM compliance)
//     + audit.ts detecta dosage_hits como backstop runtime.
// (b) Marca 3 do VOICE_OVERRIDE expandida com Tipo A (descrição) vs
//     Tipo B (reframe-translação) — frase de fecho §0 e virada §14
//     precisam redirigir verbo/qualidade do padrão pra cliente em
//     moeda nova, não apenas descrever o que o corpo está fazendo.
//     Critério 6 da auto-checagem cobre. Escape Tipo A honesto se
//     íris não sustenta Tipo B genuíno (evita reframe forçado/Forer).
//
// v2.5.0 (2026-05-24): bump MINOR 0.2.3 → 0.3.0 — mudança arquitetural.
// Novo overlay ANCHORING_PRINCIPLE_V2_5 (5º system block) institui o
// princípio de ancoragem total: Stage 1 = fonte única de verdade;
// achados com natureza='indeterminada' viram skip global em §2/§5/§7/
// §8/§10/§13 (opcional em §12 como nota técnica); §2 é gate cross-
// section (ninguém menciona o que §2 puluou); cofatores §7 só se
// pareados a sistema-âncora em §2. Trigger: Cristiane regen=1 mostrou
// §7+§8 inventando "depleção adrenal" mesmo Stage 1 marcando eixo
// pit-adrenal como indeterminada por midríase. Mitigação anti-checklist
// embutida ("cobertura ≠ enumeração") preserva voz v2.4.4. Bump minor
// porque é mudança arquitetural, não calibração de marca — analytics
// separa limpo "antes vs depois da ancoragem total".
export const STAGE2_METHOD = 'sonnet_2x' as const
export const STAGE2_VERSION = '0.3.0' as const

/**
 * Etapa 2 do pipeline Sonnet 2x — composição streaming ancorada no JSON
 * da Etapa 1. Mesmo contract `{stream, finalize}` que `analyzeReadingDirect`
 * pra o caller (route.ts) não precisar mudar a lógica de stream consumption.
 *
 * Diferenças vs analyzeReadingDirect:
 *   - NÃO envia imagens (Etapa 1 já viu, JSON é o pacto)
 *   - System block 2 = STAGE2_MODE_OVERRIDE (não VISUAL_MODE_OVERRIDE)
 *   - User content = ctx + JSON Etapa 1 + memória recente + instrução
 *
 * Mantém: streaming, cost estimation, cache control no system principal,
 * abort signal handling, finalize() promise contract.
 */
export async function analyzeReadingComposeStage2(
  args: ComposeStage2Args,
): Promise<AnalyzeDirectResult> {
  const startedAt = Date.now()

  const systemPrompt = loadSystemPrompt()
  const userContent = buildStage2UserContent(args)

  const llmStream = anthropicClient.messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: DEFAULT_SYSTEM_CACHE_CONTROL,
        },
        { type: 'text', text: STAGE2_MODE_OVERRIDE },
        // v2.4 (2026-05-23): voz visceral/observador. SEM cache_control
        // — bloco curto e potencialmente iterado rápido durante UAT;
        // cache na primeira pesa, sobrescrever invalida. Após estabilizar
        // pós-UAT, candidate a virar cached.
        { type: 'text', text: VOICE_OVERRIDE_V2_4 },
        // v2.4.2 (2026-05-24): calibração estrutural §3/§7/§11.
        // Separado do VOICE pra responsabilidade clara: VOICE = como
        // (registro/cadência); STRUCTURAL = o quê (ordem/formato/
        // anti-fórmula). Mesmo motivo de SEM cache_control — em UAT
        // ainda, sujeito a iteração rápida.
        { type: 'text', text: STRUCTURAL_OVERRIDE_V2_4_2 },
        // v2.5.0 (2026-05-24): princípio de ancoragem total. Stage 1 =
        // fonte única de verdade; achados com natureza='indeterminada'
        // viram skip global; §2 é gate cross-section. Mesmo motivo de
        // SEM cache_control — UAT ativo, mudança arquitetural sujeita a
        // calibração nas primeiras leituras pós-deploy.
        { type: 'text', text: ANCHORING_PRINCIPLE_V2_5 },
      ],
      messages: [{ role: 'user', content: userContent }],
    },
    { maxRetries: 0 },
  )

  if (args.signal) {
    args.signal.addEventListener('abort', () => {
      try {
        llmStream.controller.abort()
      } catch {
        // already ended — no-op
      }
    })
  }

  async function* toTextStream(): AsyncIterable<string> {
    for await (const event of llmStream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }

  async function finalize(): Promise<AnalyzeDirectFinalization> {
    const final = await llmStream.finalMessage()
    const usage = {
      input_tokens: final.usage.input_tokens ?? 0,
      output_tokens: final.usage.output_tokens ?? 0,
      cache_creation_input_tokens: final.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: final.usage.cache_read_input_tokens ?? 0,
    }
    const latencyMs = Date.now() - startedAt
    const cost = estimateCostUsd(usage)

    console.info({
      event: 'llm_generate_stage2',
      reading_id: args.readingId,
      therapist_id: args.therapistId,
      method_version: STAGE2_METHOD_VERSION,
      model_version: MODEL,
      n_images: 0, // Stage 2 não envia imagens
      latency_ms: latencyMs,
      tokens_in: usage.input_tokens,
      tokens_out: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens,
      cost_estimate_usd: Number(cost.toFixed(4)),
    })

    return {
      usage,
      latency_ms: latencyMs,
      cost_estimate_usd: cost,
      n_images: 0,
    }
  }

  return { stream: toTextStream(), finalize }
}
