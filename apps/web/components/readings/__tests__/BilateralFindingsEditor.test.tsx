/**
 * @vitest-environment jsdom
 *
 * BilateralFindingsEditor — Plan 07.4-07b (NOT Wave 0).
 *
 * UI-SPEC FLAG-5: the editor must render the form UNCONDITIONALLY regardless
 * of asymmetry_present so the therapist can toggle it on if asymmetry was
 * missed during the LLM pass.
 *
 * Wave 0 (Plan 00) was scoped before the Plan 07/07b split.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BilateralFindingsEditor } from '../BilateralFindingsEditor'

const noAsymmetry = { asymmetry_present: false, description: null }
const withAsymmetry = {
  asymmetry_present: true,
  description: 'Lado direito mais expressivo.',
}

describe('BilateralFindingsEditor (Plan 07.4-07b — NOT Wave 0 — FLAG-5)', () => {
  it('renders Card title even when asymmetry_present=false (FLAG-5)', () => {
    render(
      <BilateralFindingsEditor
        bilateral={noAsymmetry}
        initialBilateral={noAsymmetry}
        saving={false}
        expanded={false}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    // Card title is visible regardless of asymmetry_present (FLAG-5 — unlike
    // the read-only BilateralFindingsCard which returns null when absent).
    expect(screen.getByText('Achados bilaterais')).toBeInTheDocument()
  })

  it('shows "Sem assimetria registrada." copy when collapsed + asymmetry false', () => {
    render(
      <BilateralFindingsEditor
        bilateral={noAsymmetry}
        initialBilateral={noAsymmetry}
        saving={false}
        expanded={false}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Sem assimetria registrada.')).toBeInTheDocument()
  })

  it('clicking Editar in collapsed mode calls onExpand', () => {
    const onExpand = vi.fn()
    render(
      <BilateralFindingsEditor
        bilateral={noAsymmetry}
        initialBilateral={noAsymmetry}
        saving={false}
        expanded={false}
        onExpand={onExpand}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('editar-bilateral_findings'))
    expect(onExpand).toHaveBeenCalled()
  })

  it('renders Checkbox + Textarea when expanded (FLAG-5: even when asymmetry false)', () => {
    render(
      <BilateralFindingsEditor
        bilateral={noAsymmetry}
        initialBilateral={noAsymmetry}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bilateral-present')).toBeInTheDocument()
    expect(screen.getByTestId('bilateral-description')).toBeInTheDocument()
  })

  it('toggling Checkbox calls onChange with updated asymmetry_present', () => {
    const onChange = vi.fn()
    render(
      <BilateralFindingsEditor
        bilateral={noAsymmetry}
        initialBilateral={noAsymmetry}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('bilateral-present'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ asymmetry_present: true }),
    )
  })

  it('typing into description calls onChange with the typed string', () => {
    const onChange = vi.fn()
    render(
      <BilateralFindingsEditor
        bilateral={noAsymmetry}
        initialBilateral={noAsymmetry}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    const textarea = screen.getByTestId('bilateral-description') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'descrição nova' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'descrição nova' }),
    )
  })

  it('clearing the description textarea sets description to null', () => {
    const onChange = vi.fn()
    render(
      <BilateralFindingsEditor
        bilateral={withAsymmetry}
        initialBilateral={withAsymmetry}
        saving={false}
        expanded={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={onChange}
      />,
    )
    const textarea = screen.getByTestId('bilateral-description') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    )
  })

  it('renders existing description in collapsed mode when asymmetry_present=true', () => {
    render(
      <BilateralFindingsEditor
        bilateral={withAsymmetry}
        initialBilateral={withAsymmetry}
        saving={false}
        expanded={false}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    )
    expect(
      screen.getByText('Lado direito mais expressivo.'),
    ).toBeInTheDocument()
  })

  it('Save disabled when not dirty', () => {
    render(
      <BilateralFindingsEditor
        bilateral={noAsymmetry}
        initialBilateral={noAsymmetry}
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

  it('Save enabled when bilateral differs from initialBilateral', () => {
    render(
      <BilateralFindingsEditor
        bilateral={withAsymmetry}
        initialBilateral={noAsymmetry}
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
