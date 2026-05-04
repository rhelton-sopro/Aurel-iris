import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mocks must precede the route import.

vi.mock('@/lib/vision/hmac', () => ({
  verifyHmacSignature: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { revalidatePath } from 'next/cache'

import { createServiceClient } from '@/lib/supabase/service'
import { verifyHmacSignature } from '@/lib/vision/hmac'

import { POST } from './route'

const mockVerify = vi.mocked(verifyHmacSignature)
const mockCreateServiceClient = vi.mocked(createServiceClient)
const mockRevalidate = vi.mocked(revalidatePath)

type ExistingRow = {
  id: string
  status: string
  vision_features: { processing_metadata?: { modal_call_id?: string } } | null
} | null

function buildServiceClient({
  existing,
  selectError,
  updateError,
}: {
  existing: ExistingRow
  selectError?: { message: string }
  updateError?: { message: string }
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existing,
    error: selectError ?? null,
  })
  const eqSelect = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq: eqSelect })

  const eqUpdate2 = vi.fn().mockResolvedValue({ error: updateError ?? null })
  const eqUpdate1 = vi.fn().mockReturnValue({ eq: eqUpdate2 })
  const update = vi.fn().mockReturnValue({ eq: eqUpdate1 })

  const from = vi.fn().mockImplementation(() => ({ select, update }))
  return { from, _update: update, _select: select } as any
}

const READING_ID = '550e8400-e29b-41d4-a716-446655440000'

function bodyReady(overrides: Partial<Record<string, unknown>> = {}) {
  return JSON.stringify({
    reading_id: READING_ID,
    modal_call_id: 'fc-real-123',
    status: 'ready',
    vision_features: {
      right_eye: { constitution: { primary: 'linfatica' } },
      left_eye: { constitution: { primary: 'linfatica' } },
      asymmetry_notes: [],
      processing_metadata: { modal_call_id: 'fc-real-123' },
    },
    ...overrides,
  })
}

function bodyFailed() {
  return JSON.stringify({
    reading_id: READING_ID,
    modal_call_id: 'fc-real-fail',
    status: 'failed',
    vision_features: {
      right_eye: null,
      left_eye: null,
      asymmetry_notes: [],
      processing_metadata: {
        modal_call_id: 'fc-real-fail',
        error_summary: 'Imagens com pouca luz — tente recapturar',
      },
    },
  })
}

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/vision/webhook', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'x-modal-signature': 'sha256=deadbeef',
      'x-modal-timestamp': String(Math.floor(Date.now() / 1000)),
      ...headers,
    },
  })
}

describe('POST /api/vision/webhook', () => {
  beforeEach(() => {
    process.env.MODAL_WEBHOOK_SECRET = 'test-secret'
    // B1: discriminated-union mock — `{ valid: true }` on the happy path.
    mockVerify.mockReturnValue({ valid: true })
  })
  afterEach(() => vi.clearAllMocks())

  it('returns 401 when HMAC verification fails (signature_mismatch)', async () => {
    mockVerify.mockReturnValue({ valid: false, reason: 'signature_mismatch' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(401)
    // B1: rejection cause is logged.
    const warnText = String(warnSpy.mock.calls[0]?.[0] ?? '')
    expect(warnText).toContain('signature_mismatch')
    warnSpy.mockRestore()
  })

  it('returns 401 when timestamp is outside replay window (replay_window)', async () => {
    mockVerify.mockReturnValue({ valid: false, reason: 'replay_window' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(401)
    const warnText = String(warnSpy.mock.calls[0]?.[0] ?? '')
    expect(warnText).toContain('replay_window')
    warnSpy.mockRestore()
  })

  it('returns 401 when headers are missing (missing_headers)', async () => {
    mockVerify.mockReturnValue({ valid: false, reason: 'missing_headers' })
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(401)
  })

  it('returns 400 on malformed JSON', async () => {
    const res = await POST(makeRequest('{"not-json'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body fails Zod envelope (missing modal_call_id)', async () => {
    const bad = JSON.stringify({
      reading_id: READING_ID,
      status: 'ready',
      vision_features: {},
    })
    const res = await POST(makeRequest(bad))
    expect(res.status).toBe(400)
  })

  it('returns 400 when status enum is invalid', async () => {
    const res = await POST(makeRequest(bodyReady({ status: 'unknown' })))
    expect(res.status).toBe(400)
  })

  it('returns 200 no-op when reading is not found (idempotent)', async () => {
    mockCreateServiceClient.mockReturnValue(buildServiceClient({ existing: null }))
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.noop).toBe('reading_not_found')
  })

  it('returns 200 no-op when status guard rejects (already ready)', async () => {
    const sc = buildServiceClient({
      existing: { id: READING_ID, status: 'ready', vision_features: null },
    })
    mockCreateServiceClient.mockReturnValue(sc)
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.noop).toBe('status_guard')
    // CRITICAL: no UPDATE was attempted.
    expect(sc._update).not.toHaveBeenCalled()
    expect(mockRevalidate).not.toHaveBeenCalled()
  })

  it('returns 200 no-op when status guard rejects (edited — Phase 7)', async () => {
    const sc = buildServiceClient({
      existing: { id: READING_ID, status: 'edited', vision_features: null },
    })
    mockCreateServiceClient.mockReturnValue(sc)
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(200)
    expect(sc._update).not.toHaveBeenCalled()
  })

  it('returns 200 + applies UPDATE on valid HMAC happy path (status=ready)', async () => {
    const sc = buildServiceClient({
      existing: {
        id: READING_ID,
        status: 'processing',
        vision_features: { processing_metadata: { modal_call_id: 'fc-real-123' } },
      },
    })
    mockCreateServiceClient.mockReturnValue(sc)
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(sc._update).toHaveBeenCalledTimes(1)
    // Single .update() call — D-F5 atomicity.
    const updateArg = sc._update.mock.calls[0]![0]
    expect(updateArg.status).toBe('ready')
    expect(updateArg.processed_at).toBeTypeOf('string')
    expect(updateArg.vision_features).toBeDefined()
    expect(mockRevalidate).toHaveBeenCalledWith('/leituras')
  })

  it('returns 200 + applies UPDATE for failed status (D-F1 both-null path)', async () => {
    const sc = buildServiceClient({
      existing: {
        id: READING_ID,
        status: 'processing',
        vision_features: { processing_metadata: { modal_call_id: 'fc-real-fail' } },
      },
    })
    mockCreateServiceClient.mockReturnValue(sc)
    const res = await POST(makeRequest(bodyFailed()))
    expect(res.status).toBe(200)
    const updateArg = sc._update.mock.calls[0]![0]
    expect(updateArg.status).toBe('failed')
    expect(updateArg.vision_features.processing_metadata.error_summary).toBe(
      'Imagens com pouca luz — tente recapturar',
    )
  })

  it('B3: returns 200 + writes defensive vision_features when failed body omits the key', async () => {
    // The Zod schema marks vision_features as OPTIONAL on status='failed'
    // (only status='ready' requires it via superRefine). When the worker
    // omits the key entirely, the handler MUST substitute a defensive
    // structure carrying processing_metadata so the listing tooltip can
    // still render something meaningful (D-F2 + D-PM1.error_summary).
    const sc = buildServiceClient({
      existing: {
        id: READING_ID,
        status: 'processing',
        vision_features: null,
      },
    })
    mockCreateServiceClient.mockReturnValue(sc)
    const failedNoFeatures = JSON.stringify({
      reading_id: READING_ID,
      modal_call_id: 'fc-no-features',
      status: 'failed',
      // NO vision_features key — legitimately optional on failed.
    })
    const res = await POST(makeRequest(failedNoFeatures))
    expect(res.status).toBe(200)
    const updateArg = sc._update.mock.calls[0]![0]
    expect(updateArg.status).toBe('failed')
    // Defensive fallback was substituted.
    expect(updateArg.vision_features).toBeDefined()
    expect(updateArg.vision_features.processing_metadata).toBeDefined()
    expect(updateArg.vision_features.processing_metadata.error_summary).toBeTypeOf('string')
  })

  it('B3: returns 400 when status=ready omits vision_features (superRefine enforces)', async () => {
    // Zod superRefine rule: status='ready' MUST carry vision_features.
    const readyNoFeatures = JSON.stringify({
      reading_id: READING_ID,
      modal_call_id: 'fc-bad-ready',
      status: 'ready',
      // NO vision_features key — superRefine rejects.
    })
    const res = await POST(makeRequest(readyNoFeatures))
    expect(res.status).toBe(400)
  })

  it('proceeds with warn-log on modal_call_id mismatch (D-T5 defense-in-depth)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sc = buildServiceClient({
      existing: {
        id: READING_ID,
        status: 'processing',
        vision_features: { processing_metadata: { modal_call_id: 'fc-DIFFERENT' } },
      },
    })
    mockCreateServiceClient.mockReturnValue(sc)
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(200)
    // Update STILL applied — status guard is the primary barrier.
    expect(sc._update).toHaveBeenCalledTimes(1)
    // But a warning was logged.
    expect(warnSpy).toHaveBeenCalled()
    const warnText = String(warnSpy.mock.calls[0]?.[0] ?? '')
    expect(warnText).toContain('modal_call_id mismatch')
    warnSpy.mockRestore()
  })

  it('proceeds without warn when stored modal_call_id is the placeholder "pending"', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sc = buildServiceClient({
      existing: {
        id: READING_ID,
        status: 'processing',
        vision_features: { processing_metadata: { modal_call_id: 'pending' } },
      },
    })
    mockCreateServiceClient.mockReturnValue(sc)
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(200)
    expect(sc._update).toHaveBeenCalledTimes(1)
    // No mismatch warning when stored is the D-T5 placeholder.
    const mismatchWarn = warnSpy.mock.calls.find((c) =>
      String(c[0] ?? '').includes('modal_call_id mismatch'),
    )
    expect(mismatchWarn).toBeUndefined()
    warnSpy.mockRestore()
  })

  it('returns 500 when MODAL_WEBHOOK_SECRET is missing', async () => {
    delete process.env.MODAL_WEBHOOK_SECRET
    const res = await POST(makeRequest(bodyReady()))
    expect(res.status).toBe(500)
  })
})
