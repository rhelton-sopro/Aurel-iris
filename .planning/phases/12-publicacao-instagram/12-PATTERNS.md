# Phase 12: publicacao-instagram - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 9 new/modified
**Analogs found:** 9 / 9 (every new file has a strong in-repo analog — this phase is ~90% wiring existing primitives)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0049_social_posts_publishing.sql` (new) | migration | transform (schema + claim RPC) | `0045_social_posts.sql` (table style) + `0040_..._consume_atomic.sql` (SECURITY DEFINER claim RPC) | exact (style) + role-match (RPC) |
| `apps/web/lib/instagram/publish.ts` (new) | service / core lib | request-response (HTTP to Graph) + CRUD (claim/mark) | `apps/web/lib/billing/cron-jobs.ts` (job-fn shape, service-role loop, `.rpc()` claim) | role-match |
| `apps/web/lib/instagram/token.ts` (new) | service / config store | CRUD (read/write app_settings) + request-response (refresh/health HTTP) | `apps/web/lib/admin/client-report-config.ts` (app_settings read/write via service-role) | exact |
| `apps/web/app/api/cron/instagram-publish/route.ts` (new) | route (cron) | request-response (GET, Bearer auth) | `apps/web/app/api/cron/photo-ttl/route.ts` (hourly cron, CRON_SECRET timing-safe) | exact |
| `apps/web/lib/billing/cron-jobs.ts` OR new `instagram/token.ts` job called from `api/cron/daily/route.ts` (modified) | route (cron) + service | batch (sequenced jobs) | `apps/web/app/api/cron/daily/route.ts` (per-job `.catch`, sequential batch) | exact |
| `apps/web/app/admin/painel/actions.ts` (modified) | route (server action) | request-response (founder-gated mutation) | same file's `schedulePostAction` / `patch` (founder gate + service-role) | exact (self) |
| `apps/web/lib/admin/social-posts.ts` (modified) | model / types | — (type union + counts) | same file's `SocialPostStatus` union + `STATUS_TABS` + `isSocialPostStatus` + `fetchStatusCounts` | exact (self) |
| `apps/web/lib/admin/notifications-summary.ts` (modified) | service | CRUD (read-side aggregation) | same file's `countStuckPending` / `getAdminNotifications` | exact (self) |
| `apps/web/vercel.json` (modified) | config | — | same file's `crons[]` array | exact (self) |
| `apps/web/app/admin/page.tsx` (modified, optional) | component | — (render notification card) | same file's `cards[]` array | exact (self) |

---

## Pattern Assignments

### `apps/web/app/api/cron/instagram-publish/route.ts` (route, request-response)

**Analog:** `apps/web/app/api/cron/photo-ttl/route.ts` — hourly cron, identical auth gate. Copy this file almost verbatim; swap the worker call.

**Imports + route config** (lines 1-8):
```typescript
import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { purgeExpiredIrisPhotos } from '@/lib/capture/iris-photo-ttl'

export const runtime = 'nodejs'
export const maxDuration = 120 // sweep bounded; abaixo do teto PRO (800s)
```
For Phase 12: import `publishDuePosts` from `@/lib/instagram/publish`; keep `runtime='nodejs'`; bump `maxDuration` to ~120-300 (reel poll is bounded inside, PRO allows up to 800s — RESEARCH §"Vercel Cron").

**Cron auth gate — COPY EXACTLY** (lines 21-34, identical in `daily/route.ts` lines 31-43):
```typescript
const secret = process.env.CRON_SECRET
if (!secret) {
  console.error('[cron-photo-ttl] AUTH_REJECTED — CRON_SECRET não configurado')
  return NextResponse.json({ error: 'misconfigured' }, { status: 401 })
}
const provided =
  request.headers.get('authorization')?.replace(/^Bearer\s+/, '') ?? ''
const a = Buffer.from(provided)
const b = Buffer.from(secret)
if (a.length !== b.length || !timingSafeEqual(a, b)) {
  console.warn('[cron-photo-ttl] AUTH_REJECTED')
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}
```
Rename log tag to `[cron-instagram-publish]`. This is the V2-Auth control (RESEARCH §Security). Fail-closed + constant-time, NEVER accept `"Bearer undefined"`.

**Worker call + result shape** (lines 36-44):
```typescript
const result = await purgeExpiredIrisPhotos().catch((err) => ({
  ttl_purged: 0, catchup_purged: 0, errors: 1, error: String(err),
}))
console.info(`[cron-photo-ttl] SWEEP_COMPLETE ${JSON.stringify(result)}`)
return NextResponse.json({ ok: true, ...result })
```
Phase 12: `const result = await publishDuePosts().catch(...)` → `{ published, retried, failed, errors }`. NEVER log token values (RESEARCH §Security "redact token/secret").

---

### `apps/web/lib/instagram/publish.ts` (service / core lib, request-response + CRUD)

**Analog:** `apps/web/lib/billing/cron-jobs.ts` — the canonical "job function" shape: `server-only`, `createServiceClient()`, select-then-loop, `.rpc()` for the atomic step, structured `{ count, errors }` return, per-item `try/catch` so one failure doesn't abort the batch.

**Imports + module guard** (cron-jobs.ts lines 1-11):
```typescript
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
// ...
const RELEASE_BATCH_CAP = 500 // safety cap por execução
```
Phase 12: add `const GRAPH = 'https://graph.instagram.com/v23.0'` (pin version at plan time — RESEARCH Open Q#3). Use native `fetch` (no SDK — RESEARCH §Stack). Add `const SWEEP_CAP = 10`.

**Atomic claim via `.rpc()` + per-item loop + structured return** (cron-jobs.ts lines 21-56):
```typescript
export async function releaseExpiredReservations(): Promise<{ released: number; errors: number }> {
  const service = createServiceClient()
  const { data: expired, error } = await service
    .from('credit_reservations')
    .select('reading_id')
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .limit(RELEASE_BATCH_CAP)
  if (error) { console.error(...); return { released: 0, errors: 1 } }

  let released = 0; let errors = 0
  for (const r of expired ?? []) {
    const { error: rpcErr } = await service.rpc('release_reservation', { ... })
    if (rpcErr) { console.error(...); errors++; continue }
    released++
  }
  return { released, errors }
}
```
Phase 12 mapping — `publishDuePosts()`: call `service.rpc('claim_due_social_posts', { p_limit: SWEEP_CAP })` (the atomic claim, see migration below) → returns claimed rows. Then `for (const post of claimed) { await publishClaimed(post).catch(e => markError(post, e)) }`. `markError` does `service.from('social_posts').update({ status, publish_error, ... })`. RESEARCH §"Pattern 1" + §"Retryable vs Permanent" maps error codes to retryable (leave `agendado`, attempts<3) vs permanent (`erro`).

**Two-entry-point spine** (RESEARCH §Pattern 1 sketch — both cron and "publicar agora" call this lib):
```typescript
export async function publishDuePosts(): Promise<SweepResult> { /* claim → loop publishClaimed */ }
export async function publishPost(id: string): Promise<PublishResult> {
  // claim a SINGLE id via claim_one_social_post(id) RPC; null → already publishing/published (no-op)
}
```

**Graph calls (NEW external surface — no analog; from RESEARCH Patterns 2-5):**
- Carousel: per-slide `POST {GRAPH}/{ig-id}/media?is_carousel_item=true` → child ids → parent `media_type=CAROUSEL&children=...&caption=` → `media_publish`. Max 10; all cropped to slide-1 aspect.
- Reel: `media_type=REELS&video_url=...` → **MUST poll** `GET {GRAPH}/{containerId}?fields=status_code` until `FINISHED` (handle `ERROR`/`EXPIRED`) → `media_publish`. Poll loop bounded by `maxDuration`.
- Record: `GET {GRAPH}/{mediaId}?fields=id,permalink` → store `ig_media_id` + `ig_permalink`.
- Build media URLs from `NEXT_PUBLIC_SITE_URL` + stored relative `media` path — NEVER an externally-supplied absolute URL (RESEARCH §Security SSRF mitigation). Use `graph.instagram.com` ONLY (RESEARCH §Anti-Patterns).

---

### `apps/web/lib/instagram/token.ts` (service / config store, CRUD + request-response)

**Analog:** `apps/web/lib/admin/client-report-config.ts` — the canonical `app_settings` read/write-via-service-role module. Copy its shape exactly (untyped service client, `maybeSingle()` read with try/catch fallback, `upsert` with `onConflict:'key'`).

**Module guard + service client + key const** (lines 14-44):
```typescript
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const CLIENT_REPORT_SECTIONS_KEY = 'client_report_sections'

// app_settings ainda não está no Database type gerado → cliente untyped de propósito.
function serviceDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}
```
Phase 12: `export const INSTAGRAM_TOKEN_KEY = 'instagram_token'`. May reuse `createServiceClient()` from `@/lib/supabase/service` instead of inlining `serviceDb` (both patterns exist in repo; service.ts is the canonical one).

**Read with safe fallback** (lines 51-70):
```typescript
export async function getClientReportSections(): Promise<string[]> {
  try {
    const db = serviceDb()
    const { data } = await db.from('app_settings').select('value')
      .eq('key', CLIENT_REPORT_SECTIONS_KEY).maybeSingle()
    const value = (data as { value?: unknown } | null)?.value
    // ...validate...
  } catch (err) {
    console.error('[client-report-config] leitura falhou, usando default', err)
  }
  return [...CLIENT_REPORT_SECTIONS_DEFAULT]
}
```
Phase 12: `getValidToken()` reads `instagram_token` → `{ access_token, expires_at, obtained_at, last_refresh_at }` (jsonb value). NEVER log `access_token`.

**Write via upsert** (lines 76-87):
```typescript
const { error } = await db.from('app_settings').upsert(
  { key: CLIENT_REPORT_SECTIONS_KEY, value: clean, updated_at: new Date().toISOString() },
  { onConflict: 'key' },
)
if (error) throw new Error(error.message)
```
Phase 12: `refreshInstagramTokenIfNeeded()` — if `expires_at - now() < ~10 days`, call `GET {GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=...` → upsert new value. `healthCheck()` = `GET /me?fields=id`. Both called from `/api/cron/daily`. IG **user id** + **app secret/id** stay in Vercel env (stable), token in DB (rotating) — RESEARCH §Schema Additions.

---

### `apps/web/app/api/cron/daily/route.ts` (modified — append IG token job)

**Analog:** the file itself — per-job `.catch` so one failure doesn't abort the batch (lines 45-69):
```typescript
const results = {
  reservations: await releaseExpiredReservations().catch((err) => ({ released: 0, errors: 1, error: String(err) })),
  credits: await expireOldCredits().catch((err) => ({ expired: 0, error: String(err) })),
  // ...
}
console.info(`[cron-daily] BATCH_COMPLETE ${JSON.stringify(results)}`)
return NextResponse.json({ ok: true, ...results })
```
Phase 12: append `instagram_token: await refreshInstagramTokenIfNeeded().catch((err) => ({ refreshed: false, error: String(err) }))`. On refresh/health failure, surface via notifications (D-07), NOT a thrown error.

---

### `apps/web/app/admin/painel/actions.ts` (modified — add `publishNowAction`)

**Analog:** the file itself. Reuse the `requireFounder()` gate (lines 19-28) and the action shape. The "publicar agora" path runs in the founder's authenticated server context — NO CRON_SECRET, just `requireFounder()` (RESEARCH §Vercel Cron last bullet).

**Founder gate — REUSE** (lines 19-28):
```typescript
async function requireFounder(): Promise<ActionResult | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return { ok: false, error: 'Não autorizado.' }
  }
  return null
}
```

**Action shape — MIRROR `schedulePostAction`** (lines 71-80):
```typescript
export async function schedulePostAction(id: string, scheduledAtISO: string): Promise<ActionResult> {
  // validate ... return patch(id, { status: 'agendado', scheduled_at: ... })
}
```
Phase 12 — new `publishNowAction(id)`:
```typescript
export async function publishNowAction(id: string): Promise<ActionResult> {
  const denied = await requireFounder()
  if (denied) return denied
  if (!id) return { ok: false, error: 'Post inválido.' }
  const result = await publishPost(id) // shared core from lib/instagram/publish
  revalidatePath('/admin/painel')
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}
```
Note: `publishPost` lives in `lib/instagram/publish.ts`, imported here. Validate id is a uuid (RESEARCH §Security V5).

---

### `apps/web/lib/admin/social-posts.ts` (modified — extend status union + counts)

**Analog:** the file itself. RESEARCH §Schema flags this REQUIRED: add `'publicando' | 'erro'` to the union, `STATUS_TABS`, the `counts` init object in `fetchStatusCounts`, and the `isSocialPostStatus` guard.

**Union** (lines 14-19):
```typescript
export type SocialPostStatus =
  | 'pendente' | 'aprovado' | 'agendado' | 'publicado' | 'reprovado'
```
→ add `| 'publicando' | 'erro'`.

**Guard** (lines 56-64) and **counts init** (lines 92-98) and **`STATUS_TABS`** (lines 48-54) must ALL be extended in lockstep — MEMORY rule "Calibration: bump EVERY occurrence" applies (partial update is the #1 cause of bugs). Also add the new media-result fields (`ig_media_id`, `ig_permalink`, `ig_container_id`, `publish_error`, `publish_attempts`, `last_attempt_at`, `published_at`) to the `SocialPost` interface (lines 29-45).

---

### `apps/web/lib/admin/notifications-summary.ts` (modified — surface publish failures, D-04/D-07)

**Analog:** the file itself. D-04 explicitly says reuse `getAdminNotifications`. Add fields to `AdminNotifications` + a best-effort counter following `countStuckPending`.

**Interface + parallel aggregation** (lines 19-39):
```typescript
export interface AdminNotifications {
  unreadEmails: number; pendingRefunds: number; purchasesToday: number; stuckPending: number
}
export async function getAdminNotifications(): Promise<AdminNotifications> {
  const [unreadEmails, pendingRefunds, purchasesToday, stuckPending] = await Promise.all([
    getUnreadCount().catch(() => 0),
    countPendingRefunds().catch(() => 0),
    countPurchasesToday(...).catch(() => 0),
    countStuckPending(...).catch(() => 0),
  ])
  return { unreadEmails, pendingRefunds, purchasesToday, stuckPending }
}
```
Phase 12: add `publishErrors: number` (+ optional `instagramAuthError: boolean`). Add to the `Promise.all` with `.catch(() => 0)` (best-effort — never break /admin).

**Count-by-status helper — MIRROR `countStuckPending`** (lines 42-50):
```typescript
async function countStuckPending(beforeISO: string): Promise<number> {
  const service = createServiceClient()
  const { count } = await service
    .from('customer_credits')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending').lt('created_at', beforeISO)
  return count ?? 0
}
```
Phase 12: `countPublishErrors()` → `social_posts` where `status = 'erro'`, `head: true`. Auth error can be a flag read from `app_settings` health-check state.

---

### `apps/web/app/admin/page.tsx` (modified — render publish-error card, optional UI)

**Analog:** the file itself, `cards[]` array (lines 72-82):
```typescript
{ label: 'Compras travadas (+2h)', count: notif.stuckPending, href: '/admin/relatorios', alert: notif.stuckPending > 0 },
```
Phase 12: append `{ label: 'Falhas de publicação', count: notif.publishErrors, href: '/admin/painel?status=erro', alert: notif.publishErrors > 0 }`.

---

### `apps/web/vercel.json` (modified — append cron)

**Analog:** the file itself (lines 9-12):
```json
"crons": [
  { "path": "/api/cron/daily", "schedule": "0 5 * * *" },
  { "path": "/api/cron/photo-ttl", "schedule": "0 * * * *" }
]
```
Phase 12: append `{ "path": "/api/cron/instagram-publish", "schedule": "0 * * * *" }`. (D-01: hourly; PRO plan allows it.)

---

### `supabase/migrations/0049_social_posts_publishing.sql` (new)

**Analog A — table/column/index + idempotent header style:** `0045_social_posts.sql`.
**Analog B — SECURITY DEFINER claim RPC:** `0040_phase_8_consume_atomic_and_release_internal_fix.sql`.

**Header + idempotency style** (0045 lines 1-13, 0040 lines 1-9): leading `-- 00XX: <name>` block explaining motive; `create ... if not exists`; `drop ... if exists`; "forward-only, db push is version-tracked not content-tracked" note (0040 line 6-7). Founder applies via `supabase db push --linked` (0040 line 9) — flag this as **[BLOCKING] supabase db push** in the plan.

**Column adds + CHECK extension + sweep index** (from RESEARCH §Schema Additions — proposed, planner finalizes):
```sql
alter table social_posts
  add column if not exists ig_media_id     text,
  add column if not exists ig_permalink    text,
  add column if not exists ig_container_id text,
  add column if not exists publish_error   text,
  add column if not exists publish_attempts int not null default 0,
  add column if not exists last_attempt_at  timestamptz,
  add column if not exists published_at     timestamptz;

alter table social_posts drop constraint if exists social_posts_status_check;
alter table social_posts add constraint social_posts_status_check
  check (status in ('pendente','aprovado','agendado','publicando','publicado','reprovado','erro'));

create index if not exists social_posts_due_idx
  on social_posts(status, scheduled_at)
  where status in ('agendado','publicando');
```
(The original CHECK is inline in 0045 line 21-22, so it has the auto-generated name `social_posts_status_check` — confirm at plan time via `information_schema` per MEMORY "Verify Supabase schema, not migration list".)

**SECURITY DEFINER claim RPC — mirror 0040 function shape** (0040 lines 30-49 show the `create or replace function ... returns ... language plpgsql security definer as $$ ... update ... where status='active' returning * into ...; if not found then return false;`):
```sql
create or replace function public.claim_due_social_posts(p_limit int default 10)
returns setof social_posts
language plpgsql security definer as $$
begin
  return query
  update social_posts
     set status = 'publicando', last_attempt_at = now(),
         publish_attempts = publish_attempts + 1, updated_at = now()
   where id in (
     select id from social_posts
      where status = 'agendado' and scheduled_at <= now() and publish_attempts < 3
      order by scheduled_at
      for update skip locked
      limit p_limit)
  returning *;
end; $$;
```
The atomic `update ... where status='agendado' ... returning *` is the idempotency gate (RESEARCH §Idempotency): a `publicado` row can never be re-claimed; concurrent runs get disjoint rows via `for update skip locked`. Add a companion `claim_one_social_post(p_id uuid)` for "publicar agora" and a reaper (rows in `publicando` older than ~15min → back to `agendado`). Call via `service.rpc('claim_due_social_posts', { p_limit: 10 })`.

---

## Shared Patterns

### Cron Bearer auth (V2-Auth)
**Source:** `apps/web/app/api/cron/photo-ttl/route.ts` lines 21-34 (identical in `daily/route.ts` lines 31-43)
**Apply to:** `api/cron/instagram-publish/route.ts`
Fail-closed + `timingSafeEqual`; CRON_SECRET already configured on the project. The "publicar agora" server action does NOT use this — it uses `requireFounder()`.

### Service-role DB access (RLS bypass)
**Source:** `apps/web/lib/supabase/service.ts` `createServiceClient()` (lines 17-33)
**Apply to:** `lib/instagram/publish.ts`, `lib/instagram/token.ts`, all `social_posts`/`app_settings` reads/writes from server jobs
`'server-only'` import guard at top of every module; NEVER import in a client component.

### Founder gate (server actions)
**Source:** `apps/web/app/admin/painel/actions.ts` `requireFounder()` lines 19-28 (uses `isFounderEmail` from `@/lib/auth/founder`)
**Apply to:** `publishNowAction`
Returns `ActionResult | null`; defense-in-depth on top of middleware/layout gating.

### `app_settings` config store (rotating secrets)
**Source:** `apps/web/lib/admin/client-report-config.ts` (read lines 51-70, write lines 76-87) + migration `0048_app_settings.sql` (RLS-on, no-policy → service-role only)
**Apply to:** `lib/instagram/token.ts` — store the rotating IG token here (NOT a Vercel env var, which can't be rewritten at runtime).

### Best-effort notification aggregation
**Source:** `apps/web/lib/admin/notifications-summary.ts` `getAdminNotifications` lines 26-39 + `countStuckPending` lines 42-50
**Apply to:** publish-error + IG-auth-error signals (D-04/D-07). Each source `.catch(() => 0)` — never break /admin.

### Idempotent job-function shape
**Source:** `apps/web/lib/billing/cron-jobs.ts` lines 21-56 (select/`.rpc()` claim → per-item loop with `try/catch`/`continue` → structured `{ count, errors }` return)
**Apply to:** `publishDuePosts()` in `lib/instagram/publish.ts`. The atomic step is the `claim_due_social_posts` RPC (no supabase-js transaction API — RESEARCH §Idempotency).

---

## No Analog Found

| Surface | Role | Data Flow | Reason / Mitigation |
|---------|------|-----------|---------------------|
| Meta Graph REST calls (container → poll → media_publish, token exchange/refresh, health-check) | external HTTP | request-response | Genuinely new external surface — no in-repo analog. Build from RESEARCH §Patterns 2-5 + §Token Lifecycle with raw `fetch` (no SDK). The closest in-repo precedent for "raw fetch to a third-party REST API" is the Asaas/MP webhook code (uses native `fetch`), but the call shapes differ entirely. |

Everything else maps to a concrete in-repo analog above.

## Metadata

**Analog search scope:** `apps/web/app/api/cron/`, `apps/web/lib/admin/`, `apps/web/lib/supabase/`, `apps/web/lib/billing/`, `apps/web/app/admin/painel/`, `supabase/migrations/`
**Files scanned:** ~12 (4 deep-read cron/service/config, 4 self-modify analogs, 2 migration styles, vercel.json, admin/page.tsx)
**Next migration number:** `0049` (highest existing is `0048`)
**Pattern extraction date:** 2026-06-21
