import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ModalTriggerError, triggerVisionPipeline } from './modal-client'

const ORIGINAL_ENV = { ...process.env }
const ORIGINAL_FETCH = global.fetch

function setEnv() {
  process.env.MODAL_ANALYZE_ENDPOINT_URL = 'https://example.modal.run/analyze'
  process.env.MODAL_TOKEN_ID = 'mk_test'
  process.env.MODAL_TOKEN_SECRET = 'ms_test'
}

describe('triggerVisionPipeline', () => {
  beforeEach(() => setEnv())
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    global.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it('throws when MODAL_ANALYZE_ENDPOINT_URL missing', async () => {
    delete process.env.MODAL_ANALYZE_ENDPOINT_URL
    await expect(
      triggerVisionPipeline({ readingId: 'r1', imageUrls: [] }),
    ).rejects.toThrow(/MODAL_ANALYZE_ENDPOINT_URL/)
  })

  it('throws when MODAL_TOKEN_ID missing', async () => {
    delete process.env.MODAL_TOKEN_ID
    await expect(
      triggerVisionPipeline({ readingId: 'r1', imageUrls: [] }),
    ).rejects.toThrow(/MODAL_TOKEN_ID/)
  })

  it('throws when MODAL_TOKEN_SECRET missing', async () => {
    delete process.env.MODAL_TOKEN_SECRET
    await expect(
      triggerVisionPipeline({ readingId: 'r1', imageUrls: [] }),
    ).rejects.toThrow(/MODAL_TOKEN_SECRET/)
  })

  it('sends POST with proxy auth headers and JSON body', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ call_id: 'fc-123' }), { status: 200 }),
    )
    global.fetch = fetchMock as typeof global.fetch

    const result = await triggerVisionPipeline({
      readingId: 'r1',
      imageUrls: [{ eye: 'right', angle: 'frontal', url: 'https://signed.test/1' }],
    })
    expect(result.callId).toBe('fc-123')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://example.modal.run/analyze')
    expect((init as RequestInit).method).toBe('POST')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['Modal-Key']).toBe('mk_test')
    expect(headers['Modal-Secret']).toBe('ms_test')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.reading_id).toBe('r1')
    expect(body.image_urls).toHaveLength(1)
  })

  it('throws ModalTriggerError on non-2xx response', async () => {
    global.fetch = vi.fn(async () =>
      new Response('forbidden', { status: 403 }),
    ) as typeof global.fetch
    await expect(
      triggerVisionPipeline({ readingId: 'r1', imageUrls: [] }),
    ).rejects.toMatchObject({ name: 'ModalTriggerError', status: 403 })
  })

  it('throws when response is missing call_id', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({}), { status: 200 }),
    ) as typeof global.fetch
    await expect(
      triggerVisionPipeline({ readingId: 'r1', imageUrls: [] }),
    ).rejects.toThrow(/missing call_id/)
  })
})
