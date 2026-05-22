import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mocks must be set up BEFORE importing the route module.

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/vision/modal-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/vision/modal-client')>(
    '@/lib/vision/modal-client',
  )
  return {
    ...actual,
    triggerVisionPipeline: vi.fn(),
  }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ModalTriggerError, triggerVisionPipeline } from '@/lib/vision/modal-client'

import { POST } from './route'

const mockCreateClient = vi.mocked(createClient)
const mockCreateServiceClient = vi.mocked(createServiceClient)
const mockTrigger = vi.mocked(triggerVisionPipeline)

type TestImages = { eye: string; angle: string; storage_path: string }[]

function buildUserClient({
  user,
  reading,
  images,
}: {
  user: { id: string } | null
  reading?: { id: string; status: string; therapist_id: string } | null
  images?: TestImages
}) {
  // Tracks call count to differentiate the readings query vs reading_images query
  let selectCallIndex = 0

  const select = vi.fn().mockImplementation(() => {
    const callIdx = selectCallIndex++

    if (callIdx === 0) {
      // First call: readings ownership query → .eq().eq().single()
      const single = vi.fn().mockResolvedValue({
        data: reading ?? null,
        error: reading !== undefined && reading !== null ? null : { message: 'not found' },
      })
      const eq2 = vi.fn().mockReturnValue({ single })
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
      return { eq: eq1 }
    } else {
      // Second call: reading_images query → .eq()
      return {
        eq: vi.fn().mockResolvedValue({
          data: images ?? [],
          error: null,
        }),
      }
    }
  })

  const from = vi.fn().mockReturnValue({ select })
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user },
      error: user ? null : { message: 'no session' },
    }),
  }
  return { from, auth } as unknown as Awaited<ReturnType<typeof createClient>>
}

function buildServiceClient({
  signedUrls,
  imageCount = 6,
}: {
  signedUrls?: { signedUrl: string }[]
  /** Quantas reading_images existem (pro count check do Sonnet-direct path).
   *  Default 6 = captura completa (rota marca ready). Use 3 pra simular
   *  captura incompleta (rota retorna 400 incomplete_capture). */
  imageCount?: number
}) {
  const createSignedUrls = vi.fn().mockResolvedValue({
    data: signedUrls ?? null,
    error: signedUrls ? null : { message: 'sign failed' },
  })
  const storage = { from: vi.fn().mockReturnValue({ createSignedUrls }) }
  // markReadingReady em lib/readings/mark-ready.ts faz 2 UPDATEs:
  //   1. .update({status: 'ready'}).eq('id', ...)                 ← 1 eq
  //   2. .update({beta_counted: true}).eq('id',...).eq('beta_counted',false).select('therapist_id').maybeSingle()  ← chain
  // Mock cobre ambos: o primeiro .eq() retorna objeto que resolve ({error: null}) E
  // ALSO suporta .eq().select().maybeSingle() chain pro segundo path.
  const update = vi.fn().mockImplementation(() => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn().mockReturnValue({ maybeSingle })
    const eqInner = vi.fn().mockReturnValue({ select, maybeSingle })
    const eqOuter = vi.fn().mockImplementation(() => {
      // Promise-like + chainable (Supabase builder behavior)
      const p = Promise.resolve({ error: null })
      return Object.assign(p, { eq: eqInner, select, maybeSingle })
    })
    return { eq: eqOuter }
  })
  // Count check do Sonnet-direct path (2026-05-22): rota chama
  //   service.from('reading_images').select('id', { count: 'exact', head: true }).eq('reading_id', X)
  // Discrimina por tabela pra retornar a forma certa.
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'reading_images') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: imageCount, error: null }),
        }),
      }
    }
    // 'readings' (default): só update na rota
    return { update }
  })
  return { storage, from } as unknown as ReturnType<typeof createServiceClient>
}

function makeRequest() {
  return new Request('http://localhost/api/readings/abc-123/process', { method: 'POST' })
}

function makeParams(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: 'abc-123' }) }
}

describe('POST /api/readings/[id]/process', () => {
  beforeEach(() => {
    process.env.MODAL_ANALYZE_ENDPOINT_URL = 'https://example.modal.run/analyze'
    process.env.MODAL_TOKEN_ID = 'mk'
    process.env.MODAL_TOKEN_SECRET = 'ms'
    // Phase 7.4: Modal is retired (default OFF). These legacy-path tests
    // exercise the still-present, flag-gated Modal code → opt in explicitly.
    // The new default (flag off → 202 + status='ready') is covered separately.
    process.env.MODAL_PIPELINE_ENABLED = 'true'
  })
  afterEach(() => {
    delete process.env.MODAL_PIPELINE_ENABLED
    vi.clearAllMocks()
  })

  it('Sonnet-direct default (Modal disabled): 202 + status=ready, no trigger', async () => {
    delete process.env.MODAL_PIPELINE_ENABLED
    mockCreateClient.mockResolvedValue(
      buildUserClient({
        user: { id: 'u' },
        reading: { id: 'abc-123', status: 'pending', therapist_id: 'u' },
      }),
    )
    mockCreateServiceClient.mockReturnValue(buildServiceClient({ imageCount: 6 }))
    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(202)
    expect(mockTrigger).not.toHaveBeenCalled()
  })

  it('Sonnet-direct + incomplete capture (count<6): 400 incomplete_capture (caso Caroline)', async () => {
    delete process.env.MODAL_PIPELINE_ENABLED
    mockCreateClient.mockResolvedValue(
      buildUserClient({
        user: { id: 'u' },
        reading: { id: 'abc-123', status: 'pending', therapist_id: 'u' },
      }),
    )
    mockCreateServiceClient.mockReturnValue(buildServiceClient({ imageCount: 3 }))
    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; message: string; image_count: number }
    expect(body.error).toBe('incomplete_capture')
    expect(body.message).toContain('3 de 6')
    expect(body.image_count).toBe(3)
    expect(mockTrigger).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(buildUserClient({ user: null }))
    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when reading not found / not owned', async () => {
    mockCreateClient.mockResolvedValue(buildUserClient({ user: { id: 'u' }, reading: null }))
    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 404 when status not retriggerable (e.g. processing)', async () => {
    mockCreateClient.mockResolvedValue(
      buildUserClient({
        user: { id: 'u' },
        reading: { id: 'abc-123', status: 'processing', therapist_id: 'u' },
      }),
    )
    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 404 when no images', async () => {
    mockCreateClient.mockResolvedValue(
      buildUserClient({
        user: { id: 'u' },
        reading: { id: 'abc-123', status: 'pending', therapist_id: 'u' },
        images: [],
      }),
    )
    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 202 on successful trigger', async () => {
    const images: TestImages = [
      { eye: 'right', angle: 'frontal', storage_path: 'u/r/originais/right_frontal.jpg' },
      { eye: 'right', angle: 'lateral', storage_path: 'u/r/originais/right_lateral.jpg' },
    ]
    mockCreateClient.mockResolvedValue(
      buildUserClient({
        user: { id: 'u' },
        reading: { id: 'abc-123', status: 'pending', therapist_id: 'u' },
        images,
      }),
    )
    mockCreateServiceClient.mockReturnValue(
      buildServiceClient({
        signedUrls: images.map((_, i) => ({ signedUrl: `https://signed.test/${i}` })),
      }),
    )
    mockTrigger.mockResolvedValue({ callId: 'fc-real' })

    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(202)

    // Trigger called with correct args
    expect(mockTrigger).toHaveBeenCalledTimes(1)
    const call = mockTrigger.mock.calls[0]![0]
    expect(call.readingId).toBe('abc-123')
    expect(call.imageUrls).toHaveLength(2)
  })

  it('returns 502 and rolls back to failed on Modal trigger failure', async () => {
    const images: TestImages = [
      { eye: 'right', angle: 'frontal', storage_path: 'u/r/originais/right_frontal.jpg' },
    ]
    mockCreateClient.mockResolvedValue(
      buildUserClient({
        user: { id: 'u' },
        reading: { id: 'abc-123', status: 'pending', therapist_id: 'u' },
        images,
      }),
    )
    const serviceClient = buildServiceClient({
      signedUrls: [{ signedUrl: 'https://signed.test/0' }],
    })
    mockCreateServiceClient.mockReturnValue(serviceClient)
    mockTrigger.mockRejectedValue(new ModalTriggerError('Modal 500', 500))

    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(502)
    // Two calls to serviceClient.from expected:
    // - readings (pre-spawn UPDATE to status='processing')
    // - readings (rollback UPDATE to status='failed')
    expect(serviceClient.from).toHaveBeenCalledTimes(2)
  })

  it('accepts retrigger from failed status', async () => {
    const images: TestImages = [
      { eye: 'right', angle: 'frontal', storage_path: 'u/r/originais/right_frontal.jpg' },
    ]
    mockCreateClient.mockResolvedValue(
      buildUserClient({
        user: { id: 'u' },
        reading: { id: 'abc-123', status: 'failed', therapist_id: 'u' },
        images,
      }),
    )
    mockCreateServiceClient.mockReturnValue(
      buildServiceClient({ signedUrls: [{ signedUrl: 'https://signed.test/0' }] }),
    )
    mockTrigger.mockResolvedValue({ callId: 'fc-retry' })

    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(202)
  })
})
