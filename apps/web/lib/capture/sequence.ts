import type { Eye } from './iris-geometry'
export type { Eye }

export type Angle = 'frontal' | 'lateral' | 'backlight'

export interface Slot {
  eye: Eye
  angle: Angle
}

/**
 * Modo de captura: 'camera' (Fase 3 — getUserMedia/<input capture>) ou
 * 'upload' (Fase 4 — dropzone client-side). Afeta apenas a copy de UI;
 * a SEQUENCE e os identificadores de slot são idênticos.
 */
export type CaptureMode = 'camera' | 'upload'

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
 * Começa pelo olho esquerdo do cliente (aparece à DIREITA na tela com câmera traseira),
 * depois olho direito do cliente (aparece à ESQUERDA na tela).
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
 * Labels visíveis ao usuário. PROTOCOLO REVISTO 2026-05-12: descrevem
 * INCLINAÇÃO DA CÂMERA (não rotação do cliente). Cliente fica fixo
 * olhando para um ponto; o terapeuta inclina a câmera levemente.
 *   - frontal:   câmera frontal direta à íris
 *   - lateral:   câmera inclinada ~15° para a direita
 *   - backlight: câmera inclinada ~15° para a esquerda
 *
 * Razão da revisão: o protocolo antigo (cliente gira ~90°) produzia
 * íris em posições muito diferentes entre os 3 ângulos da mesma íris,
 * frustrando detect/segment (Phase 07.1.5 verdict B_INFEASIBLE) e o
 * gate de convergência geométrica do photometric stereo.
 *
 * Os identificadores internos ('frontal'/'lateral'/'backlight') ficam
 * pra compatibilidade do schema (path no Storage, coluna `angle` em
 * `reading_images`). Renomear é breaking change. O nome 'backlight'
 * em particular ficou semanticamente desatualizado mas mantido por
 * estabilidade do storage_path histórico.
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
 * PROTOCOLO REVISTO 2026-05-12 (founder testou empiricamente no iPhone):
 *  - CLIENTE fica FIXO olhando para um ponto na parede; NÃO gira o corpo.
 *  - TERAPEUTA muda a posição da CÂMERA entre as 3 fotos da mesma íris:
 *      frontal   → câmera direta à íris
 *      lateral   → câmera inclinada ~15° à DIREITA do terapeuta
 *      backlight → câmera inclinada ~15° à ESQUERDA do terapeuta
 *  - FLASH ATIVO em todas as fotos (revela fibras radiais; pupila contrai
 *    naturalmente; reflexo localizado é pequeno e não atrapalha).
 *
 * Razão: o protocolo antigo (cliente gira ~90°) deslocava a íris muito
 * entre as 3 fotos, frustrando convergência geométrica do photometric
 * stereo (Phase 07.1.5 B_INFEASIBLE). Tilt sutil de câmera mantém a íris
 * geometricamente próxima entre fotos enquanto varia a iluminação o
 * suficiente pra photometric stereo funcionar.
 */
export function getSlotInstructionCopy(
  slot: Slot,
  slotIndex: number,
  mode: CaptureMode = 'camera',
): { heading: string; subtitle: string; cta: string } {
  const eyeUpper = slot.eye === 'left' ? 'ESQUERDO' : 'DIREITO'

  let subtitle: string
  let angleLabel: string
  switch (slot.angle) {
    case 'frontal':
      angleLabel = 'Frente'
      subtitle = `O cliente olha para um ponto fixo na parede, sem mover a cabeça. Mantenha a câmera de frente para o olho ${eyeUpper} e tire a foto com o flash ativado.`
      break
    case 'lateral':
      angleLabel = 'Câmera à direita'
      subtitle = 'O cliente continua olhando para o mesmo ponto fixo, sem mover a cabeça. Incline a câmera 15° para a direita e tire a foto com o flash ativado.'
      break
    case 'backlight':
      angleLabel = 'Câmera à esquerda'
      subtitle = 'O cliente continua olhando para o mesmo ponto fixo, sem mover a cabeça. Incline a câmera 15° para a esquerda e tire a foto com o flash ativado.'
      break
  }

  return {
    heading: `Foto ${slotIndex + 1} de ${SEQUENCE.length} — Olho ${eyeUpper} · ${angleLabel}`,
    subtitle,
    cta: mode === 'upload' ? 'Selecionar arquivo' : 'Abrir câmera',
  }
}
