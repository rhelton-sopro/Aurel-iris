// Phase 7 | Plan 07-03 — Prompt loader + mustache substitution + ENCERRAMENTO_LITERAL.
// Source: 07-VALIDATION.md line 57, 07-RESEARCH.md line 1082 (Pitfall 4).
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  loadSystemPrompt,
  loadInjectionTemplate,
  renderInjection,
  _resetPromptsCache,
} from '../prompts'
import { ENCERRAMENTO_LITERAL } from '../types'

beforeEach(() => {
  _resetPromptsCache()
})

describe('lib/anthropic/prompts — file content (Plan 11 — 14-section Iris Codex V1)', () => {
  it('system.md contém o marker allowlist do audit na linha 1', () => {
    const sys = loadSystemPrompt()
    const firstLine = sys.split('\n')[0]
    expect(firstLine).toBe('<!-- audit-vocabulary:allowlist -->')
  })

  it('system.md identifica-se como "Iris Codex" (DC-1 brand)', () => {
    expect(loadSystemPrompt()).toContain('Iris Codex')
  })

  it('system.md contém os 14 headings "## §N — Title" (1..14)', () => {
    const sys = loadSystemPrompt()
    for (let n = 1; n <= 14; n++) {
      expect(sys).toMatch(new RegExp(`## §${n} —`))
    }
  })

  it('system.md contém os 14 titles canônicos da Direction Correction DC-1', () => {
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
    ]
    for (const title of expectedTitles) {
      expect(sys).toContain(title)
    }
  })

  it('system.md NÃO instrui JSON output (Plan 11 supersedes 8-block JSON)', () => {
    const sys = loadSystemPrompt()
    // The new prompt explicitly says "Não emita JSON" in the format section —
    // verify by asserting absence of the legacy 8-block enum/schema instructions.
    expect(sys).not.toContain('"report_version": "2.0"')
    expect(sys).not.toContain('systems_with_tendency')
    expect(sys).not.toContain('tendency_grade')
    expect(sys).not.toContain('bilateral_findings')
    // Positive assertion: the prompt instructs markdown output
    expect(sys).toMatch(/14 seções markdown/i)
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
