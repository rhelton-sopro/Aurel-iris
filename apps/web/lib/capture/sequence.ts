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

/**
 * Labels visíveis ao usuário. NÃO descrevem ângulos da câmera (ela fica
 * sempre frontal ao olho); descrevem a ROTAÇÃO DO CORPO/CABEÇA do paciente.
 *   - frontal:   rosto voltado para frente
 *   - lateral:   corpo virado ~90° para a direita
 *   - backlight: corpo virado ~90° para a esquerda
 *
 * Os identificadores internos ('frontal'/'lateral'/'backlight') ficam pra
 * compatibilidade do schema (path no Storage, coluna `angle` em
 * `reading_images`). Renomear é breaking change.
 */
export const ANGLE_LABEL: Record<Angle, string> = {
  frontal: 'frente',
  lateral: 'direita',
  backlight: 'esquerda',
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
 * Copy de instrução por slot, exibida na AngleInterstitial antes de cada foto.
 *
 * Princípios (conversa com o terapeuta sobre captura iridológica):
 *  - A câmera fica SEMPRE frontal ao olho. Quem gira é o paciente (cabeça/corpo).
 *  - A fonte de luz nunca deve ficar atrás do paciente.
 *  - 'lateral' = paciente vira ~90° para a direita; 'backlight' = ~90° para a
 *    esquerda. Nomes internos preservados pra não quebrar storage_path.
 */
export function getSlotInstructionCopy(
  slot: Slot,
  slotIndex: number,
): { heading: string; subtitle: string; cta: string } {
  const eyeUpper = slot.eye === 'left' ? 'ESQUERDO' : 'DIREITO'

  let subtitle: string
  let angleLabel: string
  switch (slot.angle) {
    case 'frontal':
      angleLabel = 'Frente'
      subtitle = `Rosto voltado para frente, olho ${eyeUpper} aberto. Luz de frente ou lateral — nunca atrás.`
      break
    case 'lateral':
      angleLabel = 'Direita'
      subtitle = 'Vire o corpo ~90° para a direita, mantendo o olho aberto e a câmera frontal ao olho.'
      break
    case 'backlight':
      angleLabel = 'Esquerda'
      subtitle = 'Vire o corpo ~90° para a esquerda, mantendo o olho aberto e a câmera frontal ao olho.'
      break
  }

  return {
    heading: `Foto ${slotIndex + 1} de ${SEQUENCE.length} — Olho ${eyeUpper} · ${angleLabel}`,
    subtitle,
    cta: 'Abrir câmera',
  }
}
