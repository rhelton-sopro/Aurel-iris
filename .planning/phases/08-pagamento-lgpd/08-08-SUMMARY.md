---
phase: 08-pagamento-lgpd
plan: "08"
subsystem: lgpd-consent
tags: [lgpd, consent, biometric, pdf, gotenberg, supabase-storage, sha256]

requires:
  - phase: 08-01
    provides: "consent_terms + client_consents schema (0020) + A6=ambos decision"
  - phase: 07.4-iris-codex-report
    provides: "Gotenberg HTML→PDF pattern (api/readings/[id]/pdf)"

provides:
  - "Termo biométrico LGPD-01 nativo: hydrate + PDF Gotenberg + assinatura click-through"
  - "signTermAction (server action) + signBiometricTerm (lib)"
  - "/api/consent/generate-pdf POST (Gotenberg + upload bucket privado client-consents)"
  - "TermoBiometricoStep component reusável (A6: office_handoff | remote_link)"
  - "seed-consent-term-v1.mjs (founder roda no checkpoint)"

affects:
  - 08-09-consent-flow-integration

tech-stack:
  added: []
  patterns:
    - "Gotenberg /forms/chromium/convert/html single-PDF (sem split/merge)"
    - "content_sha256 do termo HIDRATADO no footer-audit (T-08-08-01)"
    - "Supabase Storage upsert:false = immutable; signed URL TTL 1 ano"
    - "auth 2-path (sessão terapeuta OU invite token validado) — T-08-08-03"
    - "'use server' hygiene: schemas/tipos em consent.schemas.ts sibling"

key-files:
  created:
    - apps/web/scripts/seed-consent-term-v1.mjs
    - apps/web/lib/consent/hydrate-term.ts
    - apps/web/lib/consent/__tests__/hydrate.test.ts
    - apps/web/lib/consent/pdf-template.tsx
    - apps/web/lib/consent/sign.ts
    - apps/web/lib/consent/__tests__/sign.test.ts
    - apps/web/app/api/consent/generate-pdf/route.ts
    - apps/web/app/actions/consent.ts
    - apps/web/app/actions/consent.schemas.ts
    - apps/web/components/billing/TermoBiometricoStep.tsx
  modified: []

key-decisions:
  - "current-pointer LIVE = consent_current_version + consent_last_at (consent_signed_at/consent_document_url foram DROPADAS em 0019)"
  - "PDF path persistido em audit_events.metadata.pdf_path (não há coluna URL em clients)"
  - "auth invite-token usa validateToken() existente (não há coluna `status` em client_invite_tokens)"

metrics:
  duration: ~6min (tasks 1-4)
  completed: 2026-05-28
  tasks_completed: 4
  tasks_total: 5
  files_created: 10

status: checkpoint-resolved-deferred
---

# Phase 08 Plan 08: Termo de Consentimento Biométrico (LGPD-01) — CHECKPOINT-PENDING

**LGPD-01 nativo: hydrate de placeholders + PDF do termo via Gotenberg (HTML→PDF) com footer-audit (IP+data BRT+versão+SHA256) + upload em bucket privado immutable + assinatura click-through append-only. Tasks 1-4 construídas e commitadas; Task 5 (founder cria bucket + roda seed + verifica PDF) PENDENTE.**

## Status

PARADO no checkpoint blocking Task 5. As Tasks 1-4 estão completas, commitadas e com testes verdes. O founder precisa criar o bucket, rodar o seed e verificar o render do PDF antes do plano ser considerado fechado.

## Performance

- **Duration:** ~6 min (tasks 1-4)
- **Tasks:** 4/5 completas (Task 5 = checkpoint blocking pendente)
- **Files created:** 10 (4 source + 2 test + 1 route + 1 action + 1 schema + 1 component + 1 script)

## Task Commits

1. **Task 1: seed-consent-term-v1.mjs + hydrate-term.ts + test** — `b25860b` (feat)
2. **Task 2: pdf-template.tsx + /api/consent/generate-pdf** — `d2d3af0` (feat)
3. **Task 3: sign.ts + signTermAction + schemas + test** — `a4c1adc` (feat)
4. **Task 4: TermoBiometricoStep.tsx** — `d6ec878` (feat)
5. **Task 5: checkpoint human-verify (blocking)** — PENDENTE (founder)

## Files Created

- `apps/web/scripts/seed-consent-term-v1.mjs` — lê term-v1.md, sha256 do body bruto, upsert idempotente + flip is_current
- `apps/web/lib/consent/hydrate-term.ts` — hydrateTerm() substitui {{...}} + sha256() helper
- `apps/web/lib/consent/__tests__/hydrate.test.ts` — 6 testes
- `apps/web/lib/consent/pdf-template.tsx` — renderTermoHtml() + mdToHtml mínimo + footer-audit
- `apps/web/lib/consent/sign.ts` — signBiometricTerm() INSERT append-only client_consents
- `apps/web/lib/consent/__tests__/sign.test.ts` — 3 testes
- `apps/web/app/api/consent/generate-pdf/route.ts` — Gotenberg + upload + signed URL + auth 2-path
- `apps/web/app/actions/consent.ts` — signTermAction (gera PDF + consent + current-pointer + audit)
- `apps/web/app/actions/consent.schemas.ts` — signTermSchema + tipos (sibling 'use server')
- `apps/web/components/billing/TermoBiometricoStep.tsx` — checkbox click-through reusável

## API Surface

- `signTermAction(input: SignTermInput): Promise<SignTermResult>` — server action (exige sessão terapeuta)
- `POST /api/consent/generate-pdf` — body `{ client_id, reading_id, cliente_nome, cliente_cpf?, consent_channel }`, header opcional `x-invite-token` (path remote_link), retorna `{ ok, pdf_url, pdf_path, content_sha256, term_version }`
- `signBiometricTerm(input): Promise<SignBiometricResult>` — lib server-only
- `<TermoBiometricoStep clientId readingId clienteNome clienteCpf? consentChannel onSigned />`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] signTermAction gravava colunas DROPADAS**
- **Found during:** Task 3
- **Issue:** O plano UPDATE-ava `clients.consent_signed_at` + `consent_document_url`. Essas colunas foram DROPADAS na migration 0019 ("letra morta — nunca escrita/lida"). Em runtime seria erro PostgREST; em build, erro de tipo.
- **Fix:** Grava o current-pointer LIVE: `consent_current_version` (= term_version) + `consent_last_at` (= now). A URL do PDF não tem coluna em `clients` — persistida em `audit_events.metadata.pdf_path` (durável) e retornada ao caller pra exibição imediata.
- **Files modified:** apps/web/app/actions/consent.ts
- **Commit:** a4c1adc

**2. [Rule 1 - Bug] auth do route consultava coluna `status` inexistente**
- **Found during:** Task 2
- **Issue:** O plano fazia `.select('client_id, status, expires_at')` em `client_invite_tokens` e checava `status !== 'ok'`. A tabela não tem coluna `status` — a validade vem de `used_at IS NULL` + `expires_at > now()`.
- **Fix:** Reusa o helper `validateToken()` (lib/invite/tokens.ts) que já encapsula not_found/expired/already_used. O match de cliente compara `body.client_id` contra `token.client_id ?? token.used_by_client_id`.
- **Files modified:** apps/web/app/api/consent/generate-pdf/route.ts
- **Commit:** d2d3af0

**3. [Rule 1 - Bug] empty-string em hydrateTerm deixava gap em branco**
- **Found during:** Task 1
- **Issue:** CPF/CNPJ vazio ('') substituiria o placeholder por nada, deixando "CPF ." no documento.
- **Fix:** valor `null` OU `''` cai no marcador `[KEY]`. Teste adicional cobre.
- **Files modified:** apps/web/lib/consent/hydrate-term.ts
- **Commit:** b25860b

**4. [Rule 2 - Missing] defesa de ownership no path A (sessão)**
- **Found during:** Task 2
- **Issue:** O plano confiava que RLS cobriria, mas a query usa service-role (bypass RLS). Terapeuta logado poderia gerar PDF de cliente de outro terapeuta.
- **Fix:** Após carregar o client, valida `client.therapist_id === user.id` no path session → 401.
- **Files modified:** apps/web/app/api/consent/generate-pdf/route.ts
- **Commit:** d2d3af0

**5. [Rule 1 - Bug] link "Ler o termo completo" apontava pra rota inexistente**
- **Found during:** Task 4
- **Issue:** O plano linkava `/termo-biometrico-preview` que não existe — dead link.
- **Fix:** Removido. A preview do termo completo entra no plano de integração 08-09.
- **Files modified:** apps/web/components/billing/TermoBiometricoStep.tsx
- **Commit:** d6ec878

**Total deviations:** 5 (todas Rule 1/2 auto-fixed). Sem scope creep — todas alinham o código à realidade do schema LIVE.

## Threat Surface Scan

| Threat | Mitigação | Status |
|--------|-----------|--------|
| T-08-08-01 Tampering | content_sha256 do hidratado no footer + upsert:false immutable | mitigado |
| T-08-08-02 Repudiation | client_consents append-only + IP + UA + timestamp + audit footer | mitigado (depende de 0020 LIVE) |
| T-08-08-03 Spoofing | auth 2-path: validateToken + client_id match; defesa ownership session | mitigado |
| T-08-08-04 Info Disclosure | bucket PRIVATE (founder cria no Task 5) + signed URL | PENDENTE bucket Task 5 |
| T-08-08-05 Tampering seed dup | upsert onConflict version + flip is_current OFF | mitigado |
| T-08-08-06 Info Disclosure log | console expõe path/client_id, não CPF | accept |

## Known Stubs

Nenhum stub de dado/UI. O componente `TermoBiometricoStep` ainda não está montado em nenhuma rota — a integração em `/convite/[token]/capturar` e `/leituras/nova` é escopo explícito do plano 08-09 (documentado no `<output>` do PLAN). Não é stub: é dependência de sequência de plano.

## Checkpoint Task 5 — PENDENTE (founder)

Ver seção "AÇÕES DO FOUNDER" abaixo. O plano NÃO está fechado até:
- Bucket `client-consents` criado (PRIVATE)
- Seed rodado em produção (consent_terms v1 LIVE)
- Smoke do PDF render verificado

## Next Phase Readiness

Após o founder resolver o checkpoint, o plano 08-09 integra `TermoBiometricoStep` em `/convite/[token]/capturar` (remote_link) e `/leituras/nova` (office_handoff), bloqueando captura/link sem termo assinado (D-19).

## Self-Check: PASSED

- 10 arquivos verificados em disco — todos FOUND
- 4 commits verificados no git log (b25860b, d2d3af0, a4c1adc, d6ec878) — todos FOUND
- 9 testes verdes (6 hydrate + 3 sign); lint scoped limpo; tsc sem novos erros (22 pré-existentes em test files não-relacionados)
