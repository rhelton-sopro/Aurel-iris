// Wave-0 stub — preenchido como integration suite manual.
// Skip-by-default; opt-in setting env var ANTHROPIC_INTEGRATION=1 + pnpm test:llm.
// Source: 07-VALIDATION.md line 67.
import { describe, it } from 'vitest'

const RUN_INTEGRATION = process.env.ANTHROPIC_INTEGRATION === '1'
const maybeDescribe = RUN_INTEGRATION ? describe : describe.skip

maybeDescribe('lib/anthropic — Anthropic API integration (manual opt-in)', () => {
  it.todo('end-to-end call against fixture vision_features → 14 sections received')
  it.todo('encerramento_disclaimer appended server-side post-stream')
  it.todo('anchor_rate_pct computed via runAudit ≥ 80 on canned features')
  it.todo('forbidden_vocab vazio em geração canned (LGPD-06 SC3 spot-check)')
  it.todo('cache_creation_input_tokens > 0 na primeira call (Pitfall 4 cache hit proof)')
})
