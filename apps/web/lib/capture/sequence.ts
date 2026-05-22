import type { Eye } from './iris-geometry'
export type { Eye }

/**
 * IDENTIFIER LEGADO — preservado por estabilidade de schema e storage path
 * (migration 0001 + 0004: unique (reading_id, eye, angle) + path
 * {therapistId}/{readingId}/originais/{eye}_{angle}.jpg). NÃO renomear.
 *
 * Semântica visual ao cliente mudou em 2026-05-22 (caso Evanilce):
 *   frontal   → "1ª foto deste olho — COM flash"
 *   lateral   → "2ª foto deste olho — COM flash" (frontal redundante, sem tilt)
 *   backlight → "3ª foto deste olho — SEM flash"
 *
 * Justificativa do protocolo novo: o protocolo anterior (2026-05-20) pedia
 * tilt da câmera ±15° para 'lateral' e 'backlight'. Em UAT empírica
 * (Evanilce/Caroline), clientes leigos interpretaram "incline a câmera"
 * como "vire o rosto" e produziram fotos LATERALIZADAS — ângulo geométrico
 * tão extremo que o canonicalize peer-set não convergia. O protocolo novo
 * elimina variação geométrica e mantém apenas variação de iluminação
 * (flash on/on/off) — mais simples de executar corretamente, e o
 * peer-set fica mais consistente (3 bboxes quase coincidentes).
 *
 * O nome 'backlight' do schema ficou novamente semanticamente desatualizado
 * (já estava desde 2026-05-20 — agora 2ª vez). Mantido por estabilidade.
 * compose.py (vision-service dead code) ainda usa ANGLE_WEIGHTS frontal=
 * 0.4/lateral=0.4/backlight=0.2 — vai ficar misnamed se Modal reativar.
 */
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
 * interstitial→ AngleInterstitial fullscreen antes de cada foto
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
 * Labels visíveis ao usuário. PROTOCOLO REVISTO 2026-05-22 (caso Evanilce/
 * Caroline): 3 fotos FRONTAIS por olho — 2 com flash + 1 sem. Sem variação
 * geométrica (sem tilt). Variação apenas de iluminação.
 *   - frontal:   1ª foto — COM flash
 *   - lateral:   2ª foto — COM flash (frontal redundante)
 *   - backlight: 3ª foto — SEM flash
 *
 * Identificadores internos preservados — ver doc no topo do arquivo.
 */
export const ANGLE_LABEL: Record<Angle, string> = {
  frontal: '1ª (com flash)',
  lateral: '2ª (com flash)',
  backlight: '3ª (sem flash)',
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
 * PROTOCOLO REVISTO 2026-05-22 (caso Evanilce/Caroline): 3 fotos FRONTAIS
 * por olho. CÂMERA SEMPRE FRONTAL — sem tilt, sem inclinação. Variação só
 * de iluminação:
 *      frontal   (slot 1) → frontal · COM FLASH
 *      lateral   (slot 2) → frontal · COM FLASH (redundância pra ter opção)
 *      backlight (slot 3) → frontal · SEM FLASH (revela pigmento real)
 *
 * Razão da revisão: o protocolo anterior (2026-05-20) pedia tilt ±15° em
 * 'lateral' e 'backlight'. Em UAT empírica clientes leigos interpretavam
 * "incline a câmera" como "vire o rosto", produzindo fotos com íris em
 * perfil oblíquo — peer-set do canonicalize não convergia, Haiku gate
 * aprovava silenciosamente, relatório saía com base em fotos ruins.
 *
 * Eliminar tilt simplifica drasticamente a execução (qualquer fotógrafo
 * leigo executa "aponte direto pro olho" sem ambiguidade) e melhora o
 * trust gate D-02 (bboxes ficam quase coincidentes em vez de variar com
 * tilt). Identifier de schema preservado (ver doc no topo do arquivo).
 *
 * Histórico:
 *   2026-05-12: protocolo "tilt + flash em todas".
 *   2026-05-20: founder UAT → 3ª sem flash dá leitura melhor.
 *   2026-05-22: tilt eliminado, 6 frontais (2 com / 1 sem por olho).
 */
export function getSlotInstructionCopy(
  slot: Slot,
  slotIndex: number,
  mode: CaptureMode = 'camera',
): { heading: string; subtitle: string; cta: string; flashOn: boolean } {
  const eyeUpper = slot.eye === 'left' ? 'ESQUERDO' : 'DIREITO'

  let subtitle: string
  let flashLabel: string
  let flashOn: boolean
  switch (slot.angle) {
    case 'frontal':
      flashLabel = 'COM flash'
      flashOn = true
      subtitle = `Aponte a câmera diretamente ao olho ${eyeUpper}, mesma altura, distância de um palmo. Mantenha a câmera FRONTAL — sem inclinar. COM flash.`
      break
    case 'lateral':
      flashLabel = 'COM flash'
      flashOn = true
      subtitle = `Mesma posição da anterior: câmera diretamente ao olho ${eyeUpper}, FRONTAL, sem inclinar. COM flash. Esta é a 2ª foto deste olho.`
      break
    case 'backlight':
      flashLabel = 'SEM flash'
      flashOn = false
      subtitle = `Mesma posição: câmera diretamente ao olho ${eyeUpper}, FRONTAL. SEM flash desta vez — toque no ícone do raio na câmera pra desativar ANTES desta foto. Esta é a 3ª e última foto deste olho.`
      break
  }

  return {
    heading: `Foto ${slotIndex + 1} de ${SEQUENCE.length} — Olho ${eyeUpper} · ${flashLabel}`,
    subtitle,
    cta: mode === 'upload' ? 'Selecionar arquivo' : 'Abrir câmera',
    flashOn,
  }
}
