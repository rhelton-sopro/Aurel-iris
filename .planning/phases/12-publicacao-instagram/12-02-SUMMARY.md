---
phase: 12-publicacao-instagram
plan: 02
subsystem: infra
tags: [instagram, meta-graph-api, app_settings, service-role, token-refresh, vitest]

# Dependency graph
requires:
  - phase: 12-publicacao-instagram (Plan 01)
    provides: social_posts status union + claimDue helper (idempotência do cron)
  - phase: report (migration 0048)
    provides: app_settings (key/value jsonb, RLS-on no-policy, service-role only)
provides:
  - "lib/instagram/token.ts: getValidToken / refreshInstagramTokenIfNeeded / instagramHealthCheck via app_settings"
  - "Token de longa duração (~60d) lido/gravado no app_settings (key instagram_token), nunca em env Vercel"
  - "Refresh automático com buffer de 10d (ig_refresh_token, host graph.instagram.com/v23.0)"
  - "Health-check não-silencioso (GET /me?fields=id) pronto pra alimentar o sinal de notificação do admin"
affects: [12-publicacao-instagram (Plan 03 pipeline publish + cron daily refresh job), 13-cockpit (status de conexão IG)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "app_settings token store via service-role untyped client (analog: lib/admin/client-report-config.ts)"
    - "Host pinado graph.instagram.com/v23.0 com grep-gate proibindo o domínio Graph do Facebook"
    - "Funções de rede não-lançantes ({ refreshed/ok, error }) para o cron fazer .catch"

key-files:
  created:
    - apps/web/lib/instagram/token.ts
    - apps/web/lib/instagram/__tests__/instagram-token.test.ts
  modified: []

key-decisions:
  - "Token de longa duração vive em app_settings (DB), NÃO em env Vercel — env é imutável em runtime e o token rotaciona"
  - "createServiceClient() reusado mas castado para untyped no acesso a app_settings (tabela não está no Database type gerado)"
  - "Refresh nunca lança; retorna { refreshed:false, error } para o cron diário fazer .catch (T-12-07)"

patterns-established:
  - "Módulo de integração externa server-only: ler segredo do app_settings, refreshar com buffer, health-check detectável, token nunca logado"

requirements-completed: [IGPUB-01]

# Metrics
duration: ~12min
completed: 2026-06-21
---

# Phase 12 Plan 02: Módulo de token do Instagram Summary

**Módulo server-only `lib/instagram/token.ts` que lê o token de longa duração (~60d) do app_settings, refresha automaticamente quando faltam <10 dias (ig_refresh_token, host pinado graph.instagram.com/v23.0) e faz health-check não-silencioso via GET /me — com o access_token nunca logado nem retornado ao client.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-21T22:45:00Z
- **Completed:** 2026-06-21T22:58:00Z
- **Tasks:** 2
- **Files modified:** 2 (criados)

## Accomplishments
- `getValidToken()` lê o access_token armazenado (ou null) via service-role, sem nunca logar o valor.
- `refreshInstagramTokenIfNeeded()` refresha só quando faltam <10 dias para expirar, regrava o app_settings com novo token + novo expires_at, e nunca lança (cron faz `.catch`).
- `instagramHealthCheck()` confirma a publicabilidade via GET /me?fields=id; falha é DETECTÁVEL (não-silenciosa).
- 7 testes vitest com Graph + service-role mockados (zero rede): buffer de 10d, health ok/falha, e dois asserts de que o token nunca vaza em logs.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Módulo lib/instagram/token.ts (store + refresh + health-check)** - `e9994c6` (feat)
2. **Task 2: Teste do refresh/health (Graph mockado)** - `50f4d86` (test)

_Nota: o plano marca ambas as tasks como `tdd="true"`, mas a estrutura natural é Task 1 = módulo, Task 2 = teste (split explícito do plano). Não houve ciclo RED/GREEN separado dentro de cada task; o teste do Task 2 cobre o módulo do Task 1 e passou na primeira execução (7/7)._

## Files Created/Modified
- `apps/web/lib/instagram/token.ts` - Store + refresh + health-check do token IG via app_settings (service-role); host pinado; token nunca logado.
- `apps/web/lib/instagram/__tests__/instagram-token.test.ts` - 7 testes (Graph + service-role mockados): refresh só <10d, health ok/falha, não-vazamento do token.

## Decisions Made
- **Token no DB, não em env Vercel:** o token de longa duração rotaciona em runtime (refresh programático), e env Vercel é imutável em runtime → store obrigatório no `app_settings`. O IG user id + app secret/id ficam em env (segredos estáveis).
- **Cliente untyped para app_settings:** `createServiceClient()` retorna `SupabaseClient<Database>`, mas `app_settings` não está no Database type gerado (tabela auxiliar — não regeneramos tipos por ela). Adicionei um helper `appSettingsDb()` que casta o cliente canônico para untyped, restrito a este módulo server-only — mesmo padrão deliberado do analog `lib/admin/client-report-config.ts`.
- **Refresh não-lançante:** todas as funções de rede retornam `{ refreshed/ok, error }` em vez de lançar, para o cron diário fazer `.catch` sem derrubar o job (T-12-07).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cliente untyped para app_settings (tsc TS2769)**
- **Found during:** Task 1 (módulo token.ts)
- **Issue:** O plano sugeria preferir `createServiceClient()` (que é `SupabaseClient<Database>`), mas `app_settings` não está no Database type gerado → `tsc` falhava com TS2769/TS2345 ("'key' is not assignable to parameter of type 'never'") nas chamadas `.from('app_settings')`.
- **Fix:** Adicionado helper `appSettingsDb()` que reusa `createServiceClient()` e o casta para `SupabaseClient` untyped, exatamente como o analog `client-report-config.ts` faz deliberadamente. Mantém o cliente canônico como fonte de credenciais.
- **Files modified:** apps/web/lib/instagram/token.ts
- **Verification:** `pnpm tsc --noEmit` → zero erros nos meus arquivos.
- **Committed in:** `e9994c6` (parte do commit do Task 1)

**2. [Rule 1 - Bug] Remoção do literal `graph.facebook.com` dos comentários**
- **Found during:** Task 1 (verify gates)
- **Issue:** Acceptance criterion exige `grep -c "graph.facebook.com" == 0`. Meus comentários diziam "NUNCA graph.facebook.com", o que disparava o grep-gate (count=2).
- **Fix:** Reescrevi os comentários para "domínio Graph do Facebook" (sem o literal), preservando a intenção de segurança e satisfazendo o gate.
- **Files modified:** apps/web/lib/instagram/token.ts
- **Verification:** `grep -c "graph.facebook.com" lib/instagram/token.ts` → 0; `graph.instagram.com/v23.0` → 1.
- **Committed in:** `e9994c6` (parte do commit do Task 1)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug/gate)
**Impact on plan:** Ambos necessários para compilar e passar os grep-gates de segurança. Zero scope creep — o contrato e o comportamento são exatamente os do plano.

## Issues Encountered
None — as duas tasks rodaram limpo após os auto-fixes acima.

## Threat Surface Scan
Nenhuma superfície de segurança nova fora do `<threat_model>` do plano. T-12-04 (token não vaza em log), T-12-05 (app_settings só service-role), T-12-06 (host pinado, grep-gate proíbe o domínio Facebook), T-12-07 (buffer de 10d, refresh não-lançante) — todos mitigados conforme planejado.

## User Setup Required
None neste plano — a aquisição one-time do token (founder homework: IG Professional + Meta app + Instagram Tester + OAuth → long-lived token seed no app_settings) está documentada em 12-RESEARCH.md §Token Lifecycle e acontece quando o pipeline (Plan 03) e o cron entrarem no ar. O env Vercel `INSTAGRAM_BUSINESS_ACCOUNT_ID`/`INSTAGRAM_APP_SECRET`/`INSTAGRAM_APP_ID` será necessário pelos próximos planos, não por este.

## Next Phase Readiness
- `getValidToken` / `refreshInstagramTokenIfNeeded` / `instagramHealthCheck` exportados e testados (mock) — prontos para o Plan 03 (pipeline container→poll→media_publish) e para o job de refresh no cron diário (`/api/cron/daily`).
- Health-check pronto para alimentar o sinal `instagramAuthError` em `getAdminNotifications` (D-06/D-07).
- Sem blockers introduzidos por este plano. (Nota de ambiente: há 2 erros tsc pré-existentes em `app/admin/painel/actions.ts` que só resolvem após o founder rodar `pnpm gen:types` pós-db-push da migration 0049 — NÃO são deste plano.)

## Self-Check: PASSED

- FOUND: apps/web/lib/instagram/token.ts
- FOUND: apps/web/lib/instagram/__tests__/instagram-token.test.ts
- FOUND: .planning/phases/12-publicacao-instagram/12-02-SUMMARY.md
- FOUND commit: e9994c6 (Task 1 feat)
- FOUND commit: 50f4d86 (Task 2 test)
- 7/7 vitest GREEN; tsc clean nos meus arquivos; grep-gates de host/segurança OK.

---
*Phase: 12-publicacao-instagram*
*Completed: 2026-06-21*
