// Phase 7.1 | Plan 07.1-03 — saveAnnotation + markReviewed action tests.
// Source: 07.1-03-PLAN Task 5 verification gate.
//
// Tests:
//   - founder happy path (UPSERT)
//   - non-founder rejected (Forbidden)
//   - schema validation (invalid uuid, invalid enum)
//   - markReviewed founder happy path + non-founder block
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const VALID_READING_UUID = '401288f4-0f02-43aa-bdee-16d501089dc9'
const VALID_USER_UUID = '865eaf2a-62b6-41b2-92ad-d601fd72705c'
const FOUNDER_EMAIL = 'rhelton@gmail.com'

// vitest hoists vi.mock above these declarations — use vi.hoisted for shared mocks
const { mockGetUser, mockUpsert, mockUpdate, mockEq, mockFrom } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({
    upsert: mockUpsert,
    update: mockUpdate,
  })
  return { mockGetUser, mockUpsert, mockUpdate, mockEq, mockFrom }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    toString: (): string => 'sb-access-token=test',
  })),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

describe('app/actions/calibration', () => {
  const ORIGINAL_FOUNDER_EMAIL = process.env.FOUNDER_EMAIL

  beforeEach(() => {
    process.env.FOUNDER_EMAIL = FOUNDER_EMAIL
    mockGetUser.mockReset()
    mockUpsert.mockReset().mockResolvedValue({ error: null })
    mockUpdate.mockClear()
    mockEq.mockReset().mockResolvedValue({ error: null })
    mockFrom.mockClear()
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  afterEach(() => {
    if (ORIGINAL_FOUNDER_EMAIL === undefined) delete process.env.FOUNDER_EMAIL
    else process.env.FOUNDER_EMAIL = ORIGINAL_FOUNDER_EMAIL
  })

  function makeFormData(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData()
    fd.set('reading_id', VALID_READING_UUID)
    fd.set('real_iris_color', 'castanho')
    fd.set('real_constitution', 'biliar')
    fd.set('findings_correct', 'lacuna setor 7')
    fd.set('findings_invented', '')
    fd.set('findings_missed', 'rosario linfatico OE')
    fd.set('notes', 'observação livre')
    for (const [k, v] of Object.entries(overrides)) {
      fd.set(k, v)
    }
    return fd
  }

  describe('saveAnnotation', () => {
    it('upserts annotation when caller is founder', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveAnnotation } = await import('./calibration')
      const result = await saveAnnotation({}, makeFormData())

      expect(result).toEqual({ ok: true })
      expect(mockFrom).toHaveBeenCalledWith('calibration_annotations')
      expect(mockUpsert).toHaveBeenCalledTimes(1)
      const [payload, options] = mockUpsert.mock.calls[0]
      expect(payload.reading_id).toBe(VALID_READING_UUID)
      expect(payload.real_iris_color).toBe('castanho')
      expect(payload.real_constitution).toBe('biliar')
      expect(payload.annotated_by).toBe(VALID_USER_UUID)
      expect(payload.reviewed).toBe(false)
      expect(payload.reviewed_at).toBeNull()
      expect(options).toEqual({ onConflict: 'reading_id' })
    })

    it('rejects when caller is not founder', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: 'attacker@example.com' } },
        error: null,
      })

      const { saveAnnotation } = await import('./calibration')
      const result = await saveAnnotation({}, makeFormData())

      expect(result).toEqual({ error: 'Forbidden' })
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('rejects when no user session', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

      const { saveAnnotation } = await import('./calibration')
      const result = await saveAnnotation({}, makeFormData())

      expect(result).toEqual({ error: 'Forbidden' })
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('returns fieldErrors when reading_id is invalid uuid', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveAnnotation } = await import('./calibration')
      const result = await saveAnnotation(
        {},
        makeFormData({ reading_id: 'not-a-uuid' }),
      )

      expect(result.error).toBe('Dados inválidos')
      expect(result.fieldErrors).toBeDefined()
      expect(result.fieldErrors?.reading_id).toBeDefined()
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('returns fieldErrors when real_iris_color is not a valid enum', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveAnnotation } = await import('./calibration')
      const result = await saveAnnotation(
        {},
        makeFormData({ real_iris_color: 'invalid_color' }),
      )

      expect(result.error).toBe('Dados inválidos')
      expect(result.fieldErrors?.real_iris_color).toBeDefined()
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('returns fieldErrors when real_constitution is not a valid enum', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveAnnotation } = await import('./calibration')
      const result = await saveAnnotation(
        {},
        makeFormData({ real_constitution: 'invalid' }),
      )

      expect(result.error).toBe('Dados inválidos')
      expect(result.fieldErrors?.real_constitution).toBeDefined()
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('handles case-insensitive founder email match', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: 'Rhelton@Gmail.COM' } },
        error: null,
      })

      const { saveAnnotation } = await import('./calibration')
      const result = await saveAnnotation({}, makeFormData())

      expect(result).toEqual({ ok: true })
    })

    it('flips reviewed back to false on second save (UPSERT semantic)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveAnnotation } = await import('./calibration')
      await saveAnnotation({}, makeFormData())

      const [payload] = mockUpsert.mock.calls[0]
      expect(payload.reviewed).toBe(false)
      expect(payload.reviewed_at).toBeNull()
    })

    it('propagates supabase error message', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })
      mockUpsert.mockResolvedValue({ error: { message: 'duplicate key value' } })

      const { saveAnnotation } = await import('./calibration')
      const result = await saveAnnotation({}, makeFormData())

      expect(result).toEqual({ error: 'duplicate key value' })
    })
  })

  describe('markReviewed', () => {
    it('updates reviewed=true when caller is founder', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { markReviewed } = await import('./calibration')
      const result = await markReviewed(VALID_READING_UUID)

      expect(result).toEqual({ ok: true })
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      const [updatePayload] = mockUpdate.mock.calls[0]
      expect(updatePayload.reviewed).toBe(true)
      expect(typeof updatePayload.reviewed_at).toBe('string')
      expect(mockEq).toHaveBeenCalledWith('reading_id', VALID_READING_UUID)
    })

    it('rejects non-founder', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: 'attacker@example.com' } },
        error: null,
      })

      const { markReviewed } = await import('./calibration')
      const result = await markReviewed(VALID_READING_UUID)

      expect(result).toEqual({ error: 'Forbidden' })
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects invalid reading_id uuid', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { markReviewed } = await import('./calibration')
      const result = await markReviewed('not-a-uuid')

      expect(result).toEqual({ error: 'reading_id inválido' })
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('saveCalibrationDiagnosis', () => {
    function makeDiagnosisFormData(overrides: Record<string, string> = {}): FormData {
      const fd = new FormData()
      fd.set('reading_id', VALID_READING_UUID)
      fd.set('diagnosis', 'ANOTAÇÃO HUMANA: cor real verde\n\nDIAGNÓSTICO COMPARATIVO: pipeline classificou castanho\n\nAÇÃO DE CALIBRAÇÃO PROPOSTA: recalibrar centroides LAB com fixtures reais')
      for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
      return fd
    }

    it('upserts diagnosis when caller is founder', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveCalibrationDiagnosis } = await import('./calibration')
      const result = await saveCalibrationDiagnosis({}, makeDiagnosisFormData())

      expect(result).toEqual({ ok: true })
      expect(mockFrom).toHaveBeenCalledWith('calibration_diagnoses')
      expect(mockUpsert).toHaveBeenCalledTimes(1)
      const [payload, options] = mockUpsert.mock.calls[0]
      expect(payload.reading_id).toBe(VALID_READING_UUID)
      expect(payload.diagnosed_by).toBe(VALID_USER_UUID)
      expect(payload.diagnosis).toContain('AÇÃO DE CALIBRAÇÃO')
      expect(typeof payload.updated_at).toBe('string')
      expect(options).toEqual({ onConflict: 'reading_id' })
    })

    it('rejects non-founder', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: 'attacker@example.com' } },
        error: null,
      })

      const { saveCalibrationDiagnosis } = await import('./calibration')
      const result = await saveCalibrationDiagnosis({}, makeDiagnosisFormData())

      expect(result).toEqual({ error: 'Forbidden' })
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('rejects when no session', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

      const { saveCalibrationDiagnosis } = await import('./calibration')
      const result = await saveCalibrationDiagnosis({}, makeDiagnosisFormData())

      expect(result).toEqual({ error: 'Forbidden' })
    })

    it('rejects invalid reading_id uuid', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveCalibrationDiagnosis } = await import('./calibration')
      const result = await saveCalibrationDiagnosis(
        {},
        makeDiagnosisFormData({ reading_id: 'not-a-uuid' }),
      )

      expect(result).toEqual({ error: 'Dados inválidos' })
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('accepts empty diagnosis text', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveCalibrationDiagnosis } = await import('./calibration')
      const result = await saveCalibrationDiagnosis(
        {},
        makeDiagnosisFormData({ diagnosis: '' }),
      )

      expect(result).toEqual({ ok: true })
      const [payload] = mockUpsert.mock.calls[0]
      expect(payload.diagnosis).toBe('')
    })

    it('rejects diagnosis exceeding max chars (100KB)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })

      const { saveCalibrationDiagnosis } = await import('./calibration')
      const huge = 'x'.repeat(100_001)
      const result = await saveCalibrationDiagnosis(
        {},
        makeDiagnosisFormData({ diagnosis: huge }),
      )

      expect(result).toEqual({ error: 'Dados inválidos' })
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('propagates supabase error message', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: VALID_USER_UUID, email: FOUNDER_EMAIL } },
        error: null,
      })
      mockUpsert.mockResolvedValue({ error: { message: 'connection refused' } })

      const { saveCalibrationDiagnosis } = await import('./calibration')
      const result = await saveCalibrationDiagnosis({}, makeDiagnosisFormData())

      expect(result).toEqual({ error: 'connection refused' })
    })
  })
})
