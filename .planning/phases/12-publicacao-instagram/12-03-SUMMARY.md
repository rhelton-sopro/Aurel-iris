---
phase: 12-publicacao-instagram
plan: 03
subsystem: api
tags: [instagram, meta-graph-api, content-publishing, cron, idempotency, ssrf]

# Dependency graph
requires:
  - phase: 12-01
    provides: "tabela social_posts + colunas de publicação + RPCs claim_due/claim_one/reap (migration 0049) + tipos SocialPost/SocialPostMedia + helper claimDue"
  - phase: 12-02
    provides: "lib/instagram/token.ts (getValidToken/refreshInstagramTokenIfNeeded/instagramHealthCheck)"
provides:
  - "lib/instagram/publish.ts — núcleo de publicação IG: publishDuePosts (sweep) + publishPost (um id) compartilhando publishClaimed"
  - "Montagem de container/poll/publish para imagem única, carrossel (IGPUB-03) e reel com poll status_code (IGPUB-04)"
  - "Caption/hashtags no container (IGPUB-05); permalink+ig_media_id em sucesso (IGPUB-06)"
  - "Classificação de erro D-03: retryável→agendado (attempts<3) vs permanente→erro; AUTH não queima a tentativa"
affects: [12-04-cron-route, 13-cockpit-publicar-agora, getAdminNotifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Um núcleo (publishClaimed), dois entry-points (D-08): sweep do cron + publicar-agora compartilham o mesmo caminho"
    - "Anti-SSRF por allowlist: image_url/video_url montados SÓ de NEXT_PUBLIC_SITE_URL + path relativo do DB (rejeita URL absoluta)"
    - "Host pinado graph.instagram.com/v23.0 via fetch nativo (sem SDK Meta)"
    - "Poll obrigatório de reel (status_code até FINISHED) antes de media_publish"
    - "Classificação retryável/permanente por code do Graph carregado em GraphError; IgAuthError separado para AUTH"

key-files:
  created:
    - "apps/web/lib/instagram/__tests__/instagram-publish.test.ts"
  modified:
    - "apps/web/lib/instagram/publish.ts"
    - "apps/web/lib/instagram/__tests__/instagram-claim.test.ts"

key-decisions:
  - "publish_attempts já é incrementado pela RPC de claim (migration 0049), então markError lê o nº pós-claim para o cap de 3 tentativas"
  - "Falha ao gravar o sucesso é tratada como retryável (code 4) para reconciliar a row na próxima passada, sem perder a publicação real no IG"
  - "Poll timeout (>100s) é tratado como retryável (9007), não como erro permanente — a próxima varredura continua"
  - "AUTH (token null / code 190) devolve o post a 'agendado' e loga AUTH; não marca erro do post (health-check D-07 trata o token)"

patterns-established:
  - "GraphError/IgAuthError tipados carregando code/status para classificação D-03"
  - "graphPost/graphGet helpers que nunca logam o access_token (T-12-09)"

requirements-completed: [IGPUB-03, IGPUB-04, IGPUB-05, IGPUB-06]

# Metrics
duration: 7min
completed: 2026-06-21
---

# Phase 12 Plan 03: Núcleo de Publicação Instagram Summary

**`lib/instagram/publish.ts` — o coração do motor: um núcleo `publishClaimed` (container → poll → media_publish → grava permalink/erro) com dois entry-points (`publishDuePosts` sweep + `publishPost` um id), montando imagem/carrossel/reel-com-poll e classificando falha retryável vs permanente.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-21T23:01:15Z
- **Completed:** 2026-06-21T23:07:49Z
- **Tasks:** 2/2
- **Files modified:** 3 (1 criado, 2 modificados)

## Accomplishments
- Pipeline completo de publicação IG entregue: carrossel (N child → CAROUSEL), reel (REELS + poll `status_code` obrigatório até FINISHED), imagem única — todos via `media_publish`.
- Sucesso grava `ig_media_id` + `ig_permalink` + `ig_container_id` + `status='publicado'` + `published_at` (IGPUB-06); caption/hashtags no container (IGPUB-05).
- Classificação D-03 implementada e testada: retryável (9007/rate/5xx, attempts<3) → `agendado`; permanente (24/2207xxx/reel ERROR/EXPIRED) ou attempts esgotadas → `erro` + motivo; AUTH não queima a tentativa.
- Suite de 10 testes do publicador + 2 testes consumer-level de idempotência (`publishDuePosts`) — 22/22 verde no módulo instagram, tudo com Graph + service-role mockados (zero rede).

## Task Commits

1. **Task 1: Núcleo de publicação (container/poll/publish + claim + 2 entry-points)** - `112436f` (feat)
2. **Task 2: Suite de testes do publicador + extensão da idempotência do claim** - `9f2ec5f` (test)

_Nota: por serem tasks `tdd="true"` cujo Task 1 é a implementação e o Task 2 a suite, cada uma foi um commit atômico (impl GREEN verificada por grep+tsc; suite GREEN logo após)._

## Files Created/Modified
- `apps/web/lib/instagram/publish.ts` — núcleo + dois entry-points + montagem de container por tipo de mídia + poll de reel + classificação de erro + helpers anti-SSRF/host-pinado (modificado: estendeu o stub `claimDue` do Plan 01).
- `apps/web/lib/instagram/__tests__/instagram-publish.test.ts` — 10 casos (IGPUB-03/04/05/06 + D-03 retryável/permanente/esgotado + id inválido + claim 0-rows), Graph mockado.
- `apps/web/lib/instagram/__tests__/instagram-claim.test.ts` — +2 casos consumer-level via `publishDuePosts` (IGPUB-02 idempotência ponta-a-ponta); zero guards `typeof === "function"`.

## Verification
- `pnpm --dir apps/web test:run lib/instagram` → 22/22 verde (publish 10 + claim 5 + token 7).
- `pnpm --dir apps/web tsc --noEmit` → zero erros nos 3 arquivos do plano. Erros remanescentes são baseline pré-existente NÃO meu: `lib/vision/modal-client.test.ts` (dívida Fase 3/5) e `tmp/rev_page.tsx` (arquivo local stale, documentado em memória).
- `pnpm --dir apps/web lint` nos 3 arquivos → clean (0 erros, 0 warnings).
- grep-gates Task 1: `import 'server-only'`=1, exporta `publishDuePosts`+`publishPost`, `claim_due_social_posts`/`claim_one_social_post`/`reap_stuck_publishing` ≥1, `is_carousel_item`≥1, `REELS`+`status_code`≥1, `media_publish`≥1, `permalink`≥1, `graph.facebook.com`==0, `NEXT_PUBLIC_SITE_URL`≥1.
- grep-gate Task 2: marcadores de estado/fluxo ≥5 (45 ocorrências).

## Threat Model Coverage
- **T-12-08 (SSRF):** `absoluteMediaUrl` monta a URL só de `NEXT_PUBLIC_SITE_URL` + path relativo; rejeita URL absoluta vinda do DB. ✓
- **T-12-09 (token leak):** `graphPost`/`graphGet`/`markError` logam só code/message; nunca o access_token. ✓
- **T-12-10 (reel quebrado):** poll obrigatório `status_code` até FINISHED; ERROR/EXPIRED → erro, nunca publish. ✓
- **T-12-11 (host errado):** host pinado `graph.instagram.com/v23.0`; grep-gate `graph.facebook.com`==0. ✓
- **T-12-12 (falha sem rastro):** `publish_error` gravado em toda falha (retryável e permanente). ✓

## Deviations from Plan
None — plano executado exatamente como escrito. O followup (WARNING 6) de estender `instagram-claim.test.ts` foi atendido: os 2 casos de idempotência já existiam no nível do contrato `claimDue` (Wave 0) e foram reforçados com 2 casos consumer-level via `publishDuePosts`; zero guards `typeof === "function"` presentes.

## Known Stubs
Nenhum stub. As entry-points são consumidas pelo cron route (Plan 12-04) e pela ação "publicar agora" (Fase 13), ambos fora do escopo deste plano. A publicação real só funciona após o founder rodar `supabase db push` (migration 0049) + seedar o token IG + setar `INSTAGRAM_BUSINESS_ACCOUNT_ID` — homework já rastreado nos Plans 01/02.

## Self-Check: PASSED
- 3 arquivos de código FOUND + SUMMARY FOUND.
- 2 commits FOUND (`112436f` feat, `9f2ec5f` test).
- 22/22 testes do módulo instagram verde.
