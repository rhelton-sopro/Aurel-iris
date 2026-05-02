import { describe, it, expect } from 'vitest'
import { buildOriginalStoragePath } from './storage-path'

describe('buildOriginalStoragePath', () => {
  const TID = '11111111-1111-1111-1111-111111111111'
  const RID = '22222222-2222-2222-2222-222222222222'

  it('formats path exactly as {therapistId}/{readingId}/originais/{eye}_{angle}.jpg', () => {
    expect(buildOriginalStoragePath(TID, RID, 'right', 'frontal')).toBe(
      `${TID}/${RID}/originais/right_frontal.jpg`,
    )
  })

  it.each([
    ['right', 'frontal'],
    ['right', 'lateral'],
    ['right', 'backlight'],
    ['left', 'frontal'],
    ['left', 'lateral'],
    ['left', 'backlight'],
  ] as const)('handles %s/%s combination', (eye, angle) => {
    const p = buildOriginalStoragePath(TID, RID, eye, angle)
    expect(p).toBe(`${TID}/${RID}/originais/${eye}_${angle}.jpg`)
    expect(p.endsWith('.jpg')).toBe(true)
  })

  it('therapist_id é folder[0] (contrato RLS)', () => {
    const p = buildOriginalStoragePath(TID, RID, 'left', 'lateral')
    expect(p.split('/')[0]).toBe(TID)
  })

  it('throws when therapistId contains slash', () => {
    expect(() => buildOriginalStoragePath('a/b', RID, 'right', 'frontal')).toThrow(/inválidos/)
  })

  it('throws when readingId contains "..", a path traversal attempt', () => {
    expect(() => buildOriginalStoragePath(TID, '../evil', 'right', 'frontal')).toThrow(/inválidos/)
  })

  it('throws on empty string', () => {
    expect(() => buildOriginalStoragePath('', RID, 'right', 'frontal')).toThrow(/obrigatório/)
  })

  it('generates distinct paths for different readings', () => {
    const p1 = buildOriginalStoragePath(TID, 'aaaa-1111', 'right', 'frontal')
    const p2 = buildOriginalStoragePath(TID, 'bbbb-2222', 'right', 'frontal')
    expect(p1).not.toBe(p2)
  })

  it('generates distinct paths for different therapists', () => {
    const p1 = buildOriginalStoragePath('therapist-A', RID, 'right', 'frontal')
    const p2 = buildOriginalStoragePath('therapist-B', RID, 'right', 'frontal')
    expect(p1).not.toBe(p2)
  })
})
