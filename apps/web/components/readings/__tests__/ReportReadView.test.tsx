/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReportReadView } from '../ReportReadView'

const SINTESE_RAPIDA_BODY = `## 15. Síntese Rápida

### 🔴 Fragilidades

- Sistema linfático sob carga
- Tendência hepática inflamatória
- Sensibilidade emocional alta sem regulação completa

### 🟢 Forças

- Vitalidade física de fundo preservada
- Capacidade de regeneração rápida
- Discernimento emocional vivo

### 💛 Emoções a Cuidar

- Contenção da expressão verbal
- Hipervigilância afetiva
- Tendência à retenção emocional

### ✨ Potências

- Intuição corporal viva
- Talento para conexão profunda
- Foco interno disponível

### 🧭 Perfil e Temperamento

Pessoa de sensibilidade alta com força quieta. Atravessa contextos
desafiadores honrando o próprio ritmo. Combina discernimento clínico
com presença emocional.

### 🌱 Aptidões

Aptidão natural para escuta clínica e cuidado integrativo. Talento
para sustentar processos longos. Capacidade de reconhecer padrões
sutis em outros.`

const FULL_15_SECTIONS = {
  '1_constituicao_temperamento': '## 1. Constituição e Temperamento\n\nFibras compactas e densas.',
  '2_mapa_organico':
    '## 2. Mapa Orgânico\n\nVisão completa do organismo.\n\n### Sistemas que requerem atenção\n\nFígado sob carga.\n\n### Sistemas em bom funcionamento\n\nDigestivo preservado.',
  '3_linha_tempo_emocional': '## 3. Linha do Tempo Emocional\n\n**Marcador 1 — Infância (0-4 anos)**\n\n- Período de vida: vinculação primária\n- O que pode ter acontecido: questões de acolhimento\n- Tipo de bloqueio/trauma: contenção afetiva\n- Status atual: Em processo — organismo trabalhando ativamente esse campo',
  '4_padroes_emocionais_ativos': '## 4. Padrões Emocionais Ativos\n\nTendência à contenção.',
  '5_eixo_psicossomatico': '## 5. Eixo Psicossomático\n\nFígado ↔ raiva contida.',
  '6_herancas_transgeracionais': '## 6. Heranças Transgeracionais\n\nPadrão linfático bilateral.',
  '7_carencias_funcionais': '## 7. Repertório de Suporte\n\nMagnésio glicinato como repertório de suporte.',
  '8_estado_mental_nervoso': '## 8. Estado Mental e Nervoso\n\nHipervigilância simpática.',
  '9_recursos_forcas': '## 9. Recursos e Forças\n\nDiscernimento emocional preservado.',
  '10_dimensao_arquetipica': '## 10. Dimensão Arquetípica\n\nEsta íris carrega o tema da escuta interior.',
  '11_sugestoes_integrativas': '## 11. Sugestões Integrativas\n\n- Nutrição: aumentar fibras matinais.',
  '12_roteiro_anamnese': '## 12. Roteiro de Anamnese\n\n1. Como tem sido seu sono?',
  '13_sintese_integrativa': '## 13. Síntese Integrativa\n\nUm fio que percorre o relatório é a relação entre carga hepática e padrões de raiva contida.',
  '14_mensagem_cliente': '## 14. Mensagem para o Cliente\n\nO que a íris me trouxe sobre você hoje é a presença de uma força quieta.',
  '15_sintese_rapida': SINTESE_RAPIDA_BODY,
  'encerramento_disclaimer':
    '> Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica.',
}

describe('components/readings/ReportReadView (Plan 7.4-18 — UAT-3 reading-mode flowing surface; Plan 7.4-22 — § removal + §16 card grid)', () => {
  it('renders header with client name + reading date', () => {
    render(
      <ReportReadView
        sections={FULL_15_SECTIONS}
        clientName="Nailli GF de Carvalho"
        readingDate="2026-05-14T15:00:00.000Z"
      />,
    )
    expect(screen.getByText('Nailli GF de Carvalho')).toBeDefined()
    expect(screen.getByText(/Leitura realizada em/)).toBeDefined()
  })

  it('classic order (sem flag): renders sections 1..15 in emission order, original numbers', () => {
    const { container } = render(
      <ReportReadView
        sections={FULL_15_SECTIONS}
        clientName="Cliente Teste"
        readingDate="2026-05-14T15:00:00.000Z"
      />,
    )
    const headings = container.querySelectorAll('h2')
    expect(headings.length).toBe(15)
    // Sem a flag _display_order → ordem clássica de emissão, número original.
    const expectedOrder = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']
    expectedOrder.forEach((n, idx) => {
      expect(headings[idx]?.textContent).toContain(`${n} —`)
    })
    expect(headings[1]?.textContent).toBe('2 — Mapa Orgânico')
    expect(headings[14]?.textContent).toBe('15 — Síntese Rápida')
  })

  it('narrative order (flag _display_order): arco da devolutiva, renumerado 1..15 por posição', () => {
    // 2026-06-09: só leituras marcadas usam o arco (espelho → história → padrão
    // → o que pesa+perguntas → força → fecho). §14 → "Para {nome}".
    const flagged = { ...FULL_15_SECTIONS, _display_order: 'narrative' }
    const { container } = render(
      <ReportReadView
        sections={flagged}
        clientName="Cliente Teste"
        readingDate="2026-05-14T15:00:00.000Z"
      />,
    )
    const headings = container.querySelectorAll('h2')
    expect(headings.length).toBe(15)
    const expectedTitles = [
      'Constituição e Temperamento',
      'Linha do Tempo Emocional',
      'Heranças Transgeracionais',
      'Padrões Emocionais Ativos',
      'Eixo Psicossomático',
      'Mapa Orgânico',
      'Repertório de Suporte',
      'Estado Mental e Nervoso',
      'Roteiro de Anamnese',
      'Recursos e Forças',
      'Dimensão Arquetípica',
      'Sugestões Integrativas',
      'Síntese Integrativa',
      'Para Cliente',
      'Síntese Rápida',
    ]
    expectedTitles.forEach((title, idx) => {
      expect(headings[idx]?.textContent).toBe(`${idx + 1} — ${title}`)
    })
    // Mapa Orgânico migra pro clímax (6); Síntese Rápida fecha (15).
    expect(headings[5]?.textContent).toBe('6 — Mapa Orgânico')
    expect(headings[14]?.textContent).toBe('15 — Síntese Rápida')
  })

  it('skips empty sections (defensive — sections may have fewer than 15 keys)', () => {
    const partial = {
      '1_constituicao_temperamento': '## §1 — Constituição\n\nBody.',
      '5_eixo_psicossomatico': '## §5 — Eixo\n\nBody.',
    }
    const { container } = render(
      <ReportReadView
        sections={partial}
        clientName="Partial Client"
        readingDate="2026-05-14T15:00:00.000Z"
      />,
    )
    const headings = container.querySelectorAll('h2')
    expect(headings.length).toBe(2)
    // Sem flag → ordem clássica, número original (1 e 5).
    expect(headings[0]?.textContent).toContain('1 —')
    expect(headings[1]?.textContent).toContain('5 —')
  })

  it('strips leading `## N. Title` (and legacy `## §N — Title`) heading from rendered body', () => {
    const sections = {
      // Plan 22 prompt format
      '1_constituicao_temperamento':
        '## 1. Constituição e Temperamento\n\nO organismo é linfático.',
    }
    const { container } = render(
      <ReportReadView
        sections={sections}
        clientName="Client"
        readingDate={null}
      />,
    )
    // Body content present
    expect(screen.getByText('O organismo é linfático.')).toBeDefined()
    // The h2 heading is rendered with Plan 22 format
    const h2s = container.querySelectorAll('h2')
    expect(h2s.length).toBe(1)
    expect(h2s[0]?.textContent).toBe('1 — Constituição e Temperamento')
    // Body prose does not contain the duplicate `## 1` literal
    const proseBlock = container.querySelector('[data-testid="section-markdown"]')
    expect(proseBlock?.textContent).not.toContain('## 1')
    expect(proseBlock?.textContent).not.toContain('## §1')
    // No duplicated h2 inside the markdown body
    expect(proseBlock?.querySelector('h2')).toBeNull()
  })

  it('Plan 22 backward-compat: still strips legacy `## §N — Title` heading from body', () => {
    // Reports generated under Plan 16 prompt may still have `## §N — ` headings.
    const sections = {
      '1_constituicao_temperamento':
        '## §1 — Constituição e Temperamento\n\nLegacy body content.',
    }
    const { container } = render(
      <ReportReadView
        sections={sections}
        clientName="Client"
        readingDate={null}
      />,
    )
    expect(screen.getByText('Legacy body content.')).toBeDefined()
    const proseBlock = container.querySelector('[data-testid="section-markdown"]')
    expect(proseBlock?.textContent).not.toContain('## §1')
  })

  it('renders encerramento_disclaimer footer when present', () => {
    render(
      <ReportReadView
        sections={FULL_15_SECTIONS}
        clientName="Client"
        readingDate={null}
      />,
    )
    const footer = screen.getByTestId('report-read-view-footer')
    expect(footer).toBeDefined()
    expect(footer.textContent).toContain('apoio à anamnese terapêutica')
  })

  it('omits encerramento footer when absent in jsonb', () => {
    const noEncerramento = { ...FULL_15_SECTIONS }
    delete (noEncerramento as Record<string, string>)['encerramento_disclaimer']
    render(
      <ReportReadView
        sections={noEncerramento}
        clientName="Client"
        readingDate={null}
      />,
    )
    expect(screen.queryByTestId('report-read-view-footer')).toBeNull()
  })

  it('renders topActionsSlot above main body when provided', () => {
    const { container } = render(
      <ReportReadView
        sections={FULL_15_SECTIONS}
        clientName="Client"
        readingDate={null}
        topActionsSlot={<button data-testid="custom-action">Custom Action</button>}
      />,
    )
    const action = screen.getByTestId('custom-action')
    expect(action).toBeDefined()
    // The action should appear BEFORE the first h2 in DOM order
    const article = container.querySelector('article')
    const firstH2 = article?.querySelector('h2')
    expect(action.compareDocumentPosition(firstH2!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does NOT render an accordion (continuous flowing text only)', () => {
    const { container } = render(
      <ReportReadView
        sections={FULL_15_SECTIONS}
        clientName="Client"
        readingDate={null}
      />,
    )
    // No accordion roles or interactive buttons inside the body
    expect(container.querySelector('[role="region"][aria-labelledby]')).toBeNull()
    // sections rendered as <section> elements, not <button>-wrapped accordion items
    const sections = container.querySelectorAll('section[data-section-key]')
    expect(sections.length).toBeGreaterThan(0)
    sections.forEach((s) => {
      expect(s.tagName.toLowerCase()).toBe('section')
    })
  })

  it('§15 Síntese Rápida heading renders as "15 — Síntese Rápida" (classic, sem flag)', () => {
    const sections = {
      '15_sintese_rapida':
        '## 15. Síntese Rápida\n\nSem subseções aqui — prosa simples.',
    }
    render(
      <ReportReadView
        sections={sections}
        clientName="Client"
        readingDate={null}
      />,
    )
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2.textContent).toBe('15 — Síntese Rápida')
    const article = screen.getByTestId('report-read-view')
    expect(within(article).getByText('Sem subseções aqui — prosa simples.')).toBeDefined()
  })

  it('§15 Síntese Rápida renders as 6-card grid (parses ### subsections)', () => {
    render(
      <ReportReadView
        sections={FULL_15_SECTIONS}
        clientName="Client"
        readingDate={null}
      />,
    )
    const grid = screen.getByTestId('report-read-view-sintese-grid')
    expect(grid).toBeDefined()
    // Verify the 6 emoji-labeled cards are rendered
    const cards = grid.querySelectorAll('[data-testid^="sintese-block-"]')
    expect(cards.length).toBe(6)
    // Verify card labels (preserve emoji + name)
    const labels = Array.from(cards).map((c) => c.querySelector('h3')?.textContent ?? '')
    expect(labels[0]).toBe('🔴 Fragilidades')
    expect(labels[1]).toBe('🟢 Forças')
    expect(labels[2]).toBe('💛 Emoções a Cuidar')
    expect(labels[3]).toBe('✨ Potências')
    expect(labels[4]).toBe('🧭 Perfil e Temperamento')
    expect(labels[5]).toBe('🌱 Aptidões')
  })

  it('§15 grid hides if subsections cannot be parsed (fallback to default prose)', () => {
    const sections = {
      '15_sintese_rapida':
        '## 15. Síntese Rápida\n\nSonnet broke the structure — body has no ### subsections.',
    }
    const { container } = render(
      <ReportReadView
        sections={sections}
        clientName="Client"
        readingDate={null}
      />,
    )
    // No grid testid present
    expect(screen.queryByTestId('report-read-view-sintese-grid')).toBeNull()
    // Body still rendered as default prose
    const prose = container.querySelector('[data-testid="section-markdown"]')
    expect(prose?.textContent).toContain('Sonnet broke the structure')
  })
})
