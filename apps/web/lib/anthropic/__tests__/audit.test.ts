// Wave-0 stub — preenchido em 07-05-PLAN (anchor rate + LGPD vocab).
// Source: 07-VALIDATION.md line 55, 07-RESEARCH.md line 1080.
//
// Nota: termos proibidos LGPD-06 NÃO aparecem como substring literal aqui —
// audit-vocabulary.mjs varre `lib/anthropic` agora (D-A4) e qualquer literal
// dispararia self-match. As implementações em 07-05 montam regex via concat
// indireto (Pitfall 7 W6 parity).
import { describe, it } from 'vitest'

describe('lib/anthropic/audit — anchor rate (D-A1)', () => {
  it.todo('calcula anchor rate por seção 2-6 via sentence-split em [.!?]+(?=\\s|$)')
  it.todo('low_anchor_rate=true quando overall < 95%')
  it.todo('low_anchor_rate=false quando overall >= 95%')
  it.todo('anchor_rate_pct=100 quando seção é vazia (degenerate)')
})

describe('lib/anthropic/audit — LGPD forbidden vocab (D-A2 + Pitfall 7)', () => {
  it.todo('regex word-boundary casa cada um dos 3 termos LGPD-06 proibidos')
  it.todo('regex NÃO casa "naturocultura" (substring de termo proibido rejeitada por \\b)')
  it.todo('lista hits por seção+termo+ocorrências em audit_metadata.forbidden_vocab')
  it.todo('audit_metadata.audited_at é ISO timestamp; auditor_version="v1"')
})
