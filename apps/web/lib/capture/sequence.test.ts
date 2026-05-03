import { describe, it, expect } from 'vitest'
import {
  SEQUENCE,
  getResumeSlotIndex,
  isOuterEyeTransition,
  getSlotProgressLabel,
  getSlotInstructionCopy,
  EYE_LABEL,
  ANGLE_LABEL,
  type CaptureMode,
} from './sequence'

describe('SEQUENCE', () => {
  it('has exactly 6 slots', () => {
    expect(SEQUENCE).toHaveLength(6)
  })

  it('starts with left/frontal (olho esquerdo do paciente = direita da tela)', () => {
    expect(SEQUENCE[0]).toEqual({ eye: 'left', angle: 'frontal' })
  })

  it('ends with right/backlight', () => {
    expect(SEQUENCE[5]).toEqual({ eye: 'right', angle: 'backlight' })
  })

  it('has no duplicate slots', () => {
    const keys = SEQUENCE.map(s => `${s.eye}_${s.angle}`)
    expect(new Set(keys).size).toBe(SEQUENCE.length)
  })

  it('puts all left slots before right slots', () => {
    const firstRight = SEQUENCE.findIndex(s => s.eye === 'right')
    const lastLeft = SEQUENCE.map((s, i) => ({ s, i })).filter(x => x.s.eye === 'left').pop()?.i ?? -1
    expect(lastLeft).toBeLessThan(firstRight)
  })

  it('covers all 3 angles per eye', () => {
    const right = SEQUENCE.filter(s => s.eye === 'right').map(s => s.angle).sort()
    const left = SEQUENCE.filter(s => s.eye === 'left').map(s => s.angle).sort()
    expect(right).toEqual(['backlight', 'frontal', 'lateral'])
    expect(left).toEqual(['backlight', 'frontal', 'lateral'])
  })

  it('has 3 left slots then 3 right slots in consecutive order', () => {
    const eyes = SEQUENCE.map(s => s.eye)
    expect(eyes).toEqual(['left', 'left', 'left', 'right', 'right', 'right'])
  })
})

describe('getResumeSlotIndex', () => {
  it('returns 0 for empty captured', () => {
    expect(getResumeSlotIndex([])).toBe(0)
  })

  it('returns 0 when left/frontal and left/lateral captured (left eye first now)', () => {
    // Com nova SEQUENCE (left first), right/frontal e right/lateral estão nos índices 3 e 4.
    // Se apenas right/* capturados, o primeiro ausente da SEQUENCE é left/frontal (índice 0).
    expect(getResumeSlotIndex([
      { eye: 'right', angle: 'frontal' },
      { eye: 'right', angle: 'lateral' },
    ])).toBe(0)
  })

  it('returns 2 when left/frontal and left/lateral are captured', () => {
    expect(getResumeSlotIndex([
      { eye: 'left', angle: 'frontal' },
      { eye: 'left', angle: 'lateral' },
    ])).toBe(2)
  })

  it('returns -1 when all 6 are captured', () => {
    expect(getResumeSlotIndex([...SEQUENCE])).toBe(-1)
  })

  it('returns first MISSING slot even if captured contains later slots out of order', () => {
    // Pulou o left/lateral e capturou os outros — primeiro ausente é index 1 (left/lateral)
    const captured = [
      { eye: 'left', angle: 'frontal' },
      { eye: 'left', angle: 'backlight' },
      { eye: 'right', angle: 'frontal' },
    ]
    expect(getResumeSlotIndex(captured)).toBe(1)
  })

  it('ignores unknown slots in captured', () => {
    const captured = [
      { eye: 'left', angle: 'frontal' },
      { eye: 'left', angle: 'unknown_angle' },
    ]
    expect(getResumeSlotIndex(captured)).toBe(1)
  })

  it('returns 3 when first 3 left slots are captured', () => {
    const captured = [
      { eye: 'left', angle: 'frontal' },
      { eye: 'left', angle: 'lateral' },
      { eye: 'left', angle: 'backlight' },
    ]
    expect(getResumeSlotIndex(captured)).toBe(3)
  })
})

describe('isOuterEyeTransition', () => {
  it('true when crossing index 2 → 3 (left/backlight → right/frontal)', () => {
    expect(isOuterEyeTransition(2, 3)).toBe(true)
  })
  it('false within right (0 → 1)', () => {
    expect(isOuterEyeTransition(0, 1)).toBe(false)
  })
  it('false within left (3 → 4)', () => {
    expect(isOuterEyeTransition(3, 4)).toBe(false)
  })
  it('false on out-of-bounds from index', () => {
    expect(isOuterEyeTransition(-1, 0)).toBe(false)
  })
  it('false on out-of-bounds to index', () => {
    expect(isOuterEyeTransition(5, 6)).toBe(false)
  })
  it('false within right (1 → 2)', () => {
    expect(isOuterEyeTransition(1, 2)).toBe(false)
  })
  it('false within left (4 → 5)', () => {
    expect(isOuterEyeTransition(4, 5)).toBe(false)
  })
})

describe('getSlotProgressLabel', () => {
  it('formats as "N de 6" for index 0', () => {
    expect(getSlotProgressLabel(0)).toBe('1 de 6')
  })
  it('formats as "N de 6" for index 5', () => {
    expect(getSlotProgressLabel(5)).toBe('6 de 6')
  })
  it('formats as "N de 6" for index 2', () => {
    expect(getSlotProgressLabel(2)).toBe('3 de 6')
  })
})

describe('getSlotInstructionCopy', () => {
  it('foto 1 (left/frontal) instrui rosto para frente + olho ESQUERDO', () => {
    const copy = getSlotInstructionCopy({ eye: 'left', angle: 'frontal' }, 0)
    expect(copy.heading).toContain('Foto 1 de 6')
    expect(copy.heading).toContain('ESQUERDO')
    expect(copy.heading).toContain('Frente')
    expect(copy.subtitle).toContain('olho ESQUERDO aberto')
    expect(copy.subtitle).toContain('Luz de frente ou lateral')
    expect(copy.cta).toBe('Abrir câmera')
  })

  it('foto 2 (left/lateral) instrui virar 90° para a direita', () => {
    const copy = getSlotInstructionCopy({ eye: 'left', angle: 'lateral' }, 1)
    expect(copy.heading).toContain('Foto 2 de 6')
    expect(copy.heading).toContain('Direita')
    expect(copy.subtitle).toContain('~90° para a direita')
    expect(copy.subtitle).toContain('câmera frontal ao olho')
  })

  it('foto 3 (left/backlight) instrui virar 90° para a esquerda', () => {
    const copy = getSlotInstructionCopy({ eye: 'left', angle: 'backlight' }, 2)
    expect(copy.heading).toContain('Foto 3 de 6')
    expect(copy.heading).toContain('Esquerda')
    expect(copy.subtitle).toContain('~90° para a esquerda')
  })

  it('foto 4 (right/frontal) repete o padrão para olho DIREITO', () => {
    const copy = getSlotInstructionCopy({ eye: 'right', angle: 'frontal' }, 3)
    expect(copy.heading).toContain('Foto 4 de 6')
    expect(copy.heading).toContain('DIREITO')
    expect(copy.subtitle).toContain('olho DIREITO aberto')
  })

  it('cta é "Abrir câmera" em todas as fotos', () => {
    for (let i = 0; i < SEQUENCE.length; i++) {
      expect(getSlotInstructionCopy(SEQUENCE[i], i).cta).toBe('Abrir câmera')
    }
  })
})

describe('getSlotInstructionCopy mode parameter (Fase 4)', () => {
  const slot = { eye: 'left' as const, angle: 'frontal' as const }

  it('defaults to mode=camera with cta="Abrir câmera"', () => {
    const copy = getSlotInstructionCopy(slot, 0)
    expect(copy.cta).toBe('Abrir câmera')
  })

  it('returns cta="Abrir câmera" for explicit mode=camera', () => {
    const copy = getSlotInstructionCopy(slot, 0, 'camera')
    expect(copy.cta).toBe('Abrir câmera')
  })

  it('returns cta="Selecionar arquivo" for mode=upload', () => {
    const copy = getSlotInstructionCopy(slot, 0, 'upload')
    expect(copy.cta).toBe('Selecionar arquivo')
  })

  it('mode does NOT affect heading or subtitle', () => {
    const camera = getSlotInstructionCopy(slot, 0, 'camera')
    const upload = getSlotInstructionCopy(slot, 0, 'upload')
    expect(camera.heading).toBe(upload.heading)
    expect(camera.subtitle).toBe(upload.subtitle)
  })

  it('CaptureMode type exports correctly', () => {
    const m: CaptureMode = 'upload'
    expect(m).toBe('upload')
  })

  it('handles mode independently of slot eye/angle', () => {
    const right = getSlotInstructionCopy({ eye: 'right', angle: 'lateral' }, 4, 'upload')
    expect(right.cta).toBe('Selecionar arquivo')
  })
})

describe('labels', () => {
  it('EYE_LABEL maps to pt-BR', () => {
    expect(EYE_LABEL.left).toBe('esquerdo')
    expect(EYE_LABEL.right).toBe('direito')
  })
  it('ANGLE_LABEL reflete a ROTAÇÃO DO PACIENTE (não ângulo de câmera)', () => {
    expect(ANGLE_LABEL.frontal).toBe('frente')
    expect(ANGLE_LABEL.lateral).toBe('direita')
    expect(ANGLE_LABEL.backlight).toBe('esquerda')
  })
})
