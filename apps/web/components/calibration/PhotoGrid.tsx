'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

export interface CalibrationPhoto {
  eye: 'right' | 'left'
  angle: 'frontal' | 'lateral' | 'backlight'
  signedUrl: string
}

const EYE_LABEL: Record<CalibrationPhoto['eye'], string> = {
  right: 'OD',
  left: 'OE',
}

const ANGLE_LABEL: Record<CalibrationPhoto['angle'], string> = {
  frontal: 'frontal',
  lateral: 'lateral',
  backlight: 'contraluz',
}

const ANGLE_ORDER: CalibrationPhoto['angle'][] = ['frontal', 'lateral', 'backlight']

function sortPhotos(photos: CalibrationPhoto[]): CalibrationPhoto[] {
  // OD row first, then OE; within each row: frontal | lateral | backlight.
  return [...photos].sort((a, b) => {
    if (a.eye !== b.eye) return a.eye === 'right' ? -1 : 1
    return ANGLE_ORDER.indexOf(a.angle) - ANGLE_ORDER.indexOf(b.angle)
  })
}

export function PhotoGrid({ photos }: { photos: CalibrationPhoto[] }) {
  const [zoomed, setZoomed] = useState<CalibrationPhoto | null>(null)
  const sorted = sortPhotos(photos)

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Nenhuma foto registrada para esta leitura.
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {sorted.map(photo => (
          <button
            key={`${photo.eye}-${photo.angle}`}
            type="button"
            onClick={() => setZoomed(photo)}
            className="group flex flex-col gap-1.5 rounded-md overflow-hidden border bg-muted/30 hover:bg-muted transition-colors text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.signedUrl}
                alt={`${EYE_LABEL[photo.eye]} ${ANGLE_LABEL[photo.angle]}`}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="px-2 pb-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{EYE_LABEL[photo.eye]}</span>{' '}
              {ANGLE_LABEL[photo.angle]}
            </div>
          </button>
        ))}
      </div>

      <Dialog open={zoomed != null} onOpenChange={open => !open && setZoomed(null)}>
        <DialogContent className="max-w-5xl p-0 bg-black border-none">
          {zoomed && (
            <>
              <DialogTitle className="sr-only">
                {EYE_LABEL[zoomed.eye]} {ANGLE_LABEL[zoomed.angle]} — full resolution
              </DialogTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomed.signedUrl}
                alt={`${EYE_LABEL[zoomed.eye]} ${ANGLE_LABEL[zoomed.angle]}`}
                className="w-full h-auto max-h-[90vh] object-contain"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

