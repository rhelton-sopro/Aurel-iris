import {
  type Eye,
  type Landmark,
  IRIS_LANDMARKS,
  getIrisCenter,
  getIrisRadius,
  computeCenteredness,
  computeDistanceOk,
  computeOcclusion,
  getDistanceDirection,
} from './iris-geometry'
import { laplacianVariance, sharpnessScore } from './laplacian-variance'
import { exposureScore, getExposureDirection, reflexInCenter } from './exposure'

export type { Eye, Landmark } from './iris-geometry'

export type Angle = 'frontal' | 'lateral' | 'backlight'
export type QualityLevel = 'ruim' | 'regular' | 'boa' | 'excelente'

/** 7 sub-scores que compõem o overallScore. */
export interface QualityCheck {
  irisDetected: boolean
  irisCenteredness: number   // 0..1
  irisDistanceOk: number     // 0..1
  sharpness: number          // 0..1
  exposure: number           // 0..1
  reflexInIrisCenter: boolean
  eyelidOcclusion: number    // 0..1 (1 = totalmente coberto)
}

export type FailureKey =
  | 'iris_missing'
  | 'centeredness'
  | 'distance_far'
  | 'distance_close'
  | 'sharpness'
  | 'exposure_low'
  | 'exposure_high'
  | 'reflex'
  | 'eyelid'
  | 'good'
  | 'excellent'

/** Limiares D-07. */
export function levelFromScore(score: number): QualityLevel {
  if (score < 0.40) return 'ruim'
  if (score < 0.75) return 'regular'
  if (score < 0.90) return 'boa'
  return 'excelente'
}

/**
 * Pesos exatos (RESEARCH §Fórmula).
 * Soma: 0.20 + 0.20 + 0.20 + 0.15 + 0.15 + 0.10 = 1.00
 */
export const WEIGHTS = {
  centeredness: 0.20,
  distance: 0.20,
  sharpness: 0.20,
  exposure: 0.15,
  reflex: 0.15, // peso quando ausente; quando presente → 0
  occlusion: 0.10,
} as const

export function overallScore(c: QualityCheck): number {
  if (!c.irisDetected) return 0
  return (
    WEIGHTS.centeredness * c.irisCenteredness +
    WEIGHTS.distance * c.irisDistanceOk +
    WEIGHTS.sharpness * c.sharpness +
    WEIGHTS.exposure * c.exposure +
    WEIGHTS.reflex * (c.reflexInIrisCenter ? 0 : 1) +
    WEIGHTS.occlusion * (1 - c.eyelidOcclusion)
  )
}

/**
 * Orquestra os 7 sub-scores a partir de landmarks da face + frame ImageData.
 *
 * @param landmarks lista 0-477+ de landmarks normalizados (0..1) ou null se nenhuma face detectada
 * @param eye qual íris analisar
 * @param frame ImageData de uma janela de análise (recomendado 256×256 centrada na íris)
 * @param frameWidthPx largura do frame original em px (para reflexInCenter)
 * @param frameHeightPx altura do frame original em px
 * @param irisRadiusTarget raio target normalizado (default 0.15)
 */
export function computeQualityCheck(
  landmarks: Landmark[] | null,
  eye: Eye,
  frame: ImageData,
  frameWidthPx: number,
  frameHeightPx: number,
  irisRadiusTarget = 0.15
): QualityCheck {
  if (!landmarks || landmarks.length <= IRIS_LANDMARKS[eye].center) {
    return {
      irisDetected: false,
      irisCenteredness: 0,
      irisDistanceOk: 0,
      sharpness: 0,
      exposure: 0,
      reflexInIrisCenter: false,
      eyelidOcclusion: 1,
    }
  }
  const center = getIrisCenter(landmarks, eye)
  if (!center) {
    return {
      irisDetected: false,
      irisCenteredness: 0,
      irisDistanceOk: 0,
      sharpness: 0,
      exposure: 0,
      reflexInIrisCenter: false,
      eyelidOcclusion: 1,
    }
  }
  const radius = getIrisRadius(landmarks, eye)
  const variance = laplacianVariance(frame)
  const sharpness = sharpnessScore(variance)
  const exposure = exposureScore(frame)

  // reflex usa coordenadas em pixels do frame, não normalizadas
  const centerPx = { x: center.x * frameWidthPx, y: center.y * frameHeightPx }
  const radiusPx = radius * Math.min(frameWidthPx, frameHeightPx)
  const reflex = reflexInCenter(frame, centerPx, radiusPx)

  const occlusion = computeOcclusion(landmarks, eye, radius)

  return {
    irisDetected: true,
    irisCenteredness: computeCenteredness(center),
    irisDistanceOk: computeDistanceOk(radius, irisRadiusTarget),
    sharpness,
    exposure,
    reflexInIrisCenter: reflex,
    eyelidOcclusion: occlusion,
  }
}

/**
 * Retorna o sinal que está fazendo o score cair mais. Usado pelo LiveFeedbackMessage
 * para mostrar APENAS UMA mensagem de cada vez (UI-SPEC §regra de prioridade).
 *
 * Para resolver between distance_far/close e exposure_low/high, recebe ImageData opcional.
 * Se ImageData não disponível, retorna o key genérico ('distance_far' / 'exposure_low') como fallback.
 */
export function dominantFailure(c: QualityCheck, frame?: ImageData, observedRadius?: number, targetRadius = 0.15): FailureKey {
  if (!c.irisDetected) return 'iris_missing'
  const score = overallScore(c)
  if (score >= 0.90) return 'excellent'
  if (score >= 0.75) return 'good'

  const losses = {
    centeredness: WEIGHTS.centeredness * (1 - c.irisCenteredness),
    distance: WEIGHTS.distance * (1 - c.irisDistanceOk),
    sharpness: WEIGHTS.sharpness * (1 - c.sharpness),
    exposure: WEIGHTS.exposure * (1 - c.exposure),
    reflex: c.reflexInIrisCenter ? WEIGHTS.reflex : 0,
    eyelid: WEIGHTS.occlusion * c.eyelidOcclusion,
  } as const

  const ranked = Object.entries(losses).sort((a, b) => b[1] - a[1])
  const [topKey] = ranked[0]

  switch (topKey) {
    case 'centeredness': return 'centeredness'
    case 'distance':
      if (observedRadius != null) {
        const dir = getDistanceDirection(observedRadius, targetRadius)
        if (dir === 'far') return 'distance_far'
        if (dir === 'close') return 'distance_close'
      }
      return 'distance_far' // fallback
    case 'sharpness': return 'sharpness'
    case 'exposure':
      if (frame) {
        const dir = getExposureDirection(frame)
        if (dir === 'low') return 'exposure_low'
        if (dir === 'high') return 'exposure_high'
      }
      return 'exposure_low' // fallback
    case 'reflex': return 'reflex'
    case 'eyelid': return 'eyelid'
    default: return 'iris_missing'
  }
}

/** Copy verbatim de UI-SPEC §Copywriting Mensagens de feedback ao vivo. */
export function feedbackMessage(key: FailureKey): string {
  switch (key) {
    case 'iris_missing':    return 'Aproxime o olho do enquadramento circular'
    case 'centeredness':    return 'Centralize o olho no círculo'
    case 'distance_far':    return 'Aproxime mais o celular'
    case 'distance_close':  return 'Afaste um pouco o celular'
    case 'sharpness':       return 'Mantenha o celular firme — imagem desfocada'
    case 'exposure_low':    return 'Pouca luz — busque um ambiente mais claro'
    case 'exposure_high':   return 'Muita luz — reduza o contraluz'
    case 'reflex':          return 'Muito reflexo — gire levemente a cabeça'
    case 'eyelid':          return 'Abra mais o olho — pálpebra cobrindo a íris'
    case 'good':            return 'Ótima — capturando...'
    case 'excellent':       return 'Excelente — capturando...'
  }
}

/** Mapeia QualityLevel para classes Tailwind de cor (UI-SPEC §Paleta de qualidade). */
export const LEVEL_BG_CLASS: Record<QualityLevel, string> = {
  ruim: 'bg-red-500',
  regular: 'bg-amber-400',
  boa: 'bg-emerald-400',
  excelente: 'bg-emerald-600',
}

export const LEVEL_TEXT_CLASS: Record<QualityLevel, string> = {
  ruim: 'text-white',
  regular: 'text-neutral-900',
  boa: 'text-neutral-900',
  excelente: 'text-white',
}

export const LEVEL_LABEL: Record<QualityLevel, string> = {
  ruim: 'Ruim',
  regular: 'Regular',
  boa: 'Boa',
  excelente: 'Excelente',
}

/** Largura em % para a barra horizontal (UI-SPEC §QualityIndicator estados). */
export const LEVEL_WIDTH: Record<QualityLevel, number> = {
  ruim: 25,
  regular: 50,
  boa: 75,
  excelente: 100,
}
