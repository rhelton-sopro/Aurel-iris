---
status: partial
phase: 07-analise-llm
source: [07-VERIFICATION.md]
started: 2026-05-08T19:00:00Z
updated: 2026-05-08T19:00:00Z
---

## Current Test

number: 1
name: SC3 — Linguagem hipotética em 10 relatórios reais consecutivos
expected: |
  Em 10 relatórios gerados consecutivamente sobre features distintas (variando idade, gênero, sinais), nenhum contém ocorrência das frases proibidas: "o cliente tem", "diagnostica-se", "está doente de", "trauma confirmado aos X anos", e os termos isolados "diagnóstico", "tratamento", "cura". Verificação automática ocorre via `runAudit` (`FORBIDDEN_VOCAB_RE` com word-boundary D-A2/Pitfall 7) — `audit_metadata.forbidden_vocab` deve ter `count: 0` em todos os 10.
awaiting: user response

## Tests

### 1. SC3 — Linguagem hipotética em 10 relatórios reais consecutivos
expected: Em 10 relatórios gerados consecutivamente sobre features distintas (variando idade, gênero, sinais), nenhum contém ocorrência das frases proibidas: "o cliente tem", "diagnostica-se", "está doente de", "trauma confirmado aos X anos", e os termos isolados "diagnóstico", "tratamento", "cura". Verificação automática ocorre via `runAudit` (`FORBIDDEN_VOCAB_RE` com word-boundary D-A2/Pitfall 7) — `audit_metadata.forbidden_vocab` deve ter `count: 0` em todos os 10.

result: blocked
blocked_by: prior-phase
reason: "User reported: 'fiz a leitura... e agora 6/6 mas não aparece nada para analisar' — não conseguiu chegar à etapa de gerar análise. Pré-requisito (Surface 1 mostrar AnalysisCTA quando reading.status === 'ready') aparenta estar quebrado. SC3 só pode ser testado depois desse blocker ser resolvido."

how to test:
1. Iniciar 10 leituras com features distintas (vision_features jsonb).
2. Para cada uma, disparar análise via UI (`/leituras/[id]` → "Gerar análise") OU via direct POST a `/api/readings/[id]/analyze`.
3. Após cada stream completar, verificar `audit_metadata.forbidden_vocab.count === 0` no DB.
4. Inspecionar manualmente 2-3 relatórios completos para confirmar leitura natural e ausência das frases proibidas.
5. Se algum relatório tiver `count > 0`, capturar o termo + contexto e reportar como gap.

### 2. Surface 1 — AnalysisCTA aparece em /leituras/[id] quando status='ready'
expected: Em `/leituras/[id]` com a leitura em estado `ready` (6/6 fotos processadas, vision_features populado, report_generated null), o componente `AnalysisHero` deve mostrar o State A do `AnalysisCTA` com o botão "Gerar análise". Per UI-SPEC §Surface 1.

result: issue
reported: "fiz a leitura... e agora 6/6 mas não aparece nada para analisar"
severity: major

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
