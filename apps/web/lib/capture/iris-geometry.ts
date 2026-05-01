/**
 * Iris landmark indices canônicos (MediaPipe FaceLandmarker oficial).
 * Convenção crítica: POV do SUJEITO, não do espectador.
 *
 * Verificado em github.com/google-ai-edge/mediapipe master/face_landmarks_connections.ts:
 * - 468 = left iris center (esquerdo do sujeito); 469-472 = left iris contour
 * - 473 = right iris center (direito do sujeito); 474-477 = right iris contour
 *
 * Nota: algumas fontes e versões antigas do SPEC citam os índices invertidos (left=473, right=468).
 * Esta lib usa a convenção MediaPipe oficial (left=468, right=473) — POV do sujeito.
 */
export type Eye = 'left' | 'right'

export const IRIS_LANDMARKS = {
  left: { center: 468, contour: [469, 470, 471, 472] },
  right: { center: 473, contour: [474, 475, 476, 477] },
} as const

export const EYELID_LANDMARKS = {
  left: { upper: 159, lower: 145 },
  right: { upper: 386, lower: 374 },
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
 */
export function computeCenteredness(
  center: Landmark | null,
  overlayCenter: { x: number; y: number } = { x: 0.5, y: 0.5 },
  maxAcceptable = 0.10
): number {
  if (!center) return 0
  const dx = center.x - overlayCenter.x
  const dy = center.y - overlayCenter.y
  const d = Math.sqrt(dx * dx + dy * dy)
  return Math.max(0, 1 - d / maxAcceptable)
}

/**
 * Distance OK: 1.0 quando o raio observado está dentro de ±15% do raio target;
 * cai linearmente fora dessa faixa. Razão (RESEARCH §Sub-score 3):
 *   - target 0.15 = ~15% da menor dimensão do viewport (UI-SPEC overlay 60vmin / max 360px)
 *   - >1.15 (perto) ou <0.85 (longe) começa a perder pontos.
 */
export function computeDistanceOk(observedRadius: number, targetRadius = 0.15): number {
  if (targetRadius <= 0 || observedRadius <= 0) return 0
  const ratio = observedRadius / targetRadius
  if (ratio < 0.5 || ratio > 2.0) return 0
  // Tolerância 0.15 = ratio∈[0.85, 1.15] → score=1.0
  const dev = Math.abs(ratio - 1)
  if (dev <= 0.15) return 1
  return Math.max(0, 1 - (dev - 0.15) * 2)
}

/**
 * Direção da distância para a copy (longe vs perto).
 */
export function getDistanceDirection(observedRadius: number, targetRadius = 0.15): 'far' | 'close' | 'ok' {
  const ratio = observedRadius / targetRadius
  if (ratio < 0.85) return 'far'
  if (ratio > 1.15) return 'close'
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
