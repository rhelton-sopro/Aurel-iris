import * as React from 'react'
import type { Eye } from '@/lib/capture/sequence'
import type { Angle } from '@/lib/capture/sequence'

interface AngleIconProps extends React.SVGAttributes<SVGSVGElement> {
  eye: Eye
  angle: Angle
}

/**
 * SVG inline 96×96 com 6 variantes (3 ângulos × 2 olhos).
 * stroke=currentColor; escalar via Tailwind (className w-12 h-12, w-24 h-24 etc.).
 * NUNCA usar width=/height= inline — usar className apenas (UI-SPEC §AngleIcon).
 * D-11: ícone vetorial SVG do olho com seta indicando o ângulo.
 */
export function AngleIcon({ eye, angle, className, ...rest }: AngleIconProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      role="img"
      aria-label={`Indicador: olho ${eye === 'left' ? 'esquerdo' : 'direito'} ângulo ${angle}`}
      className={className}
      {...rest}
    >
      {/* Backlight: raios de sol ATRÁS do olho (z-index inferior) — UI-SPEC §AngleIcon backlight */}
      {angle === 'backlight' && (
        <g opacity="0.35" stroke="currentColor" strokeWidth="2">
          {/* 8 raios em torno do centro do olho */}
          {Array.from({ length: 8 }).map((_, i) => {
            const rad = (i * Math.PI) / 4
            const cx = 48
            const cy = 40
            const r1 = 30
            const r2 = 42
            const x1 = cx + r1 * Math.cos(rad)
            const y1 = cy + r1 * Math.sin(rad)
            const x2 = cx + r2 * Math.cos(rad)
            const y2 = cy + r2 * Math.sin(rad)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeLinecap="round" />
          })}
          <circle cx="48" cy="40" r="22" fill="currentColor" opacity="0.15" />
        </g>
      )}

      {/* Olho de frente — oval com íris (sempre presente em todas as variantes) */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Forma de olho: oval horizontal D-11 */}
        <path d="M16 40 Q48 18 80 40 Q48 62 16 40 Z" />
        {/* Íris (círculo central) */}
        <circle cx="48" cy="40" r="10" />
        {/* Pupila */}
        <circle cx="48" cy="40" r="3" fill="currentColor" />
      </g>

      {/* Setas — variam por angle */}
      {angle === 'frontal' && (
        /* Seta direta para baixo abaixo do olho — UI-SPEC §AngleIcon frontal */
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <line x1="48" y1="68" x2="48" y2="84" />
          <polyline points="42,78 48,84 54,78" />
        </g>
      )}

      {angle === 'lateral' && (
        /* Seta diagonal saindo da têmpora; direção depende do olho — UI-SPEC §AngleIcon lateral */
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {eye === 'right' ? (
            /* Seta para cima-direita (↗) */
            <>
              <line x1="76" y1="32" x2="90" y2="18" />
              <polyline points="82,18 90,18 90,26" />
            </>
          ) : (
            /* Seta para cima-esquerda (↖) */
            <>
              <line x1="20" y1="32" x2="6" y2="18" />
              <polyline points="14,18 6,18 6,26" />
            </>
          )}
        </g>
      )}

      {/* backlight: raios de sol atrás já indicam — sem seta adicional */}
    </svg>
  )
}
