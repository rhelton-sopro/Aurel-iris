# Phase 12: publicacao-instagram - Research

**Researched:** 2026-06-21
**Domain:** Meta Instagram Content Publishing API + Vercel Cron + idempotent Postgres job
**Confidence:** HIGH (API flow, auth model, cron, idempotency) / MEDIUM (exact daily publish-limit number — sources conflict 25 vs 50 vs 100)

## Summary

Phase 12 wires the existing `/admin/painel` approval queue (`social_posts`, migration 0045) into a real Instagram publisher. The pattern is fully buildable from existing project infra: the **hourly Vercel cron pattern already exists** (`/api/cron/photo-ctl` runs `0 * * * *` with `CRON_SECRET` Bearer + timing-safe compare on PRO plan), the **service-role Supabase client already exists** (`createServiceClient`), the **admin notifications surface already exists** (`getAdminNotifications`), and **`app_settings` (migration 0048) is an ideal token store** read/written via service-role.

The Meta side resolves cleanly to the **"Instagram API with Instagram Login"** path (host `graph.instagram.com`), which — critically — **does NOT require a Facebook Page** and **does NOT require App Review to publish to your OWN account** when that account is added as an **Instagram Tester** in the app dashboard (Development mode). App Review is only needed to publish on behalf of *other* users, which is explicitly out of scope (CONTEXT: one account, founder's own). [VERIFIED: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login + tester-role flow]

Publishing is the canonical **2-step container → media_publish** dance; carousels add per-slide `is_carousel_item` containers under a `CAROUSEL` parent; reels add a mandatory **status poll** (`status_code` until `FINISHED`) before publish. Tokens are long-lived (~60 days) and refreshed via `ig_refresh_token` (must be ≥24h old, ≤60 days). [VERIFIED: official docs + Meta gist]

**Primary recommendation:** Build one `publishPost(postId)` core function (claim row → build containers → poll if reel → media_publish → record permalink/media_id, or mark error). Call it from BOTH the hourly cron route AND a "publicar agora" server action. Store the rotating IG token + IG user ID + expiry in `app_settings` (service-role only), refreshed by the existing `/api/cron/daily` job. Use a `publishing` lock state + status guard for idempotency.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sweep due `agendado` posts hourly | Vercel Cron → Next API route (nodejs) | — | Time-triggered server job; only place with `CRON_SECRET` |
| Claim row / idempotency lock | Database (Postgres) | API/Backend | Atomicity must live where the row lives (conditional UPDATE / advisory) |
| Build containers + poll + publish | API/Backend (server lib) | Meta Graph API (external) | Business logic; calls external HTTP |
| Token storage + refresh + health-check | Database (`app_settings`) + Cron | API/Backend | Secret-ish state; refreshed on schedule |
| Media bytes (slides/MP4) | CDN / Static (`apps/web/public` → iriscodex.com) | Meta fetches by URL | Meta pulls public URLs; we never upload bytes |
| "Publicar agora" trigger | Frontend Server (server action) | API/Backend (shared core) | Reuses cron's publish core; founder-gated |
| Failure surfacing + reenqueue | Frontend Server (`getAdminNotifications` + painel) | Database | Read-side aggregation of error rows |

**Key tier note:** We do NOT proxy media bytes. Meta's servers fetch `image_url`/`video_url` directly from the public `iriscodex.com/...` URLs. Our backend only sends URLs + caption + token. This means an SSRF surface does NOT exist on our side, but it does mean the public asset must be reachable and correctly typed at publish time (see Pitfalls).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Cron Vercel **de hora em hora** (`0 * * * *`). Varre `social_posts` em `agendado` com `scheduled_at` vencido; publica na passada seguinte (atraso ≤~1h aceitável).
- **D-02:** Publicação **idempotente** — rodar o cron 2× NÃO republica um post `publicado` (lock/checagem de estado antes de disparar).
- **D-03:** Em falha, **re-tenta nas próximas 2 passadas** (≈ até 2h). Persistindo, post NÃO entra em `publicado`, marca erro + motivo gravado.
- **D-04:** Erros **visíveis na central de notificações do `/admin`** (`getAdminNotifications`), de onde o founder **reenfileira** manualmente.
- **D-05 (discrição):** Sucesso **silencioso** — sem notificação; só marca `publicado` + grava permalink/ID. Só falha alerta.
- **D-06:** Token de longa duração (~60d) com **refresh AUTOMÁTICO** antes de expirar + **health-check** periódico (token + IG Business Account ID em env/store).
- **D-07:** **Alerta no `/admin` apenas em falha** de health-check/refresh.
- **D-08:** **Botão "publicar agora"** no painel JÁ na Fase 12, reusando o **mesmo caminho de publicação do cron**.
- UMA conta (founder), **dev mode, SEM App Review**. Mídias lidas das **URLs públicas** (iriscodex.com/...).

### Claude's Discretion
- Estrutura do endpoint do cron, layout das env vars, poll de status do reel, schema do registro de erro/permalink em `social_posts`, mecânica do lock de idempotência.
- Sucesso silencioso (D-05).

### Deferred Ideas (OUT OF SCOPE)
- **Cockpit do painel** (timeline, UI rica de reenfileiramento, agendar na régua) → **Fase 13** (COCKPIT-01..03).
- **Loop de dados / Insights API** (saves/alcance/watch-time → pauta) → **Fase 14** (DATA-01..03; exige `instagram_manage_insights`).
- **Multi-conta / publicar em contas de terceiros** (exigiria App Review) — fora do milestone.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IGPUB-01 | Conta IG (Professional) conectada via Meta API — long-lived token + IG Business Account ID + health-check | "Instagram API with Instagram Login" path (no FB Page needed); token store in `app_settings`; refresh via `ig_refresh_token`; health-check = `GET /me` |
| IGPUB-02 | Cron varre `agendado` vencidos + publica idempotente | Existing hourly cron pattern (`photo-ttl`); idempotency via conditional UPDATE claim + status guard |
| IGPUB-03 | Carrossel multi-imagem das URLs públicas | per-slide `is_carousel_item` containers → `CAROUSEL` parent w/ `children` → `media_publish` (max 10) |
| IGPUB-04 | Reel (9:16 H.264) da URL pública | `media_type=REELS` container → poll `status_code` until FINISHED → `media_publish` |
| IGPUB-05 | Caption + hashtags no momento da publicação | `caption` param on parent/single container (≤2200 chars, ≤30 hashtags) |
| IGPUB-06 | Marca `publicado` + permalink/ID; em falha mantém fora de `publicado` + expõe erro | New columns `ig_media_id`, `ig_permalink`, `publish_error`, `publish_attempts`; error feeds `getAdminNotifications` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (native `fetch`) | Node 20+ (Vercel nodejs runtime) | HTTP calls to `graph.instagram.com` | No SDK needed; Meta Graph is plain REST. Project already uses `fetch` for Asaas/MP webhooks. [VERIFIED: codebase] |
| `@supabase/supabase-js` | already installed | service-role DB access (claim, update, token store) | Existing `createServiceClient()` pattern. [VERIFIED: lib/supabase/service.ts] |
| `node:crypto` `timingSafeEqual` | native | cron Bearer auth | Matches existing cron routes exactly. [VERIFIED: api/cron/photo-ttl] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` to Graph | `instagram-graph-api` npm wrappers | Wrappers lag behind Meta's frequent breaking changes (e.g., July-2024 Instagram-Login migration, Jan-2025 scope deprecation). Raw fetch = fewer surprises. [ASSUMED — based on ecosystem volatility] |
| `app_settings` token store | Vercel env var only | Env vars are static; a 60-day-rotating token MUST be writable at runtime → DB store required. Keep IG **user ID** in env (stable) + token in DB (rotating). |

**No new npm install required.** This phase is pure backend glue + 1 migration.

**Graph API version:** Pin a version in the base URL (e.g. `https://graph.instagram.com/v23.0/...`). [CITED: developers.facebook.com — versioned endpoints] Verify the latest stable `vXX.0` at plan time; do not hardcode an unpinned host (unversioned calls silently follow Meta's default version and can break).

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────┐
   Vercel Cron           │  /api/cron/instagram-publish (GET)       │
   "0 * * * *"  ───────► │  - verify CRON_SECRET (Bearer, timesafe) │
                         │  - find due rows + dispatch              │
                         └───────────────┬─────────────────────────┘
                                         │
   Founder clicks                        │   (same core)
   "publicar agora"                      ▼
   (server action) ──────────► ┌──────────────────────────────────┐
   founder-gated               │  publishDuePosts() / publishPost()│
                               │  lib/instagram/publish.ts          │
                               └───┬───────────────┬────────────────┘
                                   │               │
                  ┌────────────────▼──┐     ┌──────▼─────────────────┐
                  │ DB: claim row     │     │ getValidToken()        │
                  │ agendado→         │     │ app_settings + refresh │
                  │ publicando        │     └──────┬─────────────────┘
                  │ (conditional      │            │
                  │  UPDATE guard)    │            ▼
                  └────────┬──────────┘   ┌────────────────────────────┐
                           │              │ graph.instagram.com         │
                           ▼              │  POST /{ig-id}/media        │◄── reads
              ┌────────────────────────┐  │  GET  /{container}?status   │   iriscodex.com
              │ build containers:      │──►│  POST /{ig-id}/media_publish│   /admin/painel/...
              │  carousel: N slides    │  └──────────┬──────────────────┘   (public assets)
              │  reel: poll FINISHED   │             │
              └────────────────────────┘             │ media_id + permalink
                           │                          │
                           ▼                          ▼
              ┌─────────────────────────────────────────────────┐
              │ DB: publicando → publicado (+ig_media_id,        │
              │     ig_permalink)   OR  → agendado/erro          │
              │     (+publish_error, publish_attempts++)         │
              └──────────────────┬──────────────────────────────┘
                                 │ error rows
                                 ▼
                    getAdminNotifications() → /admin cards (D-04/D-07)
```

### Pattern 1: Single `publishPost` core, two entry points (D-08)
**What:** All publish logic lives in `lib/instagram/publish.ts`. The cron route and the "publicar agora" server action both call it. Cron calls `publishDuePosts()` (sweep); the button calls `publishPost(id, { force: true })`.
**When to use:** Always — this is the spine of the phase. Guarantees the manual path is a true end-to-end validation of the cron path.

```typescript
// lib/instagram/publish.ts  (sketch — verify Graph version at plan time)
const GRAPH = 'https://graph.instagram.com/v23.0' // [CITED: graph.instagram.com versioned]

export async function publishDuePosts(): Promise<SweepResult> {
  const due = await claimDuePosts()      // conditional UPDATE → 'publicando'
  const results = []
  for (const post of due) {
    results.push(await publishClaimed(post).catch((e) => markError(post, e)))
  }
  return summarize(results)
}

export async function publishPost(id: string): Promise<PublishResult> {
  const claimed = await claimOne(id)     // null if not claimable (already published / locked)
  if (!claimed) return { ok: false, error: 'não-publicável (já publicado ou em andamento)' }
  return publishClaimed(claimed).catch((e) => markError(claimed, e))
}
```

### Pattern 2: Container → publish (single image)
```
POST {GRAPH}/{ig-user-id}/media   image_url=<public>&caption=<text>&access_token=<t>   → { id: containerId }
POST {GRAPH}/{ig-user-id}/media_publish   creation_id=<containerId>&access_token=<t>   → { id: mediaId }
```
[VERIFIED: developers.facebook.com/docs/instagram-platform/content-publishing/]

### Pattern 3: Carousel (IGPUB-03)
```
// 1. one container per slide
for slide in slides (max 10):
  POST {GRAPH}/{ig-user-id}/media   image_url=<slide>&is_carousel_item=true&access_token=<t>  → childId
// 2. parent container
POST {GRAPH}/{ig-user-id}/media   media_type=CAROUSEL&children=<childId1,childId2,...>&caption=<text>&access_token=<t>  → parentId
// 3. publish
POST {GRAPH}/{ig-user-id}/media_publish   creation_id=<parentId>&access_token=<t>  → mediaId
```
[VERIFIED: official docs]
- **Max 10 children.** ⚠️ All slides are cropped to the **aspect ratio of the FIRST image** (default 1:1). The seed carrosséis vary slide count (4 and 6) — fine. But mixed aspect ratios within one carousel will be cropped to slide #1. Document this as a content rule for Ptah/Nefertiti.

### Pattern 4: Reel (IGPUB-04) — mandatory poll
```
POST {GRAPH}/{ig-user-id}/media   media_type=REELS&video_url=<public.mp4>&caption=<text>&access_token=<t>  → containerId
// MUST poll before publish:
loop (≤ ~5 min, ~every 5-15s, capped by maxDuration):
  GET {GRAPH}/{containerId}?fields=status_code&access_token=<t>
  → IN_PROGRESS → keep polling
  → FINISHED    → break, then media_publish
  → ERROR       → mark error (read status_code/error)
  → EXPIRED     → container >24h old, mark error
POST {GRAPH}/{ig-user-id}/media_publish   creation_id=<containerId>&access_token=<t>  → mediaId
```
[VERIFIED: official docs + multiple 2026 guides]
- Processing time: **typically 30s–2min**, can be several minutes. Poll "once per minute, ≤5 minutes" per Meta; faster (5–15s) is fine and recommended for our short window. [VERIFIED]
- **Container stays valid 24h** (then `EXPIRED`). [VERIFIED]
- Reel requirements: **9:16, H.264 (or HEVC), 5–90s, IG Business/Creator account.** [VERIFIED: postproxy 2026 guide]

### Pattern 5: Record permalink (IGPUB-06)
```
GET {GRAPH}/{mediaId}?fields=id,permalink,media_type,timestamp&access_token=<t>
→ store ig_media_id=mediaId, ig_permalink=permalink
```

### Anti-Patterns to Avoid
- **Using `graph.facebook.com` with an Instagram-Login token** → `Invalid OAuth access token - Cannot parse access token`. Use `graph.instagram.com` exclusively for this auth path. [VERIFIED: Meta gist]
- **Publishing before reel `status_code=FINISHED`** → fails / publishes broken. Always poll.
- **Storing the rotating token in a Vercel env var** → can't be updated at runtime; will expire and break silently. Token lives in `app_settings` (writable), refreshed by cron.
- **Sweeping without a claim/lock** → two overlapping cron runs (or cron + "publicar agora") double-publish. Always claim with a conditional UPDATE first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron auth | custom header scheme | existing `CRON_SECRET` Bearer + `timingSafeEqual` | Already battle-tested in `photo-ttl`/`daily`; Vercel injects the header automatically. |
| Service-role DB | new client | `createServiceClient()` | Existing, RLS-bypass, configured. |
| Token storage | new secrets table | `app_settings` (key/value jsonb, service-role only, RLS-no-policy) | Migration 0048 already exists for exactly this kind of rotating global config. |
| Failure surfacing | new admin UI | extend `getAdminNotifications()` | D-04 explicitly says reuse it. |
| HTTP retry/backoff for reel poll | external lib | small inline loop bounded by `maxDuration` | One narrow poll loop; a lib adds nothing. |

**Key insight:** This phase is ~90% wiring existing project primitives. The only genuinely new external surface is the Meta Graph REST calls. Resist adding any IG SDK — Meta's frequent breaking changes make thin raw-`fetch` the lower-risk choice.

---

## Idempotency / Locking Pattern (D-02, Claude's Discretion)

Goal: two overlapping cron runs — or cron racing "publicar agora" — must never double-publish.

**Recommended: conditional-UPDATE claim (no advisory locks, no `FOR UPDATE` needed).**

Add a `publicando` (publishing) interim state OR a claim timestamp. The atomic "claim" is a single UPDATE guarded by the current status:

```sql
-- claim due posts: only rows still 'agendado' & due flip to 'publicando'.
-- RETURNING gives us exactly the rows THIS run owns. Postgres UPDATE is atomic;
-- a second concurrent run's WHERE no longer matches → it claims nothing.
update social_posts
   set status = 'publicando',
       last_attempt_at = now(),
       publish_attempts = publish_attempts + 1,
       updated_at = now()
 where id in (
   select id from social_posts
    where status = 'agendado'
      and scheduled_at <= now()
      and publish_attempts < 3            -- D-03: max 1 + 2 retries
    order by scheduled_at
    for update skip locked                -- belt-and-suspenders vs. overlap
    limit 10
 )
returning *;
```

- `for update skip locked` inside the subselect makes concurrent runs skip rows another run already grabbed (Postgres supports it; works via service-role over supabase-js using an RPC or `.rpc()` wrapping this SQL). [VERIFIED: standard Postgres semantics]
- The outer guard `status = 'agendado'` is the real idempotency gate: a `publicado` row can never be re-claimed.
- **Crash recovery:** if a run dies after claiming (`publicando`) but before finishing, the row is stuck. Add a reaper: rows in `publicando` with `last_attempt_at < now() - interval '15 min'` → reset to `agendado` (still under the `publish_attempts < 3` cap). Run it at the top of each sweep.
- **"publicar agora"** uses the SAME claim on a single id (`where id = $1 and status in ('agendado','aprovado')`). If it returns no row, the post is already publishing/published → no-op.

**Why a conditional UPDATE over `SELECT ... FOR UPDATE` in app code:** supabase-js has no transaction API; the cleanest atomic claim is a single statement (wrap as a Postgres function `claim_due_social_posts(limit int)` and call via `.rpc()`). This keeps the claim atomic server-side without needing an open transaction from Node.

---

## Schema Additions (migration 00XX — [BLOCKING] supabase db push)

Proposed columns on `social_posts`:

```sql
alter table social_posts
  add column if not exists ig_media_id     text,        -- IGPUB-06 published media id
  add column if not exists ig_permalink    text,        -- IGPUB-06 link to the post
  add column if not exists ig_container_id text,         -- last container (resume/debug; reel)
  add column if not exists publish_error   text,         -- D-03 motivo (null on success)
  add column if not exists publish_attempts int  not null default 0,
  add column if not exists last_attempt_at  timestamptz, -- reaper + retry cadence
  add column if not exists published_at     timestamptz; -- when IG confirmed

-- extend status CHECK to add the interim lock state:
alter table social_posts drop constraint if exists social_posts_status_check;
alter table social_posts add constraint social_posts_status_check
  check (status in ('pendente','aprovado','agendado','publicando','publicado','reprovado','erro'));

-- index for the sweep
create index if not exists social_posts_due_idx
  on social_posts(status, scheduled_at)
  where status in ('agendado','publicando');
```

State machine extension: `agendado → publicando → publicado` (happy) | `publicando → agendado` (retry, attempts<3) | `publicando → erro` (attempts≥3, D-03). Founder reenqueue (D-04): `erro → agendado` (reset `publish_attempts=0, publish_error=null`).

⚠️ **`SocialPostStatus` TS union** in `lib/admin/social-posts.ts` must add `'publicando' | 'erro'`. `STATUS_TABS` and `fetchStatusCounts` counts map must include them. `isSocialPostStatus` guard too.

**`app_settings` token rows** (no schema change — reuse 0048 key/value):
- key `instagram_token` → `{ "access_token": "...", "expires_at": "2026-08-20T...", "obtained_at": "...", "last_refresh_at": "..." }`
- IG **user id** + **app secret** → Vercel env (stable secrets, never rotate): `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_APP_ID`. Initial token seeded once into `app_settings` via a one-off admin action/script.

---

## Token Lifecycle (IGPUB-01, D-06, D-07)

**Auth path: "Instagram API with Instagram Login" — host `graph.instagram.com`.** No Facebook Page required. [VERIFIED: official docs — "This API setup does not require a Facebook Page to be linked"]

**One-time acquisition (founder homework + one admin action):**
1. Founder converts IG to **Professional (Business or Creator)**.
2. Founder/dev creates a Meta app at developers.facebook.com → add product **"Instagram"** (Instagram API with Instagram Login). [VERIFIED]
3. In app dashboard → **App roles → Roles → Instagram Testers** → invite the founder's IG username. Founder accepts at **instagram.com → Settings → Apps and Websites → Tester Invites**. [VERIFIED: tester-role flow — this is what unlocks publishing to the OWN account in Development mode WITHOUT App Review]
4. OAuth once to get a short-lived token:
   - Authorize: `https://www.instagram.com/oauth/authorize?client_id={APP_ID}&redirect_uri={URI}&response_type=code&scope=instagram_business_basic,instagram_business_content_publish` [VERIFIED]
   - Exchange code: `POST https://api.instagram.com/oauth/access_token` (client_id, client_secret, grant_type=authorization_code, redirect_uri, code) → short-lived (~1h, single-use). [VERIFIED]
5. Short → long-lived: `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret={SECRET}&access_token={SHORT}` → `expires_in ≈ 5183944` (~60d). [VERIFIED]
6. Get IG user id: `GET https://graph.instagram.com/me?fields=id,username&access_token={LONG}` → store `id` as `INSTAGRAM_BUSINESS_ACCOUNT_ID`. [VERIFIED: Meta gist]
7. Seed `app_settings.instagram_token` with `{access_token, expires_at}`.

**Refresh (programmatic, D-06):** `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={LONG}` → new ~60d token. **Constraints: existing token must be ≥24h old and not yet expired.** [VERIFIED]
- Cadence: piggyback on the **existing `/api/cron/daily`** (runs 05:00 UTC). Add a `refreshInstagramTokenIfNeeded()` job: if `expires_at - now() < ~10 days`, refresh and rewrite `app_settings`. A daily check with a 10-day buffer is far inside the 60-day window — no risk of letting it lapse.

**Health-check (D-06/D-07):** lightweight `GET /me?fields=id` with the stored token. On failure (or refresh failure), surface in `getAdminNotifications` (new `instagramAuthError` signal). On success, **silent** (D-05/D-07).

**Dev-mode reality (confirms CONTEXT "SEM App Review"):** In Development mode, only users with a role (admin/dev/**tester**) can use the app. A founder's own IG account as Instagram Tester **can publish to itself with no App Review.** App Review + Live mode are only required to serve *other* users at scale — out of scope. [VERIFIED: dev-mode tester search; reconciles the conflicting "review mandatory" headlines which refer to *other users'* accounts]

---

## Vercel Cron (IGPUB-02)

- **Plan = PRO** (confirmed in project memory `project_vercel_plan_hobby` — upgraded for Stage 2 maxDuration). PRO allows minute-level cadence and up to 40 crons; hourly is trivially fine. (Hobby is daily-only — would block this phase, but we're on PRO.) [VERIFIED: vercel.com/docs/cron-jobs + project memory]
- **Declare** in `apps/web/vercel.json` `crons[]`: `{ "path": "/api/cron/instagram-publish", "schedule": "0 * * * *" }`. (File already has 2 crons; append.) [VERIFIED: codebase + Vercel docs]
- **Route contract:** `export const runtime = 'nodejs'`; `export const maxDuration = <≤300>` (reel poll bounded; PRO allows up to 800s here, set ~120–300 to be safe). Vercel calls it via GET with `Authorization: Bearer ${CRON_SECRET}`. [VERIFIED: existing cron routes]
- **Auth:** copy the exact `timingSafeEqual` fail-closed block from `api/cron/photo-ttl/route.ts` (CRON_SECRET already configured on the project). [VERIFIED: codebase]
- **"Publicar agora":** a **server action** (in `app/admin/painel/actions.ts`, founder-gated via existing `requireFounder()`) calls `publishPost(id)` directly — no HTTP, no CRON_SECRET, runs in the founder's authenticated server context. Same core lib. [VERIFIED: actions.ts pattern]

---

## Common Pitfalls

### Pitfall 1: Public media URL not reachable / wrong content-type at publish time
**What goes wrong:** Meta fetches `image_url`/`video_url` server-side; if the asset 404s, is behind auth, or serves wrong MIME, container creation fails.
**Why:** Seed media paths like `/admin/painel/img/...` and `/admin/painel/*.mp4` must resolve as **public `iriscodex.com` URLs returning HTTP 200 + correct image/video content-type.** Note current git status shows reel mp4s modified/untracked — confirm they're deployed and public.
**How to avoid:** Build absolute URLs from `NEXT_PUBLIC_SITE_URL` + the stored relative path. Pre-flight HEAD check optional. Images must be **JPEG** (PNG slides in seed `*.png` → ⚠️ verify Meta accepts; Meta docs say "JPEG only" for images — **may need PNG→JPEG conversion or storing JPEGs**). [VERIFIED: official docs say JPEG] — **OPEN QUESTION below.**

### Pitfall 2: Carousel cropped to first slide's aspect ratio
**What goes wrong:** Mixed aspect-ratio slides get cropped to slide #1 (default 1:1), silently ruining layouts.
**How to avoid:** Content rule: all slides in one carousel share aspect ratio; first slide sets it. Document for Ptah/Nefertiti.

### Pitfall 3: Reel published before processing finished
**How to avoid:** Mandatory poll loop; never publish on `IN_PROGRESS`. Handle `ERROR`/`EXPIRED`. (Pattern 4.)

### Pitfall 4: Daily publish limit hit mid-sweep
**What goes wrong:** Hitting the content-publishing cap returns an error; naive code marks the post failed permanently.
**Why:** **Sources conflict on the exact number** — Meta docs page now says **100/24h**, multiple 2026 third-party guides say **25/24h**, older docs **50/24h**. [Meta: 100 | postproxy/others: 25] **MEDIUM confidence.**
**How to avoid:** (a) Check `GET /{ig-user-id}/content_publishing_limit` before/within a sweep; (b) treat rate-limit/quota errors as **retryable** (don't burn an attempt — leave `agendado`, retry next pass). At founder's volume (a few posts/day) this is unlikely, but handle gracefully.

### Pitfall 5: Token expired between refreshes
**How to avoid:** 10-day refresh buffer on a daily cron + health-check alert (D-07). Refresh requires token ≥24h old & not expired — a never-let-it-lapse buffer avoids the "expired, can't refresh" trap.

### Pitfall 6: Stuck `publicando` row after crash
**How to avoid:** Reaper resets `publicando` rows older than ~15min back to `agendado` (Idempotency section).

---

## Retryable vs Permanent Error Classification (D-03)

| Code / status | Meaning | Treatment |
|---------------|---------|-----------|
| `9007` (media not yet processed) | transient processing | **Retryable** — leave `agendado`, next pass [VERIFIED] |
| rate/quota (`content_publishing_limit`, code `4` app-req-limit) | throttled / "spam" | **Retryable** — back off, retry next pass [VERIFIED] |
| 5xx / network timeout | transient | **Retryable** [ASSUMED — standard HTTP] |
| `190` / token invalid/expired | auth | **Permanent for this run** → trigger health-check alert (D-07); not a per-post error |
| `24` (media not found / permission) | bad token or perms | **Permanent** → mark `erro` + motivo [VERIFIED] |
| `2207xxx` media validation (bad URL, format, aspect) | bad asset | **Permanent** → mark `erro` + motivo [CITED: poststudio/contentstudio error guides] |
| reel `status_code=ERROR`/`EXPIRED` | processing failed | **Permanent** → mark `erro` [VERIFIED] |

D-03 maps cleanly: retryable errors keep `publish_attempts < 3` cycling (≈2 retries over ≈2h); after 3 attempts OR any permanent error → `erro` + `publish_error` motivo → surfaced (D-04). Auth errors short-circuit to the health-check alert path instead of per-post failure.

---

## Runtime State Inventory

Not a rename/refactor phase — greenfield wiring. Skipped (no pre-existing runtime state to migrate). The one near-equivalent: **existing `social_posts` rows** (seed + real). Confirm none are already in `publicado` with no `ig_media_id` (they predate this phase) — those should NOT be re-published; the status guard handles this automatically (only `agendado` rows are claimed). The 1 seed row in `aprovado`/`pendente` won't be touched until scheduled.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel Cron (PRO, hourly) | IGPUB-02 | ✓ | PRO plan | — (Hobby would block; not our case) |
| `CRON_SECRET` env | cron auth | ✓ | set | — |
| `createServiceClient` | DB claim/token | ✓ | existing | — |
| `app_settings` table | token store | ✓ | migration 0048 | — |
| Public `iriscodex.com` media URLs | IGPUB-03/04 | ✓ (deployed assets) | — | confirm mp4/png deployed |
| Meta app + IG Tester + long-lived token | IGPUB-01 | ✗ **founder homework** | — | **BLOCKS publish only** — code/plan proceed without it |
| `INSTAGRAM_APP_ID/SECRET/BUSINESS_ACCOUNT_ID` env | publish + refresh | ✗ (set after homework) | — | seed via `echo`→`env add` (Vercel envs all Sensitive) |

**Missing dependencies with no fallback (blocks runtime, not planning):**
- Meta app creation + IG Professional conversion + Instagram Tester acceptance + initial OAuth → long-lived token. Per CONTEXT "specifics": this is founder homework; plan/research/code all proceed without it. The plan should include a **[BLOCKING-HUMAN] founder homework** task with the exact 7 steps in "Token Lifecycle" above, and a one-off admin "seed token" action.

---

## Validation Architecture

> nyquist_validation assumed enabled (no `.planning/config.json` override found stating false). Confirm at plan time.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project standard; used across phases) |
| Config file | `apps/web/vitest.config.*` (existing) |
| Quick run command | `pnpm --filter web test <file>` (mirror existing usage) |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | File exists? |
|-----|----------|-----------|---------|--------------|
| IGPUB-02 | claim is idempotent (2nd concurrent claim gets nothing) | unit (SQL fn or mocked) | `pnpm --filter web test instagram-claim` | ❌ Wave 0 |
| IGPUB-02 | `publicado` row never re-claimed | unit | same | ❌ Wave 0 |
| IGPUB-03 | carousel builds N child containers → parent → publish (mocked fetch) | unit | `... test instagram-publish` | ❌ Wave 0 |
| IGPUB-04 | reel polls until FINISHED before publish; ERROR/EXPIRED → erro | unit | same | ❌ Wave 0 |
| IGPUB-05 | caption+hashtags passed on container | unit | same | ❌ Wave 0 |
| IGPUB-06 | success writes ig_media_id+permalink+`publicado`; failure → `erro`+motivo, NOT `publicado` | unit | same | ❌ Wave 0 |
| IGPUB-01 | refresh only when <10d to expiry; rewrites app_settings | unit | `... test instagram-token` | ❌ Wave 0 |
| IGPUB-01 | health-check failure surfaces in getAdminNotifications | unit | `... test admin-notifications` | extend existing |
| D-03 | retryable error keeps `agendado` (attempts<3); permanent → `erro` | unit | `... test instagram-publish` | ❌ Wave 0 |
| cron auth | wrong/absent Bearer → 401 | unit | `... test cron-instagram` | ❌ Wave 0 (mirror photo-ttl test if any) |

### Sampling Rate
- **Per task commit:** quick vitest on the touched file + `pnpm lint` (project rule: lint gates `next build`).
- **Per wave merge:** full `pnpm test` + `tsc`.
- **Phase gate:** full suite green; then a **live "publicar agora" smoke** by the founder against the real IG account (the canonical end-to-end validation, enabled by D-08) — verify a carousel AND a reel actually appear on IG with correct caption + permalink stored. This is the only true integration test (Meta has no sandbox publish).

### Wave 0 Gaps
- [ ] `lib/instagram/publish.ts` + `__tests__/instagram-publish.test.ts` (fetch mocked) — IGPUB-03/04/05/06, D-03
- [ ] `lib/instagram/token.ts` + `__tests__/instagram-token.test.ts` — IGPUB-01 refresh/health
- [ ] Claim RPC (`claim_due_social_posts`) test — IGPUB-02 idempotency (DB-level or mocked)
- [ ] `api/cron/instagram-publish/route.ts` auth test — mirror existing cron auth
- [ ] Extend `notifications-summary` test for `instagramAuthError`/publish-error count
- [ ] Migration 00XX applied via **[BLOCKING] supabase db push** before integration

---

## Security Domain

> security_enforcement assumed enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Cron: `CRON_SECRET` Bearer + `timingSafeEqual` (existing). "Publicar agora": existing `requireFounder()` gate. |
| V3 Session Management | no | server-to-server + founder session (existing middleware) |
| V4 Access Control | yes | `app_settings` RLS-no-policy (service-role only); painel founder-gated; `social_posts` RLS founder-only |
| V5 Input Validation | yes | validate post id (uuid), caption length ≤2200, ≤30 hashtags, media URLs built from `NEXT_PUBLIC_SITE_URL` allowlist (no arbitrary URLs) |
| V6 Cryptography | yes | token at rest in `app_settings` (DB, service-role only) — never in client bundle, never logged. App secret in Vercel env (Sensitive). |
| V9 Communications | yes | all Graph calls HTTPS to pinned `graph.instagram.com/vXX.0` |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cron endpoint abuse (anyone POSTs to publish) | Tampering/EoP | `CRON_SECRET` Bearer fail-closed timing-safe (copy existing); GET-only |
| Token exfiltration | Information Disclosure | token in DB service-role-only; never returned to client; never `console.log` the token value |
| SSRF via media URL | (our side) — N/A on us; Meta fetches | We never fetch the media; we only **send our own** `NEXT_PUBLIC_SITE_URL`-prefixed URLs to Meta. Build URLs from allowlisted base + stored relative path — never accept an externally-supplied absolute URL into `image_url`/`video_url`. |
| Double-publish (race) | — | conditional-UPDATE claim + status guard + reaper (Idempotency section) |
| App secret leak | Info Disclosure | `INSTAGRAM_APP_SECRET` Vercel env (Sensitive); used only server-side in refresh/exchange |
| Logging PII/secrets | Info Disclosure | log media_id/permalink/status only; redact token/secret |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Instagram API **with Facebook Login** (requires linked FB Page, `graph.facebook.com`, IG Business Account via Page) | Instagram API **with Instagram Login** (`graph.instagram.com`, **no FB Page**, direct IG auth) | July 2024 | Use the Instagram-Login path → simpler, no Page. Matches CONTEXT (founder may not want a Page). |
| Old scope values (`instagram_content_publish` etc.) | `instagram_business_basic`, `instagram_business_content_publish` | Old scopes deprecated **Jan 27, 2025** | Use the new `instagram_business_*` scopes. [VERIFIED] |
| `media_type=VIDEO` for single video | `media_type=REELS` (VIDEO deprecated for single posts) | 2024+ | Single videos publish as Reels. [VERIFIED] |
| Instagram Basic Display API | **Deprecated / shut down** | Dec 2024 | Do not use Basic Display for anything. [CITED: 2026 guides] |

**Deprecated/outdated:** Facebook-Login-only IG flow for new single-account apps; `VIDEO` single posts; Basic Display API.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vitest is the test framework for `apps/web` | Validation | Low — adjust commands; pattern unchanged |
| A2 | Reel seed mp4s + carousel PNGs are deployed & public at `iriscodex.com/...` with correct content-type | Pitfall 1 | **HIGH** — if PNGs (Meta wants JPEG) or assets unreachable, publish fails. Verify at plan/build. |
| A3 | Raw `fetch` preferred over an IG SDK | Stack | Low |
| A4 | 5xx/network = retryable | Error table | Low — standard practice |
| A5 | nyquist_validation enabled (no config override read) | Validation | Low — confirm `.planning/config.json` |
| A6 | Daily publish limit is low-risk at founder volume | Pitfall 4 | Medium — exact cap unclear (25/50/100); handle as retryable regardless |

## Open Questions (RESOLVED)

1. **Image format: PNG vs JPEG.** — **RESOLVED (policy):** Plan for JPEG (Meta docs list JPEG). The publisher does NOT convert in Phase 12 — it sends the public URL as-is and **classifies a format rejection as a permanent error** (visible + reenqueueable). Empirical check = founder smoke test (D-08) with one PNG carousel. If PNG fails in practice, serving/storing JPEG slides is a **content-pipeline rule outside Phase 12 code scope** (feed asset generation, not the publisher). Noted in 12-VALIDATION.md Manual-Only.
2. **Exact content-publishing daily limit (25/50/100).** — **RESOLVED:** never hardcode. Quota/limit errors are treated as **retryable** (D-03 path); the plan may query `GET /{ig-user-id}/content_publishing_limit` at runtime. No fixed number is relied upon.
3. **Graph API version to pin.** — **RESOLVED:** pin **`v23.0`** (used in Plan 02 `token.ts` and Plan 03 `publish.ts`). Single constant; re-verify against Meta changelog only if a call returns a version-deprecation error.
4. **`.planning/config.json` nyquist flag.** — **RESOLVED:** confirmed `workflow.nyquist_validation: true`; 12-VALIDATION.md created and backfilled (`nyquist_compliant: true`).

---

## Sources

### Primary (HIGH confidence)
- [Meta — Publish Content using the Instagram Platform](https://developers.facebook.com/docs/instagram-platform/content-publishing/) — full flow, carousel/reel params, status_code, rate limit, container validity 24h, JPEG, max 10 children
- [Meta — Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/) — no FB Page required; scopes; Jan 2025 scope deprecation
- [Meta — Business Login for Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/) — OAuth authorize/exchange, ig_exchange_token (60d), ig_refresh_token (≥24h, ≤60d)
- [Meta — Instagram Platform Error Codes](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes/) — 9007, 4, 24
- Codebase: `api/cron/photo-ttl/route.ts`, `api/cron/daily/route.ts` (cron auth pattern), `lib/supabase/service.ts`, `lib/admin/social-posts.ts`, `lib/admin/notifications-summary.ts`, `lib/admin/client-report-config.ts` (app_settings access), `supabase/migrations/0045_social_posts.sql`, `0048_app_settings.sql`, `vercel.json`
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — schedule syntax, CRON_SECRET, plan limits, maxDuration
- Project memory `project_vercel_plan_hobby` — PRO plan confirmed (maxDuration headroom)

### Secondary (MEDIUM confidence)
- [Comprehensive IG Instagram-Login publishing gist (PrenSJ2)](https://gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc) — graph.instagram.com only; "no app review for own account"; /me id; caption ≤2200/30 hashtags; one-account constraint
- [Postproxy — Instagram Reels API Publishing Guide 2026](https://postproxy.dev/blog/instagram-reels-api-publishing-guide/) — reel reqs (9:16, H.264, 5–90s), processing time, 3-step
- [Postproxy — Post to Instagram via API 2026](https://postproxy.dev/blog/post-to-instagram-via-api/) — flow confirmation
- Dev-mode tester-role flow (multiple 2026 guides: getphyllo, zernio, smartupworld) — Instagram Tester can publish to own account in Development mode; App Review only for other users

### Tertiary (LOW confidence — flagged)
- Conflicting daily publish-limit numbers (25 vs 50 vs 100) across third-party guides — resolve via `content_publishing_limit` at runtime
- PNG-vs-JPEG real-world acceptance — verify empirically

## Metadata

**Confidence breakdown:**
- API publish flow (image/carousel/reel/poll): HIGH — official docs + multiple corroborating 2026 guides
- Auth model (Instagram Login, no Page, dev-mode tester, token refresh): HIGH — official docs + gist + dev-mode flow
- Cron + idempotency + schema: HIGH — direct mapping onto existing project primitives
- Exact rate limit + PNG/JPEG: MEDIUM — flagged as open questions
- Validation framework specifics: MEDIUM — assumed Vitest, confirm config

**Research date:** 2026-06-21
**Valid until:** ~2026-07-21 (Meta Graph API moves fast — re-verify version pin + scopes + limits if planning slips a month)
