/**
 * @vitest-environment jsdom
 *
 * IntegrativeAxesEditor — Plan 07.4-07b (NOT Wave 0).
 *
 * Wave 0 (Plan 00) was scoped before the Plan 07/07b split. Tests assert:
 *   - add-axis appends { axis_name: '', status: 'latente', description: '' }
 *   - remove-axis splices by index
 *   - per-axis edit (name + status + description) replaces row at index
 *   - empty-state copy when axes=[] in collapsed mode
 *   - status Select with AXIS_STATUSES enum (ativo/latente/inativo)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntegrativeAxesEditor } from '../IntegrativeAxesEditor'

const mockAxes = [
  {
    axis_name: 'Fígado-Linfa-Mucosa',
    status: 'ativo' as const,
    description: 'Eixo expressando carga circulatória.',
  },
]

describe('IntegrativeAxesEditor (Plan 07.4-07b — NOT Wave 0)', () => {
  it('renders existing axes in collapsed mode', () => {
    render(
      <IntegrativeAxesEditor
        axes={mockAxes}
        initialAxes={mockAxes}
        saving={false}
        expanded={false}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Fígado-Linfa-Mucosa')).toBeInTheDocument()
  })

  it('clicking Editar in collapsed mode calls onExpand', () => {
    const onExpand = vi.fn()
    render(
      <IntegrativeAxesEditor
        axes={mockAxes}
        initialAxes={mockAxes}
        saving={false}
        expanded={false}
        onExpand={onExpand}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('editar-integrative_axes'))
    expect(onExpand).toHaveBeenCalled()
  })

  it('shows "Adicionar eixo" button when expanded', () => {
    render(
      <IntegrativeAxesEditor
        axes={mockAxes}
        initialAxes={mockAxes}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('add-axis')).toBeInTheDocument()
  })

  it('add-axis pushes a new empty axis with status="latente"', () => {
    const onChange = vi.fn()
    render(
      <IntegrativeAxesEditor
        axes={mockAxes}
        initialAxes={mockAxes}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('add-axis'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0]![0] as Array<{
      axis_name: string
      status: string
      description: string
    }>
    expect(arg).toHaveLength(2)
    expect(arg[0]).toEqual(mockAxes[0])
    expect(arg[1]).toEqual({
      axis_name: '',
      status: 'latente',
      description: '',
    })
  })

  it('remove-axis splices by index', () => {
    const onChange = vi.fn()
    render(
      <IntegrativeAxesEditor
        axes={mockAxes}
        initialAxes={mockAxes}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('remove-axis-0'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('editing axis_name calls onChange with updated row', () => {
    const onChange = vi.fn()
    render(
      <IntegrativeAxesEditor
        axes={mockAxes}
        initialAxes={mockAxes}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    const input = screen.getByTestId('axis-name-0') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Novo eixo' } })
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ axis_name: 'Novo eixo' }),
    ])
  })

  it('editing description calls onChange with updated row', () => {
    const onChange = vi.fn()
    render(
      <IntegrativeAxesEditor
        axes={mockAxes}
        initialAxes={mockAxes}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    const textarea = screen.getByTestId('axis-description-0') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'nova descrição' } })
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ description: 'nova descrição' }),
    ])
  })

  it('renders empty-state copy when axes is empty in collapsed mode', () => {
    render(
      <IntegrativeAxesEditor
        axes={[]}
        initialAxes={[]}
        saving={false}
        expanded={false}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Nenhum eixo registrado.')).toBeInTheDocument()
  })

  it('Save disabled when not dirty (isDirty=false)', () => {
    render(
      <IntegrativeAxesEditor
        axes={mockAxes}
        initialAxes={mockAxes}
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

  it('Save enabled when axes differ from initialAxes', () => {
    render(
      <IntegrativeAxesEditor
        axes={[]}
        initialAxes={mockAxes}
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
})
