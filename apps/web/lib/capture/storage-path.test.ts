import { describe, it, expect } from 'vitest'
import { buildCroppedStoragePath, buildOriginalStoragePath } from './storage-path'

describe('buildCroppedStoragePath', () => {
  const TID = '11111111-1111-1111-1111-111111111111'
  const RID = '22222222-2222-2222-2222-222222222222'

  it('formats path exactly as {therapistId}/{readingId}/recortadas/{eye}_{angle}.jpg', () => {
    expect(buildCroppedStoragePath(TID, RID, 'right', 'frontal')).toBe(
      `${TID}/${RID}/recortadas/right_frontal.jpg`,
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
    const p = buildCroppedStoragePath(TID, RID, eye, angle)
    expect(p).toBe(`${TID}/${RID}/recortadas/${eye}_${angle}.jpg`)
    expect(p.endsWith('.jpg')).toBe(true)
  })

  it('throws when therapistId contains slash', () => {
    expect(() => buildCroppedStoragePath('a/b', RID, 'right', 'frontal')).toThrow(/inválidos/)
  })

  it('throws when readingId contains "..", a path traversal attempt', () => {
    expect(() => buildCroppedStoragePath(TID, '../evil', 'right', 'frontal')).toThrow(/inválidos/)
  })

  it('throws on empty string', () => {
    expect(() => buildCroppedStoragePath('', RID, 'right', 'frontal')).toThrow(/obrigatório/)
  })

  it('generates distinct paths for different readings', () => {
    const p1 = buildCroppedStoragePath(TID, 'aaaa-1111', 'right', 'frontal')
    const p2 = buildCroppedStoragePath(TID, 'bbbb-2222', 'right', 'frontal')
    expect(p1).not.toBe(p2)
  })

  it('generates distinct paths for different therapists', () => {
    const p1 = buildCroppedStoragePath('therapist-A', RID, 'right', 'frontal')
    const p2 = buildCroppedStoragePath('therapist-B', RID, 'right', 'frontal')
    expect(p1).not.toBe(p2)
  })
})

describe('buildOriginalStoragePath', () => {
  const TID = '11111111-1111-1111-1111-111111111111'
  const RID = '22222222-2222-2222-2222-222222222222'

  it('formats path with /originais/ subfolder', () => {
    expect(buildOriginalStoragePath(TID, RID, 'right', 'frontal')).toBe(
      `${TID}/${RID}/originais/right_frontal.jpg`,
    )
  })

  it('shares therapist_id as folder[0] with cropped path (RLS contract)', () => {
    const cropped = buildCroppedStoragePath(TID, RID, 'left', 'lateral')
    const original = buildOriginalStoragePath(TID, RID, 'left', 'lateral')
    expect(cropped.split('/')[0]).toBe(TID)
    expect(original.split('/')[0]).toBe(TID)
  })
})
