import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStableQualityGate, useQualityLevel } from './use-quality-score'

describe('useStableQualityGate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'Date', 'setTimeout', 'setInterval', 'clearInterval'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not trigger when score stays below gate', () => {
    const onTrigger = vi.fn()
    const { rerender } = renderHook(({ score }) => useStableQualityGate(score, onTrigger), {
      initialProps: { score: 0.30 },
    })
    act(() => { vi.advanceTimersByTime(800) })
    rerender({ score: 0.45 })
    act(() => { vi.advanceTimersByTime(800) })
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('does not trigger when score crosses gate but falls before 200ms', () => {
    const onTrigger = vi.fn()
    const { rerender } = renderHook(({ score }) => useStableQualityGate(score, onTrigger), {
      initialProps: { score: 0.30 },
    })
    rerender({ score: 0.80 })
    act(() => { vi.advanceTimersByTime(100) })
    rerender({ score: 0.40 })
    act(() => { vi.advanceTimersByTime(400) })
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('triggers exactly once after 200ms continuous above gate', () => {
    const onTrigger = vi.fn()
    const { rerender } = renderHook(({ score }) => useStableQualityGate(score, onTrigger), {
      initialProps: { score: 0.50 },
    })
    rerender({ score: 0.85 })
    act(() => { vi.advanceTimersByTime(250) })
    expect(onTrigger).toHaveBeenCalledTimes(1)
    // Continuar score alto não dispara de novo
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('reset() allows re-triggering', () => {
    const onTrigger = vi.fn()
    const { result, rerender } = renderHook(({ score }) => useStableQualityGate(score, onTrigger), {
      initialProps: { score: 0.85 },
    })
    act(() => { vi.advanceTimersByTime(450) })
    expect(onTrigger).toHaveBeenCalledTimes(1)

    act(() => { result.current.reset() })
    rerender({ score: 0.50 })
    rerender({ score: 0.85 })
    act(() => { vi.advanceTimersByTime(450) })
    expect(onTrigger).toHaveBeenCalledTimes(2)
  })

  it('respects custom stabilityMs option', () => {
    const onTrigger = vi.fn()
    const { rerender } = renderHook(
      ({ score }) => useStableQualityGate(score, onTrigger, { stabilityMs: 1000 }),
      { initialProps: { score: 0.85 } }
    )
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTrigger).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(600) })
    expect(onTrigger).toHaveBeenCalledTimes(1)
    void rerender // silence unused
  })
})

describe('useQualityLevel', () => {
  it('maps 0.30 → ruim', () => {
    const { result } = renderHook(() => useQualityLevel(0.30))
    expect(result.current).toBe('ruim')
  })
  it('maps 0.95 → excelente', () => {
    const { result } = renderHook(() => useQualityLevel(0.95))
    expect(result.current).toBe('excelente')
  })
})
