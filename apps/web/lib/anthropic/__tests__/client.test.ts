// Wave-0 stub — preenchido em 07-03-PLAN (Anthropic client factory).
// Source: 07-VALIDATION.md line 58.
import { describe, it } from 'vitest'

describe('lib/anthropic/client', () => {
  it.todo('exports Anthropic instance built from process.env.ANTHROPIC_API_KEY')
  it.todo('MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6" (D-T2)')
  it.todo('throws claro se ANTHROPIC_API_KEY missing')
  it.todo('cache_control: { type: "ephemeral" } in default system block (Pitfall 4)')
})
