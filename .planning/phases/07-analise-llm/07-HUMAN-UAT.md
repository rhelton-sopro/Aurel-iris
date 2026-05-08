---
status: partial
phase: 07-analise-llm
source: [07-VERIFICATION.md]
started: 2026-05-08T19:00:00Z
updated: 2026-05-08T19:00:00Z
---

## Current Test

[awaiting human testing — founder UAT against real Anthropic API]

## Tests

### 1. SC3 — Linguagem hipotética em 10 relatórios reais consecutivos
expected: Em 10 relatórios gerados consecutivamente sobre features distintas (variando idade, gênero, sinais), nenhum contém ocorrência das frases proibidas: "o cliente tem", "diagnostica-se", "está doente de", "trauma confirmado aos X anos", e os termos isolados "diagnóstico", "tratamento", "cura". Verificação automática ocorre via `runAudit` (`FORBIDDEN_VOCAB_RE` com word-boundary D-A2/Pitfall 7) — `audit_metadata.forbidden_vocab` deve ter `count: 0` em todos os 10.

result: [pending]

how to test:
1. Iniciar 10 leituras com features distintas (vision_features jsonb).
2. Para cada uma, disparar análise via UI (`/leituras/[id]` → "Gerar análise") OU via direct POST a `/api/readings/[id]/analyze`.
3. Após cada stream completar, verificar `audit_metadata.forbidden_vocab.count === 0` no DB.
4. Inspecionar manualmente 2-3 relatórios completos para confirmar leitura natural e ausência das frases proibidas.
5. Se algum relatório tiver `count > 0`, capturar o termo + contexto e reportar como gap.

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
