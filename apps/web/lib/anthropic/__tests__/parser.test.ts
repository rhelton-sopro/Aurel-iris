// Phase 7 | Plan 07-04 — section-boundary parser tests.
// Phase 7.4 Plan 11 — Direction Correction DC-1/DC-3: range extended 1..13 -> 1..14;
//   section keys remapped from legacy 13 to new 14 (Iris Codex V1 markdown structure).
// Phase 7.4 Plan 17 — UAT-3: §2.5 decimal heading inserted (15 sections); BoundaryMatch
//   field renamed `number: number` → `headingNumber: string`; monotonicity now
//   array-index based (not numeric `lastNumber + 1`).
import { describe, it, expect } from 'vitest'
import { findAllBoundaries, closeSections } from '../parser'

describe('lib/anthropic/parser — findAllBoundaries (D-S2 + Pitfall 2)', () => {
  it('detecta single boundary em buffer simples', () => {
    const buf = '### 1. Constituição\nFoo bar baz.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ headingNumber: '1', key: '1_constituicao_temperamento' })
    expect(result[0].startIdx).toBe(0)
  })

  it('detecta 3 boundaries sequenciais 1, 2, 3', () => {
    const buf = `### 1. Constituição e Temperamento
Foo.
### 2. Mapa Orgânico
Bar.
### 3. Linha do Tempo Emocional
Baz.`
    const result = findAllBoundaries(buf)
    // §2.5 is OPTIONAL in the canonical sequence — buffer without §2.5 still
    // matches §1 → §2 → §3 (array-index monotonicity allows skipping intervening
    // headings as long as no out-of-order heading appears between them).
    // Wait — actually the array-index check requires `idx === lastIndex + 1`,
    // meaning §3 (idx 3) cannot follow §2 (idx 1) without §2.5 (idx 2).
    // So this buffer (without §2.5) matches §1 (idx 0) + §2 (idx 1), then §3
    // gets rejected because idx 3 !== idx 1 + 1.
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2'])
  })

  it('detecta 4 boundaries 1, 2, 2.5, 3 (Plan 17 happy path com §2.5)', () => {
    const buf = `### 1. Constituição e Temperamento
Foo.
### 2. Mapa Orgânico
Bar.
## §2.5 — Sistemas em Bom Funcionamento
Boa funcionalidade.
### 3. Linha do Tempo Emocional
Baz.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(4)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2', '2.5', '3'])
    expect(result.map((b) => b.key)).toEqual([
      '1_constituicao_temperamento',
      '2_mapa_organico',
      '2_5_sistemas_funcionando_bem',
      '3_linha_tempo_emocional',
    ])
  })

  it('rejeita number=0 (Pitfall 2 — out of range)', () => {
    const buf = '### 0. Prólogo\n### 1. Constituição\nFoo.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0].headingNumber).toBe('1')
  })

  it('rejeita number=15 (Plan 22 — sequência pula de 14 para 16; 15 NÃO está no array)', () => {
    // To isolate the membership filter, buffer first satisfies 1..14 + §2.5.
    // Then `### 15.` exercises exclusively the `idx === -1` branch.
    // Plan 22: 15 was already invalid (max was 14); now array contains '16' but
    // STILL not '15' — the sequence skips 15 by founder explicit choice.
    const headings = ['1', '2', '2.5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']
    const head = headings.map((n) => `### ${n}. Seção ${n}\nConteúdo.`).join('\n')
    const buf = `${head}\n### 15. Bibliografia\nDrift — 15 não existe no array.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(15)
    expect(result.map((b) => b.headingNumber)).toEqual(headings)
  })

  it('rejeita number=17 (out of range; max is 16 com pula 15)', () => {
    const headings = ['1', '2', '2.5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '16']
    const head = headings.map((n) => `### ${n}. Seção ${n}\nConteúdo.`).join('\n')
    const buf = `${head}\n### 17. Apêndice\nDrift fora do range.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(16)
    expect(result.map((b) => b.headingNumber)).toEqual(headings)
  })

  it('aceita number=14 + 16 (Plan 22 — sequência 1, 2, 2.5, 3..14, 16)', () => {
    const headings = ['1', '2', '2.5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']
    const head = headings.map((n) => `### ${n}. Seção ${n}\nConteúdo.`).join('\n')
    const buf = `${head}\n### 14. Mensagem para o Cliente\nFecho caloroso.\n### 16. Síntese Rápida\nResumo.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(16)
    expect(result.map((b) => b.headingNumber)).toEqual([...headings, '14', '16'])
    expect(result[14].key).toBe('14_mensagem_cliente')
    expect(result[15].key).toBe('16_sintese_rapida')
  })

  it('rejeita boundary não-monotônica crescente (Pitfall 2)', () => {
    // After 1 (idx 0), sees 5 (idx 5). 5 is rejected because lastIndex + 1 = 1, mismatch.
    // Then 2 (idx 1) satisfies lastIndex + 1 = 1.
    const buf = '### 1. Constituição\nFoo.\n### 5. Salto\nDrift.\n### 2. Mapa\nReal.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2'])
  })

  it('rejeita §3 quando precede §2.5 (Plan 17 — array-index monotonicity skipa misordered)', () => {
    // §1 (idx 0) ✓ → §2 (idx 1) ✓ → §3 (idx 3) ✗ rejected (idx 3 !== 1+1=2)
    // → §2.5 (idx 2) ✓ accepted (idx 2 === 1+1=2). Parser recovers from
    // misordering by skipping the out-of-order heading and accepting the next
    // valid sequential one.
    const buf = `## §1 — A
## §2 — B
## §3 — C (out of order — §2.5 should come first)
## §2.5 — D`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(3)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2', '2.5'])
  })

  it('ignora pseudo-heading inline em corpo (Pitfall 2 — false positive)', () => {
    const buf = `### 1. Constituição
Veja a Tabela 4. de exemplo na página 7.
Inline ### 7.5 Detalhe técnico (não é boundary).
### 2. Mapa Orgânico
Bar.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2'])
  })

  it('aceita 16 boundaries 1, 2, 2.5, 3..14, 16 sequenciais (Plan 22 happy path full report)', () => {
    const headings = ['1', '2', '2.5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '16']
    const buf = headings.map((n) => `### ${n}. Seção ${n}\nConteúdo.`).join('\n')
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(16)
    expect(result.map((b) => b.headingNumber)).toEqual(headings)
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
    const buf = `# Documento
## Subtítulo de cliente
## 1. Constituição
Foo.
## 2. Mapa
Bar.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2'])
  })

  it('rejeita "# " (H1) e "#### " (H4) — só H2/H3 são aceitos', () => {
    const buf = '# 1. Não é boundary\n### 1. Constituição\n#### 2. Não é boundary'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0].headingNumber).toBe('1')
  })
})

describe('lib/anthropic/parser — closeSections', () => {
  it('produz lista de ClosedSection com conteúdo trimmed entre boundaries', () => {
    const buf = `### 1. Constituição e Temperamento
Texto da seção 1.

### 2. Mapa Orgânico
Texto da seção 2.`
    const boundaries = findAllBoundaries(buf)
    const closed = closeSections(boundaries, buf)
    expect(closed).toHaveLength(2)
    expect(closed[0].key).toBe('1_constituicao_temperamento')
    expect(closed[0].content).toBe('### 1. Constituição e Temperamento\nTexto da seção 1.')
    expect(closed[1].key).toBe('2_mapa_organico')
    expect(closed[1].content).toBe('### 2. Mapa Orgânico\nTexto da seção 2.')
  })

  it('última seção captura o resto do buffer', () => {
    const buf = `### 1. Constituição
Foo.
### 14. Mensagem para o Cliente
A mensagem final que vai até o fim do buffer.`
    const boundaries = findAllBoundaries(buf)
    // Note: this won't have all 15 boundaries because monotonia violou.
    // closeSections só processa o que findAllBoundaries devolveu.
    expect(boundaries).toHaveLength(1)
    expect(boundaries[0].headingNumber).toBe('1')
    const closed = closeSections(boundaries, buf)
    expect(closed[0].content).toContain('A mensagem final que vai até o fim do buffer.')
  })

  it('retorna lista vazia se boundaries está vazio', () => {
    expect(closeSections([], 'Texto qualquer.')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Phase 07.1.6 UAT-1 regression (2026-05-12)
//
// f4408c23 regenerar análise: buffer_length=40038, sections_completed=[].
// LLM produced `## §1 — Constituição Iridológica` headers (Sonnet 4.6 drift)
// but old regex required `.` separator. Zero boundaries matched → empty report.
// Parser now accepts §-prefixed numbers and em-dash/en-dash/hyphen separators.
// ---------------------------------------------------------------------------

describe('lib/anthropic/parser — Sonnet 4.6 heading variants (Phase 07.1.6 UAT-1 + Plan 11 §N — Title format)', () => {
  it('aceita "## §N — Title" (section glyph + em-dash separator)', () => {
    const buf = '## §1 — Constituição e Temperamento\nA íris revela...'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ headingNumber: '1', key: '1_constituicao_temperamento' })
  })

  it('aceita "### §N — Title" (H3 + § + em-dash)', () => {
    const buf = '### §1 — Constituição e Temperamento\nFoo.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0].headingNumber).toBe('1')
  })

  it('aceita "## §2.5 — Title" (Plan 17 — decimal heading)', () => {
    const buf = `## §1 — Constituição
Foo.
## §2 — Mapa Orgânico
Bar.
## §2.5 — Sistemas em Bom Funcionamento
Boa funcionalidade.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(3)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2', '2.5'])
    expect(result[2].key).toBe('2_5_sistemas_funcionando_bem')
  })

  it('aceita en-dash e hyphen além de em-dash', () => {
    const enDashBuf = '## 1 – Title\n'
    const hyphenBuf = '## 1 - Title\n'
    expect(findAllBoundaries(enDashBuf)).toHaveLength(1)
    expect(findAllBoundaries(hyphenBuf)).toHaveLength(1)
  })

  it('Plan 17 backward-compat: detecta 15 boundaries sequenciais no formato legacy §N — Title (com §2.5, sem §16)', () => {
    // Plan 16 prompt emitted §-prefixed format. Reports generated under Plan
    // 16 still parse correctly via the optional `§?` + `[\\p{Pd}.]` regex.
    const headings = ['1', '2', '2.5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']
    const sections = headings.map((n) => `## §${n} — Seção ${n}\nConteúdo.`)
    const buf = sections.join('\n')
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(15)
    expect(result.map((b) => b.headingNumber)).toEqual(headings)
    expect(result[0].key).toBe('1_constituicao_temperamento')
    expect(result[2].key).toBe('2_5_sistemas_funcionando_bem')
    expect(result[14].key).toBe('14_mensagem_cliente')
  })

  it('Plan 22: detecta 16 boundaries sequenciais no formato `## N. Title` (sem §, com §16)', () => {
    const headings = ['1', '2', '2.5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '16']
    const sections = headings.map((n) => `## ${n}. Seção ${n}\nConteúdo.`)
    const buf = sections.join('\n')
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(16)
    expect(result.map((b) => b.headingNumber)).toEqual(headings)
    expect(result[2].key).toBe('2_5_sistemas_funcionando_bem')
    expect(result[15].key).toBe('16_sintese_rapida')
  })

  it('aceita variantes mistas (Sonnet ocasionalmente alterna formato no mesmo report)', () => {
    const buf = `### 1. Constituição e Temperamento
Foo.
## §2 — Mapa Orgânico
Bar.
## §2.5 — Sistemas em Bom Funcionamento
Recursos.
### 3. Linha do Tempo Emocional
Baz.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(4)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2', '2.5', '3'])
  })

  it('regression: f4408c23 buffer head matches first section', () => {
    const buf =
      '# Leitura Iridológica Integrativa\n## Nailli GF de Carvalho · 37 anos\n\n---\n\n## §1 — Constituição e Temperamento\n\nA íris de Nailli revela uma constituição funcional mista.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ headingNumber: '1', key: '1_constituicao_temperamento' })
    expect(buf.slice(result[0].startIdx, result[0].startIdx + 6)).toBe('## §1 ')
  })

  it('still rejects H1 and H4 (Pitfall 2 boundaries intact)', () => {
    const h1 = '# 1. Wrong depth\n'
    const h4 = '#### 1. Wrong depth\n'
    expect(findAllBoundaries(h1)).toHaveLength(0)
    expect(findAllBoundaries(h4)).toHaveLength(0)
  })

  it('still rejects out-of-range numbers with new format', () => {
    const buf = '## §0 — Prologue\n## §1 — Real first\nFoo.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0].headingNumber).toBe('1')
  })
})
