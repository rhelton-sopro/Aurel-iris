// Phase 7.1 | Plan 07.1-03 — photos download API route tests.
// Source: 07.1-03-PLAN Task 6 verification gate.
//
// Tests:
//   - founder happy path: returns 200 + signedUrls array
//   - non-founder: returns 404 (not 403 — avoids leaking existence)
//   - no session: returns 404
//   - empty images: returns 200 with empty array
//   - service error: returns 500
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const VALID_READING_UUID = '401288f4-0f02-43aa-bdee-16d501089dc9'
const FOUNDER_EMAIL = 'rhelton@gmail.com'

const { mockGetUser, mockServiceFrom, mockServiceStorage } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockServiceFrom = vi.fn()
  const mockServiceStorage = vi.fn()
  return { mockGetUser, mockServiceFrom, mockServiceStorage }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
    storage: { from: mockServiceStorage },
  })),
}))

describe('GET /api/admin/calibration/photos/[reading_id]', () => {
  const ORIGINAL_FOUNDER_EMAIL = process.env.FOUNDER_EMAIL

  beforeEach(() => {
    process.env.FOUNDER_EMAIL = FOUNDER_EMAIL
    mockGetUser.mockReset()
    mockServiceFrom.mockReset()
    mockServiceStorage.mockReset()
  })

  afterEach(() => {
    if (ORIGINAL_FOUNDER_EMAIL === undefined) delete process.env.FOUNDER_EMAIL
    else process.env.FOUNDER_EMAIL = ORIGINAL_FOUNDER_EMAIL
  })

  function makeParams() {
    return { params: Promise.resolve({ reading_id: VALID_READING_UUID }) }
  }

  it('returns 404 when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/'), makeParams())

    expect(response.status).toBe(404)
  })

  it('returns 404 when user is not founder', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'attacker@example.com' } },
      error: null,
    })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/'), makeParams())

    expect(response.status).toBe(404)
    expect(mockServiceFrom).not.toHaveBeenCalled()
  })

  it('returns 200 with signed URLs when founder requests', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: FOUNDER_EMAIL } },
      error: null,
    })
    const images = [
      { eye: 'right', angle: 'frontal', storage_path: 'uid/rid/right_frontal.jpg' },
      { eye: 'right', angle: 'lateral', storage_path: 'uid/rid/right_lateral.jpg' },
    ]
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: images, error: null }),
      }),
    })
    mockServiceStorage.mockReturnValue({
      createSignedUrls: vi.fn().mockResolvedValue({
        data: [
          { signedUrl: 'https://cdn.example/uid/rid/right_frontal.jpg?sig=1' },
          { signedUrl: 'https://cdn.example/uid/rid/right_lateral.jpg?sig=2' },
        ],
        error: null,
      }),
    })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/'), makeParams())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.signedUrls).toHaveLength(2)
    expect(body.signedUrls[0]).toEqual({
      eye: 'right',
      angle: 'frontal',
      url: 'https://cdn.example/uid/rid/right_frontal.jpg?sig=1',
      filename: `${VALID_READING_UUID}_right_frontal.jpg`,
    })
  })

  it('returns 200 with empty array when reading has no images', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: FOUNDER_EMAIL } },
      error: null,
    })
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/'), makeParams())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.signedUrls).toEqual([])
    expect(mockServiceStorage).not.toHaveBeenCalled()
  })

  it('returns 500 when service-role storage fails to sign URLs', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: FOUNDER_EMAIL } },
      error: null,
    })
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ eye: 'right', angle: 'frontal', storage_path: 'p' }],
          error: null,
        }),
      }),
    })
    mockServiceStorage.mockReturnValue({
      createSignedUrls: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'storage timeout' },
      }),
    })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/'), makeParams())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toContain('storage timeout')
  })
})
