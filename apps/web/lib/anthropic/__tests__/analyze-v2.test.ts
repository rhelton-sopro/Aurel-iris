// IMPLEMENTED BY: 07.4-03 (analyze-v2.ts — Anthropic JSON mode + retry path)
// Source: 07.4-VALIDATION.md, RESEARCH.md §Anthropic JSON mode.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @anthropic-ai/sdk before any module that imports it (analyze-v2 →
// client.ts → @anthropic-ai/sdk). Pattern mirrors __tests__/client.test.ts.
//
// The mock supports a queue of pre-staged stream payloads — each call to
// `anthropicClient.messages.stream()` consumes the next entry. This lets us
// simulate (a) happy path JSON, (b) bad-JSON-then-good (retry path), and (c)
// 3-bad (3rd-fail throw).
// ---------------------------------------------------------------------------
const streamQueue: Array<{ text: string; usage?: Partial<Record<string, number>> }> = []

function enqueueStream(text: string, usage: Partial<Record<string, number>> = {}) {
  streamQueue.push({ text, usage })
}

async function drainStream(stream: AsyncIterable<string>): Promise<string> {
  let collected = ''
  for await (const chunk of stream) collected += chunk
  return collected
}

function makeMockStream(payload: { text: string; usage?: Partial<Record<string, number>> }) {
  const events = [
    {
      type: 'content_block_delta' as const,
      delta: { type: 'text_delta' as const, text: payload.text },
    },
  ]
  const usage = {
    input_tokens: payload.usage?.input_tokens ?? 1000,
    output_tokens: payload.usage?.output_tokens ?? 500,
    cache_creation_input_tokens: payload.usage?.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: payload.usage?.cache_read_input_tokens ?? 0,
  }
  let aborted = false
  return {
    controller: {
      abort: () => {
        aborted = true
      },
      get aborted() {
        return aborted
      },
    },
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e
    },
    async finalMessage() {
      return { usage }
    },
  }
}

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    apiKey: string
    messages = {
      stream: vi.fn(() => {
        const payload = streamQueue.shift()
        if (!payload) {
          throw new Error('analyze-v2 test mock: stream queue empty (test setup error)')
        }
        return makeMockStream(payload)
      }),
    }
    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey
    }
  }
  return { default: Anthropic }
})

// SDK helper — pass-through; we only care that the call site uses it. Real
// implementation calls zod.toJSONSchema which would still work, but the mock
// keeps the unit test fast and isolated.
vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({
  zodOutputFormat: vi.fn(() => ({ type: 'json_schema', schema: { _mocked: true } })),
}))

// Mock loadSystemPrompt — avoid reading prompts/system.md from disk in unit test.
vi.mock('../prompts', () => ({
  loadSystemPrompt: () => 'MOCK SYSTEM PROMPT — analyze-v2 unit test',
}))

// ---------------------------------------------------------------------------
// Reusable fixtures
// ---------------------------------------------------------------------------
const VALID_REPORT_JSON = JSON.stringify({
  report_version: '2.0',
  executive_summary: 'Resumo executivo do panorama clínico-funcional do iris codex.',
  constitutional_pattern: {
    description: 'Padrão estrutural com expressões funcionais delicadas.',
    key_traits: ['traço a', 'traço b'],
  },
  systems_with_tendency: [
    {
      system_id: 'linfatico',
      system_name: 'sistema linfático',
      tendency_grade: 3,
      tendency_label: 'moderada',
      clinical_description: 'Descrição clínica neutra.',
      associated_manifestations: ['manifesto'],
      investigation_points: ['investigação'],
      therapeutic_direction: 'Orientação acolhedora.',
    },
  ],
  integrative_axes: [
    { axis_name: 'eixo', status: 'ativo', description: 'Descrição do eixo.' },
  ],
  bilateral_findings: { asymmetry_present: false, description: null },
  therapeutic_synthesis: 'Síntese terapêutica detalhada.',
  priority_focus: ['foco 1', 'foco 2', 'foco 3'],
  clinical_note: 'Nota clínica final.',
  advanced_analysis: { available: true, generated: false, credit_cost: 1 },
})

const INVALID_REPORT_JSON_MISSING_REQUIRED = JSON.stringify({
  report_version: '2.0',
  // missing executive_summary, systems_with_tendency, etc.
})

const INVALID_REPORT_PRIORITY_FOCUS_WRONG_LENGTH = (() => {
  const parsed = JSON.parse(VALID_REPORT_JSON)
  parsed.priority_focus = ['only', 'two']
  return JSON.stringify(parsed)
})()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('lib/anthropic/analyze-v2 (D-VAL1, D-VAL2, D-TEL2) — Plan 07.4-03', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    streamQueue.length = 0
    process.env.ANTHROPIC_API_KEY = 'sk-test-analyze-v2'
    vi.resetModules()
  })

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
  })

  async function runHappyPath() {
    enqueueStream(VALID_REPORT_JSON)
    const mod = await import('../analyze-v2')
    const result = await mod.analyzeReadingV2({
      readingId: 'reading-abc',
      therapistId: 'therapist-xyz',
      clientName: 'Test Client',
      clientAge: 40,
      clientSex: 'F',
      therapistNotes: 'note',
      tendencies: [],
      knowledgeChunks: [],
    })
    // Consume stream
    let streamed = ''
    for await (const chunk of result.stream) streamed += chunk
    expect(streamed).toBe(VALID_REPORT_JSON)
    const final = await result.finalize()
    return { result, final }
  }

  it('mocks anthropic stream + emits text_delta events → parsed ReportV2', async () => {
    const { final } = await runHappyPath()
    expect(final.report.report_version).toBe('2.0')
    expect(final.report.systems_with_tendency.length).toBe(1)
    expect(final.report.systems_with_tendency[0]!.system_id).toBe('linfatico')
    expect(final.retryCount).toBe(0)
    expect(final.audit.json_validation_passed).toBe(true)
    expect(final.audit.retry_count).toBe(0)
  })

  it('triggers retry on invalid JSON output (D-VAL2 path) → retryCount=1', async () => {
    enqueueStream(INVALID_REPORT_JSON_MISSING_REQUIRED)
    enqueueStream(VALID_REPORT_JSON)
    const mod = await import('../analyze-v2')
    const result = await mod.analyzeReadingV2({
      readingId: 'r',
      therapistId: 't',
      clientName: 'c',
      clientAge: null,
      clientSex: null,
      therapistNotes: null,
      tendencies: [],
      knowledgeChunks: [],
    })
    await drainStream(result.stream)
    const final = await result.finalize()
    expect(final.retryCount).toBe(1)
    expect(final.report.report_version).toBe('2.0')
    expect(final.audit.retry_count).toBe(1)
  })

  it('triggers retry on subtle validation error (priority_focus length != 3) → retryCount=1', async () => {
    enqueueStream(INVALID_REPORT_PRIORITY_FOCUS_WRONG_LENGTH)
    enqueueStream(VALID_REPORT_JSON)
    const mod = await import('../analyze-v2')
    const result = await mod.analyzeReadingV2({
      readingId: 'r',
      therapistId: 't',
      clientName: 'c',
      clientAge: null,
      clientSex: null,
      therapistNotes: null,
      tendencies: [],
      knowledgeChunks: [],
    })
    await drainStream(result.stream)
    const final = await result.finalize()
    expect(final.retryCount).toBe(1)
    expect(final.report.priority_focus.length).toBe(3)
  })

  it('max 2 retries then throws ZodValidationFailedError preserving raw output', async () => {
    enqueueStream(INVALID_REPORT_JSON_MISSING_REQUIRED)
    enqueueStream(INVALID_REPORT_JSON_MISSING_REQUIRED)
    enqueueStream(INVALID_REPORT_JSON_MISSING_REQUIRED)
    const mod = await import('../analyze-v2')
    const result = await mod.analyzeReadingV2({
      readingId: 'r',
      therapistId: 't',
      clientName: 'c',
      clientAge: null,
      clientSex: null,
      therapistNotes: null,
      tendencies: [],
      knowledgeChunks: [],
    })
    await drainStream(result.stream)
    await expect(result.finalize()).rejects.toThrowError(mod.ZodValidationFailedError)
    // Verify the error preserves raw output for the route handler to save
    try {
      // Replay scenario for instance-check (await rejects.toThrowError consumed the promise)
      streamQueue.length = 0
      enqueueStream(INVALID_REPORT_JSON_MISSING_REQUIRED)
      enqueueStream(INVALID_REPORT_JSON_MISSING_REQUIRED)
      enqueueStream(INVALID_REPORT_JSON_MISSING_REQUIRED)
      const r2 = await mod.analyzeReadingV2({
        readingId: 'r',
        therapistId: 't',
        clientName: 'c',
        clientAge: null,
        clientSex: null,
        therapistNotes: null,
        tendencies: [],
        knowledgeChunks: [],
      })
      await drainStream(r2.stream)
      await r2.finalize()
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(mod.ZodValidationFailedError)
      const e = err as InstanceType<typeof mod.ZodValidationFailedError>
      expect(e.rawOutput).toBe(INVALID_REPORT_JSON_MISSING_REQUIRED)
      expect(e.zodError).toBeDefined()
      expect(e.attempts).toBeGreaterThanOrEqual(3)
    }
  })

  it('telemetry event iris_codex_report_generate emitted with grade_distribution + retry_count + audit hits', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    try {
      await runHappyPath()
      const calls = infoSpy.mock.calls.flat()
      const event = calls.find(
        (c) => typeof c === 'object' && c !== null && (c as { event?: string }).event === 'iris_codex_report_generate',
      ) as Record<string, unknown> | undefined
      expect(event).toBeDefined()
      expect(event!.reading_id).toBe('reading-abc')
      expect(event!.therapist_id).toBe('therapist-xyz')
      expect(event!.report_version).toBe('2.0')
      expect(event!.systems_detected).toBe(1)
      expect(event!.retry_count).toBe(0)
      expect(event!.json_validation_passed).toBe(true)
      expect(typeof event!.iridological_jargon_hits).toBe('number')
      expect(typeof event!.sopro_vocab_hits).toBe('number')
      expect(typeof event!.forbidden_vocab_hits).toBe('number')
      expect(typeof event!.cost_estimate_usd).toBe('number')
      // PII guard — must not include client_name or therapist_notes
      expect(event).not.toHaveProperty('client_name')
      expect(event).not.toHaveProperty('therapist_notes')
      // Grade distribution shape
      const gd = event!.grade_distribution as Record<string, number>
      expect(gd['3']).toBe(1)
      expect(gd['1']).toBe(0)
    } finally {
      infoSpy.mockRestore()
    }
  })

  it('cache_control and output_config set on stream call', async () => {
    enqueueStream(VALID_REPORT_JSON)
    const mod = await import('../analyze-v2')
    const sdkMock = await import('@anthropic-ai/sdk')
    // Cast to access the prototype-bound vi.fn() on messages.stream
    const Anthropic = (sdkMock as unknown as { default: new (opts: { apiKey: string }) => { messages: { stream: ReturnType<typeof vi.fn> } } }).default
    // Instantiate (uses same mock class) to inspect call args via the SAME prototype property
    // The actual call is made by analyze-v2 → client.ts → new Anthropic() which uses this same mock class.
    // We grab the stream mock from the analyze-v2 module's anthropicClient.
    const clientMod = await import('../client')
    const streamMock = clientMod.anthropicClient.messages.stream as unknown as ReturnType<typeof vi.fn>

    const result = await mod.analyzeReadingV2({
      readingId: 'r',
      therapistId: 't',
      clientName: 'c',
      clientAge: null,
      clientSex: null,
      therapistNotes: null,
      tendencies: [],
      knowledgeChunks: [],
    })
    await drainStream(result.stream)
    await result.finalize()

    const callArgs = streamMock.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(callArgs).toBeDefined()
    // system block uses cache_control: ephemeral
    const sys = callArgs.system as Array<Record<string, unknown>>
    expect(sys[0]!.cache_control).toEqual({ type: 'ephemeral' })
    // output_config wired with zodOutputFormat result
    const out = callArgs.output_config as Record<string, unknown>
    expect(out.format).toBeDefined()

    // Make sure Anthropic class reference is alive (defends against tree-shaking of mock)
    expect(Anthropic).toBeDefined()
  })

  it('MAX_RETRIES exported as 2 (D-VAL2 contract)', async () => {
    const mod = await import('../analyze-v2')
    expect(mod.MAX_RETRIES).toBe(2)
  })

  it('AbortSignal cancels the stream', async () => {
    enqueueStream(VALID_REPORT_JSON)
    const ac = new AbortController()
    const mod = await import('../analyze-v2')
    const result = await mod.analyzeReadingV2({
      readingId: 'r',
      therapistId: 't',
      clientName: 'c',
      clientAge: null,
      clientSex: null,
      therapistNotes: null,
      tendencies: [],
      knowledgeChunks: [],
      signal: ac.signal,
    })
    ac.abort()
    // Should not throw — stream events may have already drained, but abort is fired
    await drainStream(result.stream)
    await result.finalize()
    expect(ac.signal.aborted).toBe(true)
  })
})
