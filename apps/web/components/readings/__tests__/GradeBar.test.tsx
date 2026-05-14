/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-06 (GradeBar.tsx — 5-segment horizontal bar per grade)
// Source: 07.4-VALIDATION.md, D-UI4, UI-SPEC §Color Grade visual bar palette (lines 125-160).
// Palette resolved by UI-SPEC: amber-200 / amber-400 / orange-500 / red-500 / red-700.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GradeBar } from '../GradeBar'

describe('components/readings/GradeBar (D-UI4) — Plan 07.4-06', () => {
  it('renders 5 div segments', () => {
    const { container } = render(<GradeBar grade={3} />)
    const wrapper = container.querySelector('[role="img"]')
    expect(wrapper).not.toBeNull()
    // 5 child segments (aria-hidden) inside the wrapper
    const segments = wrapper!.querySelectorAll('div[aria-hidden]')
    expect(segments.length).toBe(5)
  })

  it('fills first N segments per grade prop', () => {
    const { container } = render(<GradeBar grade={3} />)
    const segments = container.querySelectorAll('[role="img"] > div[aria-hidden]')
    // Grade 3 → first 3 segments use orange-500; last 2 use bg-muted
    expect(segments[0].className).toContain('bg-orange-500')
    expect(segments[1].className).toContain('bg-orange-500')
    expect(segments[2].className).toContain('bg-orange-500')
    expect(segments[3].className).toContain('bg-muted')
    expect(segments[4].className).toContain('bg-muted')
  })

  it('applies bg-amber-200 for grade 1, bg-red-700 for grade 5 (UI-SPEC palette)', () => {
    const { container: c1 } = render(<GradeBar grade={1} />)
    const segs1 = c1.querySelectorAll('[role="img"] > div[aria-hidden]')
    expect(segs1[0].className).toContain('bg-amber-200')
    expect(segs1[1].className).toContain('bg-muted')

    const { container: c5 } = render(<GradeBar grade={5} />)
    const segs5 = c5.querySelectorAll('[role="img"] > div[aria-hidden]')
    expect(segs5[0].className).toContain('bg-red-700')
    expect(segs5[4].className).toContain('bg-red-700')
  })

  it('exposes accessibility role + aria-label', () => {
    const { container } = render(<GradeBar grade={4} />)
    const wrapper = container.querySelector('[role="img"]')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.getAttribute('aria-label')).toMatch(/4 de 5/)
  })
})
