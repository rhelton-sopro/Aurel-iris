---
phase: 12
slug: publicacao-instagram
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | apps/web (vitest via package.json `test`/`test:run`) |
| **Quick run command** | `pnpm --dir apps/web test:run --changed` |
| **Full suite command** | `pnpm --dir apps/web test:run` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir apps/web test:run --changed`
- **After every plan wave:** Run `pnpm --dir apps/web test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Uma linha por task `auto`/`tdd` (tasks `checkpoint:*` listadas em Manual-Only). O comando é o `<automated>` exato escrito no PLAN.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01 T1 — migration 0049 (colunas+CHECK+índice+RPCs) | 01 | 1 | IGPUB-02, IGPUB-06 | T-12-01, T-12-02, T-12-03 | claim atômico + SECURITY DEFINER só service_role | grep-gate | `grep -c "claim_due_social_posts\|claim_one_social_post\|reap_stuck_publishing" supabase/migrations/0049_social_posts_publishing.sql | grep -qx 3 && echo OK` | supabase/migrations/0049_social_posts_publishing.sql | ⬜ pending |
| 12-01 T2 — bump SocialPostStatus union/STATUS_TABS/guard/counts/interface | 01 | 1 | IGPUB-02, IGPUB-06 | — | lockstep bump (sem estado órfão) | tsc + grep | `cd apps/web && pnpm tsc --noEmit -p tsconfig.json 2>&1 | head -5; grep -c "'publicando'" lib/admin/social-posts.ts` | apps/web/lib/admin/social-posts.ts | ⬜ pending |
| 12-01 T3 — teste do claim idempotente (mock) | 01 | 1 | IGPUB-02 | T-12-01 | publicado nunca re-reivindicado | vitest (contract/Wave 0) | `cd apps/web && pnpm test:run lib/instagram/__tests__/instagram-claim.test.ts 2>&1 | tail -15` | apps/web/lib/instagram/__tests__/instagram-claim.test.ts | ⬜ pending |
| 12-02 T1 — lib/instagram/token.ts (store+refresh+health) | 02 | 1 | IGPUB-01 | T-12-04, T-12-05, T-12-06, T-12-07 | token nunca logado; host pinado | tsc + grep | `cd apps/web && pnpm tsc --noEmit -p tsconfig.json 2>&1 | head -5; grep -c "INSTAGRAM_TOKEN_KEY\|ig_refresh_token\|fields=id" lib/instagram/token.ts` | apps/web/lib/instagram/token.ts | ⬜ pending |
| 12-02 T2 — teste do refresh/health (Graph mock) | 02 | 1 | IGPUB-01 | T-12-04, T-12-07 | refresh só <10d; token não vaza em logs | vitest | `cd apps/web && pnpm test:run lib/instagram/__tests__/instagram-token.test.ts 2>&1 | tail -15` | apps/web/lib/instagram/__tests__/instagram-token.test.ts | ⬜ pending |
| 12-03 T1 — núcleo publish.ts (container/poll/publish + 2 entry-points) | 03 | 2 | IGPUB-03, IGPUB-04, IGPUB-05, IGPUB-06 | T-12-08, T-12-10, T-12-11, T-12-12 | URL allowlist (anti-SSRF); host pinado | tsc + grep | `cd apps/web && pnpm tsc --noEmit -p tsconfig.json 2>&1 | head -5; grep -c "publishDuePosts\|publishPost\|media_publish\|status_code\|is_carousel_item" lib/instagram/publish.ts` | apps/web/lib/instagram/publish.ts | ⬜ pending |
| 12-03 T2 — suite do publicador (Graph mock) | 03 | 2 | IGPUB-03, IGPUB-04, IGPUB-05, IGPUB-06 | T-12-10, T-12-12 | reel só após FINISHED; erro classificado D-03 | vitest | `cd apps/web && pnpm test:run lib/instagram/__tests__/instagram-publish.test.ts 2>&1 | tail -20` | apps/web/lib/instagram/__tests__/instagram-publish.test.ts | ⬜ pending |
| 12-04 T1 — getAdminNotifications + publishErrors/instagramAuthError | 04 | 2 | IGPUB-06, IGPUB-01 | T-12-13, T-12-15 | best-effort `.catch` por fonte (não derruba /admin) | tsc + grep | `cd apps/web && pnpm tsc --noEmit -p tsconfig.json 2>&1 | head -5; grep -c "publishErrors\|instagramAuthError\|instagram_health" lib/admin/notifications-summary.ts` | apps/web/lib/admin/notifications-summary.ts | ⬜ pending |
| 12-04 T2 — card "Falhas de publicação" no portal admin | 04 | 2 | IGPUB-06 | T-12-14 | card gateado founder (page já faz notFound) | grep | `cd apps/web && grep -c "Falhas de publicação\|notif.publishErrors" app/admin/page.tsx` | apps/web/app/admin/page.tsx | ⬜ pending |
| 12-04 T3 — teste notifications-summary (mock) | 04 | 2 | IGPUB-06, IGPUB-01 | T-12-13, T-12-15 | sucesso silencioso (D-05); best-effort 0 em erro | vitest | `cd apps/web && pnpm test:run lib/admin/__tests__/notifications-summary.test.ts 2>&1 | tail -15` | apps/web/lib/admin/__tests__/notifications-summary.test.ts | ⬜ pending |
| 12-05 T1 — rota cron horária + entry vercel.json | 05 | 3 | IGPUB-02 | T-12-16 | CRON_SECRET Bearer fail-closed (timing-safe) | grep | `cd apps/web && grep -c "publishDuePosts\|timingSafeEqual\|maxDuration = 300" app/api/cron/instagram-publish/route.ts; grep -c "instagram-publish" vercel.json` | apps/web/app/api/cron/instagram-publish/route.ts, apps/web/vercel.json | ⬜ pending |
| 12-05 T2 — job refresh/health no cron diário + flag instagram_health | 05 | 3 | IGPUB-01 | T-12-19, T-12-20 | `.catch` por job (IG não derruba batch); token não logado | grep | `cd apps/web && grep -c "refreshAndHealthcheckInstagram\|instagram_health" lib/instagram/token.ts; grep -c "refreshAndHealthcheckInstagram\|instagram:" app/api/cron/daily/route.ts` | apps/web/lib/instagram/token.ts, apps/web/app/api/cron/daily/route.ts | ⬜ pending |
| 12-05 T3 — publishNowAction ("publicar agora", D-08) | 05 | 3 | IGPUB-02 | T-12-17, T-12-18 | requireFounder + regex uuid antes de publishPost | grep | `cd apps/web && grep -c "publishNowAction\|publishPost\|requireFounder" app/admin/painel/actions.ts` | apps/web/app/admin/painel/actions.ts | ⬜ pending |
| 12-05 T4 — reenqueuePostAction + UI "Publicar agora"/"Reenfileirar" no PostCard (D-04, D-08) | 05 | 3 | IGPUB-06, IGPUB-02 | T-12-17 | requireFounder + UPDATE só sobre `status='erro'` | vitest + grep | `cd apps/web && pnpm test:run app/admin/painel/__tests__/reenqueue-action.test.ts 2>&1 | tail -15; grep -c "reenqueuePostAction\|publishNowAction" app/admin/painel/PostCard.tsx` | apps/web/app/admin/painel/actions.ts, apps/web/app/admin/painel/PostCard.tsx, apps/web/app/admin/painel/__tests__/reenqueue-action.test.ts | ⬜ pending |
| 12-05 T5 — teste de auth do cron (Bearer correto/errado/ausente) | 05 | 3 | IGPUB-02 | T-12-16 | fail-closed 401 em todos os caminhos sem Bearer | vitest | `cd apps/web && pnpm test:run app/api/cron/__tests__/instagram-publish-auth.test.ts 2>&1 | tail -15` | apps/web/app/api/cron/__tests__/instagram-publish-auth.test.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Arquivos de teste/contrato que precisam existir antes (ou junto com) o código que validam. Cobrem todas as tasks `auto`/`tdd`:

- [ ] `apps/web/lib/instagram/__tests__/instagram-claim.test.ts` — contrato do claim idempotente (REQ IGPUB-02). **Criado no Plan 01 T3 como contrato** (assinatura `claimDue(service, p_limit)`); torna-se substantivo no **Wave 2 (Plan 03)**, que implementa `claimDue` em `publish.ts` e estende este arquivo com os casos reais ("2 reivindicados depois 0", "publicado nunca reivindicado"). Evitar deixar um único `typeof === 'function'` como cobertura: os casos reais entram com o Plan 03.
- [ ] `apps/web/lib/instagram/__tests__/instagram-token.test.ts` — refresh só <10d + health-check + token não-vaza-em-log (REQ IGPUB-01). Substantivo já no Plan 02 (token.ts existe no mesmo wave).
- [ ] `apps/web/lib/instagram/__tests__/instagram-publish.test.ts` — montagem container/carrossel/reel-poll, gravação de permalink, classificação retryável/permanente, **Graph API fetch mockado** (REQ IGPUB-03/04/05/06, D-03).
- [ ] `apps/web/lib/admin/__tests__/notifications-summary.test.ts` — `publishErrors` conta `status='erro'`, flag `instagram_health`, sucesso silencioso (D-05), best-effort (REQ IGPUB-06/IGPUB-01).
- [ ] `apps/web/app/admin/painel/__tests__/reenqueue-action.test.ts` — `reenqueuePostAction` reseta `status='agendado', publish_attempts=0, publish_error=null` só sobre `status='erro'`, com service-role mockado (REQ IGPUB-06, D-04).
- [ ] `apps/web/app/api/cron/__tests__/instagram-publish-auth.test.ts` — cron auth fail-closed (Bearer correto/errado/ausente → 401/200), `publishDuePosts` mockado (REQ IGPUB-02).

*A pesquisa (12-RESEARCH.md §Validation Architecture) define o que precisa ser validado para confiar no motor. A máquina de estados (agendado→publicando→publicado/erro) é exercida indiretamente pelos mocks de `.rpc()`/`.from().update()` nos testes de claim, publish e reenqueue.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| migration 0049 aplicada em prod (db push) | IGPUB-02/06 | senha do banco não está no env local — só o founder roda `supabase db push --linked` | Plan 01 Task 4 (checkpoint:human-action): aplicar e confirmar via information_schema (colunas + CHECK 7 estados + 3 RPCs em pg_proc) |
| Bootstrap da conexão Meta/Instagram (token long-lived, env Vercel, seed app_settings) | IGPUB-01 | depende de conta/credencial viva do founder (Instagram API with Instagram Login, dev mode, Instagram Tester) | Plan 05 Task 5 (checkpoint:human-action): passos OAuth → ig_exchange_token → me?fields=id → env + seed |
| Carrossel/reel real aparece no feed do IG | IGPUB-03/04 | exige conta IG real + token; não há sandbox fiel | Smoke E2E do founder (Plan 05 Task 5): "publicar agora" num carrossel e num reel aprovados → conferir no IG + `ig_permalink`/`ig_media_id` gravados |
| Token long-lived + refresh contra o Meta real | IGPUB-01 | depende de credencial viva | Health-check em prod após configurar o token (cron diário grava `instagram_health`) |

*O restante (idempotência, claim de linha, classificação de erro, transição de estado, montagem de payload, reenfileiramento, auth do cron) tem verificação automatizada com o Graph API / service-role mockados.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
