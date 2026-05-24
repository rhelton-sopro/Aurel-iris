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

export const STAGE2_METHOD_VERSION = 'sonnet_2x_0.2.1' as const

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
export const STAGE2_METHOD = 'sonnet_2x' as const
export const STAGE2_VERSION = '0.2.1' as const

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
