'use client'

import * as React from 'react'
import {
  type QualityLevel,
  levelFromScore,
  LEVEL_BG_CLASS,
  LEVEL_LABEL,
  LEVEL_TEXT_CLASS,
  LEVEL_WIDTH,
} from '@/lib/capture/quality-scoring'

interface QualityIndicatorProps {
  score: number
}

export function QualityIndicator({ score }: QualityIndicatorProps) {
  const level: QualityLevel = levelFromScore(score)
  const width = LEVEL_WIDTH[level]
  const bg = LEVEL_BG_CLASS[level]
  const text = LEVEL_TEXT_CLASS[level]
  const label = LEVEL_LABEL[level]

  return (
    <div className="flex flex-col items-center gap-2 px-4">
      {/* Barra horizontal 8px full-width — UI-SPEC §QualityIndicator */}
      <div
        role="progressbar"
        aria-label={`Qualidade da imagem: ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(score * 100)}
        className="h-2 w-full max-w-md rounded-full overflow-hidden bg-white/15"
      >
        <div
          className={`h-full transition-all duration-300 ease-out ${bg}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {/* Label centralizada abaixo da barra (gap 8px = TW gap-2) */}
      <span
        className={`text-sm font-semibold rounded-full px-3 py-0.5 ${bg} ${text}`}
        aria-hidden="true"
      >
        {label}
      </span>
    </div>
  )
}
