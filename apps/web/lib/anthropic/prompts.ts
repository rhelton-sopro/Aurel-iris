/**
 * Prompt loader + mustache substitution for Phase 7 LLM analysis.
 *
 * Files: `apps/web/prompts/system.md` + `apps/web/prompts/feature-injection.md`.
 * Ambos são cópias LITERAIS de SPEC.md §6 (D-PR1 frozen contract — sem rewrite).
 *
 * Vercel deploy: `next.config.ts` `outputFileTracingIncludes` traceia
 * `prompts/**\/*` para o bundle do route analyze (Pitfall 9 RESEARCH). Sem
 * essa config, prod 500s com ENOENT no primeiro request.
 *
 * Token count: `loadSystemPrompt()` avisa no module init se system.md estimar
 * < 2200 tokens (Sonnet 4.6 cache_control threshold 2048 + margem). Abaixo do
 * threshold, cache_control fica silently disabled e o custo sobe ~10x. O
 * estimador char/4 é heurística — integration smoke confirma com
 * `client.messages.countTokens` no caminho real.
 *
 * Phase 7 | Plan 07-03 | Decisions: D-PR1, RESEARCH Pitfall 4 + Pitfall 9
 */
import 'server-only'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

let _systemCache: string | null = null
let _injectionCache: string | null = null
let _systemVersionCache: string | null = null

const PROMPTS_DIR = path.join(process.cwd(), 'prompts')

/**
 * Threshold para emitir warn quando system.md estiver curto demais para que
 * o cache_control do Anthropic seja ativado (Sonnet 4.6 = 2048 tokens; usamos
 * 2200 como margem de segurança contra estimativas char/4 imprecisas).
 */
const CACHE_CONTROL_TOKEN_MARGIN = 2200
const CHARS_PER_TOKEN_ESTIMATE = 4

/**
 * Versionamento ao vivo do prompt do relatório (founder UAT 2026-05-22).
 * Default = v2 (system.md). Setar env `REPORT_PROMPT_VERSION=v1` força o
 * fallback pra system-v1.md (snapshot do estado pré-v2). Permite rollback
 * sem revert no git: muda env no Vercel e redeploya.
 *
 * Toda nova versão segue o mesmo padrão: cópia atual vira system-v{N-1}.md,
 * system.md recebe a nova versão.
 */
function resolvePromptFile(): string {
  const version = process.env.REPORT_PROMPT_VERSION?.trim().toLowerCase()
  if (version === 'v1') return 'system-v1.md'
  return 'system.md'
}

export function loadSystemPrompt(): string {
  if (_systemCache !== null) return _systemCache
  const filepath = path.join(PROMPTS_DIR, resolvePromptFile())
  _systemCache = readFileSync(filepath, 'utf8')
  // Pitfall 4 — token-count check no first load.
  // Aproximação: 1 token ≈ 4 chars para pt-BR + estrutura markdown.
  // Para precisão Anthropic, rodar client.messages.countTokens em deploy-smoke.
  const estimatedTokens = Math.ceil(_systemCache.length / CHARS_PER_TOKEN_ESTIMATE)
  if (estimatedTokens < CACHE_CONTROL_TOKEN_MARGIN) {
    console.warn(
      `[lib/anthropic/prompts] system.md ~${estimatedTokens} tokens estimados, ` +
        `abaixo da margem ${CACHE_CONTROL_TOKEN_MARGIN} (Sonnet 4.6 cache_control ` +
        `threshold = 2048). Prompt caching pode estar silently disabled — custo ~10x. ` +
        `Pitfall 4 RESEARCH.`,
    )
  }
  return _systemCache
}

/**
 * Label humano da versão do prompt de geração de relatório (semver).
 * Bumpe MANUALMENTE quando:
 *   - major (v2.0.0): redesign estrutural (nova arquitetura de seções,
 *     mudança de modelo, troca de método);
 *   - minor (v1.1.0): mudança de comportamento (regra nova/removida,
 *     seção nova, novo bloco de exemplos);
 *   - patch (v1.0.1): polimento / correção de copy / threshold de
 *     calibração / pequenas substituições.
 *
 * v1.0.0 = beta launch state pós-Plan 7.4-36 + UAT 2026-05-20 (essence
 * phrase 60w + flash 2-com-1-sem-protocolo + sonnet-direct estável).
 * Founder UAT-aprovado em iriscodex.com 2026-05-20.
 *
 * v2.0.0 (2026-05-22) = anti-template push: §7 lista TODAS as carências
 * sustentadas (não 2-4 "principais"); §10 arquétipo deve emergir da
 * combinação ÚNICA desta íris (banido template "escuta interior em meio
 * ao ruído" como default); §11.Práticas contemplativas seleciona por
 * padrão sistêmico (calmar/ativar/liberar) — sem "meditação respiratória"
 * default; sweep anti-Forer reforçado em §7/§10/§11. Snapshot v1 fica
 * recuperável via env REPORT_PROMPT_VERSION=v1.
 *
 * v2.1.0 (2026-05-22) = §11 anti-template EXPANDIDO pras outras 5
 * categorias (Nutrição, Fitoterapia, Práticas corporais, Florais,
 * Adaptógenos). Cada categoria tem defaults proibidos explícitos +
 * eixos de seleção ancorados em achados §1-§10. Teste meta-§11
 * obrigatório no final ("releia 18 bullets — funcionaria pra outra íris?").
 *
 * Pareado com getSystemPromptVersion() (sha curto) — label é o nome
 * humano, sha é a impressão digital exata do conteúdo (varia a cada
 * edit; label só varia quando você bumpa).
 */
export const REPORT_PROMPT_LABEL = (
  process.env.REPORT_PROMPT_VERSION?.trim().toLowerCase() === 'v1'
    ? 'v1.0.0'
    : 'v2.1.0'
) as 'v1.0.0' | 'v2.1.0'

/**
 * Stable short fingerprint of the EFFECTIVE system.md content (12 hex chars
 * of sha256). Persisted per generation in `report_generations.prompt_version`
 * so production quality/cost shifts can be attributed to prompt iteration vs
 * model change (07.4-36 founder amendment). Derived from the same cached
 * buffer as `loadSystemPrompt()` — no extra disk read; cache reset by
 * `_resetPromptsCache` (test only).
 */
export function getSystemPromptVersion(): string {
  if (_systemVersionCache !== null) return _systemVersionCache
  _systemVersionCache = createHash('sha256')
    .update(loadSystemPrompt())
    .digest('hex')
    .slice(0, 12)
  return _systemVersionCache
}

export function loadInjectionTemplate(): string {
  if (_injectionCache !== null) return _injectionCache
  const filepath = path.join(PROMPTS_DIR, 'feature-injection.md')
  _injectionCache = readFileSync(filepath, 'utf8')
  return _injectionCache
}

/**
 * Mustache-style substitution: `{{name}}` → vars[name] || ''.
 * Chaves ausentes substituem para empty string (não literal `{{name}}`) para
 * placeholders unrendered não vazarem para o LLM como instruções.
 *
 * Regex restritivo `[\w_]+` (alfanumérico/underscore apenas) — defesa contra
 * T-7-INJECTION (prompt injection via template). Valores das vars vêm de
 * server-controlled state (vision_features JSON server-validated, RAG chunks
 * da base de conhecimento Fase 6), nunca user input direto.
 */
export function renderInjection(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([\w_]+)\}\}/g, (_, key) => vars[key] ?? '')
}

/** Reset module cache — TEST ONLY. Production callers MUST NOT call this. */
export function _resetPromptsCache(): void {
  _systemCache = null
  _injectionCache = null
  _systemVersionCache = null
}
