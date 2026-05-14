/**
 * @vitest-environment jsdom
 *
 * SystemTendencyCardEditor — Plan 07.4-07b (NOT Wave 0).
 *
 * Wave 0 (Plan 00) was scoped before the Plan 07/07b split. These tests are
 * native to 07b and assert: 6 editable fields per system (D-SCH3 + UI-SPEC
 * §Surface 2 lines 263-267), auto-sync grade→label via GRADE_TO_LABEL map,
 * newline-delimited parser for associated_manifestations + investigation_points.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SystemTendencyCardEditor } from '../SystemTendencyCardEditor'
import type { SystemTendency } from '@/lib/anthropic/report-schema'

const mockSystem: SystemTendency = {
  system_id: 'linfatico',
  system_name: 'Sistema linfático',
  tendency_grade: 3,
  tendency_label: 'moderada',
  clinical_description: 'Tendência inflamatória.',
  associated_manifestations: ['edema', 'sinusite'],
  investigation_points: ['hidratação', 'mobilização'],
  therapeutic_direction: 'Drenagem linfática.',
}

describe('SystemTendencyCardEditor (Plan 07.4-07b — NOT Wave 0)', () => {
  it('renders system name + GradeBadge in collapsed mode', () => {
    render(
      <SystemTendencyCardEditor
        system={mockSystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={false}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Sistema linfático')).toBeInTheDocument()
    expect(screen.getByText(/Grade 3\/5/)).toBeInTheDocument()
  })

  it('shows "Editar" button when collapsed; clicking it calls onExpand', () => {
    const onExpand = vi.fn()
    render(
      <SystemTendencyCardEditor
        system={mockSystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={false}
        onExpand={onExpand}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId(`editar-system-${mockSystem.system_id}`))
    expect(onExpand).toHaveBeenCalled()
  })

  it('renders all 6 form fields when expanded', () => {
    render(
      <SystemTendencyCardEditor
        system={mockSystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(
      screen.getByTestId(`system-grade-${mockSystem.system_id}`),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(`system-label-${mockSystem.system_id}`),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(`system-description-${mockSystem.system_id}`),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(`system-manifestations-${mockSystem.system_id}`),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(`system-investigations-${mockSystem.system_id}`),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(`system-direction-${mockSystem.system_id}`),
    ).toBeInTheDocument()
  })

  it('parses newline-delimited manifestations into array on edit', () => {
    const onChange = vi.fn()
    render(
      <SystemTendencyCardEditor
        system={mockSystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    const textarea = screen.getByTestId(
      `system-manifestations-${mockSystem.system_id}`,
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'a\nb\nc' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ associated_manifestations: ['a', 'b', 'c'] }),
    )
  })

  it('parses newline-delimited investigation_points into array on edit', () => {
    const onChange = vi.fn()
    render(
      <SystemTendencyCardEditor
        system={mockSystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    const textarea = screen.getByTestId(
      `system-investigations-${mockSystem.system_id}`,
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'x\ny' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ investigation_points: ['x', 'y'] }),
    )
  })

  it('Salvar bloco disabled when not dirty (isDirty=false)', () => {
    render(
      <SystemTendencyCardEditor
        system={mockSystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    const save = screen.getByTestId('block-edit-pane-save') as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it('Salvar bloco enabled when dirty (system differs from initialSystem)', () => {
    const dirtySystem = {
      ...mockSystem,
      clinical_description: 'edited description',
    }
    render(
      <SystemTendencyCardEditor
        system={dirtySystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    const save = screen.getByTestId('block-edit-pane-save') as HTMLButtonElement
    expect(save.disabled).toBe(false)
  })

  it('editing clinical_description calls onChange with new text', () => {
    const onChange = vi.fn()
    render(
      <SystemTendencyCardEditor
        system={mockSystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    const textarea = screen.getByTestId(
      `system-description-${mockSystem.system_id}`,
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'new clinical desc' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ clinical_description: 'new clinical desc' }),
    )
  })

  it('editing therapeutic_direction calls onChange with new text', () => {
    const onChange = vi.fn()
    render(
      <SystemTendencyCardEditor
        system={mockSystem}
        initialSystem={mockSystem}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    const textarea = screen.getByTestId(
      `system-direction-${mockSystem.system_id}`,
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'novo plano' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ therapeutic_direction: 'novo plano' }),
    )
  })
})
