/**
 * Testes pra extract-phrases — v2.4.2 (2026-05-24).
 *
 * Foco: extração do resumo §11 (sugestoes_integrativas_resumo) que
 * alimenta anti-repetição entre leituras via recent-phrases-context.
 * Fixture reproduz a estrutura típica do §11 que Sonnet 4.6 emite em
 * leituras v2.4 (heading H3 por subseção + bullets com `- **Nome** —`).
 */
import { describe, it, expect } from 'vitest'
import { extractSugestoesResumo, extractPhrases } from '../extract-phrases'

const FIXTURE_REPORT_WITH_FULL_S11 = `## 1. Constituição e Temperamento

### Síntese inicial
Foo.

### Leitura de base
Bar.

## 11. Sugestões Integrativas

### Nutrição

- **Amargos pré-prandiais diários** — rúcula, almeirão, agrião ou dente-de-leão antes das refeições principais
- **Redução de gorduras saturadas** — período de observação da resposta hepática por 4-6 semanas
- **Fibras solúveis no desjejum** — aveia, linhaça moída, banana verde

### Fitoterapia tradicional

- **Cardo-mariano (silimarina)** — hepatoprotetor clássico; uso tradicional para sobrecarga hepática crônica
- **Alcachofra** — estimulante biliar e hepático suave
- **Melissa com passiflora** — nervino combinado para sistema nervoso em exaustão

### Práticas corporais

- **TRE (Tension Release Exercises)** — trabalha desgaste acumulado no eixo adrenal e nervoso
- **Yoga restaurativa ou yin yoga** — posições passivas sustentadas que liberam fáscia
- **Automassagem com bola de tênis** — ativa retorno venoso e estimula zonas reflexas

### Práticas contemplativas

- **Escrita catártica não-enviada** — 10 minutos ao final do dia escrevendo o que ficou preso
- **Gemido sonoro ou canto livre por 5 minutos** — ativa via vocal-vagal; destrava expressão
- **Choro consciente em espaço seguro** — quando vier, deixar; quando não vier, não forçar

### Florais

- **Floral de ressentimento e mágoa acumulada** — para o padrão de raiva não-expressada
- **Floral de autossuficiência** — para o padrão de funcionar sozinha
- **Floral de transição de ciclo ativo** — suporte para travessia consciente

### Adaptógenos

- **Ashwagandha (KSM-66 ou raiz)** — adaptógeno regulador do eixo adrenal
- **Reishi** — imunomodulador e calmante
- **Schisandra** — suporte adrenal e hepático simultâneo

## 12. Roteiro de Anamnese

Foo.`

describe('extractSugestoesResumo (v2.4.2)', () => {
  it('extrai os 3 bullets de cada uma das 6 subseções', () => {
    const r = extractSugestoesResumo(FIXTURE_REPORT_WITH_FULL_S11)

    expect(r.nutricao).toEqual([
      'Amargos pré-prandiais diários',
      'Redução de gorduras saturadas',
      'Fibras solúveis no desjejum',
    ])
    expect(r.fitoterapia).toEqual([
      'Cardo-mariano (silimarina)',
      'Alcachofra',
      'Melissa com passiflora',
    ])
    expect(r.praticas_corporais).toEqual([
      'TRE (Tension Release Exercises)',
      'Yoga restaurativa ou yin yoga',
      'Automassagem com bola de tênis',
    ])
    expect(r.praticas_contemplativas).toEqual([
      'Escrita catártica não-enviada',
      'Gemido sonoro ou canto livre por 5 minutos',
      'Choro consciente em espaço seguro',
    ])
    expect(r.florais).toEqual([
      'Floral de ressentimento e mágoa acumulada',
      'Floral de autossuficiência',
      'Floral de transição de ciclo ativo',
    ])
    expect(r.adaptogenos).toEqual([
      'Ashwagandha (KSM-66 ou raiz)',
      'Reishi',
      'Schisandra',
    ])
  })

  it('retorna 6 arrays vazias quando §11 ausente', () => {
    const r = extractSugestoesResumo('## 1. Foo\n\nBar.\n\n## 12. Baz\n\nQux.')
    expect(r.nutricao).toEqual([])
    expect(r.fitoterapia).toEqual([])
    expect(r.praticas_corporais).toEqual([])
    expect(r.praticas_contemplativas).toEqual([])
    expect(r.florais).toEqual([])
    expect(r.adaptogenos).toEqual([])
  })

  it('aceita bullets sem **bold** (formato relaxado)', () => {
    const md = `## 11. Sugestões Integrativas

### Nutrição

- Amargos pré-prandiais diários — descrição
- Fibras no desjejum — descrição

### Adaptógenos

- Ashwagandha — calmante
`
    const r = extractSugestoesResumo(md)
    expect(r.nutricao).toEqual(['Amargos pré-prandiais diários', 'Fibras no desjejum'])
    expect(r.adaptogenos).toEqual(['Ashwagandha'])
  })

  it('para no próximo `## N.` heading (não pega bullets de §12)', () => {
    const md = `## 11. Sugestões Integrativas

### Nutrição

- Amargos — descrição

## 12. Roteiro de Anamnese

- Pergunta intrusa que NÃO deve aparecer no resumo §11 — descrição
`
    const r = extractSugestoesResumo(md)
    expect(r.nutricao).toEqual(['Amargos'])
    expect(r.fitoterapia).toEqual([])
  })

  it('captura mais que 3 bullets se a subseção tiver (3-5 conforme v2.4.2)', () => {
    const md = `## 11. Sugestões Integrativas

### Adaptógenos

- Rhodiola — descrição
- Eleutero — descrição
- Tulsi — descrição
- Maca — descrição
- Cordyceps — descrição
`
    const r = extractSugestoesResumo(md)
    expect(r.adaptogenos).toHaveLength(5)
    expect(r.adaptogenos[0]).toBe('Rhodiola')
    expect(r.adaptogenos[4]).toBe('Cordyceps')
  })

  it('é tolerante a variações de heading (acentos, "Fitoterapia tradicional")', () => {
    const md = `## 11. Sugestões Integrativas

### Práticas Corporais

- Tai Chi — descrição

### Práticas contemplativas

- Meditação — descrição
`
    const r = extractSugestoesResumo(md)
    expect(r.praticas_corporais).toEqual(['Tai Chi'])
    expect(r.praticas_contemplativas).toEqual(['Meditação'])
  })

  it('extractPhrases inclui o resumo §11 no output completo', () => {
    const r = extractPhrases(FIXTURE_REPORT_WITH_FULL_S11)
    expect(r.sugestoes_integrativas_resumo).toBeDefined()
    expect(r.sugestoes_integrativas_resumo.adaptogenos).toContain('Ashwagandha (KSM-66 ou raiz)')
  })
})
