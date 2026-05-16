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
}: {
  signedUrls?: { signedUrl: string }[]
}) {
  const createSignedUrls = vi.fn().mockResolvedValue({
    data: signedUrls ?? null,
    error: signedUrls ? null : { message: 'sign failed' },
  })
  const storage = { from: vi.fn().mockReturnValue({ createSignedUrls }) }
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })
  const from = vi.fn().mockReturnValue({ update })
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
    mockCreateServiceClient.mockReturnValue(buildServiceClient({}))
    const res = await POST(makeRequest(), makeParams())
    expect(res.status).toBe(202)
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
