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
 *   isCrossAngleOutlier: <2 peers => false; x delta >0.08 => true; y delta >0.08 => true;
 *                       boundary delta = 0.08 NOT outlier (strict >).
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
// suficientemente grande (>0.08) pra simular o caso em que o gate captura
// (founder admin Re-canonicalizar é escape hatch quando NÃO captura).
const nailliRightFrontalOutlier: IrisBbox = {
  center_x_pct: 0.55, // peers median x = 0.465 → delta 0.085 > 0.08
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

// Outlier x test: peers x median ≈ 0.46, this bbox at 0.55 → delta 0.09 > 0.08
const crossAngleOutlierX: IrisBbox = {
  center_x_pct: 0.55,
  center_y_pct: 0.41,
  radius_pct: 0.13,
  confidence: 0.78,
  valid: true,
}

// Outlier y test: peers y median ≈ 0.41, this bbox at 0.50 → delta 0.09 > 0.08
const crossAngleOutlierY: IrisBbox = {
  center_x_pct: 0.47,
  center_y_pct: 0.50,
  radius_pct: 0.13,
  confidence: 0.78,
  valid: true,
}

// Boundary delta exactly 0.08 — strict > so NOT outlier.
// peers x median = 0.46; this bbox.x = 0.54 → delta 0.08 (boundary)
const boundaryOutlierX: IrisBbox = {
  center_x_pct: 0.54,
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

  it('retorna true quando |center_x_pct - median(peers.center_x)| > 0.08', () => {
    // peers x = [0.46, 0.48] → median 0.47
    // bbox x = 0.55 → delta 0.08 boundary; bump to 0.56 → delta 0.09
    const bbox = { ...crossAngleOutlierX, center_x_pct: 0.56 }
    expect(
      isCrossAngleOutlier(bbox, [validNailliLeftLateral, validNailliLeftBacklight]),
    ).toBe(true)
  })

  it('retorna true quando |center_y_pct - median(peers.center_y)| > 0.08', () => {
    // peers y = [0.42, 0.40] → median 0.41
    // bbox y = 0.50 → delta 0.09 > 0.08
    expect(
      isCrossAngleOutlier(crossAngleOutlierY, [
        validNailliLeftLateral,
        validNailliLeftBacklight,
      ]),
    ).toBe(true)
  })

  it('retorna false em boundary delta = 0.08 (strict > não inclui igualdade)', () => {
    // peers x = [0.46, 0.48] → median 0.47
    // bbox x = 0.54? delta vs 0.47 = 0.07 (não 0.08); usar peers que produzam median 0.46:
    // peers x = [0.46, 0.46] → median 0.46
    // bbox x = 0.54 → delta exatamente 0.08
    const peer1: IrisBbox = { ...validNailliLeftLateral, center_x_pct: 0.46 }
    const peer2: IrisBbox = { ...validNailliLeftBacklight, center_x_pct: 0.46 }
    expect(isCrossAngleOutlier(boundaryOutlierX, [peer1, peer2])).toBe(false)
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
      nailliRightFrontalOutlier, // frontal (fallback — outlier x delta > 0.08)
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
