import { describe, it, expect } from 'vitest'
import { findAllBoundaries, closeSections } from '../parser'

describe('lib/anthropic/parser — findAllBoundaries (D-S2 + Pitfall 2)', () => {
  it('detecta single boundary em buffer simples', () => {
    const buf = '### 1. Constituição\nFoo bar baz.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ number: 1, key: '1_constituicao' })
    expect(result[0].startIdx).toBe(0)
  })

  it('detecta 3 boundaries sequenciais 1, 2, 3', () => {
    const buf = `### 1. Constituição
Foo.
### 2. Estrutural Física
Bar.
### 3. Indicações Sistêmicas
Baz.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(3)
    expect(result.map((b) => b.number)).toEqual([1, 2, 3])
    expect(result.map((b) => b.key)).toEqual([
      '1_constituicao',
      '2_estrutural_fisica',
      '3_indicacoes_sistemicas',
    ])
  })

  it('rejeita number=0 (Pitfall 2 — out of range)', () => {
    const buf = '### 0. Prólogo\n### 1. Constituição\nFoo.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0].number).toBe(1)
  })

  it('rejeita number=14 (Pitfall 2 — out of range)', () => {
    // Para isolar o filtro de range (1..13), o buffer precisa primeiro satisfazer
    // monotonia 1..13 (lastNumber+1) — só então o `### 14.` exercita exclusivamente
    // o branch `number > 13`. Test 5 cobre monotonia em isolado.
    const head = Array.from({ length: 13 }, (_, i) => `### ${i + 1}. Seção ${i + 1}\nConteúdo.`).join('\n')
    const buf = `${head}\n### 14. Bibliografia\nDrift fora do range.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(13)
    expect(result.map((b) => b.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it('rejeita boundary não-monotônica crescente (Pitfall 2)', () => {
    // After 1, sees 5 (not 2). 5 is rejected because lastNumber + 1 = 2, mismatch.
    // Then 2 satisfies lastNumber + 1 = 2.
    const buf = '### 1. Constituição\nFoo.\n### 5. Salto\nDrift.\n### 2. Estrutural\nReal.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.number)).toEqual([1, 2])
  })

  it('ignora pseudo-heading inline em corpo (Pitfall 2 — false positive)', () => {
    // `### 7.5 Detalhe` (decimal) is rejected because regex requires `\d{1,2}\.`
    // followed by `\s+` AND only matches at LINE START in /m mode.
    // `Tabela 4. exemplo` is rejected because no `### ` prefix.
    const buf = `### 1. Constituição
Veja a Tabela 4. de exemplo na página 7.
Inline ### 7.5 Detalhe técnico (não é boundary).
### 2. Estrutural Física
Bar.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.number)).toEqual([1, 2])
  })

  it('aceita 13 boundaries 1..13 sequenciais (happy path full report)', () => {
    const buf = Array.from({ length: 13 }, (_, i) => `### ${i + 1}. Seção ${i + 1}\nConteúdo.`).join('\n')
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(13)
    expect(result.map((b) => b.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it('retorna lista vazia para buffer sem boundaries', () => {
    const buf = 'Apenas texto sem nenhum heading aqui.'
    expect(findAllBoundaries(buf)).toEqual([])
  })

  it('regex global state não vaza entre chamadas (lastIndex reset)', () => {
    const buf = '### 1. Constituição\n'
    expect(findAllBoundaries(buf)).toHaveLength(1)
    expect(findAllBoundaries(buf)).toHaveLength(1) // second call must produce same result
  })

  it('aceita "## " (H2) como boundary — Sonnet 4.6 às vezes adiciona H1 doc title e bump sections para H2', () => {
    // Real raw observed in dogfooding 2026-05-08: Sonnet emitted `# Doc Title`,
    // `## Client Subtitle`, then `## 1. Constituição`, `## 2. Estrutural`, etc.
    // Parser must accept both H2 and H3 to handle both heading depths.
    const buf = `# Documento
## Subtítulo de cliente
## 1. Constituição
Foo.
## 2. Estrutural
Bar.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.number)).toEqual([1, 2])
  })

  it('rejeita "# " (H1) e "#### " (H4) — só H2/H3 são aceitos', () => {
    const buf = '# 1. Não é boundary\n### 1. Constituição\n#### 2. Não é boundary'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0].number).toBe(1)
  })
})

describe('lib/anthropic/parser — closeSections', () => {
  it('produz lista de ClosedSection com conteúdo trimmed entre boundaries', () => {
    const buf = `### 1. Constituição
Texto da seção 1.

### 2. Estrutural Física
Texto da seção 2.`
    const boundaries = findAllBoundaries(buf)
    const closed = closeSections(boundaries, buf)
    expect(closed).toHaveLength(2)
    expect(closed[0].key).toBe('1_constituicao')
    expect(closed[0].content).toBe('### 1. Constituição\nTexto da seção 1.')
    expect(closed[1].key).toBe('2_estrutural_fisica')
    expect(closed[1].content).toBe('### 2. Estrutural Física\nTexto da seção 2.')
  })

  it('última seção captura o resto do buffer', () => {
    const buf = `### 1. Constituição
Foo.
### 13. Mensagem Final
A mensagem final que vai até o fim do buffer.`
    const boundaries = findAllBoundaries(buf)
    // Note: this won't have all 13 boundaries because monotonia violou.
    // closeSections só processa o que findAllBoundaries devolveu.
    expect(boundaries).toHaveLength(1)
    expect(boundaries[0].number).toBe(1)
    const closed = closeSections(boundaries, buf)
    expect(closed[0].content).toContain('A mensagem final que vai até o fim do buffer.')
  })

  it('retorna lista vazia se boundaries está vazio', () => {
    expect(closeSections([], 'Texto qualquer.')).toEqual([])
  })
})
