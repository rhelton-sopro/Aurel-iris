// Phase 7 | Plan 07-03 — Anthropic client factory tests.
// Source: 07-VALIDATION.md line 58, 07-CONTEXT.md D-T2, 07-RESEARCH.md Pitfall 4.
//
// Mock `@anthropic-ai/sdk` para sidestep do detector "browser-like" do SDK
// quando rodando em jsdom (default em vitest.config.ts). Esse mock preserva
// constructor.name='Anthropic' e expõe apiKey para asserts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    apiKey: string
    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey
    }
  }
  return { default: Anthropic }
})

describe('lib/anthropic/client', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY
  const ORIGINAL_MODEL = process.env.ANTHROPIC_MODEL

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
    if (ORIGINAL_MODEL === undefined) delete process.env.ANTHROPIC_MODEL
    else process.env.ANTHROPIC_MODEL = ORIGINAL_MODEL
  })

  it('exports Anthropic instance built from process.env.ANTHROPIC_API_KEY', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const mod = await import('../client')
    expect(mod.anthropicClient).toBeDefined()
    expect(mod.anthropicClient.constructor.name).toBe('Anthropic')
  })

  it('MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6" (D-T2)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    delete process.env.ANTHROPIC_MODEL
    const mod = await import('../client')
    expect(mod.MODEL).toBe('claude-sonnet-4-6')
  })

  it('MODEL respects ANTHROPIC_MODEL env override (D-T2)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    process.env.ANTHROPIC_MODEL = 'claude-opus-4-7'
    const mod = await import('../client')
    expect(mod.MODEL).toBe('claude-opus-4-7')
  })

  it('throws clear error if ANTHROPIC_API_KEY missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(import('../client')).rejects.toThrow(/ANTHROPIC_API_KEY env var is required/)
  })

  it('DEFAULT_SYSTEM_CACHE_CONTROL is { type: "ephemeral" } (Pitfall 4)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const mod = await import('../client')
    expect(mod.DEFAULT_SYSTEM_CACHE_CONTROL).toEqual({ type: 'ephemeral' })
  })

  it('estimateCostUsd correctly weights all 4 token buckets (Pitfall 4)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const mod = await import('../client')
    // 1M input @ $3 + 1M output @ $15 + 1M cache write @ $3.75 + 1M cache read @ $0.30
    expect(
      mod.estimateCostUsd({
        input_tokens: 1_000_000,
        output_tokens: 1_000_000,
        cache_creation_input_tokens: 1_000_000,
        cache_read_input_tokens: 1_000_000,
      }),
    ).toBeCloseTo(22.05, 2)
  })
})
