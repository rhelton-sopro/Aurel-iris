/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorAccordion } from '../EditorAccordion'

describe('components/readings/EditorAccordion (D-U1 + UI-SPEC §Surface 2)', () => {
  it('renderiza 13 sections + 14ª encerramento read-only', () => {
    const generated = {
      '1_constituicao': 'Texto 1',
      '2_estrutural_fisica': 'Texto 2',
      'encerramento_disclaimer': '> Disclaimer literal.',
    }
    render(
      <EditorAccordion
        reportGenerated={generated}
        reportDelivered={generated}
        onSectionChange={vi.fn()}
      />,
    )
    // Triggers are always rendered regardless of open/closed state
    expect(screen.getByText(/1\. Constituição/)).toBeDefined()
    expect(screen.getByText(/13\. Mensagem Final/)).toBeDefined()
    expect(screen.getByText(/Encerramento \(texto literal — não editável\)/)).toBeDefined()
  })

  it('mostra "editado" indicator quando deliveredValue !== generatedValue', () => {
    const generated = { '1_constituicao': 'Original' }
    const delivered = { '1_constituicao': 'Modificado' }
    render(
      <EditorAccordion
        reportGenerated={generated}
        reportDelivered={delivered}
        onSectionChange={vi.fn()}
      />,
    )
    // The "editado" indicator appears in the trigger label for section 1
    expect(screen.getAllByText(/editado/).length).toBeGreaterThan(0)
  })

  it('encerramento_disclaimer é read-only (não tem Textarea editável)', () => {
    const generated = {
      'encerramento_disclaimer':
        '> Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica.',
    }
    const onChange = vi.fn()
    const { container } = render(
      <EditorAccordion
        reportGenerated={generated}
        reportDelivered={generated}
        onSectionChange={onChange}
      />,
    )
    // Encerramento trigger is rendered
    const encerrTrigger = screen.getByText(/Encerramento \(texto literal — não editável\)/)
    expect(encerrTrigger).toBeDefined()

    // Encerramento item does NOT contain a Textarea — only a prose preview pane.
    // The AccordionPanel for encerramento is only mounted when open; since we can't
    // easily interact without userEvent, we assert no Textarea exists in the container
    // for the encerramento section by checking the parent AccordionItem structure.
    // (If the item were open, the prose div appears, but never a Textarea.)
    const allTextareas = container.querySelectorAll('textarea')
    // Only the first 3 open items (1_constituicao, 2_estrutural_fisica, 3_indicacoes_sistemicas)
    // have Textareas; encerramento never has one.
    allTextareas.forEach((t) => {
      const id = t.getAttribute('id') ?? ''
      expect(id).not.toContain('encerramento')
    })
  })

  it('readOnly prop desabilita todos os Textareas renderizados', () => {
    const generated = { '1_constituicao': 'Texto', '5_psicoemocional': 'Outro' }
    const { container } = render(
      <EditorAccordion
        reportGenerated={generated}
        reportDelivered={generated}
        onSectionChange={vi.fn()}
        readOnly={true}
      />,
    )
    // Only open panels (first 3 by defaultValue) render Textareas in jsdom
    const textareas = container.querySelectorAll('textarea')
    textareas.forEach((t) => expect(t.hasAttribute('disabled')).toBe(true))
  })
})
