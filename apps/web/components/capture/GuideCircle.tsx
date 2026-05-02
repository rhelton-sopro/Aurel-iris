'use client'

import * as React from 'react'
import { levelFromScore, type QualityLevel } from '@/lib/capture/quality-scoring'

const STROKE_COLOR: Record<QualityLevel, string> = {
  ruim:      '#ef4444',  // red-500
  regular:   '#fbbf24',  // amber-400
  boa:       '#34d399',  // emerald-400
  excelente: '#059669',  // emerald-600
}

interface GuideCircleProps {
  score: number
}

/**
 * Círculo guia grande (~60vmin de diâmetro) sempre visível durante captura.
 * Stroke duplo: halo preto fora + cor do nível dentro — visível em fundo claro e escuro.
 */
export function GuideCircle({ score }: GuideCircleProps) {
  const level = levelFromScore(score)
  const stroke = STROKE_COLOR[level]

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
    >
      <svg viewBox="0 0 100 100" className="w-[60vmin] h-[60vmin]">
        {/* Halo externo preto — contraste contra fundo claro */}
        <circle
          cx="50" cy="50" r="47"
          fill="none"
          stroke="black"
          strokeWidth="6"
          strokeOpacity="0.4"
        />
        {/* Anel principal — cor do nível por cima do halo preto */}
        <circle
          cx="50" cy="50" r="47"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeOpacity="0.95"
        />
        {/* Marcadores cardinais — também com halo preto */}
        {([0, 90, 180, 270] as const).map(deg => {
          const rad = (deg * Math.PI) / 180
          const x = 50 + 47 * Math.sin(rad)
          const y = 50 - 47 * Math.cos(rad)
          return (
            <React.Fragment key={deg}>
              <circle cx={x} cy={y} r="3" fill="black" fillOpacity="0.4" />
              <circle cx={x} cy={y} r="2" fill={stroke} fillOpacity="0.95" />
            </React.Fragment>
          )
        })}
      </svg>
    </div>
  )
}
