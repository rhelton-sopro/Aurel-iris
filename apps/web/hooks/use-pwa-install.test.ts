import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePWAInstall } from './use-pwa-install'

describe('usePWAInstall', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })
  })

  it('detects iOS user agent', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isIOS).toBe(true)
  })

  it('isStandalone false when matchMedia returns no match', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isStandalone).toBe(false)
  })

  it('canPromptAndroid is false until beforeinstallprompt fires', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.canPromptAndroid).toBe(false)
  })

  it('captures beforeinstallprompt event and exposes canPromptAndroid', () => {
    const { result } = renderHook(() => usePWAInstall())
    act(() => {
      const evt = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: string }>
      }
      // injetar métodos do tipo BeforeInstallPromptEvent
      Object.assign(evt, {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
        platforms: ['web'],
      })
      window.dispatchEvent(evt)
    })
    expect(result.current.canPromptAndroid).toBe(true)
  })

  it('promptInstall returns false when no installEvent captured', async () => {
    const { result } = renderHook(() => usePWAInstall())
    const accepted = await result.current.promptInstall()
    expect(accepted).toBe(false)
  })
})
