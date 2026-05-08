// Test contract for saveReportDelivered Server Action.
// Mocks supabase + auth.getUser via vi.hoisted; asserts BLOCK on vocab,
// edit_diff calc, status transition, timestamp.
//
// NOTE: Wave-0 stubs (it.todo) — full implementation requires elaborate
// supabase mock surface. Founder UAT in 07-UAT.md is the integration check.
import { describe, it } from 'vitest'

describe('app/actions/analise.saveReportDelivered (D-U2 + D-A2)', () => {
  it.todo('redirects to /login quando session ausente (auth gate)')
  it.todo('retorna error quando reading.therapist_id !== user.id (RLS + explicit check)')
  it.todo('BLOCK save com mensagem clara quando texto contém forbidden vocab (D-A2 defesa em profundidade)')
  it.todo('classifyAllSections é chamado com (report_generated, delivered) — produz edit_diff per-key')
  it.todo('UPDATE atomic: report_delivered + edit_diff + zonas_editadas + tipo_edicao + status="edited" + report_delivered_at=NOW()')
  it.todo('audit_metadata atualizado com runAudit(delivered) pós-save (defesa em profundidade)')
  it.todo('revalidatePath chamado para /leituras/[id], /leituras/[id]/editar, /leituras (3 paths)')
})

describe('app/actions/analise.markReadingDelivered (D-A2 defesa em profundidade)', () => {
  it.todo('re-roda audit em report_delivered antes do flip terminal (defense in depth)')
  it.todo('BLOCK quando re-audit detecta vocab proibido (transição terminal protegida)')
  it.todo('UPDATE: is_delivered=true, delivered_at=NOW()')
  it.todo('error quando is_delivered já true (idempotência — não re-flipa)')
})
