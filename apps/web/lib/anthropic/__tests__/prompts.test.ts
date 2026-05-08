// Wave-0 stub — preenchido em 07-03-PLAN (prompts loader + cache_control threshold).
// Source: 07-VALIDATION.md line 57, 07-RESEARCH.md line 1082, Pitfall 4.
import { describe, it } from 'vitest'

describe('lib/anthropic/prompts — file content', () => {
  it.todo('system.md contém "Princípios de operação"')
  it.todo('system.md contém os 13 headings "### N. " (1..13)')
  it.todo('feature-injection.md contém placeholders {{client_name}}, {{vision_features_json}}, {{rag_chunks_concatenated_with_citations}}')
})

describe('lib/anthropic/prompts — token-count threshold (Pitfall 4)', () => {
  it.todo('system.md tem >= 2200 tokens estimados (Sonnet 4.6 cache_control threshold 2048 + margem)')
})

describe('lib/anthropic/prompts — renderInjection mustache substitution', () => {
  it.todo('substitui {{vision_features_json}} pelo JSON.stringify das features')
  it.todo('substitui {{rag_chunks_concatenated_with_citations}} pela string de chunks')
  it.todo('placeholders não-existentes ficam vazios, não literal {{...}}')
})

describe('lib/anthropic/prompts — ENCERRAMENTO_LITERAL invariant (A4)', () => {
  it.todo('ENCERRAMENTO_LITERAL casa SPEC §6 linhas 624-627 byte-exact')
})
