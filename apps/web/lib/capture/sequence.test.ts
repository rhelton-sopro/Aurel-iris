import { describe, it, expect } from 'vitest'
import {
  SEQUENCE,
  getResumeSlotIndex,
  isOuterEyeTransition,
  getSlotProgressLabel,
  getInterstitialCopy,
  EYE_LABEL,
  ANGLE_LABEL,
} from './sequence'

describe('SEQUENCE', () => {
  it('has exactly 6 slots', () => {
    expect(SEQUENCE).toHaveLength(6)
  })

  it('starts with right/frontal', () => {
    expect(SEQUENCE[0]).toEqual({ eye: 'right', angle: 'frontal' })
  })

  it('ends with left/backlight', () => {
    expect(SEQUENCE[5]).toEqual({ eye: 'left', angle: 'backlight' })
  })

  it('has no duplicate slots', () => {
    const keys = SEQUENCE.map(s => `${s.eye}_${s.angle}`)
    expect(new Set(keys).size).toBe(SEQUENCE.length)
  })

  it('puts all right slots before left slots', () => {
    const firstLeft = SEQUENCE.findIndex(s => s.eye === 'left')
    const lastRight = SEQUENCE.map((s, i) => ({ s, i })).filter(x => x.s.eye === 'right').pop()?.i ?? -1
    expect(lastRight).toBeLessThan(firstLeft)
  })

  it('covers all 3 angles per eye', () => {
    const right = SEQUENCE.filter(s => s.eye === 'right').map(s => s.angle).sort()
    const left = SEQUENCE.filter(s => s.eye === 'left').map(s => s.angle).sort()
    expect(right).toEqual(['backlight', 'frontal', 'lateral'])
    expect(left).toEqual(['backlight', 'frontal', 'lateral'])
  })

  it('has 3 right slots then 3 left slots in consecutive order', () => {
    const eyes = SEQUENCE.map(s => s.eye)
    expect(eyes).toEqual(['right', 'right', 'right', 'left', 'left', 'left'])
  })
})

describe('getResumeSlotIndex', () => {
  it('returns 0 for empty captured', () => {
    expect(getResumeSlotIndex([])).toBe(0)
  })

  it('returns 2 when right/frontal and right/lateral are captured', () => {
    expect(getResumeSlotIndex([
      { eye: 'right', angle: 'frontal' },
      { eye: 'right', angle: 'lateral' },
    ])).toBe(2)
  })

  it('returns -1 when all 6 are captured', () => {
    expect(getResumeSlotIndex([...SEQUENCE])).toBe(-1)
  })

  it('returns first MISSING slot even if captured contains later slots out of order', () => {
    // Pulou o right/lateral e capturou os outros — primeiro ausente é index 1 (right/lateral)
    const captured = [
      { eye: 'right', angle: 'frontal' },
      { eye: 'right', angle: 'backlight' },
      { eye: 'left', angle: 'frontal' },
    ]
    expect(getResumeSlotIndex(captured)).toBe(1)
  })

  it('ignores unknown slots in captured', () => {
    const captured = [
      { eye: 'right', angle: 'frontal' },
      { eye: 'right', angle: 'unknown_angle' },
    ]
    expect(getResumeSlotIndex(captured)).toBe(1)
  })

  it('returns 3 when first 3 right slots are captured', () => {
    const captured = [
      { eye: 'right', angle: 'frontal' },
      { eye: 'right', angle: 'lateral' },
      { eye: 'right', angle: 'backlight' },
    ]
    expect(getResumeSlotIndex(captured)).toBe(3)
  })
})

describe('isOuterEyeTransition', () => {
  it('true when crossing index 2 → 3 (right/backlight → left/frontal)', () => {
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

describe('getInterstitialCopy', () => {
  it('returns left copy verbatim', () => {
    const copy = getInterstitialCopy('left')
    expect(copy.heading).toBe('Vamos para o olho esquerdo')
    expect(copy.cta).toBe('Pronto, vou capturar')
    expect(copy.subtitle).toContain('olho esquerdo')
  })
  it('returns right copy', () => {
    const copy = getInterstitialCopy('right')
    expect(copy.heading).toBe('Vamos para o olho direito')
    expect(copy.cta).toBe('Pronto, vou capturar')
  })
  it('cta is identical for both eyes', () => {
    expect(getInterstitialCopy('left').cta).toBe(getInterstitialCopy('right').cta)
  })
})

describe('labels', () => {
  it('EYE_LABEL maps to pt-BR', () => {
    expect(EYE_LABEL.left).toBe('esquerdo')
    expect(EYE_LABEL.right).toBe('direito')
  })
  it('ANGLE_LABEL maps to pt-BR', () => {
    expect(ANGLE_LABEL.frontal).toBe('frontal')
    expect(ANGLE_LABEL.lateral).toBe('lateral')
    expect(ANGLE_LABEL.backlight).toBe('contraluz')
  })
})
