---
phase: 08-pagamento-lgpd
plan: 15
subsystem: lgpd-consent-gate
tags: [lgpd, consent, biometric, gate, invite, termo]

requires:
  - phase: 08-07
    provides: "reserveCreditForReading (credit gate) em createReadingAction + invite capture"
  - phase: 08-08
    provides: "signBiometricTerm + signTermAction + TermoBiometricoStep + /api/consent/generate-pdf + consent infra"

provides:
  - "assertClientTermoSigned(clientId) — gate LGPD-01 (D-19) reusável (lib/gates/termo-gate.ts)"
  - "createReadingAction gateado por termo ANTES do credit gate (office_handoff)"
  - "Decisão A+ documentada (TERMO_GATE_BYPASS) em invites.ts"
  - "A+: termo assinado pelo CLIENTE no fluxo de captura do convite (remote_link) antes da captura"
  - "signInviteTermAction — assinatura token-auth sem sessão (app/actions/invite-consent.ts)"

affects:
  - 08-14-verification

tech-stack:
  added: []
  patterns:
    - "Gate pure-ish (1 SELECT service-role, sem mutation) reaproveitando createServiceClient"
    - "current-pointer LIVE consent_last_at/consent_current_version (NÃO consent_signed_at — dropada 0019)"
    - "fail-closed no capture flow: db_error/not_found → trata como NÃO assinado"
    - "token-auth server action (validateToken + client_id match) pra path sem sessão"

key-files:
  created:
    - apps/web/lib/gates/termo-gate.ts
    - apps/web/lib/gates/__tests__/termo-gate.test.ts
    - apps/web/app/actions/invite-consent.ts
    - apps/web/app/actions/invite-consent.schemas.ts
    - apps/web/app/convite/[token]/capturar/InviteTermoStep.tsx
    - apps/web/app/actions/__tests__/termo-gate-integration.test.ts
  modified:
    - apps/web/app/actions/readings.ts
    - apps/web/app/actions/invites.ts
    - apps/web/app/convite/[token]/capturar/page.tsx
    - apps/web/app/convite/[token]/capturar/InviteCaptureWrapper.tsx

key-decisions:
  - "Decisão A+ (founder 2026-05-28): bypass no createInviteTokenAction + termo wired no ponto de captura do convite"
  - "Gate lê consent_last_at (current-pointer LIVE), não consent_signed_at (dropada 0019)"
  - "signInviteTermAction nova: signTermAction exige sessão; convite não tem"

metrics:
  duration: ~25min
  completed: 2026-05-29
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 4

status: complete
---

# Phase 08 Plan 15: Termo Gate (LGPD-01 / BILLING-03) Summary

**Gate de consentimento biométrico (D-19) wired nos dois pontos de início de captura: `createReadingAction` (office_handoff) bloqueia antes do credit gate; e — via Decisão A+ — o fluxo de convite (remote_link) agora obriga o CLIENTE a assinar o termo (PDF-backed) ANTES de qualquer captura/upload, fechando a brecha de enforcement que a Decisão A pura deixava.**

## Decisão A+ (founder, 2026-05-28) — onde e por quê

**Task 3 do plano pedia escolha entre Decisão A e B.** O founder decidiu **A+** (A + expansão obrigatória):

### 1. Decisão A no `createInviteTokenAction`
Não gateamos o termo na criação do link de convite. O consentimento biométrico pertence ao **cliente** e é assinado por ele no ponto de captura (remote_link) — gatear na geração do link forçaria o terapeuta a assinar pelo cliente, o que é errado.

**Onde vive o marker:** `apps/web/app/actions/invites.ts`, dentro de `createInviteTokenAction`, comentário começando com a string literal **`TERMO_GATE_BYPASS`** (logo antes de `const token = generateToken()`). O grep de verificação (`assertClientTermoSigned|TERMO_GATE_BYPASS`) encontra 2 hits no arquivo.

### 2. A+ — enforcement no ponto de captura (REQUIRED, além da lista original do plano)
A Decisão A pura deixava uma brecha: nada obrigava o cliente a assinar. Fechado assim:

- **`page.tsx` (RSC)** computa `termoSigned = (await assertClientTermoSigned(client.id)).ok` e passa ao wrapper. Fail-closed: `db_error`/`client_not_found` → trata como NÃO assinado.
- **`InviteCaptureWrapper`** (client) ganhou prop `termoSigned`. Se `false`, renderiza `InviteTermoStep` BLOQUEANTE e só monta `CaptureClient` após `onSigned()`.
- **`InviteTermoStep`** (novo) — checkbox click-through que chama `signInviteTermAction`.
- **`signInviteTermAction`** (novo, `app/actions/invite-consent.ts`) — assina o termo no path PÚBLICO (sem sessão): valida token + client_id match → `POST /api/consent/generate-pdf` com header `x-invite-token` (Path B do route) → `signBiometricTerm` (append-only) → UPDATE `clients.consent_current_version` + `consent_last_at` (o que o gate lê) → `logAuditEvent`. `consent_channel='remote_link'`.

**Por que uma action nova (não reusar `signTermAction` 08-08):** `signTermAction` exige `supabase.auth.getUser()` (sessão de terapeuta). O cliente do convite não tem sessão — o token é o auth. `signInviteTermAction` espelha a lógica mas autentica via `validateToken` + match de `client_id`.

**Resume flow não regride:** quando o cliente reentra com fotos já capturadas (`resumeMode`), o termo já estava assinado (a 1ª captura só ocorreu após o aceite), então `assertClientTermoSigned` retorna `ok` e o passo é pulado. A pré-vinculação `used_by_reading_id`/`client_id` (memory) é intocada.

## Task Commits

1. **Task 1: termo-gate + 4 unit tests** — `37ba41b` (feat)
2. **Task 2: wire em createReadingAction antes do credit gate** — `9d03aa7` (feat)
3. **Task 3 + A+: bypass marcado + termo no capture flow + integration test** — `0dff820` (feat)

## API Surface

- `assertClientTermoSigned(clientId): Promise<TermoGateResult>` — `{ ok: true, signed_at, term_version } | { ok: false, reason: 'termo_missing' | 'client_not_found' | 'db_error', detail? }`
- `signInviteTermAction(input): Promise<SignInviteTermResult>` — token-auth, retorna `{ ok, consent_id, pdf_url } | { ok: false, error }`
- `<InviteTermoStep token clientId readingId clienteNome clienteCpf? onSigned />`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plano lia colunas DROPADAS (`consent_signed_at` / `consent_document_url`)**
- **Found during:** Task 1
- **Issue:** O código de exemplo do PLAN.md lia `clients.consent_signed_at` + `consent_document_url`. Essas colunas foram DROPADAS na migration 0019 ("letra morta") — leitura seria erro PostgREST em runtime e erro de tipo em build. Confirmado em `0019_client_profile_min.sql` e no 08-08-SUMMARY deviation #1.
- **Fix:** Gate lê o current-pointer LIVE `consent_last_at` (+ `consent_current_version`), que é o que `signTermAction` (08-08) e `signInviteTermAction` (este plano) escrevem.
- **Files modified:** apps/web/lib/gates/termo-gate.ts
- **Commit:** 37ba41b

**2. [Rule 3 - Blocking] `signTermAction` (08-08) não funciona no fluxo de convite (sem sessão)**
- **Found during:** A+ wiring
- **Issue:** O A+ pedia "wire o TermoBiometricoStep no capture flow". Mas `TermoBiometricoStep` chama `signTermAction`, que exige `auth.getUser()`. O cliente do convite não tem sessão → a action retornaria "Não autenticado." sempre. Usar o componente as-is não fecharia o gate.
- **Fix:** Criada `signInviteTermAction` (token-auth) + `InviteTermoStep` (espelha o componente 08-08 mas chama a action pública). A action reusa toda a infra 08-08 (generate-pdf Path B com `x-invite-token`, `signBiometricTerm`, pointer update). Cirúrgico e aditivo — não toca o `TermoBiometricoStep` original (segue válido pro path office_handoff de planos UI futuros).
- **Files created:** apps/web/app/actions/invite-consent.ts, invite-consent.schemas.ts, InviteTermoStep.tsx
- **Commit:** 0dff820

**Total deviations:** 2 (Rule 1 schema + Rule 3 sessão). Ambas alinham o código à realidade do schema/auth LIVE; sem scope creep.

## Threat Surface Scan

| Threat | Mitigação | Status |
|--------|-----------|--------|
| T-08-15-01 Spoofing (reading sem termo via API) | assertClientTermoSigned em createReadingAction (service-role SELECT) ANTES do INSERT/reserve | mitigado |
| D-19 brecha (cliente nunca assina no convite) | A+: InviteTermoStep bloqueante + page fail-closed | mitigado |
| Spoofing signInviteTermAction (token de outro cliente) | validateToken + token.client_id match + client.therapist_id match | mitigado |
| T-08-15-04 Repudiation | signInviteTermAction → signBiometricTerm append-only (IP+UA) + audit_events consent.term_signed | mitigado |

Sem novo surface além do threat_model do plano. `signInviteTermAction` reusa a auth 2-path já modelada em T-08-08-03.

## Known Stubs

Nenhum stub de dado/UI. O href `/clientes/{id}/termo` no erro de `createReadingAction` (path office_handoff) é um link semântico — a página dedicada que monta `TermoBiometricoStep` no path authed é escopo de plano UI futuro (08-09/UI). Não bloqueia o gate: o erro é exibido e bloqueia a criação da reading. O path remote_link (convite), que é o canal LIVE de captura por cliente, está totalmente wired neste plano.

## Verification

- 4 testes unit termo-gate verdes; 3 testes integration verdes (block / client_not_found / proceed-to-credit-gate)
- Suite gates+consent+actions: 47/47 green (sem regressões)
- `git grep assertClientTermoSigned app/actions/readings.ts` = 2
- `git grep -E "assertClientTermoSigned|TERMO_GATE_BYPASS" app/actions/invites.ts` = 2 (marker presente)
- tsc limpo nos arquivos novos/modificados; eslint scoped limpo

## Next Phase Readiness

Plano 08-14 (verification) pode marcar **BILLING-03** e **LGPD-01 (D-19)** como done: gate LIVE nos dois canais (office_handoff via createReadingAction; remote_link via InviteTermoStep no capture flow). Requirement attribution: 08-15 (não mais 08-07).

## Self-Check: PASSED
