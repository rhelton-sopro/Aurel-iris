/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorSectionItem } from '../EditorSectionItem'

describe('components/readings/EditorSectionItem (UI-SPEC §Surface 2 Editor)', () => {
  it('Textarea propaga onChange com novo valor', () => {
    const onChange = vi.fn()
    render(
      <EditorSectionItem
        sectionKey="1_constituicao"
        number={1}
        title="Constituição"
        generatedValue="Original"
        deliveredValue="Original"
        onChange={onChange}
      />,
    )
    const textarea = screen.getByLabelText('Texto da seção') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Modificado pelo terapeuta' } })
    expect(onChange).toHaveBeenCalledWith('Modificado pelo terapeuta')
  })

  it('char count atualiza com o tamanho de deliveredValue', () => {
    render(
      <EditorSectionItem
        sectionKey="1_constituicao"
        number={1}
        title="Constituição"
        generatedValue=""
        deliveredValue="abcde"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/5 caracteres/)).toBeDefined()
  })

  it('edited indicator toggles quando texto difere do gerado', () => {
    const { rerender } = render(
      <EditorSectionItem
        sectionKey="1_constituicao"
        number={1}
        title="Constituição"
        generatedValue="A"
        deliveredValue="A"
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByText(/editado/)).toBeNull()
    rerender(
      <EditorSectionItem
        sectionKey="1_constituicao"
        number={1}
        title="Constituição"
        generatedValue="A"
        deliveredValue="B"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/editado/)).toBeDefined()
  })

  it('preview pane renderiza markdown via react-markdown', () => {
    render(
      <EditorSectionItem
        sectionKey="1_constituicao"
        number={1}
        title="Constituição"
        generatedValue=""
        deliveredValue="**negrito**"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Pré-visualização')).toBeDefined()
    // react-markdown renderiza <strong>negrito</strong> dentro do prose pane
    const strong = document.querySelector('.prose strong')
    expect(strong).toBeDefined()
  })

  it('readOnly desabilita o Textarea', () => {
    const { container } = render(
      <EditorSectionItem
        sectionKey="1_constituicao"
        number={1}
        title="Constituição"
        generatedValue="A"
        deliveredValue="A"
        onChange={vi.fn()}
        readOnly={true}
      />,
    )
    const textarea = container.querySelector('textarea')
    expect(textarea?.hasAttribute('disabled')).toBe(true)
  })

  it('Plan 14 UAT-2 fix: preview body strips the duplicate ## §N — Title heading line', () => {
    // 14-section Iris Codex V1 format: `## §N — Title\n\nbody`
    const deliveredValue =
      '## §1 — Constituição e Temperamento\n\nO organismo é linfático com tendência à retenção.'
    const { container } = render(
      <EditorSectionItem
        sectionKey="1_constituicao_temperamento"
        number={1}
        title="Constituição e Temperamento"
        generatedValue=""
        deliveredValue={deliveredValue}
        onChange={vi.fn()}
      />,
    )
    // Preview pane content
    const prose = container.querySelector('.prose')
    expect(prose).not.toBeNull()
    const proseText = prose?.textContent ?? ''
    // Body content is preserved
    expect(proseText).toContain('O organismo é linfático')
    // Heading line is stripped — no `## §1` literal and no rendered <h2>
    // matching the section title in the preview
    expect(proseText).not.toContain('## §1')
    const h2InPreview = prose?.querySelector('h2')
    expect(h2InPreview).toBeNull()
    // But the textarea (source view) still has the raw markdown including the heading
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.value).toContain('## §1 — Constituição e Temperamento')
  })

  it('Plan 14 UAT-2 fix: preview body strip also handles legacy 13-section `### N. ` heading shape', () => {
    const deliveredValue = '### 1. Constituição linfática\n\nBody content here.'
    const { container } = render(
      <EditorSectionItem
        sectionKey="1_constituicao"
        number={1}
        title="Constituição"
        generatedValue=""
        deliveredValue={deliveredValue}
        onChange={vi.fn()}
      />,
    )
    const prose = container.querySelector('.prose')
    const proseText = prose?.textContent ?? ''
    expect(proseText).toContain('Body content here.')
    expect(proseText).not.toContain('### 1.')
    expect(proseText).not.toContain('Constituição linfática')
  })
})
