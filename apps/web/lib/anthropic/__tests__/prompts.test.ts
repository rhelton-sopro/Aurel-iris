// Phase 7 | Plan 07-03 — Prompt loader + mustache substitution + ENCERRAMENTO_LITERAL.
// Source: 07-VALIDATION.md line 57, 07-RESEARCH.md line 1082 (Pitfall 4).
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  loadSystemPrompt,
  loadInjectionTemplate,
  renderInjection,
  getSystemPromptVersion,
  _resetPromptsCache,
} from '../prompts'
import { ENCERRAMENTO_LITERAL } from '../types'

beforeEach(() => {
  _resetPromptsCache()
})

describe('lib/anthropic/prompts — getSystemPromptVersion (07.4-36)', () => {
  it('é 12 hex chars, estável entre chamadas, e = sha256(system.md).slice(0,12)', () => {
    const v = getSystemPromptVersion()
    expect(v).toMatch(/^[0-9a-f]{12}$/)
    expect(getSystemPromptVersion()).toBe(v) // cached / deterministic
    const expected = createHash('sha256')
      .update(loadSystemPrompt())
      .digest('hex')
      .slice(0, 12)
    expect(v).toBe(expected)
  })
})

describe('lib/anthropic/prompts — file content (Plan 21 — 16-section Iris Codex V1, no § symbol)', () => {
  it('system.md contém o marker allowlist do audit na linha 1', () => {
    const sys = loadSystemPrompt()
    const firstLine = sys.split('\n')[0]
    expect(firstLine).toBe('<!-- audit-vocabulary:allowlist -->')
  })

  it('system.md identifica-se como "Iris Codex" (DC-1 brand)', () => {
    expect(loadSystemPrompt()).toContain('Iris Codex')
  })

  it('system.md contém os 15 headings "## N. Title" (1..15 sequencial)', () => {
    const sys = loadSystemPrompt()
    const expectedNumbers = [
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15',
    ]
    for (const n of expectedNumbers) {
      expect(sys).toContain(`## ${n}.`)
    }
    // Plan 27: §2.5 collapsed into §2 — no decimal heading remains.
    expect(sys).not.toContain('## 2.5.')
    expect(sys).not.toContain('## 16.')
  })

  it('system.md contém os 15 titles canônicos (Plan 27 — Síntese Rápida = §15)', () => {
    const sys = loadSystemPrompt()
    const expectedTitles = [
      'Constituição e Temperamento',
      'Mapa Orgânico',
      'Linha do Tempo Emocional',
      'Padrões Emocionais Ativos',
      'Eixo Psicossomático',
      'Heranças Transgeracionais',
      'Carências Funcionais',
      'Estado Mental e Nervoso',
      'Recursos e Forças',
      'Dimensão Arquetípica',
      'Sugestões Integrativas',
      'Roteiro de Anamnese',
      'Síntese Integrativa',
      'Mensagem para o Cliente',
      'Síntese Rápida',
    ]
    for (const title of expectedTitles) {
      expect(sys).toContain(title)
    }
  })

  it('system.md preserva a regra clínica pigmento/lacuna em linguagem VISUAL, sem termos JSON (07.4-35 cleanup, decisão C)', () => {
    const sys = loadSystemPrompt()
    // Clinical principle SURVIVES the Sonnet-direct cleanup...
    expect(sys).toMatch(/Leitura visual/i)
    expect(sys).toMatch(/pigment/i)
    expect(sys).toMatch(/lacuna/i)
    // pigment ≠ lacuna, both directions
    expect(sys).toMatch(/Pigmento n[ãa]o é lacuna e lacuna n[ãa]o é pigmento/i)
    // sector without cavity but with dense pigment = LOADED, not clean
    expect(sys).toMatch(/n[ãa]o significa setor limpo/i)
    expect(sys).toContain('CARREGADO')
    // respect the observed asymmetry direction
    expect(sys).toMatch(/assimetria observada/i)
    // ...but the JSON/pipeline scaffolding is GONE (the whole point of C):
    expect(sys).not.toContain('sectoral_pigments')
    expect(sys).not.toContain('asymmetry_notes')
    expect(sys).not.toContain('carga_pigmentar_assimetrica')
    expect(sys).not.toContain('findings[]')
    expect(sys).not.toContain('<features>')
  })

  it('system.md: "Em poucas palavras" é o ÚLTIMO bloco (pós-§15) com contrato de âncora visual + comprimento (07.4-36)', () => {
    const sys = loadSystemPrompt()
    // Imperative, unmissable, still mandatory.
    expect(sys).toContain('## Em poucas palavras')
    // Legacy heading must be fully gone from the prompt (only the parser
    // keeps the backward-compat alternative for stored buffers).
    expect(sys).not.toContain('## Em uma palavra')
    expect(sys).toMatch(/OBRIGAT[ÓO]RIO/i)
    expect(sys).toMatch(/NÃO PULE|N[ÃA]O pule|não pule/i)
    // NEW contract: generated LAST, AFTER §15 — NOT before §1.
    expect(sys).toMatch(/[ÚU]LTIMO bloco|depois da §15|DEPOIS da §15/i)
    expect(sys).toMatch(/come[çc]e direto na seção 1|primeiro conteúdo do output é literalmente/i)
    // Hard visual-anchor contract (the anti-Forer core of the fix).
    expect(sys).toMatch(/Contrato de ancoragem visual/i)
    expect(sys).toMatch(/estrutura VIS[ÍI]VEL/i)
    expect(sys).toMatch(/Forer/i)
    // 07.4-36: ceiling widened to 15-30 words; the OLD 15-25 must be gone.
    expect(sys).toMatch(/15-30 palavras/)
    expect(sys).not.toMatch(/15-25 palavras/)
    // Hard length-regen contract: >30 words ⇒ regenerate (founder Check 1).
    expect(sys).toMatch(/mais de 30 palavras/i)
    expect(sys).toMatch(/regerar/i)
    // The OLD "antes da seção 1" essence instruction must be GONE.
    expect(sys).not.toMatch(/primeir[íi]ssimo conte[úu]do/i)
  })

  it('system.md NÃO instrui JSON output (Plan 11 supersedes 8-block JSON)', () => {
    const sys = loadSystemPrompt()
    // The new prompt explicitly says "Não emita JSON" in the format section —
    // verify by asserting absence of the legacy 8-block enum/schema instructions.
    expect(sys).not.toContain('"report_version": "2.0"')
    expect(sys).not.toContain('systems_with_tendency')
    expect(sys).not.toContain('tendency_grade')
    expect(sys).not.toContain('bilateral_findings')
    // Positive assertion: the prompt instructs markdown output (15 seções)
    expect(sys).toMatch(/15 seções markdown/i)
  })

  it('feature-injection.md contém placeholders mustache canônicos', () => {
    const inj = loadInjectionTemplate()
    expect(inj).toContain('{{client_name}}')
    expect(inj).toContain('{{vision_features_json}}')
    expect(inj).toContain('{{rag_chunks_concatenated_with_citations}}')
  })

  it('module-scope cache: segunda chamada de loadSystemPrompt não relê o disco', () => {
    const a = loadSystemPrompt()
    const b = loadSystemPrompt()
    // Mesma referência por causa do cache em module scope.
    expect(a).toBe(b)
  })
})

describe('lib/anthropic/prompts — token-count threshold (Pitfall 4)', () => {
  // Pitfall 4 (07-RESEARCH.md): Sonnet 4.6 ativa cache_control somente se o
  // system block tem >= 2048 tokens; abaixo, cache silently disabled e custo
  // sobe ~10x. system.md atual (~1600 tokens estimados) está ABAIXO desse
  // threshold — o loader emite console.warn quando isso acontece (defesa em
  // profundidade; integration smoke verifica cache_creation_input_tokens > 0
  // na primeira call real).
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('emite console.warn se system.md estimado < 2200 tokens (Pitfall 4 margin)', () => {
    loadSystemPrompt()
    // system.md atual está abaixo do threshold — o warn DEVE ser chamado.
    // Quando o prompt-base for expandido pós-dogfooding (e.g. exemplos few-shot
    // que empurrem para >= 2200 tokens), este teste deve flipar para
    // expect(warnSpy).not.toHaveBeenCalled() — sinalizando que o cache está
    // ativo. A inversão futura é registro vivo da decisão.
    const lengthChars = loadSystemPrompt().length
    const estimatedTokens = Math.ceil(lengthChars / 4)
    if (estimatedTokens < 2200) {
      expect(warnSpy).toHaveBeenCalled()
      const msg = warnSpy.mock.calls.flat().join(' ')
      expect(msg).toMatch(/Pitfall 4|cache_control|2048|threshold/i)
    } else {
      expect(warnSpy).not.toHaveBeenCalled()
    }
  })
})

describe('lib/anthropic/prompts — renderInjection mustache substitution', () => {
  it('substitui {{vision_features_json}} pelo JSON.stringify das features', () => {
    const out = renderInjection('Features: {{vision_features_json}}', {
      vision_features_json: '{"a":1}',
    })
    expect(out).toBe('Features: {"a":1}')
  })

  it('substitui múltiplos placeholders na mesma string', () => {
    const out = renderInjection('Cliente: {{client_name}} ({{age}})', {
      client_name: 'Maria',
      age: '42',
    })
    expect(out).toBe('Cliente: Maria (42)')
  })

  it('placeholders não-existentes ficam vazios, não literal {{...}}', () => {
    const out = renderInjection('Nada: {{unknown}}', {})
    expect(out).toBe('Nada: ')
    expect(out).not.toContain('{{')
  })

  it('preserva texto sem placeholders', () => {
    const out = renderInjection('Sem placeholders aqui.', {})
    expect(out).toBe('Sem placeholders aqui.')
  })
})

describe('lib/anthropic/prompts — Plan 16 absolute rules + structural restructures', () => {
  it('contém o bloco "Regras absolutas (mandatórias)" com as 7 regras nomeadas', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('## Regras absolutas (mandatórias)')
    expect(sys).toContain('Regra 1 — Nunca cite autores')
    expect(sys).toContain('Regra 2 — Nunca cite escolas')
    // 07.4-35 fix 1: Regra 3 hardened (title now covers olho-lateralization).
    expect(sys).toMatch(/Regra 3 — Sem coordenadas NEM lateraliza[çc][ãa]o de olho/i)
    expect(sys).toContain('Regra 4 — §3 Linha do Tempo: APENAS 4 campos clínicos')
    expect(sys).toContain('Regra 5 — §10 Arquetípica abre simbolicamente')
    expect(sys).toContain('Regra 6 — §13 Síntese: apenas temas humanos')
    expect(sys).toContain('Regra 7 — §1 Polimento')
  })

  it('Regra 1 lista os autores que nunca devem aparecer (allowlisted file)', () => {
    const sys = loadSystemPrompt()
    // The rule block names the authors so Sonnet knows what NOT to say.
    // Allowlist marker on line 1 keeps audit-vocabulary.mjs happy.
    expect(sys).toMatch(/Jensen[\s\S]*Lo Rito[\s\S]*Battello[\s\S]*Moraga/)
  })

  it('Regra 2 lista as escolas/tradições que nunca devem aparecer', () => {
    const sys = loadSystemPrompt()
    expect(sys).toMatch(/escola alemã[\s\S]*italiana[\s\S]*americana/)
    expect(sys).toContain('medicina tradicional chinesa')
    expect(sys).toContain('Cronorichio')
  })

  it('§3 instructions include the 4 mandatory field labels', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('**Período de vida:**')
    expect(sys).toContain('**O que pode ter acontecido:**')
    expect(sys).toContain('**Tipo de bloqueio/trauma:**')
    expect(sys).toContain('**Status atual:**')
  })

  it('§3 instructions include the 3 verbatim Status atual phrases', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('Resolvido — marca cicatrizada, sem expressão atual')
    expect(sys).toContain('Em processo — organismo trabalhando ativamente esse campo')
    expect(sys).toContain('A resolver — marca ativa, pede atenção terapêutica')
  })

  it('§3 instructions include the INTERNAL vs VISIBLE separation language', () => {
    const sys = loadSystemPrompt()
    expect(sys).toMatch(/INTERNAL[\s\S]*VISIBLE/)
    expect(sys).toMatch(/skip-rather-than-fabricate/i)
  })

  it('§2 contém as duas subseções (atenção + bom funcionamento) com critérios de ancoragem', () => {
    const sys = loadSystemPrompt()
    // Plan 27: §2.5 collapsed into §2 as a `### ` subsection.
    expect(sys).toContain('## 2. Mapa Orgânico')
    expect(sys).toContain('### Sistemas que requerem atenção')
    expect(sys).toContain('### Sistemas em bom funcionamento')
    expect(sys).toMatch(/Ausência de marcas no setor esperado/)
    expect(sys).toMatch(/Zonas claras\/íntegras/)
    expect(sys).toMatch(/Marcadores estruturais positivos/)
    expect(sys).toMatch(/5 sistemas/)
  })

  it('§10 instructions enforce symbolic opening (not anatomical)', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('§10 ABRE com a leitura arquetípica')
    expect(sys).toMatch(/NÃO abra com inventário anatômico/)
  })

  it('§13 instructions enforce no-sector-no-hour-no-eye prohibition', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('§13 NÃO tem referência a setor')
    expect(sys).toMatch(/sem coordenadas/)
  })

  it('§1 polimento table includes the 3 mappings', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('densidade fibrilar alta')
    expect(sys).toContain('fibras compactas e densas')
    expect(sys).toContain('colarete regular')
    expect(sys).toContain('anel interno regular e bem posicionado')
    expect(sys).toContain('hepatobiliar')
    expect(sys).toContain('do fígado e vesícula')
  })
})

describe('lib/anthropic/prompts — Plan 21 UAT-4 fixes (§ removal + §1 breathing + §12 numbered + §16 Síntese Rápida)', () => {
  it('§1 instrução de parágrafos curtos (3-5 frases) com respiração', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('parágrafos CURTOS')
    expect(sys).toContain('3-5 frases')
    expect(sys).toMatch(/respiração visual|linha em branco/i)
  })

  it('§1 polimento table extended with Plan 21 mappings', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('anel digestivo interno')
    expect(sys).toContain('fibrilar (qualquer uso)')
    expect(sys).toContain('sinais setoriais')
    expect(sys).toContain('organização funcional de base')
  })

  it('§12 explicit numbered markdown list instruction', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('lista numerada markdown')
    // The example block in §12 should show numbered list format
    expect(sys).toMatch(/1\.\s+Você notou/)
  })

  it('§15 Síntese Rápida section exists with 6 mandatory subsections', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('## 15. Síntese Rápida')
    expect(sys).toContain('### 🔴 Fragilidades')
    expect(sys).toContain('### 🟢 Forças')
    expect(sys).toContain('### 💛 Emoções a Cuidar')
    expect(sys).toContain('### ✨ Potências')
    expect(sys).toContain('### 🧭 Perfil e Temperamento')
    expect(sys).toContain('### 🌱 Aptidões')
  })

  it('§16 instructions include "Específico desta íris" rule', () => {
    const sys = loadSystemPrompt()
    expect(sys).toContain('Específico desta íris')
  })

  it('Format de saída instructs `## N. Title` (NOT `## §N — Title`)', () => {
    const sys = loadSystemPrompt()
    // Positive: at least one canonical example uses period-separator format
    expect(sys).toContain('## 1. Constituição e Temperamento')
    expect(sys).toContain('## 15. Síntese Rápida')
    // Negative-rule instruction acknowledges the old format is abandoned
    expect(sys).toContain('NÃO emita `## §N — Título`')
  })

  it('Format de saída instrui sequência estrita 1..15 (sem fração, sem pulo)', () => {
    const sys = loadSystemPrompt()
    expect(sys).toMatch(/15 seções markdown/i)
    expect(sys).toMatch(/estritamente sequencial|estrita 1\.\.15|sem fração/i)
    expect(sys).not.toMatch(/skip 15|pula de 14 para 16/i)
  })
})

describe('lib/anthropic/types — ENCERRAMENTO_LITERAL invariant (SC4)', () => {
  // Estes asserts validam shape/conteúdo do encerramento literal SPEC §6 sem
  // citar os 3 termos LGPD-06 explicitamente (defesa contra self-match do
  // audit-vocabulary; o conteúdo dos termos vive apenas em ENCERRAMENTO_LITERAL
  // dentro de types.ts, que carrega o marker audit-vocabulary:allowlist).
  it('contém literal de apoio à anamnese terapêutica', () => {
    expect(ENCERRAMENTO_LITERAL).toContain(
      'Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica',
    )
  })

  it('é blockquote markdown de 4 linhas começando com "> "', () => {
    const lines = ENCERRAMENTO_LITERAL.split('\n')
    expect(lines.length).toBe(4)
    for (const line of lines) {
      expect(line.startsWith('> ')).toBe(true)
    }
  })

  it('contém negação explícita de natureza clínica/diagnóstica (defesa LGPD)', () => {
    // Sem trailing newline além do que o blockquote tem.
    expect(ENCERRAMENTO_LITERAL.endsWith('contexto integral.')).toBe(true)
    // Caracteres exatos da negação canônica.
    expect(ENCERRAMENTO_LITERAL).toContain('Não constitui')
    expect(ENCERRAMENTO_LITERAL).toContain('substitui avaliação clínica profissional')
  })
})
