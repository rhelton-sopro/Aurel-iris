/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-06 (GradeBadge.tsx — text badge "Grade N/5 · label")
// Source: 07.4-VALIDATION.md, D-UI4, UI-SPEC §Surface 1b (line 217).
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GradeBadge } from '../GradeBadge'

describe('components/readings/GradeBadge (D-UI4) — Plan 07.4-06', () => {
  it('label text = "Grade {n}/5 · {tendency_label}"', () => {
    render(<GradeBadge grade={4} label="alta" />)
    expect(screen.getByText(/Grade 4\/5 · alta/)).toBeDefined()
  })

  it('outline variant default', () => {
    const { container } = render(<GradeBadge grade={2} label="leve-moderada" />)
    // Badge renders as <span>; outline variant applies "border-border text-foreground" classes
    const badge = container.querySelector('span')
    expect(badge).not.toBeNull()
    expect(badge!.className).toMatch(/border-border|text-foreground/)
  })
})
