/**
 * Gerador do RELATÓRIO EMOCIONAL ("Mapa do Ser") — o 2º tipo de relatório.
 *
 * Roda a partir do MESMO Stage 1 da leitura que já existe (`report_findings.exame_json`),
 * então não captura foto nova nem chama o Stage 1 de novo: é só uma segunda leitura do
 * mesmo dado, com outro motor e outro prompt.
 *
 * ⚠️ O motor vive em `_motor-lab/` e é o MESMO que o lab usa — de propósito. Manter uma
 * cópia em lib/ garantiria deriva: o método somático de 7 movimentos ficou 7 dias
 * aprovado num HTML sem chegar ao prompt justamente porque existia em dois lugares.
 * Os módulos resolvem os próprios caminhos por import.meta.url, então funcionam tanto
 * com cwd=raiz-do-repo (lab) quanto cwd=apps/web (Next).
 *
 * Bundle: os .md/.html de lastro precisam de `outputFileTracingIncludes` no next.config,
 * senão dá ENOENT no primeiro request (mesmo pitfall já documentado para system.md).
 */
import 'server-only'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
// módulo .mjs sem tipos, compartilhado com o lab (ver nota acima)
import { serialize as _serialize } from '../../_motor-lab/serialize.mjs'
const serialize = _serialize as (exame: unknown, nome: string) => string

const LAB = path.join(process.cwd(), '_motor-lab')
export const PROMPT_VERSION = 'emocional_0.1.0'
const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 24000

let _system: string | null = null
function systemPrompt(): string {
  // cacheado no módulo — o arquivo tem ~44 KB e não muda entre requests
  if (_system === null) {
    _system = readFileSync(path.join(LAB, 'prompts/stage2-relatorio-novo-DRAFT.md'), 'utf8')
  }
  return _system
}

export type ResultadoEmocional = {
  markdown: string
  metadata: {
    model: string
    prompt_version: string
    tokens_in: number
    tokens_out: number
    latency_ms: number
    words: number
  }
}

/**
 * @param exame  o `exame_json` do Stage 1 (objeto, direto do banco)
 * @param nome   nome do cliente, para o vocativo
 * @param onText callback OPCIONAL por delta de texto. Existe porque o Mapa do Ser
 *   virou o relatório principal (2026-07-30) e a geração leva ~3 min: sem repassar
 *   o texto, o terapeuta encara uma tela parada. Quem não passa o callback (a rota
 *   /emocional das leituras antigas) segue exatamente como antes.
 */
export async function gerarRelatorioEmocional(
  exame: Record<string, unknown>,
  nome: string,
  onText?: (delta: string) => void,
): Promise<ResultadoEmocional> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente')

  const blocosBC: string = serialize(exame, nome)
  const system = systemPrompt()

  const client = new Anthropic({ apiKey })
  const t0 = Date.now()

  // streaming é obrigatório: a saída passa de 20k tokens e a chamada pode ultrapassar
  // o limite de resposta não-streamed da SDK.
  const stream = client.messages
    .stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `<contexto_cliente>\nNome: ${nome}\n</contexto_cliente>` },
            {
              type: 'text',
              text: `# BLOCO A — STAGE 1 (bruto)\n\`\`\`json\n${JSON.stringify(exame, null, 2)}\n\`\`\``,
            },
            { type: 'text', text: blocosBC },
            {
              type: 'text',
              text: 'Gere agora o Documento do Cliente completo, na voz do cliente. Só o documento — sem preâmbulo, sem JSON, sem encerramento.',
            },
          ],
        },
      ],
    })

  // O repasse é best-effort e NÃO pode derrubar a geração: se o consumidor
  // (a conexão do terapeuta) já fechou, `onText` throw — e perder o relatório
  // inteiro porque o navegador saiu seria o mesmo bug do UAT 2026-05-20.
  if (onText) {
    stream.on('text', (delta) => {
      try {
        onText(delta)
      } catch {
        /* consumidor foi embora — a geração continua e persiste no banco */
      }
    })
  }

  const msg = await stream.finalMessage()

  const markdown = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  if (!markdown.trim()) throw new Error('resposta vazia do modelo')

  return {
    markdown,
    metadata: {
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      tokens_in: msg.usage.input_tokens,
      tokens_out: msg.usage.output_tokens,
      latency_ms: Date.now() - t0,
      words: markdown.trim().split(/\s+/).length,
    },
  }
}
