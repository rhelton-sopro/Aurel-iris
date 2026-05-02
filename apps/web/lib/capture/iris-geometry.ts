/**
 * Iris landmark indices (MediaPipe FaceLandmarker).
 * Convenção: POV da CÂMERA TRASEIRA (não espelhada) — validado por teste empírico no iPhone.
 * - O olho que aparece no LADO ESQUERDO da tela = olho DIREITO da pessoa
 * - MediaPipe numera os landmarks pelo lado da IMAGEM (câmera), não pelo lado do sujeito:
 *   468 = iris no LADO DIREITO da imagem = olho ESQUERDO da pessoa
 *   473 = iris no LADO ESQUERDO da imagem = olho DIREITO da pessoa
 */
export type Eye = 'left' | 'right'

export const IRIS_LANDMARKS = {
  left:  { center: 473, contour: [474, 475, 476, 477] },  // lado esquerdo da tela = olho esq. da pessoa
  right: { center: 468, contour: [469, 470, 471, 472] },  // lado direito da tela = olho dir. da pessoa
} as const

export const EYELID_LANDMARKS = {
  left:  { upper: 386, lower: 374 },
  right: { upper: 159, lower: 145 },
} as const

export interface Landmark {
  x: number
  y: number
  z?: number
}

/**
 * Distância euclidiana 2D (ignora z).
 */
function dist2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function getIrisCenter(landmarks: Landmark[], eye: Eye): Landmark | null {
  const idx = IRIS_LANDMARKS[eye].center
  const lm = landmarks[idx]
  if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return null
  return lm
}

export function getIrisRadius(landmarks: Landmark[], eye: Eye): number {
  const center = landmarks[IRIS_LANDMARKS[eye].center]
  if (!center) return 0
  const radii = IRIS_LANDMARKS[eye].contour.map(i => {
    const lm = landmarks[i]
    return lm ? dist2D(center, lm) : 0
  })
  if (radii.length === 0) return 0
  return radii.reduce((a, b) => a + b, 0) / radii.length
}

/**
 * Centeredness: 1.0 quando o centro da íris coincide com overlayCenter; cai linear
 * quando se afasta. Default overlayCenter (0.5, 0.5) — overlay circular no centro
 * do viewport.
 * maxAcceptable=0.15: câmera traseira mobile exige área de aceitação maior (vs 0.10 de lab).
 */
export function computeCenteredness(
  center: Landmark | null,
  overlayCenter: { x: number; y: number } = { x: 0.5, y: 0.5 },
  maxAcceptable = 0.15
): number {
  if (!center) return 0
  const dx = center.x - overlayCenter.x
  const dy = center.y - overlayCenter.y
  const d = Math.sqrt(dx * dx + dy * dy)
  return Math.max(0, 1 - d / maxAcceptable)
}

/**
 * Distance OK: calibrado para câmera mobile real em uso iridológico.
 *   - target 0.12 ≈ raio normalizado da íris quando preenche o overlay circular
 *     (~10–15cm com câmera traseira de iPhone — câmera consegue focar)
 *   - Tolerância ±50%: ratio∈[0.50, 1.50] → score=1.0
 *   - Assimétrico: longe penaliza mais (iris sem detalhe); perto penaliza menos
 *     (íris transborda levemente → ainda tem detalhe suficiente)
 */
/**
 * Perto = melhor para iridologia (mais detalhe da íris).
 * Score cresce monotonicamente conforme a íris se aproxima do tamanho-alvo;
 * não penaliza quando a íris está maior que o alvo (outros sub-scores
 * — sharpness e occlusion — capturam os efeitos reais de estar muito perto).
 *
 * ratio < 0.10  → 0 (íris quase invisível)
 * ratio 0.10–0.50 → linear 0→1
 * ratio ≥ 0.50  → 1 (no alvo ou além = sempre bom)
 */
/**
 * Íris preenchendo ≥ 25% do raio-alvo já recebe score 1.0.
 * Para iridologia: perto = sempre melhor. Limiar baixo evita penalizar
 * capturas válidas com câmera muito próxima.
 */
export function computeDistanceOk(observedRadius: number, targetRadius = 0.12): number {
  if (targetRadius <= 0 || observedRadius <= 0) return 0
  const ratio = observedRadius / targetRadius
  if (ratio < 0.05) return 0
  if (ratio >= 0.25) return 1.0
  return (ratio - 0.05) / 0.20
}

/**
 * Direção da distância para a copy.
 * Sem penalidade por "muito perto" — só penaliza longe.
 */
export function getDistanceDirection(observedRadius: number, targetRadius = 0.12): 'far' | 'close' | 'ok' {
  const ratio = observedRadius / targetRadius
  if (ratio < 0.50) return 'far'
  return 'ok'
}

/**
 * Eyelid occlusion: 0 = totalmente aberto, 1 = totalmente fechado.
 * Razão openness/(2*irisRadius): olho aberto idealmente tem openness ≈ 2*r.
 */
export function computeOcclusion(
  landmarks: Landmark[],
  eye: Eye,
  irisRadius: number
): number {
  if (irisRadius <= 0) return 1
  const upper = landmarks[EYELID_LANDMARKS[eye].upper]
  const lower = landmarks[EYELID_LANDMARKS[eye].lower]
  if (!upper || !lower) return 0.5
  const openness = Math.abs(upper.y - lower.y)
  const ratio = openness / (2 * irisRadius)
  // ratio>=1: olho totalmente aberto → occlusion=0
  // ratio<=0.3: olho fortemente coberto → occlusion=1
  if (ratio >= 1) return 0
  if (ratio <= 0.3) return 1
  return 1 - (ratio - 0.3) / 0.7
}
