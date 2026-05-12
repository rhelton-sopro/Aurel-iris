/**
 * Phase 07.1.6 Plan 03 Task 1 — buildCanonicalStoragePath unit tests.
 *
 * Pure function: sem mocks, sem fixtures externos.
 * Espelha estrutura de sanity.test.ts (Plan 02).
 *
 * Cobertura:
 *   - Path shape literal: {t}/{r}/canonical/{eye}_{angle}.jpg
 *   - Segmento `canonical/` (distingue do `originais/` do storage-path.ts)
 *   - validateSegment rejeita `/`, `..`, `\`, vazio
 *   - 6 eye×angle combos canônicos
 */
import { describe, it, expect } from 'vitest'
import { buildCanonicalStoragePath } from '../storage-path'

const T_ID = '1e02831f-0631-4059-b7bc-c8a6a62f9548'
const R_ID = 'e85ea7de-0e5f-4f49-a889-f886e4a05073'

describe('buildCanonicalStoragePath', () => {
  it('produz path {therapist}/{reading}/canonical/{eye}_{angle}.jpg', () => {
    expect(buildCanonicalStoragePath(T_ID, R_ID, 'left', 'frontal')).toBe(
      `${T_ID}/${R_ID}/canonical/left_frontal.jpg`,
    )
  })

  it("inclui literal segmento '/canonical/' (não 'originais/')", () => {
    const path = buildCanonicalStoragePath(T_ID, R_ID, 'right', 'backlight')
    expect(path).toContain('/canonical/')
    expect(path).not.toContain('/originais/')
  })

  it.each([
    ['left', 'frontal'],
    ['left', 'lateral'],
    ['left', 'backlight'],
    ['right', 'frontal'],
    ['right', 'lateral'],
    ['right', 'backlight'],
  ] as const)('produz path consistente para %s_%s', (eye, angle) => {
    expect(buildCanonicalStoragePath(T_ID, R_ID, eye, angle)).toBe(
      `${T_ID}/${R_ID}/canonical/${eye}_${angle}.jpg`,
    )
  })

  it('rejeita therapistId vazio', () => {
    expect(() => buildCanonicalStoragePath('', R_ID, 'left', 'frontal')).toThrow(
      /therapistId/,
    )
  })

  it('rejeita readingId vazio', () => {
    expect(() => buildCanonicalStoragePath(T_ID, '', 'left', 'frontal')).toThrow(
      /readingId/,
    )
  })

  it('rejeita therapistId contendo / (path traversal)', () => {
    expect(() => buildCanonicalStoragePath('foo/bar', R_ID, 'left', 'frontal')).toThrow(
      /caracteres inválidos/,
    )
  })

  it('rejeita readingId contendo ..', () => {
    expect(() => buildCanonicalStoragePath(T_ID, '../etc', 'left', 'frontal')).toThrow(
      /caracteres inválidos/,
    )
  })

  it('rejeita therapistId contendo \\ (windows path traversal)', () => {
    expect(() => buildCanonicalStoragePath('a\\b', R_ID, 'left', 'frontal')).toThrow(
      /caracteres inválidos/,
    )
  })
})
