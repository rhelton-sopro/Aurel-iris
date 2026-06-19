---
status: testing
phase: 08-pagamento-lgpd
source: [08-VERIFICATION.md (6 cenários E2E A-F PENDING-FOUNDER), 9 ROADMAP Success Criteria]
started: 2026-06-01T15:11:58Z
updated: 2026-06-01T15:11:58Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cenário A — Trial → esgota → compra → reserva → gera → consome
expected: |
  Terapeuta novo recebe trial (3 leituras/15d). Esgotado → bloqueia geração +
  redireciona /assinatura/comprar. Compra pacote (PIX ou cartão) → webhook
  PAYMENT_CONFIRMED/RECEIVED ativa o crédito. Gera relatório → reserva converte
  em consumo (1 crédito debitado; regen não cobra de novo).
awaiting: user response

## Tests

### 1. Cenário A — Trial → esgota → compra → reserva → gera → consome
expected: Terapeuta novo recebe trial (3 leituras/15d); esgotado bloqueia + redireciona /assinatura/comprar; compra PIX/cartão → webhook ativa crédito; gerar relatório debita 1 crédito (regen não recobra). Memória: PIX→crédito PROVADO no go-live; bug 0042 (crédito comprado não debitava) corrigido.
result: [pending]

### 2. Cenário B — Arrependimento 7d (refund integral + parcial)
expected: /assinatura → "Solicitar reembolso". 0 consumidas → integral; ≥1 → proporcional (só não-usadas). Asaas processa (PIX devolução; parcial = "Em progresso" assíncrono mas chega). Saldo zera e pacote sai de "ativo". Memória: testado hoje 01/06 — parcial R$4,50 OK, total instantâneo.
result: [pending]

### 3. Cenário C — Termo biométrico LGPD-01 (PDF + assinatura + gate)
expected: Captura exige termo assinado nos 2 paths (consultório E convite remoto). PDF gerado (Gotenberg) com footer IP/data BRT/SHA-256; bucket immutable; client_consents append-only. Sem termo → captura bloqueada (fail-closed).
result: [pending]

### 4. Cenário D — internal_use bypass (founder gera sem consumir)
expected: Conta founder (internal_use=true) gera N relatórios sem debitar trial/crédito; source='internal'; audit admin.internal_use_used; excluído de métricas.
result: [pending]

### 5. Cenário E — Cron daily (libera reserva expirada + 4 jobs)
expected: curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/daily → 200 + JSON {reservations, credits, trials, warnings}; reserva 7d expirada é liberada de volta ao pool.
result: [pending]

### 6. Cenário F — Páginas legais (/privacidade, /termos, deleção, disclaimer)
expected: /privacidade + /termos renderizam LGPD-compliant; #deletar-dados com mailto operador; DisclaimerCopy em múltiplas superfícies; sem vocabulário proibido visível.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
