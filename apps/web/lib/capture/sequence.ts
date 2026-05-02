import type { Eye } from './iris-geometry'
export type { Eye }

export type Angle = 'frontal' | 'lateral' | 'backlight'

export interface Slot {
  eye: Eye
  angle: Angle
}

/**
 * Fase da state machine do capture-client (CONTEXT D-10).
 * idle        → câmera ainda não iniciada
 * streaming   → câmera ativa, aguardando o usuário apertar o botão manual
 * freezing    → frame congelado (snapshot + crop) por 300ms com borda pulsante
 * previewing  → CapturePreview visível (2s preview pós-captura, D-09)
 * overlay     → AngleOverlay visível entre ângulos do mesmo olho (~2.5s)
 * interstitial→ AngleInterstitial fullscreen na transição de olho
 * finalizing  → 6/6 capturas concluídas
 * complete    → leitura confirmada
 */
export type SlotPhase =
  | 'idle'
  | 'streaming'
  | 'freezing'
  | 'previewing'
  | 'overlay'
  | 'interstitial'
  | 'finalizing'
  | 'complete'

/**
 * Sequência canônica de 6 capturas.
 * Começa pelo olho esquerdo do paciente (aparece à DIREITA na tela com câmera traseira),
 * depois olho direito do paciente (aparece à ESQUERDA na tela).
 * AngleInterstitial fullscreen aparece ANTES do índice 3 (transição de olho).
 */
export const SEQUENCE: readonly Slot[] = [
  { eye: 'left', angle: 'frontal' },
  { eye: 'left', angle: 'lateral' },
  { eye: 'left', angle: 'backlight' },
  { eye: 'right', angle: 'frontal' },
  { eye: 'right', angle: 'lateral' },
  { eye: 'right', angle: 'backlight' },
] as const

export const EYE_LABEL: Record<Eye, string> = {
  left: 'esquerdo',
  right: 'direito',
}

export const ANGLE_LABEL: Record<Angle, string> = {
  frontal: 'frontal',
  lateral: 'lateral',
  backlight: 'contraluz',
}

/**
 * Retorna o índice do primeiro slot da SEQUENCE que ainda não foi capturado.
 * -1 se todos os 6 já foram capturados.
 */
export function getResumeSlotIndex(captured: { eye: string; angle: string }[]): number {
  const set = new Set(captured.map(c => `${c.eye}_${c.angle}`))
  for (let i = 0; i < SEQUENCE.length; i++) {
    const s = SEQUENCE[i]
    if (!set.has(`${s.eye}_${s.angle}`)) return i
  }
  return -1
}

/**
 * True quando a transição de fromIndex para toIndex cruza de 'right' para 'left'.
 * AngleInterstitial fullscreen é mostrado apenas nesta transição (CONTEXT D-10).
 */
export function isOuterEyeTransition(fromIndex: number, toIndex: number): boolean {
  if (fromIndex < 0 || fromIndex >= SEQUENCE.length) return false
  if (toIndex < 0 || toIndex >= SEQUENCE.length) return false
  return SEQUENCE[fromIndex].eye !== SEQUENCE[toIndex].eye
}

/**
 * Retorna label de progresso no formato "N de 6".
 * slotIndex é 0-based.
 */
export function getSlotProgressLabel(slotIndex: number): string {
  return `${slotIndex + 1} de ${SEQUENCE.length}`
}

/**
 * Retorna a copy verbatim da UI-SPEC §Copywriting AngleInterstitial.
 */
export function getInterstitialCopy(toEye: Eye): { heading: string; subtitle: string; cta: string } {
  if (toEye === 'left') {
    return {
      heading: 'Vamos para o olho esquerdo',
      subtitle:
        'Os próximos 3 registros serão do olho esquerdo. Posicione o celular e toque em capturar quando estiver pronto.',
      cta: 'Pronto, vou capturar',
    }
  }
  return {
    heading: 'Vamos para o olho direito',
    subtitle:
      'Os próximos 3 registros serão do olho direito. Posicione o celular e toque em capturar quando estiver pronto.',
    cta: 'Pronto, vou capturar',
  }
}

/**
 * Copy da tela inicial de instrução, exibida UMA VEZ antes da 1ª captura.
 * Usa o mesmo padrão visual do AngleInterstitial mas comunica o início do
 * fluxo (eye + ângulo + dica de aproximação).
 */
export function getFirstInterstitialCopy(slot: Slot): { heading: string; subtitle: string; cta: string } {
  return {
    heading: `Vamos começar pelo olho ${EYE_LABEL[slot.eye]}`,
    subtitle: `Primeiro ângulo: ${ANGLE_LABEL[slot.angle]}. Aproxime o celular até a íris preencher o círculo guia.`,
    cta: 'Estou pronto',
  }
}
