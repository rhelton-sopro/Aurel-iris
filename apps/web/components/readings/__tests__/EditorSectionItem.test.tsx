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
})
