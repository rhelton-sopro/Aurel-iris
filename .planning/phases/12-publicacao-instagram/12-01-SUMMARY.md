---
phase: 12-publicacao-instagram
plan: 01
subsystem: database
tags: [postgres, supabase, social_posts, instagram, idempotency, security-definer, typescript]

# Dependency graph
requires:
  - phase: 12-publicacao-instagram (migration 0045 social_posts)
    provides: tabela social_posts (status pendente/aprovado/agendado/publicado/reprovado + scheduled_at + media jsonb)
provides:
  - "social_posts estendida com colunas de resultado de publicacao (ig_media_id/ig_permalink/ig_container_id/publish_error/publish_attempts/last_attempt_at/published_at)"
  - "CHECK de status com 7 estados (+ publicando lock + erro terminal)"
  - "indice de varredura social_posts_due_idx (status, scheduled_at) WHERE status in ('agendado','publicando')"
  - "3 RPCs SECURITY DEFINER: claim_due_social_posts (sweep idempotente), claim_one_social_post (publicar agora), reap_stuck_publishing (crash recovery >15min)"
  - "SocialPostStatus union TS bumpado em lockstep (union + STATUS_TABS + guard + counts + interface)"
  - "contrato de claim idempotente testado (instagram-claim.test.ts)"
affects: [12-03 nucleo de publicacao, 12-05 cron+publicar-agora, 13 cockpit do painel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "claim atomico via UPDATE ... WHERE status='agendado' ... RETURNING * + FOR UPDATE SKIP LOCKED (portao de idempotencia D-02)"
    - "RPC SECURITY DEFINER com grant execute SOMENTE a service_role (RLS bypass server-side controlado)"
    - "reaper de rows presas em estado de lock (publicando >15min -> agendado, sob cap publish_attempts < 3)"
    - "bump EVERY occurrence: union TS + suas 4 ocorrencias + interface atualizados em lockstep com a migration"

key-files:
  created:
    - supabase/migrations/0049_social_posts_publishing.sql
    - apps/web/lib/instagram/__tests__/instagram-claim.test.ts
  modified:
    - apps/web/lib/admin/social-posts.ts
    - apps/web/types/database.ts

key-decisions:
  - "Idempotencia mora no banco (claim atomico), nao na aplicacao: um post 'publicado' nunca casa o WHERE status='agendado' -> nao re-reivindicavel"
  - "publish_attempts < 3 como cap de re-tentativa (D-03); reaper devolve presos a 'agendado' ainda sob o cap"
  - "claim_one_social_post aceita aprovado/agendado/erro (publicar agora + reenfileirar), nunca publicando/publicado"
  - "grant execute apenas a service_role nas 3 RPCs SECURITY DEFINER (T-12-03 EoP mitigado)"

patterns-established:
  - "Padrao 1: claim/release atomico no Postgres com SKIP LOCKED para serializar cron x publicar-agora sem deadlock"
  - "Padrao 2: tipo TS bumpado em lockstep com a migration (union + tabs + guard + counts + interface) + regen database.ts pos db push"

requirements-completed: [IGPUB-06]

# Metrics
duration: ~38h wall-clock (gated no founder db push entre 06-21 e 06-22; trabalho efetivo do agente ~25min)
completed: 2026-06-22
---

# Phase 12 Plan 01: Schema de publicacao Instagram + claim atomico Summary

**social_posts estendida com colunas de resultado + 7 estados (publicando/erro) + indice de varredura + 3 RPCs SECURITY DEFINER de claim/reaper (idempotencia no banco) + SocialPostStatus bumpado em lockstep + contrato de claim testado; migration 0049 APLICADA em producao pelo founder.**

## Performance

- **Duration:** ~38h wall-clock (predominantemente gated no founder db push); trabalho efetivo do agente ~25min
- **Started:** 2026-06-21
- **Completed:** 2026-06-22
- **Tasks:** 4 (3 auto + 1 checkpoint:human-action resolvido pelo founder)
- **Files modified:** 4 (2 criados, 2 modificados)

## Accomplishments
- Migration 0049 aplicada em PRODUCAO (db push pelo founder): 7 colunas de resultado, CHECK estendido para 7 estados (`pendente`/`aprovado`/`agendado`/`publicando`/`publicado`/`reprovado`/`erro`), indice `social_posts_due_idx`, e 3 RPCs SECURITY DEFINER (`claim_due_social_posts`, `claim_one_social_post`, `reap_stuck_publishing`) com `grant execute` ao `service_role`.
- Idempotencia ancorada no banco: o claim atomico (`UPDATE ... WHERE status='agendado' ... RETURNING *` + `FOR UPDATE SKIP LOCKED`) garante que dois cron runs sobrepostos nunca republicam o mesmo post (D-02 / IGPUB-02 substrate).
- `SocialPostStatus` bumpado em LOCKSTEP: union + `STATUS_TABS` + `isSocialPostStatus` guard + `fetchStatusCounts` counts + interface `SocialPost` (7 campos novos) — tsc limpo.
- Contrato de claim idempotente testado em `instagram-claim.test.ts` (mock, sem rede): "2 reivindicados depois 0" + "publicado nunca reivindicado".
- `database.ts` regenerado pos db push (reflete as colunas novas + as 3 RPCs) — limpou os 2 erros tsc transitorios em `actions.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0049 (colunas + CHECK 7 estados + indice + RPCs claim/reaper)** - `27483c2` (feat)
2. **Task 2: Bump SocialPostStatus union + STATUS_TABS + guard + counts + interface (lockstep, TDD)** - `1a28334` + `589c95a` (test -> feat)
3. **Task 3: Teste do claim idempotente (mock, TDD)** - `3a0f9ea` (test)
4. **Task 4: db push 0049 em producao** - resolvido pelo founder (checkpoint:human-action) -> types regen `65e5e58` (chore)

**Plan metadata:** docs commit (este SUMMARY + STATE.md + ROADMAP.md)

_Note: Tasks 2-3 sao TDD; a regen dos types entra como chore separado pos db push do founder._

## Files Created/Modified
- `supabase/migrations/0049_social_posts_publishing.sql` - Colunas de resultado + CHECK 7 estados + indice `social_posts_due_idx` + 3 RPCs SECURITY DEFINER (grants ao service_role)
- `apps/web/lib/admin/social-posts.ts` - `SocialPostStatus` union + tabs + guard + counts + interface `SocialPost` com 7 campos novos (lockstep)
- `apps/web/lib/instagram/__tests__/instagram-claim.test.ts` - Contrato de claim idempotente (mock `createServiceClient`): 2-reivindicados-depois-0 + publicado-nunca-reivindicado
- `apps/web/types/database.ts` - Regenerado pos db push (colunas social_posts novas + tipos das 3 RPCs)

## Decisions Made
- **Idempotencia mora no banco**, nao na aplicacao: o portao e o `UPDATE ... WHERE status='agendado' ... RETURNING *`; um `publicado` jamais casa o WHERE, logo nunca re-reivindicado (D-02).
- **`FOR UPDATE SKIP LOCKED`** serializa cron x "publicar agora" sem deadlock — cada run pega rows disjuntas.
- **Cap `publish_attempts < 3`** (D-03); o reaper devolve rows presas em `publicando` (>15min) a `agendado`, ainda sob o cap (crash recovery sem republicacao infinita).
- **`grant execute` apenas a `service_role`** nas 3 RPCs SECURITY DEFINER — mitiga T-12-03 (EoP); a tabela `social_posts` ja e RLS founder-only.
- **Bump EVERY occurrence** (regra de memoria): atualizar o union sem as 4 ocorrencias + interface seria a causa #1 de bug — feito em lockstep com a migration e os types.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Task 4 (db push) era BLOCKING no founder:** a senha do banco nao esta no env local, entao o agente nao podia rodar `supabase db push --linked` de forma autonoma. O founder aplicou a 0049 em producao e confirmou o schema via probe service-role (colunas + CHECK + RPCs presentes). Resolvido; nao e desvio — e o fluxo `checkpoint:human-action` previsto no plano (`autonomous: false`).

## Threat Model Compliance
- **T-12-01 (double-publish via race):** mitigado — claim atomico + `FOR UPDATE SKIP LOCKED`; `publicado` nunca casa o WHERE.
- **T-12-02 (row presa em publicando apos crash):** mitigado — `reap_stuck_publishing()` reseta `publicando` >15min -> `agendado`, sob cap `publish_attempts < 3`.
- **T-12-03 (RPC SECURITY DEFINER por role indevido):** mitigado — `grant execute` apenas a `service_role`; `social_posts` RLS founder-only.

## User Setup Required
None - o unico passo manual (db push 0049) ja foi executado pelo founder nesta entrega.

## Next Phase Readiness
- Substrato de schema + claim atomico PRONTO em producao para o nucleo de publicacao (12-03, ja entregue) e para o cron + "publicar agora" (12-05).
- IGPUB-06 concluido (12-03 grava permalink/erro; 12-04 expoe erro no /admin pra reenfileirar). IGPUB-02 (cron sweep idempotente end-to-end) tem o substrato pronto aqui; fecha quando o Plan 05 for conectado ao Meta/IG (Task 7 ainda BLOCKING no founder).
- Continuacao da Fase 12: Plan 05 Task 7 (bootstrap Meta/IG + smoke E2E) — unico ponto aberto da fase.

## Self-Check: PASSED

**Files verified (exist on disk):**
- FOUND: `supabase/migrations/0049_social_posts_publishing.sql`
- FOUND: `apps/web/lib/admin/social-posts.ts`
- FOUND: `apps/web/lib/instagram/__tests__/instagram-claim.test.ts`
- FOUND: `apps/web/types/database.ts`

**Commits verified (exist in git):**
- FOUND: `27483c2` (Task 1 — migration 0049)
- FOUND: `1a28334` (Task 2 RED — SocialPostStatus lockstep test)
- FOUND: `589c95a` (Task 2 GREEN — SocialPostStatus lockstep impl)
- FOUND: `3a0f9ea` (Task 3 — claim contract test)
- FOUND: `65e5e58` (Task 4 closeout — regen database.ts pos db push)

**Prod-schema verification (service-role probe, confirmado pelo founder/orchestrator):**
- Colunas `ig_media_id`, `ig_permalink`, `ig_container_id`, `publish_error`, `publish_attempts`, `last_attempt_at`, `published_at` existem em `social_posts`.
- CHECK aceita `publicando` e `erro` (7 estados).
- RPCs `claim_due_social_posts`, `claim_one_social_post`, `reap_stuck_publishing` respondem.
- `pnpm tsc --noEmit` limpo para os arquivos da Fase 12 (os 2 erros transitorios em `actions.ts` desapareceram apos regen).

---
*Phase: 12-publicacao-instagram*
*Completed: 2026-06-22*
