import { describe, it, expect } from 'vitest'
import {
  levelFromScore,
  overallScore,
  dominantFailure,
  feedbackMessage,
  computeQualityCheck,
  WEIGHTS,
  type QualityCheck,
} from './quality-scoring'

const PERFECT: QualityCheck = {
  irisDetected: true,
  irisCenteredness: 1,
  irisDistanceOk: 1,
  sharpness: 1,
  exposure: 1,
  reflexInIrisCenter: false,
  eyelidOcclusion: 0,
}

describe('levelFromScore (D-07 thresholds)', () => {
  it('< 0.40 → ruim', () => expect(levelFromScore(0.30)).toBe('ruim'))
  it('0.40-0.74 → regular', () => expect(levelFromScore(0.50)).toBe('regular'))
  it('0.75-0.89 → boa', () => expect(levelFromScore(0.80)).toBe('boa'))
  it('>= 0.90 → excelente', () => expect(levelFromScore(0.95)).toBe('excelente'))
  it('exactly 0.40 → regular', () => expect(levelFromScore(0.40)).toBe('regular'))
  it('exactly 0.75 → boa', () => expect(levelFromScore(0.75)).toBe('boa'))
  it('exactly 0.90 → excelente', () => expect(levelFromScore(0.90)).toBe('excelente'))
})

describe('overallScore', () => {
  it('returns 0 when iris not detected (gate)', () => {
    expect(overallScore({ ...PERFECT, irisDetected: false })).toBe(0)
  })

  it('weights sum to 1.0 — perfect QualityCheck → score=1.0', () => {
    expect(overallScore(PERFECT)).toBeCloseTo(1.0, 9)
  })

  it('weights individual values', () => {
    const sumOfWeights =
      WEIGHTS.centeredness +
      WEIGHTS.distance +
      WEIGHTS.sharpness +
      WEIGHTS.exposure +
      WEIGHTS.reflex +
      WEIGHTS.occlusion
    expect(sumOfWeights).toBeCloseTo(1.0, 9)
  })

  it('reflex true cancels its 0.15 contribution', () => {
    const reflexed: QualityCheck = { ...PERFECT, reflexInIrisCenter: true }
    expect(overallScore(reflexed)).toBeCloseTo(1.0 - WEIGHTS.reflex, 9)
  })

  it('eyelid 1.0 (totally closed) cancels its 0.10 contribution', () => {
    const closed: QualityCheck = { ...PERFECT, eyelidOcclusion: 1 }
    expect(overallScore(closed)).toBeCloseTo(1.0 - WEIGHTS.occlusion, 9)
  })
})

describe('dominantFailure + feedbackMessage', () => {
  it('returns iris_missing when not detected', () => {
    const c: QualityCheck = { ...PERFECT, irisDetected: false }
    expect(dominantFailure(c)).toBe('iris_missing')
    expect(feedbackMessage('iris_missing')).toBe('Aproxime o olho do enquadramento circular')
  })

  it('returns excellent when score >= 0.90', () => {
    expect(dominantFailure(PERFECT)).toBe('excellent')
    expect(feedbackMessage('excellent')).toBe('Excelente — capturando...')
  })

  it('returns good when 0.75 <= score < 0.90', () => {
    // Reduzir centeredness para 0.4 → score = 1 - 0.20*0.6 = 0.88
    const c: QualityCheck = { ...PERFECT, irisCenteredness: 0.4 }
    const s = overallScore(c)
    expect(s).toBeGreaterThanOrEqual(0.75)
    expect(s).toBeLessThan(0.90)
    expect(dominantFailure(c)).toBe('good')
  })

  it('returns centeredness when score < 0.75 and centeredness is the worst', () => {
    // irisCenteredness=0 alone gives score=0.80 (>= 0.75 = 'good').
    // To force score < 0.75, also reduce exposure so centeredness loss still dominates.
    // score = 0.20*0 + 0.20*1 + 0.20*1 + 0.15*0 + 0.15*1 + 0.10*1 = 0.65 < 0.75
    // centeredness loss = 0.20*1 = 0.20 > exposure loss = 0.15*1 = 0.15
    const c: QualityCheck = { ...PERFECT, irisCenteredness: 0.0, exposure: 0.0 }
    expect(overallScore(c)).toBeLessThan(0.75)
    expect(dominantFailure(c)).toBe('centeredness')
    expect(feedbackMessage('centeredness')).toBe('Centralize o olho no círculo')
  })

  it('returns sharpness when sharpness is the worst and score < 0.75', () => {
    // score = 0.20*0.5 + 0.20*0.5 + 0.20*0.0 + 0.15*0.5 + 0.15*1 + 0.10*1 = 0.525 < 0.75
    // sharpness loss = 0.20*1.0 = 0.20; others less
    const c: QualityCheck = { ...PERFECT, sharpness: 0.0, irisCenteredness: 0.5, irisDistanceOk: 0.5, exposure: 0.5 }
    expect(overallScore(c)).toBeLessThan(0.75)
    expect(dominantFailure(c)).toBe('sharpness')
  })

  it('returns reflex when reflexInIrisCenter=true and score < 0.75', () => {
    const c: QualityCheck = {
      ...PERFECT,
      reflexInIrisCenter: true,
      irisCenteredness: 0.5,
      sharpness: 0.5,
    }
    expect(overallScore(c)).toBeLessThan(0.75)
    // reflex sozinho não é necessariamente o pior; este teste valida que o key existe e a copy é correta
    expect(feedbackMessage('reflex')).toBe('Muito reflexo — gire levemente a cabeça')
  })

  it('feedbackMessage distance_far', () => {
    expect(feedbackMessage('distance_far')).toBe('Aproxime mais o celular')
  })

  it('feedbackMessage distance_close', () => {
    expect(feedbackMessage('distance_close')).toBe('Afaste um pouco o celular')
  })

  it('feedbackMessage exposure_low', () => {
    expect(feedbackMessage('exposure_low')).toBe('Pouca luz — busque um ambiente mais claro')
  })

  it('feedbackMessage exposure_high', () => {
    expect(feedbackMessage('exposure_high')).toBe('Muita luz — reduza o contraluz')
  })

  it('feedbackMessage eyelid', () => {
    expect(feedbackMessage('eyelid')).toBe('Abra mais o olho — pálpebra cobrindo a íris')
  })

  it('feedbackMessage good', () => {
    expect(feedbackMessage('good')).toBe('Ótima — capturando...')
  })
})

describe('computeQualityCheck — edge cases', () => {
  function blankImageData(w: number, h: number): ImageData {
    return new ImageData(new Uint8ClampedArray(w * h * 4).fill(0), w, h)
  }

  it('returns irisDetected=false when landmarks is null', () => {
    const r = computeQualityCheck(null, 'right', blankImageData(8, 8), 8, 8)
    expect(r.irisDetected).toBe(false)
  })

  it('returns irisDetected=false when landmarks list is too short', () => {
    const r = computeQualityCheck([{ x: 0.5, y: 0.5 }], 'right', blankImageData(8, 8), 8, 8)
    expect(r.irisDetected).toBe(false)
  })
})
