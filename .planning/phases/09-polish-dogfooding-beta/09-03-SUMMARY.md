---
phase: 09-polish-dogfooding-beta
plan: 03
subsystem: notifications/email
tags: [email, resend, idempotencia, tdd, onboarding, notification, wave-2]
dependency-graph:
  requires:
    - "readings.notification_sent_at (Plan 09-01 migration 0032)"
    - "RESEND_API_KEY env var configurada"
    - "Resend domain noreply@iriscodex.com verificado (Fase 11 11-01)"
  provides:
    - "notifyTherapistReportReady(readingId, therapistId) — envia e-mail Resend pós-relatório"
    - "Hook idempotente em analyze/route.ts — 1ª geração dispara, regen não duplica"
  affects:
    - "apps/web/app/api/readings/[id]/analyze/route.ts — novo bloco post-UPDATE"
    - "Fluxo terapeuta: agora recebe e-mail quando relatório fica pronto (D-04)"
tech-stack:
  added: []
  patterns:
    - "fetch direto para api.resend.com/emails (sem SDK, mesmo padrão notify-therapist-capture-complete.ts)"
    - "{ sent: boolean; reason?: string } retorno para route.ts decidir UPDATE de flag"
    - "Promise.all([reading, profile, authResult]) para fetch paralelo de dados"
    - "vi.hoisted() para mocks em testes vitest (pattern estabelecido no projeto)"
    - "escapeHtml helper inline (XSS mitigation T-09-03-02)"
key-files:
  created:
    - path: "apps/web/lib/notifications/notify-report-ready.ts"
      purpose: "Módulo de notificação: notifyTherapistReportReady + escapeHtml + constantes Resend"
    - path: "apps/web/lib/notifications/notify-report-ready.test.ts"
      purpose: "12 testes vitest cobrindo todos os cenários de erro + happy path + LGPD + XSS"
  modified:
    - path: "apps/web/app/api/readings/[id]/analyze/route.ts"
      change: "import + SELECT expansion + bloco condicional D-04 pós-UPDATE report_generated + UPDATE notification_sent_at"
decisions:
  - "Signature retorna { sent: boolean; reason? } em vez de void — route.ts decide UPDATE de flag com base em sent===true (atomicidade opcional, idempotência robusta)"
  - "Bloco condicional inserido ENTRE UPDATE report_generated e extração de frases — relatório já persistido antes de notificar, frases extraídas depois"
  - "try/catch defensivo no bloco de notificação — erro não joga exception nem interrompe finally (controller.close())"
  - "escapeHtml aplicado em clientName no htmlBody (T-09-03-02 mitigado, Test 10 cobre)"
  - "LGPD: zero diagnóstico/tratamento/cura nos templates html+text (T-09-03-05, Test 9 + prose-grep)"
metrics:
  duration: "~5.95 min wall-clock"
  completed_date: "2026-05-26"
  tasks_completed: 2
  files_touched: 3
  commits: 2
---

# Phase 09 Plan 03: E-mail "Leitura Pronta" (ONBOARD-02) Summary

**One-liner:** Módulo `notifyTherapistReportReady` (fetch direto Resend, escapeHtml, LGPD-safe, `{ sent: boolean; reason? }`) + hook idempotente em `analyze/route.ts` — terapeuta recebe e-mail automático na 1ª geração de relatório, regen não duplica (D-04).

## What Shipped

### Task 1 — Módulo notify-report-ready + 12 testes vitest GREEN (commit `a695870`)

Arquivo `apps/web/lib/notifications/notify-report-ready.ts` criado espelhando byte-por-byte o shape de `notify-therapist-capture-complete.ts`:

- Header docstring 300+ palavras documentando propósito, trigger, idempotência, LGPD, best-effort
- `import 'server-only'` no topo
- Constantes `RESEND_API_URL`, `DEFAULT_FROM` idênticas ao precedent
- Signature `notifyTherapistReportReady(readingId, therapistId): Promise<{ sent: boolean; reason? }>` — diferença intencional do precedent (que retorna `void`)
- `Promise.all([reading, profile, authResult])` — fetch paralelo em 3 queries
- 4 early returns `{ sent: false, reason }`: `no_api_key`, `reading_not_found`, `no_therapist_email`
- `try/catch` em fetch: HTTP non-2xx → `resend_http_<status>`, throw → `fetch_error`
- `escapeHtml` helper idêntico ao precedent (anti-XSS via `&lt;`, `&gt;`, `&quot;`, `&#39;`)
- Template HTML branded: header "Iris Codex", CTA "Abrir leitura" teal `#1e6b65`, link `${baseUrl}/leituras/${readingId}`
- `RESEND_FROM_EMAIL` override respeitado (ou fallback `DEFAULT_FROM`)

Arquivo `apps/web/lib/notifications/notify-report-ready.test.ts` com 12 testes:

| # | Cenário | Status |
|---|---------|--------|
| 1 | Sem RESEND_API_KEY → `{ sent: false, reason: 'no_api_key' }` + sem fetch | GREEN |
| 2 | Reading não encontrado → `{ sent: false, reason: 'reading_not_found' }` | GREEN |
| 3 | therapistEmail null → `{ sent: false, reason: 'no_therapist_email' }` | GREEN |
| 4 | Happy path → fetch POST + `{ sent: true }` | GREEN |
| 5a | HTTP 422 → `{ sent: false, reason: 'resend_http_422' }` | GREEN |
| 5b | HTTP 500 → `{ sent: false, reason: 'resend_http_500' }` | GREEN |
| 6 | fetch throws → `{ sent: false, reason: 'fetch_error' }` | GREEN |
| 7a | RESEND_FROM_EMAIL ausente → default `'Iris Codex <noreply@iriscodex.com>'` | GREEN |
| 7b | RESEND_FROM_EMAIL definido → usa override | GREEN |
| 8 | Subject contém clientName + "leitura" + URL `/leituras/${id}` | GREEN |
| 9 | LGPD: regex `/\b(diagnóstico|tratamento|cura)\b/iu` false em text+html | GREEN |
| 10 | escapeHtml: `<script>` vira `&lt;script&gt;` no HTML body | GREEN |

### Task 2 — Wire-up em analyze/route.ts (commit `51a8209`)

Edições cirúrgicas em `apps/web/app/api/readings/[id]/analyze/route.ts`:

1. **Import adicionado** (linha 32):
   ```typescript
   import { notifyTherapistReportReady } from '@/lib/notifications/notify-report-ready'
   ```

2. **SELECT expandido** (linha 89) — `notification_sent_at` adicionado ao select string inicial

3. **Bloco condicional D-04** inserido ENTRE `.eq('id', readingId)` do UPDATE report_generated (linha ~408) e `// ===== v2.3.0 Extração de frases-chave` (linha ~410+):
   - Guard `if (reading.notification_sent_at == null)` — idempotência
   - `await notifyTherapistReportReady(readingId, user.id)`
   - UPDATE `notification_sent_at` SOMENTE em `notifyResult.sent === true`
   - `console.warn` em `sent === false` com `reason`
   - `try/catch` defensivo: erro não bloqueia `finally`

**Acceptance criteria verificados:**
- `notifyTherapistReportReady` × 2 (import + call) ✓
- `notification_sent_at` × 4 (SELECT + check + UPDATE + service update) ✓
- `reading.notification_sent_at == null` × 1 ✓
- `D-04` × 1 (rastreabilidade) ✓
- Ordering: notify call linha 417 > UPDATE report_generated linha 408 > revalidatePath linha 501 ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsc warning em mockFrom.mockImplementation()**
- **Found during:** Task 1 acceptance criteria (tsc check)
- **Issue:** `mockFrom.mockImplementation((table: string) => ...)` gerava TS2345 — `mockFrom` é `Mock<() => ...>` (sem args), implementação com arg `table` era type-incompatível
- **Fix:** Removido o `mockImplementation` em `beforeEach` (era redundante — `vi.hoisted` já configura `mockFrom` para retornar `{ select: mockSelect }`, que serve todos os casos). Removidos `mockSelect` e `mockEq` do destructuring externo (não eram usados por nome fora do hoisted block, causando `no-unused-vars` lint warning)
- **Files modified:** `apps/web/lib/notifications/notify-report-ready.test.ts`
- **Commit:** `51a8209` (bundled com Task 2)

## Threat Register Status

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-09-03-01 | accept | Resend HTTPS-only. Body inclui apenas nome do cliente. Aceito beta-stage. |
| T-09-03-02 | mitigate | ✓ escapeHtml aplicado em `${escapeHtml(clientName)}` no htmlBody. Test 10 GREEN. |
| T-09-03-03 | mitigate | ✓ try/catch defensivo em fetch. `fetch_error` retorna `{sent:false}` sem throw. controller.close() roda em finally. |
| T-09-03-04 | accept | Gate (f) "already running" bloqueia retries em <5min. Janela residual ~1s aceita. |
| T-09-03-05 | mitigate | ✓ Test 9 LGPD regex GREEN. Prose-grep clean. |
| T-09-03-06 | mitigate | ✓ therapistId = user.id (auth gate route.ts). auth.admin.getUserById service-role. |
| T-09-03-07 | mitigate | ✓ UPDATE notification_sent_at SOMENTE em `sent===true`. |

## Known Stubs

None — dados reais: reading de DB, therapist email de auth.admin.getUserById, link gerado dinamicamente via `process.env.NEXT_PUBLIC_SITE_URL`.

## Commits

| Task | Hash      | Message |
|------|-----------|---------|
| 1    | `a695870` | `feat(09-03): notify-report-ready module + 12 vitest GREEN (ONBOARD-02)` |
| 2    | `51a8209` | `feat(09-03): wire notify-report-ready hook em analyze/route.ts` |

## Self-Check: PASSED

**Files exist:**
- `apps/web/lib/notifications/notify-report-ready.ts` — FOUND
- `apps/web/lib/notifications/notify-report-ready.test.ts` — FOUND
- `apps/web/app/api/readings/[id]/analyze/route.ts` (modified) — FOUND

**Commits exist:**
- `a695870` — FOUND (Task 1)
- `51a8209` — FOUND (Task 2)

**Verification gates GREEN:**
- 12/12 vitest tests GREEN
- tsc: zero erros novos em notify-report-ready.ts, notify-report-ready.test.ts, analyze/route.ts
- lint: zero warnings/errors novos nos 3 arquivos modificados
- Acceptance criteria greps: todos passaram
- Ordering check: notify (linha 417) após UPDATE report_generated (linha 408), antes revalidatePath (linha 501)
