'use client'

import * as React from 'react'
import { type QualityLevel, levelFromScore } from '@/lib/capture/quality-scoring'

export interface StableQualityGateOptions {
  /** Tempo contínuo acima do gate antes de disparar onTrigger. Default 400ms. */
  stabilityMs?: number
  /** Limiar mínimo. Default 0.75. */
  gate?: number
}

export interface StableQualityGateResult {
  /** true quando o cronômetro de estabilidade está ativo (score acima do gate) */
  arming: boolean
  /** ms já decorridos no estado armed (0 se não armed) */
  elapsedMs: number
  /** Reset para re-disparar (ex: após captura, próximo slot) */
  reset: () => void
}

const DEFAULT_STABILITY_MS = 200
const DEFAULT_GATE = 0.50

/**
 * Gate de auto-captura: dispara onTrigger uma única vez quando `score` permanece
 * `>= gate` por `stabilityMs` ms contínuos. CONTEXT D-02 + UI-SPEC §janela de estabilidade.
 */
export function useStableQualityGate(
  score: number,
  onTrigger: () => void,
  options: StableQualityGateOptions = {}
): StableQualityGateResult {
  const stabilityMs = options.stabilityMs ?? DEFAULT_STABILITY_MS
  const gate = options.gate ?? DEFAULT_GATE

  const enteredAtRef = React.useRef<number | null>(null)
  const triggeredRef = React.useRef<boolean>(false)
  const onTriggerRef = React.useRef(onTrigger)
  React.useEffect(() => { onTriggerRef.current = onTrigger }, [onTrigger])

  const [arming, setArming] = React.useState(false)
  const [elapsedMs, setElapsedMs] = React.useState(0)

  React.useEffect(() => {
    if (score < gate) {
      enteredAtRef.current = null
      triggeredRef.current = false
      setArming(false)
      setElapsedMs(0)
      return
    }
    if (enteredAtRef.current == null) {
      enteredAtRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      setArming(true)
    }
    const started = enteredAtRef.current
    const tick = () => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const delta = now - started
      setElapsedMs(delta)
      if (delta >= stabilityMs && !triggeredRef.current) {
        triggeredRef.current = true
        onTriggerRef.current()
        return
      }
    }
    // Tick imediato para casos onde score já estava acima do gate
    tick()
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [score, gate, stabilityMs])

  const reset = React.useCallback(() => {
    enteredAtRef.current = null
    triggeredRef.current = false
    setArming(false)
    setElapsedMs(0)
  }, [])

  return { arming, elapsedMs, reset }
}

/** Helper: mapeia score → QualityLevel. */
export function useQualityLevel(score: number): QualityLevel {
  return React.useMemo(() => levelFromScore(score), [score])
}
