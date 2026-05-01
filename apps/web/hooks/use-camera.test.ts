import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import * as React from 'react'
import { useCamera } from './use-camera'

function makeMockTrack() {
  return { stop: vi.fn(), kind: 'video' }
}

function makeMockStream() {
  const tracks = [makeMockTrack(), makeMockTrack()]
  return {
    getTracks: () => tracks,
    _tracks: tracks,
  } as unknown as MediaStream & { _tracks: ReturnType<typeof makeMockTrack>[] }
}

describe('useCamera', () => {
  let getUserMediaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUserMediaMock = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts streaming when getUserMedia resolves', async () => {
    const stream = makeMockStream()
    getUserMediaMock.mockResolvedValue(stream)
    const videoRef = { current: { srcObject: null, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement }

    const { result } = renderHook(() => useCamera({ videoRef: videoRef as React.RefObject<HTMLVideoElement | null> }))

    await waitFor(() => expect(result.current.status).toBe('streaming'))
    expect(result.current.stream).toBe(stream)
    expect(result.current.errorType).toBeNull()
  })

  it('handles NotAllowedError → denied status', async () => {
    getUserMediaMock.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    const videoRef = { current: null }

    const { result } = renderHook(() => useCamera({ videoRef: videoRef as React.RefObject<HTMLVideoElement | null> }))

    await waitFor(() => expect(result.current.status).toBe('denied'))
    expect(result.current.errorType).toBe('NotAllowedError')
  })

  it('handles NotFoundError → error status', async () => {
    getUserMediaMock.mockRejectedValue(Object.assign(new Error('no cam'), { name: 'NotFoundError' }))
    const videoRef = { current: null }

    const { result } = renderHook(() => useCamera({ videoRef: videoRef as React.RefObject<HTMLVideoElement | null> }))

    await waitFor(() => expect(result.current.errorType).toBe('NotFoundError'))
    expect(result.current.status).toBe('error')
  })

  it('handles OverconstrainedError', async () => {
    getUserMediaMock.mockRejectedValue(Object.assign(new Error('over'), { name: 'OverconstrainedError' }))
    const videoRef = { current: null }
    const { result } = renderHook(() => useCamera({ videoRef: videoRef as React.RefObject<HTMLVideoElement | null> }))
    await waitFor(() => expect(result.current.errorType).toBe('OverconstrainedError'))
  })

  it('stop() kills all tracks', async () => {
    const stream = makeMockStream()
    getUserMediaMock.mockResolvedValue(stream)
    const videoRef = { current: { srcObject: null, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement }

    const { result } = renderHook(() => useCamera({ videoRef: videoRef as React.RefObject<HTMLVideoElement | null> }))
    await waitFor(() => expect(result.current.status).toBe('streaming'))

    act(() => { result.current.stop() })

    expect(stream._tracks.every(t => t.stop.mock.calls.length >= 1)).toBe(true)
    expect(result.current.status).toBe('idle')
    expect(result.current.stream).toBeNull()
  })

  it('unmount triggers cleanup (stops tracks)', async () => {
    const stream = makeMockStream()
    getUserMediaMock.mockResolvedValue(stream)
    const videoRef = { current: { srcObject: null, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement }

    const { unmount, result } = renderHook(() => useCamera({ videoRef: videoRef as React.RefObject<HTMLVideoElement | null> }))
    await waitFor(() => expect(result.current.status).toBe('streaming'))

    unmount()

    expect(stream._tracks.every(t => t.stop.mock.calls.length >= 1)).toBe(true)
  })

  it('autoStart=false does not call getUserMedia immediately', () => {
    const videoRef = { current: null }
    renderHook(() => useCamera({ videoRef: videoRef as React.RefObject<HTMLVideoElement | null>, autoStart: false }))
    expect(getUserMediaMock).not.toHaveBeenCalled()
  })
})
