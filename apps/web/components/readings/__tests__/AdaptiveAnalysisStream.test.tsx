/**
 * @vitest-environment jsdom
 */
// IMPLEMENTED BY: 07.4-07 (AdaptiveAnalysisStream.tsx — streaming progress UI)
// Source: 07.4-VALIDATION.md, D-VAL3 path (b), UI-SPEC §Streaming Visual Cue.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AdaptiveAnalysisStream } from '../AdaptiveAnalysisStream'

describe('components/readings/AdaptiveAnalysisStream (D-VAL3) — Plan 07.4-07', () => {
  it('renders "Gerando relatório… {n}/8 blocos"', () => {
    render(<AdaptiveAnalysisStream blocksReceived={3} />)
    expect(
      screen.getByTestId('adaptive-analysis-stream-counter'),
    ).toHaveTextContent('Gerando relatório… 3/8 blocos')
  })

  it('clamps blocksReceived to [0, 8]', () => {
    const { rerender } = render(<AdaptiveAnalysisStream blocksReceived={-2} />)
    expect(
      screen.getByTestId('adaptive-analysis-stream-counter'),
    ).toHaveTextContent('0/8 blocos')
    rerender(<AdaptiveAnalysisStream blocksReceived={99} />)
    expect(
      screen.getByTestId('adaptive-analysis-stream-counter'),
    ).toHaveTextContent('8/8 blocos')
  })

  it('shows Skeleton per pending block', () => {
    const { container } = render(<AdaptiveAnalysisStream blocksReceived={2} />)
    // 8 total blocks − 2 received = 6 skeletons
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBe(6)
  })

  it('renders an aria-live polite region', () => {
    const { container } = render(<AdaptiveAnalysisStream blocksReceived={1} />)
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live?.getAttribute('role')).toBe('region')
  })

  it('renders error fallback message when error is set', () => {
    render(<AdaptiveAnalysisStream blocksReceived={4} error="boom" />)
    expect(
      screen.getByTestId('adaptive-analysis-stream-error'),
    ).toHaveTextContent(/A geração foi interrompida\./)
  })
})
