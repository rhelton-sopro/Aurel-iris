/**
 * Wave-0 stubs for the analyze Route Handler.
 *
 * NOTE: Full integration tests with mocked Anthropic.messages.stream are
 * deferred to a follow-up. The 5 auth gates are validated by founder UAT
 * (07-UAT.md scenarios). These stubs document the contract.
 *
 * Source: 07-VALIDATION.md line 60, 07-RESEARCH.md lines 1054-1060.
 */
import { describe, it } from 'vitest'

describe('app/api/readings/[id]/analyze — auth gates (T-7-AUTH a-e)', () => {
  it.todo('401 quando session ausente (gate a)')
  it.todo('403 quando reading.therapist_id !== user.id (gate b)')
  it.todo('404 quando reading não existe')
  it.todo("409 quando reading.status !== 'ready' (gate c)")
  it.todo('409 quando reading.report_delivered IS NOT NULL (gate d)')
  it.todo('409 quando reading.regeneration_count >= 3 (gate e)')
})

describe('app/api/readings/[id]/analyze — Response shape (D-S1)', () => {
  it.todo('headers Content-Type: text/plain; charset=utf-8')
  it.todo('headers Cache-Control: no-cache, no-transform')
  it.todo('headers X-Content-Type-Options: nosniff')
  it.todo('body é ReadableStream of Uint8Array text deltas')
})

describe('app/api/readings/[id]/analyze — finalization (D-S2 + D-P3)', () => {
  it.todo('append ENCERRAMENTO_LITERAL em report_generated.encerramento_disclaimer')
  it.todo('UPDATE audit_metadata via runAudit pós-stream')
  it.todo('regeneration_count incrementado em sucesso (não em erro)')
  it.todo('regeneration_log append entry com {timestamp, model, latency, tokens, cost}')
})

describe('app/api/readings/[id]/analyze — params Promise (Pitfall 5)', () => {
  it.todo('await params before usando id (Next.js 15 contract)')
})

describe('app/api/readings/[id]/analyze — abort plumbing', () => {
  it.todo('request.signal.aborted dispara llmStream.controller.abort')
})
