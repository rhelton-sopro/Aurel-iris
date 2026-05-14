/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReportReadView } from '../ReportReadView'

const FULL_15_SECTIONS = {
  '1_constituicao_temperamento': '## §1 — Constituição e Temperamento\n\nFibras compactas e densas.',
  '2_mapa_organico': '## §2 — Mapa Orgânico\n\nFígado sob carga.',
  '2_5_sistemas_funcionando_bem': '## §2.5 — Sistemas em Bom Funcionamento\n\nDigestivo preservado.',
  '3_linha_tempo_emocional': '## §3 — Linha do Tempo Emocional\n\n**Marcador 1 — Infância (0-4 anos)**\n\n- Período de vida: vinculação primária\n- O que pode ter acontecido: questões de acolhimento\n- Tipo de bloqueio/trauma: contenção afetiva\n- Status atual: Em processo — organismo trabalhando ativamente esse campo',
  '4_padroes_emocionais_ativos': '## §4 — Padrões Emocionais Ativos\n\nTendência à contenção.',
  '5_eixo_psicossomatico': '## §5 — Eixo Psicossomático\n\nFígado ↔ raiva contida.',
  '6_herancas_transgeracionais': '## §6 — Heranças Transgeracionais\n\nPadrão linfático bilateral.',
  '7_carencias_funcionais': '## §7 — Carências Funcionais\n\nPossível baixa de magnésio.',
  '8_estado_mental_nervoso': '## §8 — Estado Mental e Nervoso\n\nHipervigilância simpática.',
  '9_recursos_forcas': '## §9 — Recursos e Forças\n\nDiscernimento emocional preservado.',
  '10_dimensao_arquetipica': '## §10 — Dimensão Arquetípica\n\nEsta íris carrega o tema da escuta interior.',
  '11_sugestoes_integrativas': '## §11 — Sugestões Integrativas\n\n- Nutrição: aumentar fibras matinais.',
  '12_roteiro_anamnese': '## §12 — Roteiro de Anamnese\n\n1. Como tem sido seu sono?',
  '13_sintese_integrativa': '## §13 — Síntese Integrativa\n\nUm fio que percorre o relatório é a relação entre carga hepática e padrões de raiva contida.',
  '14_mensagem_cliente': '## §14 — Mensagem para o Cliente\n\nO que a íris me trouxe sobre você hoje é a presença de uma força quieta.',
  'encerramento_disclaimer':
    '> Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica.',
}

describe('components/readings/ReportReadView (Plan 7.4-18 — UAT-3 reading-mode flowing surface)', () => {
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

  it('renders 15 sections in order including §2.5 between §2 and §3', () => {
    const { container } = render(
      <ReportReadView
        sections={FULL_15_SECTIONS}
        clientName="Cliente Teste"
        readingDate="2026-05-14T15:00:00.000Z"
      />,
    )
    const headings = container.querySelectorAll('h2')
    expect(headings.length).toBe(15)
    // Verify order: §1 → §2 → §2.5 → §3 → ... → §14
    const expectedOrder = ['1', '2', '2.5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']
    expectedOrder.forEach((n, idx) => {
      expect(headings[idx]?.textContent).toContain(`§${n}`)
    })
    // §2.5 specifically
    expect(headings[2]?.textContent).toBe('§2.5 — Sistemas em Bom Funcionamento')
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
    expect(headings[0]?.textContent).toContain('§1')
    expect(headings[1]?.textContent).toContain('§5')
  })

  it('strips leading `## §N — Title` heading from rendered body', () => {
    const sections = {
      '1_constituicao_temperamento':
        '## §1 — Constituição e Temperamento\n\nO organismo é linfático.',
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
    // The h2 heading is rendered (we WANT this — it's the styled section header)
    const h2s = container.querySelectorAll('h2')
    expect(h2s.length).toBe(1)
    expect(h2s[0]?.textContent).toBe('§1 — Constituição e Temperamento')
    // But the body prose should NOT contain the duplicate `## §1` literal
    const proseBlock = container.querySelector('.prose')
    expect(proseBlock?.textContent).not.toContain('## §1')
    // And should not contain a second heading (no duplicated h2 inside .prose)
    expect(proseBlock?.querySelector('h2')).toBeNull()
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

  it('section number 2.5 renders losslessly as "§2.5" not "§3" or "§2"', () => {
    const sections = {
      '2_5_sistemas_funcionando_bem':
        '## §2.5 — Sistemas em Bom Funcionamento\n\nDigestivo preservado.',
    }
    render(
      <ReportReadView
        sections={sections}
        clientName="Client"
        readingDate={null}
      />,
    )
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2.textContent).toBe('§2.5 — Sistemas em Bom Funcionamento')
    // Verify body content present
    const article = screen.getByTestId('report-read-view')
    expect(within(article).getByText('Digestivo preservado.')).toBeDefined()
  })
})
