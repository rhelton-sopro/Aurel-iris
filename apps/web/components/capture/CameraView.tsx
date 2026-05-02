'use client'

import * as React from 'react'
import { Camera } from 'lucide-react'
import { useCamera } from '@/hooks/use-camera'
import { CameraDeniedScreen } from './CameraDeniedScreen'

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export function CameraView({ videoRef }: CameraViewProps) {
  const { status, errorType, start } = useCamera({ videoRef })

  // Estados denied/error → tela de fallback fullscreen (D-15)
  if (status === 'denied' || status === 'error') {
    return <CameraDeniedScreen errorType={errorType} onRetry={start} />
  }

  return (
    <div className="relative flex-1 w-full bg-black overflow-hidden">
      {/* Vídeo fullscreen — playsInline + muted + autoPlay são obrigatórios para iOS Safari (RESEARCH Pitfall 8) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-label="Visualização da câmera traseira"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Estado idle/requesting overlay */}
      {(status === 'idle' || status === 'requesting') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
          <Camera className="h-12 w-12 text-white/70 animate-pulse" />
          <p className="text-sm text-white/80">Solicitando acesso à câmera</p>
        </div>
      )}


    </div>
  )
}
