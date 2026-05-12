/**
 * Phase 07.1.6 Plan 03 Task 2 — sonnet-bbox unit tests.
 *
 * Mocks @anthropic-ai/sdk (no real Sonnet API call, EVER).
 * Real sharp pipeline runs on a tiny synthetic JPEG buffer.
 *
 * Pattern mirrored from `lib/anthropic/__tests__/client.test.ts`:
 *   - vi.mock @anthropic-ai/sdk at top-level
 *   - vi.resetModules() per test + dynamic await import('../sonnet-bbox')
 *   - process.env.ANTHROPIC_API_KEY set inside test before import
 *     (client.ts throws at module init if missing)
 *
 * Cobertura:
 *   - Happy path: parses valid JSON → IrisBbox + usage + cost_usd
 *   - Markdown wrap: ```json {...}``` → regex extracts inner JSON
 *   - Missing fields: defaults applied (radius=0, center=0.5/0.5)
 *   - valid:false: bbox.valid=false propaga (sanity gate marca 'fallback')
 *   - Invalid JSON: lança erro claro
 *   - No text block: lança erro claro
 *   - SONNET_BBOX_MODEL hardcoded passa pra messages.create (C-04 enforcement)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'

// Module-scope spy: each test wires messages.create via beforeEach.
const mockMessagesCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    apiKey: string
    messages: { create: typeof mockMessagesCreate }
    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey
      this.messages = { create: mockMessagesCreate }
    }
  }
  return { default: Anthropic }
})

async function makeTestJpeg(width = 100, height = 100): Promise<Buffer> {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 50, b: 50 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
}

function mockSonnetResponse(text: string, inputTokens = 1800, outputTokens = 170) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
  }
}

describe('fetchIrisBbox', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    vi.resetModules()
    mockMessagesCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'sk-test-mock'
  })

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
  })

  it('happy path: parses valid JSON, returns bbox + usage + cost', async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      mockSonnetResponse(
        JSON.stringify({
          valid: true,
          iris_bbox: { center_x_pct: 0.47, center_y_pct: 0.41, radius_pct: 0.13 },
          rotation_angle_deg: -3,
          eye_landmarks: {
            inner_canthus_x_pct: 0.3,
            inner_canthus_y_pct: 0.4,
            outer_canthus_x_pct: 0.7,
            outer_canthus_y_pct: 0.4,
          },
          confidence: 0.85,
        }),
      ),
    )
    const { fetchIrisBbox } = await import('../sonnet-bbox')
    const buf = await makeTestJpeg(800, 600)
    const result = await fetchIrisBbox(buf)
    expect(result.bbox).toEqual({
      center_x_pct: 0.47,
      center_y_pct: 0.41,
      radius_pct: 0.13,
      confidence: 0.85,
      valid: true,
    })
    expect(result.usage).toEqual({ input_tokens: 1800, output_tokens: 170 })
    // Sonnet pricing: 1800/1M * $3 + 170/1M * $15 = $0.0054 + $0.00255 = $0.00795
    expect(result.cost_usd).toBeCloseTo(0.00795, 5)
  })

  it('strips markdown wrap via regex fallback', async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      mockSonnetResponse(
        '```json\n' +
          JSON.stringify({
            valid: true,
            iris_bbox: { center_x_pct: 0.5, center_y_pct: 0.5, radius_pct: 0.15 },
            confidence: 0.9,
          }) +
          '\n```',
      ),
    )
    const { fetchIrisBbox } = await import('../sonnet-bbox')
    const buf = await makeTestJpeg()
    const result = await fetchIrisBbox(buf)
    expect(result.bbox.radius_pct).toBe(0.15)
    expect(result.bbox.valid).toBe(true)
  })

  it('applies safe defaults on missing iris_bbox fields', async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      mockSonnetResponse(JSON.stringify({ valid: true, confidence: 0.6 })),
    )
    const { fetchIrisBbox } = await import('../sonnet-bbox')
    const buf = await makeTestJpeg()
    const result = await fetchIrisBbox(buf)
    expect(result.bbox).toEqual({
      center_x_pct: 0.5,
      center_y_pct: 0.5,
      radius_pct: 0,
      confidence: 0.6,
      valid: true,
    })
  })

  it("propagates valid:false (sanity gate will mark 'fallback')", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      mockSonnetResponse(
        JSON.stringify({
          valid: false,
          iris_bbox: { center_x_pct: 0.5, center_y_pct: 0.5, radius_pct: 0 },
          confidence: 0,
        }),
      ),
    )
    const { fetchIrisBbox } = await import('../sonnet-bbox')
    const buf = await makeTestJpeg()
    const result = await fetchIrisBbox(buf)
    expect(result.bbox.valid).toBe(false)
    expect(result.bbox.radius_pct).toBe(0)
  })

  it('throws clear error on invalid JSON', async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      mockSonnetResponse('not even close to JSON, just plaintext'),
    )
    const { fetchIrisBbox } = await import('../sonnet-bbox')
    const buf = await makeTestJpeg()
    await expect(fetchIrisBbox(buf)).rejects.toThrow(/Sonnet returned invalid JSON/)
  })

  it('throws when response has no text block', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [],
      usage: { input_tokens: 0, output_tokens: 0 },
    })
    const { fetchIrisBbox } = await import('../sonnet-bbox')
    const buf = await makeTestJpeg()
    await expect(fetchIrisBbox(buf)).rejects.toThrow(/no text block/)
  })

  it('throws when image buffer has no width/height', async () => {
    const { fetchIrisBbox } = await import('../sonnet-bbox')
    const badBuf = Buffer.from('not an image at all')
    await expect(fetchIrisBbox(badBuf)).rejects.toThrow()
  })

  it('passes SONNET_BBOX_MODEL (hardcoded) to messages.create — C-04 enforcement', async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      mockSonnetResponse(
        JSON.stringify({
          valid: true,
          iris_bbox: { center_x_pct: 0.5, center_y_pct: 0.5, radius_pct: 0.15 },
          confidence: 0.9,
        }),
      ),
    )
    const { fetchIrisBbox } = await import('../sonnet-bbox')
    const buf = await makeTestJpeg()
    await fetchIrisBbox(buf)
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    )
    const callArgs = mockMessagesCreate.mock.calls[0]?.[0]
    expect(callArgs.messages[0].content[0].type).toBe('image')
    expect(callArgs.messages[0].content[0].source.media_type).toBe('image/jpeg')
  })
})
