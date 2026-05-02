'use client'

import * as React from 'react'
import { Info, X } from 'lucide-react'
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

const CRITERIA = [
  { label: 'Distância', desc: 'A íris deve preencher o círculo guia — aproxime o celular' },
  { label: 'Centralização', desc: 'Mantenha a íris no centro do círculo' },
  { label: 'Nitidez', desc: 'Imagem em foco — segure o celular firme' },
  { label: 'Exposição', desc: 'Iluminação adequada, sem contraluz excessivo' },
  { label: 'Reflexo', desc: 'Sem ponto brilhante sobre a íris' },
  { label: 'Pálpebra', desc: 'Olho bem aberto, pálpebra acima da íris' },
]

export function QualityIndicator({ score }: QualityIndicatorProps) {
  const level: QualityLevel = levelFromScore(score)
  const width = LEVEL_WIDTH[level]
  const bg = LEVEL_BG_CLASS[level]
  const text = LEVEL_TEXT_CLASS[level]
  const label = LEVEL_LABEL[level]
  const pct = Math.round(score * 100)

  const [showCriteria, setShowCriteria] = React.useState(false)

  return (
    <div className="flex flex-col items-center gap-2 px-4">
      {/* Barra horizontal 8px full-width — UI-SPEC §QualityIndicator */}
      <div
        role="progressbar"
        aria-label={`Qualidade da imagem: ${label} ${pct}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 w-full max-w-md rounded-full overflow-hidden bg-white/15"
      >
        <div
          className={`h-full transition-all duration-300 ease-out ${bg}`}
          style={{ width: `${width}%` }}
        />
      </div>

      {/* Label chip + percentual + info toggle */}
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-semibold rounded-full px-3 py-0.5 ${bg} ${text}`}
          aria-hidden="true"
        >
          {label} · {pct}%
        </span>
        <button
          type="button"
          onClick={() => setShowCriteria(v => !v)}
          aria-label="Critérios de qualidade"
          className="rounded-full bg-white/20 p-1 text-white/80 hover:bg-white/30 transition-colors"
        >
          {showCriteria ? <X className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Painel de critérios */}
      {showCriteria && (
        <div className="mt-1 w-full max-w-xs rounded-xl bg-black/75 backdrop-blur-sm px-4 py-3 text-white/90 text-xs space-y-2">
          <p className="font-semibold text-white text-[11px] uppercase tracking-wide">O que determina a qualidade</p>
          {CRITERIA.map(c => (
            <div key={c.label} className="flex gap-2">
              <span className="font-medium w-24 shrink-0">{c.label}</span>
              <span className="text-white/70">{c.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
