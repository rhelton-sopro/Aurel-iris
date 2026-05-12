/**
 * Phase 07.1.6 Plan 02 — Sanity gate unit tests (TDD RED → GREEN).
 *
 * Pure functions: no mocks, no fakes — fixtures inline.
 * Fixtures empíricas derivadas de Nailli `e85ea7de` probe (CONTEXT.md §Specifics).
 *
 * D-02: trust gate combina geometric sanity + cross-angle outlier detection.
 * D-03: gate falhou → fallback direto (sem retry).
 *
 * Behavior coverage (≥14 cases):
 *   isGeometricallySane: in-range, center_x out-low, center_y out-high,
 *                       radius out-low, radius out-high, inclusive boundaries.
 *   isCrossAngleOutlier: <2 peers => false; x delta >0.18 => true; y delta >0.18 => true;
 *                       boundary delta = 0.18 NOT outlier (strict >).
 *                       (Threshold relaxed 0.08 → 0.18 2026-05-12 after UAT item 1.)
 *   isCanonicalAccepted: ok when sane+non-outlier; fallback on insane geometry;
 *                       fallback on cross-angle outlier; fallback on bbox.valid===false.
 *
 * Additionally: Nailli e85ea7de empirical end-to-end fixture (5 ok + 1 fallback).
 */
import { describe, it, expect } from 'vitest'
import {
  isGeometricallySane,
  isCrossAngleOutlier,
  isCanonicalAccepted,
  diagnoseCanonical,
  GATE_THRESHOLDS,
} from '../sanity'
import type { IrisBbox } from '@/lib/anthropic/types'

// ---------------------------------------------------------------------------
// Fixtures empíricas — Nailli e85ea7de probe (CONTEXT.md §Specifics)
// LEFT eye median: center ≈ (0.47, 0.41), radius ≈ 0.13
// RIGHT eye median: center ≈ (0.46, 0.44), radius ≈ 0.14
// ---------------------------------------------------------------------------

const validNailliLeftFrontal: IrisBbox = {
  center_x_pct: 0.47,
  center_y_pct: 0.41,
  radius_pct: 0.13,
  confidence: 0.85,
  valid: true,
}

const validNailliLeftLateral: IrisBbox = {
  center_x_pct: 0.46,
  center_y_pct: 0.42,
  radius_pct: 0.13,
  confidence: 0.82,
  valid: true,
}

const validNailliLeftBacklight: IrisBbox = {
  center_x_pct: 0.48,
  center_y_pct: 0.40,
  radius_pct: 0.14,
  confidence: 0.80,
  valid: true,
}

// RIGHT eye fixtures — para o end-to-end Nailli (5 ok + 1 fallback)
const validNailliRightLateral: IrisBbox = {
  center_x_pct: 0.46,
  center_y_pct: 0.44,
  radius_pct: 0.13,
  confidence: 0.83,
  valid: true,
}

const validNailliRightBacklight: IrisBbox = {
  center_x_pct: 0.47,
  center_y_pct: 0.45,
  radius_pct: 0.14,
  confidence: 0.81,
  valid: true,
}

// O smoking gun real do Nailli probe: right_frontal mislocated.
// CONTEXT.md §Specifics observa: "números podem estar dentro do range geométrico"
// mas a bbox em SI tá fora da íris visualmente. Aqui usamos delta cross-angle
// suficientemente grande (>0.18) pra simular o caso em que o gate captura
// um Sonnet-aponta-pra-pálpebra (founder admin Re-canonicalizar é escape hatch
// quando NÃO captura). Threshold pós-UAT (0.18) é > shift natural do protocolo
// de tilt; outliers reais (Sonnet localiza eyelid em vez de íris) tendem a ≥ 0.25.
const nailliRightFrontalOutlier: IrisBbox = {
  center_x_pct: 0.71, // peers median x ≈ 0.465 → delta ≈ 0.245 > 0.18
  center_y_pct: 0.44,
  radius_pct: 0.13,
  confidence: 0.78,
  valid: true,
}

// ---------------------------------------------------------------------------
// Boundary + invalid fixtures
// ---------------------------------------------------------------------------

const edgeCenterXLow: IrisBbox = {
  center_x_pct: 0.19, // out of [0.20, 0.80]
  center_y_pct: 0.50,
  radius_pct: 0.13,
  confidence: 0.75,
  valid: true,
}

const edgeCenterYHigh: IrisBbox = {
  center_x_pct: 0.50,
  center_y_pct: 0.81, // out of [0.20, 0.80]
  radius_pct: 0.13,
  confidence: 0.75,
  valid: true,
}

const edgeRadiusLow: IrisBbox = {
  center_x_pct: 0.50,
  center_y_pct: 0.50,
  radius_pct: 0.04, // below 0.05
  confidence: 0.75,
  valid: true,
}

const edgeRadiusHigh: IrisBbox = {
  center_x_pct: 0.50,
  center_y_pct: 0.50,
  radius_pct: 0.31, // above 0.30
  confidence: 0.75,
  valid: true,
}

const boundaryCenterLow: IrisBbox = {
  center_x_pct: 0.20, // inclusive
  center_y_pct: 0.80, // inclusive
  radius_pct: 0.05, // inclusive
  confidence: 0.75,
  valid: true,
}

const boundaryRadiusHigh: IrisBbox = {
  center_x_pct: 0.50,
  center_y_pct: 0.50,
  radius_pct: 0.30, // inclusive upper bound
  confidence: 0.75,
  valid: true,
}

const invalidBbox: IrisBbox = {
  center_x_pct: 0.5,
  center_y_pct: 0.5,
  radius_pct: 0,
  confidence: 0,
  valid: false,
}

// Outlier x test: peers x median ≈ 0.46, this bbox at 0.68 → delta ≈ 0.22 > 0.18
const crossAngleOutlierX: IrisBbox = {
  center_x_pct: 0.68,
  center_y_pct: 0.41,
  radius_pct: 0.13,
  confidence: 0.78,
  valid: true,
}

// Outlier y test: peers y median ≈ 0.41, this bbox at 0.62 → delta ≈ 0.21 > 0.18
const crossAngleOutlierY: IrisBbox = {
  center_x_pct: 0.47,
  center_y_pct: 0.62,
  radius_pct: 0.13,
  confidence: 0.78,
  valid: true,
}

// Boundary delta exactly 0.18 — strict > so NOT outlier.
// peers x median = 0.50; bbox.x = 0.32 → Math.abs(0.32 - 0.50) === 0.18 exactly
// (IEEE 754 stable: `0.18 > 0.18` is false; tested via node REPL).
// 0.32 stays geometrically sane (within [0.20, 0.80]).
const boundaryOutlierX: IrisBbox = {
  center_x_pct: 0.32,
  center_y_pct: 0.41,
  radius_pct: 0.13,
  confidence: 0.78,
  valid: true,
}

// ===========================================================================
// describe block 1 — isGeometricallySane
// ===========================================================================

describe('isGeometricallySane', () => {
  it('aceita bbox dentro de [0.20,0.80] × [0.20,0.80] + radius [0.05,0.30]', () => {
    expect(isGeometricallySane(validNailliLeftFrontal)).toBe(true)
  })

  it('rejeita center_x = 0.19 (abaixo de 0.20)', () => {
    expect(isGeometricallySane(edgeCenterXLow)).toBe(false)
  })

  it('rejeita center_y = 0.81 (acima de 0.80)', () => {
    expect(isGeometricallySane(edgeCenterYHigh)).toBe(false)
  })

  it('rejeita radius_pct = 0.04 (abaixo de 0.05)', () => {
    expect(isGeometricallySane(edgeRadiusLow)).toBe(false)
  })

  it('rejeita radius_pct = 0.31 (acima de 0.30)', () => {
    expect(isGeometricallySane(edgeRadiusHigh)).toBe(false)
  })

  it('aceita boundary inclusivo center=0.20/0.80 + radius=0.05', () => {
    expect(isGeometricallySane(boundaryCenterLow)).toBe(true)
  })

  it('aceita boundary inclusivo radius=0.30 (upper)', () => {
    expect(isGeometricallySane(boundaryRadiusHigh)).toBe(true)
  })
})

// ===========================================================================
// describe block 2 — isCrossAngleOutlier
// ===========================================================================

describe('isCrossAngleOutlier', () => {
  it('retorna false quando peers.length < 2 (não dá pra calcular median confiável)', () => {
    // 0 peers
    expect(isCrossAngleOutlier(validNailliLeftFrontal, [])).toBe(false)
    // 1 peer
    expect(
      isCrossAngleOutlier(validNailliLeftFrontal, [validNailliLeftLateral]),
    ).toBe(false)
  })

  it('retorna true quando |center_x_pct - median(peers.center_x)| > 0.18', () => {
    // peers x = [0.46, 0.48] → median 0.47
    // bbox x = 0.68 → delta 0.21 > 0.18
    expect(
      isCrossAngleOutlier(crossAngleOutlierX, [
        validNailliLeftLateral,
        validNailliLeftBacklight,
      ]),
    ).toBe(true)
  })

  it('retorna true quando |center_y_pct - median(peers.center_y)| > 0.18', () => {
    // peers y = [0.42, 0.40] → median 0.41
    // bbox y = 0.62 → delta 0.21 > 0.18
    expect(
      isCrossAngleOutlier(crossAngleOutlierY, [
        validNailliLeftLateral,
        validNailliLeftBacklight,
      ]),
    ).toBe(true)
  })

  it('retorna false em boundary delta = 0.18 (strict > não inclui igualdade)', () => {
    // peers x = [0.50, 0.50] → median 0.50
    // bbox x = 0.32 → Math.abs(0.32 - 0.50) === 0.18 exactly
    // (`0.18 > 0.18` is false in IEEE 754; verified via node REPL).
    const peer1: IrisBbox = { ...validNailliLeftLateral, center_x_pct: 0.5 }
    const peer2: IrisBbox = { ...validNailliLeftBacklight, center_x_pct: 0.5 }
    expect(isCrossAngleOutlier(boundaryOutlierX, [peer1, peer2])).toBe(false)
  })

  it('retorna false quando delta cross-angle é shift natural do tilt protocol (≤ 0.18)', () => {
    // UAT item 1 regression guard: natural shift entre os 3 ângulos do mesmo olho
    // sob o capture protocol (founder tilta camera ~15°-25° entre frontal/lateral/
    // medial). Empirical deltas observados: 0.09-0.16 (todos abaixo de 0.18).
    // 0.10 representativa de mid-range natural shift.
    const bbox: IrisBbox = { ...validNailliLeftFrontal, center_x_pct: 0.56 }
    expect(
      isCrossAngleOutlier(bbox, [validNailliLeftLateral, validNailliLeftBacklight]),
    ).toBe(false)
  })

  it('não é outlier quando bbox está alinhada aos peers (caso feliz)', () => {
    expect(
      isCrossAngleOutlier(validNailliLeftFrontal, [
        validNailliLeftLateral,
        validNailliLeftBacklight,
      ]),
    ).toBe(false)
  })
})

// ===========================================================================
// describe block 3 — isCanonicalAccepted
// ===========================================================================

describe('isCanonicalAccepted', () => {
  it("retorna 'ok' quando bbox é sane E não-outlier", () => {
    const peers = [validNailliLeftLateral, validNailliLeftBacklight]
    expect(isCanonicalAccepted(validNailliLeftFrontal, peers)).toBe('ok')
  })

  it("retorna 'fallback' quando bbox é geometricamente insana", () => {
    const peers = [validNailliLeftLateral, validNailliLeftBacklight]
    expect(isCanonicalAccepted(edgeCenterXLow, peers)).toBe('fallback')
  })

  it("retorna 'fallback' quando bbox é cross-angle outlier mesmo se geometricamente sane", () => {
    // crossAngleOutlierX é dentro do range geométrico mas outlier vs peers
    const peers = [validNailliLeftLateral, validNailliLeftBacklight]
    expect(isCanonicalAccepted(crossAngleOutlierX, peers)).toBe('fallback')
  })

  it("retorna 'fallback' quando bbox.valid === false (Sonnet self-flagged unreadable)", () => {
    const peers = [validNailliLeftLateral, validNailliLeftBacklight]
    expect(isCanonicalAccepted(invalidBbox, peers)).toBe('fallback')
  })
})

// ===========================================================================
// describe block 4 — Empirical end-to-end (Nailli e85ea7de fixture)
// ===========================================================================

describe('Nailli e85ea7de end-to-end fixture (5 ok + 1 fallback)', () => {
  it('processa 6 bboxes e produz 5× ok + 1× fallback (right_frontal)', () => {
    // Simula o agrupamento por olho (3 ângulos × 2 olhos) que o orchestrator faz.
    const leftEye = [
      validNailliLeftFrontal, // frontal (ok)
      validNailliLeftLateral, // lateral (ok)
      validNailliLeftBacklight, // backlight (ok)
    ]
    const rightEye = [
      nailliRightFrontalOutlier, // frontal (fallback — outlier x delta > 0.18)
      validNailliRightLateral, // lateral (ok)
      validNailliRightBacklight, // backlight (ok)
    ]

    // Para cada bbox, peers = outros 2 ângulos do mesmo olho
    const results: Array<{ eye: string; angle: string; status: ReturnType<typeof isCanonicalAccepted> }> = []

    const leftAngles = ['frontal', 'lateral', 'backlight']
    leftEye.forEach((bbox, idx) => {
      const peers = leftEye.filter((_, i) => i !== idx)
      results.push({ eye: 'left', angle: leftAngles[idx], status: isCanonicalAccepted(bbox, peers) })
    })

    const rightAngles = ['frontal', 'lateral', 'backlight']
    rightEye.forEach((bbox, idx) => {
      const peers = rightEye.filter((_, i) => i !== idx)
      results.push({ eye: 'right', angle: rightAngles[idx], status: isCanonicalAccepted(bbox, peers) })
    })

    const okCount = results.filter(r => r.status === 'ok').length
    const fallbackCount = results.filter(r => r.status === 'fallback').length

    expect(okCount).toBe(5)
    expect(fallbackCount).toBe(1)
    expect(results.find(r => r.status === 'fallback')).toEqual({
      eye: 'right',
      angle: 'frontal',
      status: 'fallback',
    })
  })
})

// ---------------------------------------------------------------------------
// diagnoseCanonical — UAT diagnostic instrumentation (Phase 07.1.6 UAT item 1)
// Founder reportou 5/6 fallback no primeiro reading real; precisamos saber
// QUAL gate flagrou cada foto. diagnoseCanonical retorna structured info.
// Behavioral parity com isCanonicalAccepted (mesmo status); só amplia output.
// ---------------------------------------------------------------------------

describe('diagnoseCanonical', () => {
  it('returns status=ok and empty fail_reasons when bbox sane and matches peers', () => {
    const peers = [validNailliLeftLateral, validNailliLeftBacklight]
    const diag = diagnoseCanonical(validNailliLeftFrontal, peers)
    expect(diag.status).toBe('ok')
    expect(diag.fail_reasons).toEqual([])
    expect(diag.peer_count).toBe(2)
    expect(diag.median_x_pct).not.toBeNull()
    expect(diag.delta_x_pct).not.toBeNull()
  })

  it('flags geom_center_x when center_x out of [0.20, 0.80]', () => {
    const bbox: IrisBbox = { center_x_pct: 0.1, center_y_pct: 0.5, radius_pct: 0.15, confidence: 0.9, valid: true }
    const diag = diagnoseCanonical(bbox, [validNailliLeftLateral, validNailliLeftBacklight])
    expect(diag.status).toBe('fallback')
    expect(diag.fail_reasons).toContain('geom_center_x')
  })

  it('flags geom_radius when radius_pct out of [0.05, 0.30]', () => {
    const bbox: IrisBbox = { center_x_pct: 0.5, center_y_pct: 0.5, radius_pct: 0.40, confidence: 0.9, valid: true }
    const diag = diagnoseCanonical(bbox, [validNailliLeftLateral, validNailliLeftBacklight])
    expect(diag.fail_reasons).toContain('geom_radius')
  })

  it('flags multiple reasons simultaneously when several axes fail', () => {
    const bbox: IrisBbox = { center_x_pct: 0.05, center_y_pct: 0.95, radius_pct: 0.40, confidence: 0.9, valid: true }
    const diag = diagnoseCanonical(bbox, [validNailliLeftLateral, validNailliLeftBacklight])
    expect(diag.fail_reasons).toEqual(
      expect.arrayContaining(['geom_center_x', 'geom_center_y', 'geom_radius']),
    )
  })

  it('flags cross_angle_x when delta from peer median exceeds 0.18', () => {
    // bbox x = 0.70; peer median x ≈ 0.47 → delta ≈ 0.23 > 0.18
    const bbox: IrisBbox = { center_x_pct: 0.70, center_y_pct: 0.41, radius_pct: 0.13, confidence: 0.85, valid: true }
    const diag = diagnoseCanonical(bbox, [validNailliLeftLateral, validNailliLeftBacklight])
    expect(diag.fail_reasons).toContain('cross_angle_x')
    expect(diag.delta_x_pct).toBeGreaterThan(0.18)
  })

  it('returns null medians/deltas when peer_count < 2', () => {
    const diag = diagnoseCanonical(validNailliLeftFrontal, [validNailliLeftLateral])
    expect(diag.peer_count).toBe(1)
    expect(diag.median_x_pct).toBeNull()
    expect(diag.delta_x_pct).toBeNull()
  })

  it('flags invalid when bbox.valid=false', () => {
    const invalidBbox: IrisBbox = { ...validNailliLeftFrontal, valid: false }
    const diag = diagnoseCanonical(invalidBbox, [validNailliLeftLateral, validNailliLeftBacklight])
    expect(diag.fail_reasons).toContain('invalid')
    expect(diag.status).toBe('fallback')
  })

  it('behavioral parity: isCanonicalAccepted returns same status as diagnoseCanonical', () => {
    const cases: { bbox: IrisBbox; peers: IrisBbox[] }[] = [
      { bbox: validNailliLeftFrontal, peers: [validNailliLeftLateral, validNailliLeftBacklight] },
      { bbox: { center_x_pct: 0.1, center_y_pct: 0.5, radius_pct: 0.15, confidence: 0.9, valid: true }, peers: [validNailliLeftLateral, validNailliLeftBacklight] },
      { bbox: { ...validNailliLeftFrontal, valid: false }, peers: [validNailliLeftLateral, validNailliLeftBacklight] },
    ]
    for (const { bbox, peers } of cases) {
      expect(isCanonicalAccepted(bbox, peers)).toBe(diagnoseCanonical(bbox, peers).status)
    }
  })

  it('exports GATE_THRESHOLDS with canonical empirical values', () => {
    expect(GATE_THRESHOLDS.geom_center_min).toBe(0.2)
    expect(GATE_THRESHOLDS.geom_center_max).toBe(0.8)
    expect(GATE_THRESHOLDS.geom_radius_min).toBe(0.05)
    expect(GATE_THRESHOLDS.geom_radius_max).toBe(0.3)
    // Relaxed 0.08 → 0.18 2026-05-12 (UAT item 1: natural tilt-protocol shift was 0.09-0.16).
    expect(GATE_THRESHOLDS.cross_angle_outlier).toBe(0.18)
  })
})
