/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-06 (SystemTendencyCard.tsx — per-system card with grade badge + bar)
// Source: 07.4-VALIDATION.md, D-UI1, UI-SPEC §Surface 1b lines 354-376.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SystemTendencyCard } from '../SystemTendencyCard'
import type { SystemTendency } from '@/lib/anthropic/report-schema-shared'

const baseSystem: SystemTendency = {
  system_id: 'linfatico',
  system_name: 'Sistema linfático',
  tendency_grade: 4,
  tendency_label: 'alta',
  clinical_description: 'Sinais sugerem drenagem linfática comprometida.',
  associated_manifestations: ['sinusite recorrente', 'edema vespertino'],
  investigation_points: ['histórico infeccioso', 'qualidade da hidratação'],
  therapeutic_direction: 'Considere protocolos de drenagem linfática e suporte imune funcional.',
}

describe('components/readings/SystemTendencyCard (D-UI1) — Plan 07.4-06', () => {
  it('renders system_name + GradeBadge + GradeBar in header', () => {
    const { container } = render(<SystemTendencyCard system={baseSystem} />)
    // system_name heading
    expect(screen.getByText('Sistema linfático')).toBeDefined()
    // GradeBadge text format
    expect(screen.getByText(/Grade 4\/5 · alta/)).toBeDefined()
    // GradeBar wrapper (role=img)
    expect(container.querySelector('[role="img"]')).not.toBeNull()
  })

  it('2-col bullets render associated_manifestations + investigation_points', () => {
    render(<SystemTendencyCard system={baseSystem} />)
    expect(screen.getByText('Manifestações associadas')).toBeDefined()
    expect(screen.getByText('Pontos para investigação')).toBeDefined()
    expect(screen.getByText('sinusite recorrente')).toBeDefined()
    expect(screen.getByText('edema vespertino')).toBeDefined()
    expect(screen.getByText('histórico infeccioso')).toBeDefined()
    expect(screen.getByText('qualidade da hidratação')).toBeDefined()
  })

  it('therapeutic_direction footer has bg-muted/50 highlight class', () => {
    const { container } = render(<SystemTendencyCard system={baseSystem} />)
    // The highlighted footer wraps "Direção terapêutica" + the markdown direction
    const highlighted = container.querySelector('.bg-muted\\/50')
    expect(highlighted).not.toBeNull()
    expect(highlighted!.textContent).toContain('Direção terapêutica')
    expect(highlighted!.textContent).toContain('drenagem linfática')
  })
})
