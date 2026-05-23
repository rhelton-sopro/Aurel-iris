// Phase 7 | Plan 07-04 — section-boundary parser tests.
// Phase 7.4 Plan 27 — UAT-iter-3: §2.5 collapsed into §2; Síntese §16 → §15.
//   The canonical sequence is now strictly sequential 1..15 (no fractions,
//   no gaps). Monotonicity is array-index based via NUMBERED_SECTION_HEADINGS.
import { describe, it, expect } from 'vitest'
import { findAllBoundaries, closeSections, extractEssencePhrase } from '../parser'

const ALL_15 = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15',
]

describe('lib/anthropic/parser — findAllBoundaries (D-S2 + Pitfall 2)', () => {
  it('detecta single boundary em buffer simples', () => {
    const buf = '### 1. Constituição\nFoo bar baz.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ headingNumber: '1', key: '1_constituicao_temperamento' })
    expect(result[0].startIdx).toBe(0)
  })

  it('detecta 3 boundaries sequenciais 1, 2, 3 (Plan 27 — sequência sem §2.5)', () => {
    const buf = `### 1. Constituição e Temperamento
Foo.
### 2. Mapa Orgânico
Bar.
### 3. Linha do Tempo Emocional
Baz.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(3)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2', '3'])
    expect(result.map((b) => b.key)).toEqual([
      '1_constituicao_temperamento',
      '2_mapa_organico',
      '3_linha_tempo_emocional',
    ])
  })

  it('rejeita number=0 (Pitfall 2 — out of range)', () => {
    const buf = '### 0. Prólogo\n### 1. Constituição\nFoo.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(1)
    expect(result[0].headingNumber).toBe('1')
  })

  it('rejeita legacy "2.5" (Plan 27 — não está mais no array; membership filter)', () => {
    // Reports generated before Plan 27 may carry `## §2.5 —`. The regex still
    // tolerates a decimal tail, but '2.5' is no longer in
    // NUMBERED_SECTION_HEADINGS, so it is rejected via the `idx === -1` branch
    // and §3 (idx 2) correctly follows §2 (idx 1).
    const buf = `### 1. Constituição
Foo.
### 2. Mapa Orgânico
Bar.
## §2.5 — Sistemas em Bom Funcionamento (legacy — deve ser ignorado)
Drift.
### 3. Linha do Tempo Emocional
Baz.`
    const result = findAllBoundaries(buf)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2', '3'])
  })

  it('rejeita number=16 (Plan 27 — max é 15; 16 não está no array)', () => {
    const head = ALL_15.map((n) => `### ${n}. Seção ${n}\nConteúdo.`).join('\n')
    const buf = `${head}\n### 16. Bibliografia\nDrift — 16 não existe no array.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(15)
    expect(result.map((b) => b.headingNumber)).toEqual(ALL_15)
  })

  it('aceita number=14 + 15 (Plan 27 — Síntese Rápida = §15)', () => {
    const headings = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']
    const head = headings.map((n) => `### ${n}. Seção ${n}\nConteúdo.`).join('\n')
    const buf = `${head}\n### 14. Mensagem para o Cliente\nFecho caloroso.\n### 15. Síntese Rápida\nResumo.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(15)
    expect(result.map((b) => b.headingNumber)).toEqual([...headings, '14', '15'])
    expect(result[13].key).toBe('14_mensagem_cliente')
    expect(result[14].key).toBe('15_sintese_rapida')
  })

  it('rejeita boundary não-monotônica crescente (Pitfall 2)', () => {
    // After 1 (idx 0), sees 5 (idx 4). 5 rejected (lastIndex + 1 = 1, mismatch).
    // Then 2 (idx 1) satisfies lastIndex + 1 = 1.
    const buf = '### 1. Constituição\nFoo.\n### 5. Salto\nDrift.\n### 2. Mapa\nReal.'
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2'])
  })

  it('recupera de misordering: §4 antes de §3 é pulado, §3 aceito depois', () => {
    // §1 (0) ✓ → §2 (1) ✓ → §4 (3) ✗ (idx 3 !== 1+1=2) → §3 (2) ✓ (=== 1+1=2)
    const buf = `## §1 — A
## §2 — B
## §4 — D (fora de ordem — §3 deveria vir primeiro)
## §3 — C`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(3)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2', '3'])
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

  it('aceita 15 boundaries 1..15 sequenciais (Plan 27 happy path full report)', () => {
    const buf = ALL_15.map((n) => `### ${n}. Seção ${n}\nConteúdo.`).join('\n')
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(15)
    expect(result.map((b) => b.headingNumber)).toEqual(ALL_15)
    expect(result[14].key).toBe('15_sintese_rapida')
  })

  it('retorna lista vazia para buffer sem boundaries', () => {
    const buf = 'Apenas texto sem nenhum heading aqui.'
    expect(findAllBoundaries(buf)).toEqual([])
  })

  it('regex global state não vaza entre chamadas (lastIndex reset)', () => {
    const buf = '### 1. Constituição\n'
    expect(findAllBoundaries(buf)).toHaveLength(1)
    expect(findAllBoundaries(buf)).toHaveLength(1)
  })

  it('aceita "## " (H2) como boundary — Sonnet às vezes bump H3→H2', () => {
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

  // Regressão Caroline/Evanilce (v2.4 UAT, reading e8976f11, 2026-05-23):
  // o report_generated dessa leitura ficou com APENAS 13 chaves (§1..§13),
  // faltando §14, §15 e essence_phrase — mesmo o markdown bruto (raw_text)
  // tendo todas as 15 seções corretamente. O bug era no CONSUMER
  // (route.ts:analyze) que fazia UPDATE incremental sobrescrevendo
  // report_generated parcial e o edge timeout cortava antes do post-stream
  // cleanup. Este teste blinda: dado o raw_text exato emitido por Sonnet
  // 4.6 v2.3.0.1 com ## N. (H2, sem § glyph), findAllBoundaries DEVE
  // retornar exatamente 15 boundaries e extractEssencePhrase DEVE retornar
  // a frase final. Se isso quebrar no futuro, regredimos o fix.
  it('regression e8976f11 — buffer real v2.3.0.1 (## N. H2 + Em poucas palavras pós-§15) retorna 15 boundaries + essence', () => {
    const buf = `## 1. Constituição e Temperamento

### Síntese inicial
Foo.

### Leitura de base
Bar.

## 2. Mapa Orgânico

### Sistemas que requerem atenção
Baz.

### Sistemas em bom funcionamento
Qux.

## 3. Linha do Tempo Emocional

Conteúdo §3.

## 4. Padrões Emocionais Ativos

Conteúdo §4.

## 5. Eixo Psicossomático

Conteúdo §5.

## 6. Heranças Transgeracionais Sugeridas

Conteúdo §6.

## 7. Carências Funcionais

Conteúdo §7.

## 8. Estado Mental e Nervoso

Conteúdo §8.

## 9. Recursos e Forças

Conteúdo §9.

## 10. Dimensão Arquetípica / Espiritual

Conteúdo §10.

## 11. Sugestões Integrativas

### Nutrição
- bullet

### Fitoterapia tradicional
- bullet

### Práticas corporais
- bullet

### Práticas contemplativas
- bullet

### Florais
- bullet

### Adaptógenos
- bullet

## 12. Roteiro de Anamnese

1. pergunta
2. pergunta

## 13. Síntese Integrativa

Conteúdo §13.

---

## 14. Mensagem para o Cliente

Evanilce, o que esta leitura me trouxe sobre você é a imagem de uma mulher que foi ficando muito boa em sustentar.

## 15. Síntese Rápida

### 🔴 Fragilidades
- bullet

### 🟢 Forças
- bullet

### 💛 Emoções a Cuidar
- bullet

### ✨ Potências
- bullet

### 🧭 Perfil e Temperamento
Introversão funcional com alta carga vital.

### 🌱 Aptidões
Sensibilidade e profundidade.

## Em poucas palavras

Uma vida inteira sendo o chão firme que os outros pisaram sem perceber o quanto aquilo custava.`

    const boundaries = findAllBoundaries(buf)
    expect(boundaries).toHaveLength(15)
    expect(boundaries.map((b) => b.headingNumber)).toEqual(ALL_15)
    expect(boundaries[13].key).toBe('14_mensagem_cliente')
    expect(boundaries[14].key).toBe('15_sintese_rapida')

    const essence = extractEssencePhrase(buf)
    expect(essence).toBeTruthy()
    expect(essence).toContain('chão firme')
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
    // §14 (idx 13) cannot follow §1 (idx 0) — monotonia violada; só §1 passa.
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
// LLM produced `## §1 — Constituição` headers (Sonnet 4.6 drift); parser must
// accept §-prefixed numbers + em-dash/en-dash/hyphen separators.
// ---------------------------------------------------------------------------

describe('lib/anthropic/parser — Sonnet heading variants', () => {
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

  it('aceita en-dash e hyphen além de em-dash', () => {
    const enDashBuf = '## 1 – Title\n'
    const hyphenBuf = '## 1 - Title\n'
    expect(findAllBoundaries(enDashBuf)).toHaveLength(1)
    expect(findAllBoundaries(hyphenBuf)).toHaveLength(1)
  })

  it('detecta 15 boundaries sequenciais no formato legacy §N — Title', () => {
    const sections = ALL_15.map((n) => `## §${n} — Seção ${n}\nConteúdo.`)
    const buf = sections.join('\n')
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(15)
    expect(result.map((b) => b.headingNumber)).toEqual(ALL_15)
    expect(result[0].key).toBe('1_constituicao_temperamento')
    expect(result[13].key).toBe('14_mensagem_cliente')
    expect(result[14].key).toBe('15_sintese_rapida')
  })

  it('detecta 15 boundaries sequenciais no formato `## N. Title` (sem §)', () => {
    const sections = ALL_15.map((n) => `## ${n}. Seção ${n}\nConteúdo.`)
    const buf = sections.join('\n')
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(15)
    expect(result.map((b) => b.headingNumber)).toEqual(ALL_15)
    expect(result[14].key).toBe('15_sintese_rapida')
  })

  it('aceita variantes mistas (Sonnet alterna formato no mesmo report)', () => {
    const buf = `### 1. Constituição e Temperamento
Foo.
## §2 — Mapa Orgânico
Bar.
### 3. Linha do Tempo Emocional
Baz.
## §4 — Padrões Emocionais Ativos
Qux.`
    const result = findAllBoundaries(buf)
    expect(result).toHaveLength(4)
    expect(result.map((b) => b.headingNumber)).toEqual(['1', '2', '3', '4'])
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

describe('lib/anthropic/parser — extractEssencePhrase (Plan 28 CHANGE 5)', () => {
  it('LEGACY backward-compat: extracts from a leading "## Em uma palavra" block (07.4-36 — stored buffers keep parsing)', () => {
    const buf =
      '## Em uma palavra\nUm organismo que aprendeu a sustentar — e que agora pede permissão para ser sustentado.\n\n## 1. Constituição e Temperamento\nCorpo.'
    expect(extractEssencePhrase(buf)).toBe(
      'Um organismo que aprendeu a sustentar — e que agora pede permissão para ser sustentado.',
    )
  })

  it('strips blockquote, emphasis and wrapping quotes; collapses whitespace', () => {
    const buf =
      '### Em poucas palavras\n> *"Há aqui a força de quem carrega\n> e a sabedoria que começa a perceber o peso."*\n\n## 1. X\nY'
    expect(extractEssencePhrase(buf)).toBe(
      'Há aqui a força de quem carrega e a sabedoria que começa a perceber o peso.',
    )
  })

  it('tolerates a colon and **bold** marker form', () => {
    const buf = '**Em poucas palavras:**\nA vida desta íris se organiza em torno de uma pergunta.\n## 1. X\nY'
    expect(extractEssencePhrase(buf)).toBe(
      'A vida desta íris se organiza em torno de uma pergunta.',
    )
  })

  it('returns null when the block is absent (page is skipped)', () => {
    const buf = '## 1. Constituição e Temperamento\nCorpo sem essência.'
    expect(extractEssencePhrase(buf)).toBeNull()
  })

  it('is NOT picked up as a numbered boundary (monotonicity intact)', () => {
    const buf =
      '## Em poucas palavras\nFrase.\n\n## 1. Constituição\nA\n\n## 2. Mapa\nB'
    const b = findAllBoundaries(buf)
    expect(b).toHaveLength(2)
    expect(b[0].headingNumber).toBe('1')
  })

  // iter-5 FIX 3 — hardened: survive an LLM preamble before the marker,
  // same-line phrase, and ALL-CAPS heading.
  it('survives a preamble before the marker (pre-§1 region search)', () => {
    const buf =
      '# Leitura Iridológica\n\n## Em poucas palavras\nFrase essência aqui.\n\n## 1. Constituição\nCorpo.'
    expect(extractEssencePhrase(buf)).toBe('Frase essência aqui.')
  })

  it('extracts a same-line phrase after an em-dash separator', () => {
    const buf = '## Em poucas palavras — A frase na mesma linha.\n\n## 1. X\nCorpo.'
    expect(extractEssencePhrase(buf)).toBe('A frase na mesma linha.')
  })

  it('tolerates an ALL-CAPS heading', () => {
    const buf = '## EM POUCAS PALAVRAS\nFrase em caixa alta de cabeçalho.\n## 1. X\nY'
    expect(extractEssencePhrase(buf)).toBe('Frase em caixa alta de cabeçalho.')
  })

  it('does not false-match prose "em poucas palavras:" inside §1 body', () => {
    const buf =
      '## 1. Constituição\nResumindo em poucas palavras: equilíbrio.\n\n## 2. Mapa\nB'
    expect(extractEssencePhrase(buf)).toBeNull()
  })

  // Plan 29 FIX 3 — realistic full-stream fixture: mandatory block first,
  // then §1..§15. The essence phrase must surface intact.
  it('extracts the essence from a realistic full-report stream', () => {
    const buf = [
      '## Em poucas palavras',
      'Um corpo que aprendeu a se proteger contendo, e que agora começa a perguntar o que aconteceria se confiasse.',
      '',
      '## 1. Constituição e Temperamento',
      'Fibras compactas e densas, padrão linfático-reativo.',
      '',
      '## 2. Mapa Orgânico',
      'Visão completa do organismo.',
      '',
      '## 14. Mensagem para o Cliente',
      'Querida, este é o seu momento.',
      '',
      '## 15. Síntese Rápida',
      '### 🔴 Fragilidades',
      '- Sistema linfático sob carga',
    ].join('\n')
    expect(extractEssencePhrase(buf)).toBe(
      'Um corpo que aprendeu a se proteger contendo, e que agora começa a perguntar o que aconteceria se confiasse.',
    )
    // And it must NOT have polluted §1's content.
    const closed = closeSections(findAllBoundaries(buf), buf)
    const sec1 = closed.find((c) => c.key === '1_constituicao_temperamento')
    expect(sec1?.content).not.toContain('Em poucas palavras')
    expect(sec1?.content).toContain('Fibras compactas')
  })

  // 07.4-35 — NEW contract: essence is emitted LAST, after §15. The parser
  // must extract it from the post-§15 tail AND §15 must not swallow it.
  it('extracts the essence from a post-§15 block (07.4-35 contract)', () => {
    const secs = Array.from(
      { length: 15 },
      (_, i) => `## ${i + 1}. Seção ${i + 1}\nConteúdo da seção ${i + 1}.`,
    ).join('\n\n')
    const phrase =
      'Uma íris de fundo claro e fibras finas e tensas — um organismo que processa rápido e ainda não achou o freio.'
    const buf = `${secs}\n\n## Em poucas palavras\n${phrase}`
    expect(extractEssencePhrase(buf)).toBe(phrase)
    const closed = closeSections(findAllBoundaries(buf), buf)
    const sec15 = closed.find((c) => c.key === '15_sintese_rapida')
    expect(sec15?.content).not.toContain('Em poucas palavras')
    expect(sec15?.content).toContain('Conteúdo da seção 15')
  })

  // 07.4-36 — heading renamed to "Em poucas palavras"; the parser keeps the
  // legacy "Em uma palavra" alternative so already-stored raw buffers (and
  // any re-parse path) still surface their essence in the post-§15 position.
  it('LEGACY backward-compat: a post-§15 "## Em uma palavra" block still extracts', () => {
    const secs = Array.from(
      { length: 15 },
      (_, i) => `## ${i + 1}. Seção ${i + 1}\nConteúdo da seção ${i + 1}.`,
    ).join('\n\n')
    const phrase =
      'Uma íris de fibras finas e tensas — um organismo que ainda procura o freio.'
    const buf = `${secs}\n\n## Em uma palavra\n${phrase}`
    expect(extractEssencePhrase(buf)).toBe(phrase)
  })
})
