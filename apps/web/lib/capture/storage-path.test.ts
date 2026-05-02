import { describe, it, expect } from 'vitest'
import { buildStoragePath } from './storage-path'

describe('buildStoragePath', () => {
  const TID = '11111111-1111-1111-1111-111111111111'
  const RID = '22222222-2222-2222-2222-222222222222'

  it('formats path exactly as {therapistId}/{readingId}/{eye}_{angle}.jpg', () => {
    expect(buildStoragePath(TID, RID, 'right', 'frontal')).toBe(`${TID}/${RID}/right_frontal.jpg`)
  })

  it.each([
    ['right', 'frontal'],
    ['right', 'lateral'],
    ['right', 'backlight'],
    ['left', 'frontal'],
    ['left', 'lateral'],
    ['left', 'backlight'],
  ] as const)('handles %s/%s combination', (eye, angle) => {
    const p = buildStoragePath(TID, RID, eye, angle)
    expect(p).toBe(`${TID}/${RID}/${eye}_${angle}.jpg`)
    expect(p.endsWith('.jpg')).toBe(true)
  })

  it('throws when therapistId contains slash', () => {
    expect(() => buildStoragePath('a/b', RID, 'right', 'frontal')).toThrow(/inválidos/)
  })

  it('throws when readingId contains "..", a path traversal attempt', () => {
    expect(() => buildStoragePath(TID, '../evil', 'right', 'frontal')).toThrow(/inválidos/)
  })

  it('throws on empty string', () => {
    expect(() => buildStoragePath('', RID, 'right', 'frontal')).toThrow(/obrigatório/)
  })

  it('generates distinct paths for different readings', () => {
    const p1 = buildStoragePath(TID, 'aaaa-1111', 'right', 'frontal')
    const p2 = buildStoragePath(TID, 'bbbb-2222', 'right', 'frontal')
    expect(p1).not.toBe(p2)
  })

  it('generates distinct paths for different therapists', () => {
    const p1 = buildStoragePath('therapist-A', RID, 'right', 'frontal')
    const p2 = buildStoragePath('therapist-B', RID, 'right', 'frontal')
    expect(p1).not.toBe(p2)
  })
})
