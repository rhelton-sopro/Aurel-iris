import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CapturePreview } from './CapturePreview'

describe('CapturePreview', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders the image and quality badge', () => {
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.95} onRedo={vi.fn()} onTimeout={vi.fn()} />
    )
    expect(screen.getByAltText('Foto capturada')).toHaveAttribute('src', 'blob:test')
    expect(screen.getByText('Excelente')).toBeInTheDocument()
  })

  it('renders "Boa" badge for score 0.80', () => {
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.80} onRedo={vi.fn()} onTimeout={vi.fn()} />
    )
    expect(screen.getByText('Boa')).toBeInTheDocument()
  })

  it('calls onRedo when clicked', () => {
    const onRedo = vi.fn()
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.85} onRedo={onRedo} onTimeout={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Tocar para refazer/ }))
    expect(onRedo).toHaveBeenCalled()
  })

  it('calls onTimeout after default 2000ms', () => {
    const onTimeout = vi.fn()
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.85} onRedo={vi.fn()} onTimeout={onTimeout} />
    )
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2010)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('respects custom durationMs', () => {
    const onTimeout = vi.fn()
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.85} onRedo={vi.fn()} onTimeout={onTimeout} durationMs={1000} />
    )
    vi.advanceTimersByTime(500)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(600)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('shows "Tocar para refazer" text', () => {
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.85} onRedo={vi.fn()} onTimeout={vi.fn()} />
    )
    expect(screen.getByText('Tocar para refazer')).toBeInTheDocument()
  })
})
