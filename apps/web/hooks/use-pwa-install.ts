'use client'

import * as React from 'react'

// Tipo do evento beforeinstallprompt (não exportado por padrão pela TS DOM lib)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export interface UsePWAInstall {
  /** App está rodando em modo standalone (instalado) */
  isStandalone: boolean
  /** Device é iOS (Safari não suporta beforeinstallprompt) */
  isIOS: boolean
  /** Evento beforeinstallprompt foi capturado (Android Chrome) */
  canPromptAndroid: boolean
  /** Dispara o prompt nativo Android Chrome. Retorna true se aceito. No-op em iOS. */
  promptInstall: () => Promise<boolean>
}

export function usePWAInstall(): UsePWAInstall {
  const [isStandalone, setIsStandalone] = React.useState(false)
  const [isIOS, setIsIOS] = React.useState(false)
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    // Detectar standalone — matchMedia (cross-browser) + iOS legacy navigator.standalone
    const mql = window.matchMedia('(display-mode: standalone)')
    const updateStandalone = () => {
      const legacyIOS = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      setIsStandalone(mql.matches || legacyIOS)
    }
    updateStandalone()
    mql.addEventListener('change', updateStandalone)

    // Detectar iOS (sem suporte a beforeinstallprompt)
    const ua = window.navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream
    setIsIOS(iOS)

    // Capturar beforeinstallprompt (Chrome/Edge/Samsung Android)
    const onBIP = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBIP)

    // Limpar evento quando o app é instalado
    const onInstalled = () => {
      setInstallEvent(null)
      updateStandalone()
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      mql.removeEventListener('change', updateStandalone)
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = React.useCallback(async () => {
    if (!installEvent) return false
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    setInstallEvent(null)
    return outcome === 'accepted'
  }, [installEvent])

  return {
    isStandalone,
    isIOS,
    canPromptAndroid: installEvent !== null,
    promptInstall,
  }
}
