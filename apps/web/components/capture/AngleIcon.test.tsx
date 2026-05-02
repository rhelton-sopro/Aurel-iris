import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AngleIcon } from './AngleIcon'

describe('AngleIcon', () => {
  it.each([
    ['right', 'frontal'],
    ['right', 'lateral'],
    ['right', 'backlight'],
    ['left', 'frontal'],
    ['left', 'lateral'],
    ['left', 'backlight'],
  ] as const)('renders %s/%s without crashing', (eye, angle) => {
    const { container } = render(<AngleIcon eye={eye} angle={angle} className="w-12 h-12" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 96 96')
  })

  it('has aria-label with translated eye name for left', () => {
    const { container } = render(<AngleIcon eye="left" angle="frontal" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toContain('esquerdo')
  })

  it('has aria-label with translated eye name for right', () => {
    const { container } = render(<AngleIcon eye="right" angle="frontal" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toContain('direito')
  })

  it('does not set inline width or height attributes', () => {
    const { container } = render(<AngleIcon eye="left" angle="frontal" className="w-24 h-24" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBeNull()
    expect(svg?.getAttribute('height')).toBeNull()
  })

  it('has role img for accessibility', () => {
    const { container } = render(<AngleIcon eye="right" angle="backlight" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
  })

  it('renders backlight variant with sun ray elements', () => {
    const { container } = render(<AngleIcon eye="right" angle="backlight" />)
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThan(0)
  })
})
