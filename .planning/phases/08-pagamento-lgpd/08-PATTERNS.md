# Phase 8: Pagamento (Asaas pré-pago) + LGPD core — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 28 new / 5 modified
**Analogs found:** 26 / 28 (2 greenfield — Asaas client lib, audit-vocabulary insert helper)

This map tells the planner which existing file each new file should mirror, and gives concrete excerpts to copy from. **Most of Phase 8 is plumbing on top of patterns already proven in prod** (migrations, server actions, webhook idempotency, Resend notifications, Gotenberg PDF, RLS founder bypass, gates). The single greenfield is the **Asaas REST client + webhook auth** (different contract than Modal HMAC).

---

## File Classification

### Migrations (4 new — Wave 1)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `supabase/migrations/0035_phase_8_billing_lgpd_schema.sql` | migration | DDL additive | `0028_report_findings.sql` + `0033_therapist_invites_and_client_email_unique.sql` | exact (additive, idempotent, comments, RLS) |
| `supabase/migrations/0036_phase_8_billing_lgpd_rls.sql` | migration | DDL grants/policies | `0020_consent_infra.sql` (lines 102-154) | exact |
| `supabase/migrations/0037_phase_8_helper_functions.sql` | migration | DDL functions | `0030_report_persistence_rpcs.sql` (recent precedent) + 0020 partial unique index | role-match |
| `supabase/migrations/0038_phase_8_seed_packages.sql` | migration | DDL seed | none in repo (founder seeds via script for `consent_terms`); use `0028` comment style + INSERT … ON CONFLICT DO NOTHING | role-match |

> Note: planner may consolidate into fewer files; structure above mirrors how Fase 1 split schema / grants / functions. Numbering picks up from `0034_invite_notify_on_capture.sql` (latest applied).

### Asaas integration (5 new — Wave 1+2)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `apps/web/lib/asaas/client.ts` | service | request-response (REST out) | `apps/web/lib/notifications/notify-therapist-capture-complete.ts` (Resend fetch direct) | role-match (fetch direct, no SDK) |
| `apps/web/lib/asaas/webhook-auth.ts` | utility | crypto | `apps/web/lib/vision/hmac.ts` | role-match (different algorithm — shared secret vs HMAC) |
| `apps/web/lib/asaas/types.ts` | utility | types/zod | `apps/web/app/api/vision/webhook/route.ts` (envelope schema lines 64-79) | role-match |
| `apps/web/lib/asaas/idempotency.ts` | utility | DB dedup | `apps/web/lib/invite/tokens.ts` (markTokenUsed with `.is('used_at', null)` idempotent UPDATE) | role-match |
| `apps/web/app/api/asaas/webhook/route.ts` | api route | event-driven webhook | `apps/web/app/api/vision/webhook/route.ts` | exact (webhook + idempotency + status guard + service-role UPDATE) |

### Credit ledger + trial (8 new — Wave 2+3)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `apps/web/lib/billing/credits.ts` | service | DB transaction (SELECT FOR UPDATE) | `apps/web/app/actions/admin-therapists.ts:182-225` (atomic guard + service client) + `apps/web/lib/invite/tokens.ts:markTokenUsed` | role-match (no exact FOR UPDATE precedent in repo) |
| `apps/web/lib/billing/reservations.ts` | service | DB lifecycle (status state machine) | `apps/web/app/api/vision/webhook/route.ts:152-208` (status guard + atomic UPDATE) | role-match |
| `apps/web/lib/billing/trial.ts` | service | DB read + state check | `apps/web/lib/gates/profile-completeness.ts` (pure, testable, single source of truth) | role-match (logic is pure; state-read uses service client) |
| `apps/web/lib/billing/config.ts` | utility | constants | `apps/web/lib/beta/config.ts` (`BETA_READING_CAP`) + `apps/web/lib/consent/tos.ts` (`TOS_VERSION`) | exact |
| `apps/web/app/actions/billing.ts` | server action | 'use server' + zod | `apps/web/app/actions/admin-therapists.ts` (inviteTherapistAction: founder gate + zod + service client + revalidatePath) | exact |
| `apps/web/app/actions/billing.schemas.ts` | utility | zod schemas | `apps/web/app/actions/readings.schemas.ts` (planner pattern of co-located `.schemas.ts`) | exact |
| `apps/web/lib/billing/__tests__/credits.test.ts` + `reservations.test.ts` + `trial.test.ts` + `race.test.ts` | tests | vitest | `apps/web/lib/gates/profile-completeness.test.ts` (pure unit) + `apps/web/app/actions/therapist-invites.test.ts` (action integration) | role-match |
| `apps/web/app/actions/__tests__/billing.test.ts` | tests | vitest | `apps/web/app/actions/admin-therapists.test.ts` | exact |

### Anti-fraud CPF (3 new — Wave 1)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `apps/web/lib/auth/cpf.ts` | utility | pure validation | `apps/web/lib/gates/profile-completeness.ts:computeAge` (pure, testable, no side effects) + `apps/web/lib/profile/fields.ts:phoneIsValidBR` | exact |
| `apps/web/lib/auth/__tests__/cpf.test.ts` | tests | vitest | `apps/web/lib/gates/profile-completeness.test.ts` | exact |
| `apps/web/app/actions/__tests__/signup-cpf-dedup.test.ts` (modify signup flow) | tests | integration | `apps/web/app/actions/admin-therapists.test.ts` (D-DUPE pattern, listUsers check) | role-match |

### LGPD-01 termo biométrico (5 new — Wave 4)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `apps/web/lib/consent/hydrate-term.ts` | utility | template substitution + sha256 | `apps/web/lib/pdf/report-print-document.tsx:renderCoverHtml/renderBodyHtml` (template prop hydration) | role-match |
| `apps/web/lib/consent/sign.ts` | service | DB append-only INSERT | `apps/web/app/actions/invites.ts:165-201` (createServiceClient + client_consents INSERT with `consent_channel` + term_version) | exact |
| `apps/web/app/api/consent/generate-pdf/route.ts` | api route | request-response (Gotenberg fetch) | `apps/web/app/api/readings/[id]/pdf/route.tsx` | exact (Gotenberg form/chromium/convert/html + storage upload pattern) |
| `apps/web/app/actions/consent.ts` (signTermAction) | server action | 'use server' + zod | `apps/web/app/actions/invites.ts:completeInviteNewClientAction` (token-validated public path + service-role + client_consents INSERT) | exact |
| `apps/web/scripts/seed-consent-term-v1.mjs` | script | one-shot seed | none in repo for `consent_terms`; use `apps/web/scripts/audit-vocabulary.mjs` style + `0020` comment on `is_current` flip | role-match |

### LGPD-02/03/05/06 pages + audit log (4 new — Wave 4)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `apps/web/app/privacidade/page.tsx` (modify — add deletion section) | page | static | `apps/web/app/privacidade/page.tsx` (existing) | extend existing |
| `apps/web/lib/audit/log.ts` | service | append-only INSERT | `supabase/migrations/0023_capture_attempts.sql` schema (decoupled, no FK) + `apps/web/lib/notifications/notify-therapist-capture-complete.ts` (best-effort, non-blocking) | role-match |
| `apps/web/lib/audit/events.ts` | utility | event type constants | `apps/web/lib/beta/config.ts` (single source of truth pattern) | exact |
| `apps/web/lib/audit/__tests__/log.test.ts` | tests | vitest | `apps/web/lib/gates/profile-completeness.test.ts` | role-match |

### UI surfaces (6 new — Wave 5)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `apps/web/app/assinatura/comprar/page.tsx` | page | server component | `apps/web/app/privacidade/page.tsx` (server static) + `apps/web/components/clientes/InviteLinkDialog.tsx` (dialog modal for selection) | role-match |
| `apps/web/components/billing/PackageCard.tsx` | component | server/client mixed | `apps/web/components/clientes/InviteLinkDialog.tsx` (card + button + isPending toast) | role-match |
| `apps/web/components/billing/CreditsBalanceWidget.tsx` | component | server data fetch | existing dashboard cards (planner finds in `/components/dashboard/*`) | role-match |
| `apps/web/components/billing/ReservationsList.tsx` | component | server data + cancel action | existing list components mirroring InviteLinkDialog UX | role-match |
| `apps/web/components/billing/TermoBiometricoStep.tsx` | component | client checkbox + redirect | `apps/web/app/(auth)/signup/page.tsx` (checkbox `tosAccepted` + state lifecycle) + `apps/web/components/clientes/InviteLinkDialog.tsx:184-200` (checkbox + label + helper text) | role-match |
| `apps/web/components/billing/__tests__/PackageCard.test.tsx` etc. | tests | RTL | none yet; planner may skip per founder convention (founder UATs UI) | — |

### Cron + middleware gate (3 new — Wave 5)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `apps/web/app/api/cron/daily/route.ts` | api route | scheduled batch | `apps/web/app/api/vision/webhook/route.ts` (auth check + status guard + atomic UPDATE) — adapt to bearer token | role-match |
| `apps/web/vercel.json` (modify) | config | cron schedule | no precedent file in repo — create new in `apps/web/` (Vercel project root) | greenfield |
| `apps/web/middleware.ts` (modify) | middleware | route gate | existing (lines 1-87) — add credit-gate to /leituras/nova/*, termo-gate to /convite/* | extend existing |

### Modified files

| Modified File | What Changes | Pattern Source |
|---------------|-------------|----------------|
| `apps/web/app/actions/readings.ts` (lines 47-138 `createReadingAction`) | replace `BETA_READING_CAP` check with `reserveCreditForReading()` call | own file (lines 73-84 swap-in-place) |
| `apps/web/app/actions/invites.ts` (lines 40-90 `createInviteTokenAction`) | add credit + termo gate before INSERT | own file (validation already structured for early returns) |
| `apps/web/app/api/readings/[id]/analyze/route.ts` (lines 84-100) | add reservation→consume conversion at start; tap `notification_sent_at` already there | own file |
| `apps/web/app/(auth)/signup/page.tsx` (lines 27-80) | add CPF input + dedup error handling | own file (mirror `phone` field) |
| `apps/web/middleware.ts` (lines 9-50) | add `/assinatura/comprar` to PROTECTED_PATHS; add credit-gate query | own file (extend profile-gate block lines 53-71) |

---

## Pattern Assignments

### `supabase/migrations/0035_phase_8_billing_lgpd_schema.sql` (migration, DDL)

**Analog:** `supabase/migrations/0028_report_findings.sql` (recent, well-commented) + `supabase/migrations/0033_therapist_invites_and_client_email_unique.sql` (alter table + UNIQUE constraint).

**Comment header pattern** (0028 lines 1-37, copy structure verbatim):
```sql
-- 0035_phase_8_billing_lgpd_schema.sql
--
-- Fase 8 | Pagamento (Asaas pré-pago) + LGPD core
--
-- CONTEXTO:
--   Cria o esqueleto de monetização — 4 SKUs, créditos por terapeuta, FIFO,
--   reservas 7d, trial 3-OR-60d first-wins, arrependimento 7d. Webhook
--   Asaas (PAYMENT_RECEIVED) credita; cron daily libera reservas expiradas
--   + expira créditos 12m + envia avisos.
--
-- Strictly additive. Zero DROP. Pre-existentes (profiles.subscription_status,
-- profiles.trial_ends_at de Fase 1) ficam deprecated-by-disuse — não tocadas
-- aqui (drop futuro em V1.1+ migration).
--
-- Mudanças (idempotent — create table IF NOT EXISTS + add column IF NOT EXISTS):
--   1. credit_packages (catálogo) — 4 SKUs seedados na 0038.
--   2. customer_credits (saldo por compra) — payment-id UNIQUE, FIFO via purchase_date.
--   3. credit_transactions (event log decoupled, sem FK em reading_id — mirror 0017).
--   4. credit_reservations (lifecycle active/converted/released/expired).
--   5. trial_status (1 row por user_id, first-wins).
--   6. asaas_webhook_events (idempotency dedup via event_id PK).
--   7. audit_events (LGPD-04 básico append-only).
--   8. profiles: add asaas_customer_id, cpf, internal_use, tos_accepted_at, tos_version.
```

**Table + columns + indexes pattern** (0028 lines 38-115 — copy idiom; especially the partial unique index at line 99-103):
```sql
create table if not exists public.customer_credits (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete cascade not null,
  -- (... ver D-20 + RESEARCH.md §Credit Ledger Architecture)
  asaas_payment_id    text unique,
  check (leituras_remaining + leituras_reserved <= leituras_purchased)
);

-- Partial unique: 1 reservation 'active' por reading_id
create unique index if not exists credit_reservations_one_active_per_reading
  on public.credit_reservations (reading_id) where status = 'active';

-- Hot query: saldo ativo do user em FIFO order
create index if not exists customer_credits_user_active_idx
  on public.customer_credits (user_id, status, expires_at)
  where status = 'active';
```

**COMMENT pattern** (0028 lines 86-96 — copy idiom: `comment on table … is '…';` with verbose decision context):
Every new table + column gets a `comment on …` explaining the decision and link to CONTEXT.md D-NN.

**Alter table additive idiom** (0033 lines 92-97 — extends `clients`):
```sql
alter table public.profiles add column if not exists asaas_customer_id text;
alter table public.profiles add column if not exists internal_use boolean not null default false;
alter table public.profiles add column if not exists cpf text;
alter table public.profiles add column if not exists tos_accepted_at timestamptz;
alter table public.profiles add column if not exists tos_version text;
create unique index if not exists profiles_cpf_unique_idx on public.profiles (cpf) where cpf is not null;
create unique index if not exists profiles_asaas_customer_unique_idx on public.profiles (asaas_customer_id) where asaas_customer_id is not null;
```

---

### `supabase/migrations/0036_phase_8_billing_lgpd_rls.sql` (migration, RLS policies)

**Analog:** `supabase/migrations/0020_consent_infra.sql:102-154` (terapeuta-sees-own + founder bypass).

**Self-read policy pattern** (0020 lines 110-115):
```sql
alter table public.customer_credits enable row level security;

drop policy if exists "customer_credits_self_read" on public.customer_credits;
create policy "customer_credits_self_read"
  on public.customer_credits for select to authenticated
  using (user_id = auth.uid());
```

**Founder bypass pattern** (0020 lines 117-123 — verbatim; required on every new table):
```sql
drop policy if exists "founder_full_access" on public.customer_credits;
create policy "founder_full_access"
  on public.customer_credits for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');
```

> Per memory `feedback_supabase_rls_no_auth_users`: **never query `auth.users` from RLS**; use `auth.jwt() ->> 'email'`. Founder email is hard-coded (literal string match) — same idiom as 0011/0017/0023.

**EXISTS-join pattern for self-via-parent** (0020 lines 130-143 — `client_consents` via `clients.therapist_id`):
Use this when a child table doesn't have user_id directly. Not needed for Phase 8 tables (all have user_id), but useful for `credit_transactions` if planner adds session-side visibility.

**No-policy + service-role only** (0033 lines 62-68 — `therapist_invites`):
Apply to `asaas_webhook_events` and `audit_events` (founder-only read via `founder_full_access`; INSERT exclusively via service-role from webhook/cron). No `authenticated` policy = blocked.

---

### `apps/web/lib/asaas/webhook-auth.ts` (utility, crypto — shared secret)

**Analog:** `apps/web/lib/vision/hmac.ts` (HMAC version) — adapt to **shared secret simple comparison** (Asaas uses `asaas-access-token` header, not HMAC).

**Discriminated union return pattern** (hmac.ts lines 24-33 — copy verbatim shape):
```typescript
export type AsaasWebhookAuthResult =
  | { valid: true }
  | { valid: false; reason: 'missing_token' | 'invalid_token' | 'misconfigured' }
```

**Timing-safe compare** (hmac.ts lines 91-103 — adapt to no-HMAC):
```typescript
import 'server-only'
import { timingSafeEqual } from 'node:crypto'

export function verifyAsaasToken(
  providedHeader: string | null | undefined,
  expectedSecret: string | undefined,
): AsaasWebhookAuthResult {
  if (!expectedSecret) return { valid: false, reason: 'misconfigured' }
  if (!providedHeader) return { valid: false, reason: 'missing_token' }
  const a = Buffer.from(providedHeader)
  const b = Buffer.from(expectedSecret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: 'invalid_token' }
  }
  return { valid: true }
}
```

**Why NOT reuse hmac.ts directly** (per RESEARCH.md §HMAC/Token line 279): Asaas doesn't sign body; it just sends a configured shared secret in `asaas-access-token` header. Different contract = different file.

---

### `apps/web/app/api/asaas/webhook/route.ts` (api route, event-driven webhook)

**Analog:** `apps/web/app/api/vision/webhook/route.ts` (full structure — header comment, runtime, schema, gates, status guard, atomic update, revalidatePath).

**Header docstring pattern** (vision/webhook lines 1-37 — copy structure; replace Modal-specific bullets with Asaas):
```typescript
/**
 * POST /api/asaas/webhook
 *
 * Asaas payment events. Receives PAYMENT_CREATED / PAYMENT_CONFIRMED /
 * PAYMENT_RECEIVED / PAYMENT_REFUNDED / PAYMENT_PARTIALLY_REFUNDED /
 * PAYMENT_CHARGEBACK_REQUESTED with shared-secret token in
 * `asaas-access-token` header.
 *
 * Contract:
 *   - 401: token missing / mismatch / misconfigured.
 *   - 400: body shape invalid (Zod envelope failure).
 *   - 200 (success): customer_credits row UPSERT'd; revalidatePath('/assinatura').
 *   - 200 (no-op):   event.id already in asaas_webhook_events (idempotent dup).
 *
 * Idempotency strategy:
 *   - PRIMARY barrier: asaas_webhook_events.event_id is PK (UNIQUE). INSERT
 *     conflict = 23505 → return 200 no-op (don't re-process).
 *   - State machine on customer_credits.status absorbs out-of-order events
 *     (RESEARCH §Idempotency Pitfall #1).
 *
 * Security:
 *   - asaas-access-token timing-safe compare via lib/asaas/webhook-auth.
 *   - request.text() read FIRST so the raw body matches Zod parse step.
 *   - Service-role client used for all writes (no terapeuta session).
 *   - Defensive: ALWAYS .eq('user_id', externalReference_user_id) on writes
 *     to avoid service-role cross-tenant accidents (memory pitfall #9).
 */
```

**Runtime + body-read + auth pattern** (vision/webhook lines 87-115 — copy idiom):
```typescript
export const runtime = 'nodejs'

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text()  // raw FIRST, before parse
  const token = request.headers.get('asaas-access-token')
  const result = verifyAsaasToken(token, process.env.ASAAS_WEBHOOK_TOKEN)
  if (!result.valid) {
    console.warn(`[asaas-webhook] auth rejected: ${result.reason}`)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
  // (... zod parse → idempotency check → state machine dispatch ...)
```

**Idempotency check (INSERT-then-return) pattern** (per RESEARCH §Idempotency line 287; analog: `lib/invite/tokens.ts:markTokenUsed` uses `.is('used_at', null)` as the same idempotent guard idiom):
```typescript
const service = createServiceClient()
const { error: dedupErr } = await service
  .from('asaas_webhook_events')
  .insert({ event_id: parsed.id, event_type: parsed.event, payment_id: parsed.payment?.id, payload: parsed })
  // PG returns 23505 on duplicate event_id PK
if (dedupErr?.code === '23505') {
  console.info(`[asaas-webhook] idempotent skip event=${parsed.id}`)
  return NextResponse.json({ ok: true, noop: 'idempotent' })
}
```

**Status guard double-check pattern** (vision/webhook lines 152-208 — copy idiom: SELECT for state, UPDATE with .eq on previous status to prevent race):
```typescript
// Adapt for customer_credits.status state machine
const { error: updateErr } = await service
  .from('customer_credits')
  .update({ status: 'active', leituras_remaining: pkg.leituras_count, expires_at: now12m })
  .eq('id', creditId)
  .eq('status', 'pending')  // double-guard at SQL level
```

**Best-effort revalidatePath + structured log** (vision/webhook lines 215-220):
```typescript
revalidatePath('/assinatura')
console.info(`[asaas-webhook] applied event=${parsed.id} type=${parsed.event} payment=${parsed.payment?.id}`)
return NextResponse.json({ ok: true })
```

**Cross-tenant safety note** (memory pitfall #9 — repeated):
Every `.update()` / `.select()` against `customer_credits` MUST filter `.eq('user_id', ...)` explicitly. Service-role bypasses RLS. Code-review focus on this file.

---

### `apps/web/lib/asaas/client.ts` (service, REST out via fetch)

**Analog:** `apps/web/lib/notifications/notify-therapist-capture-complete.ts` (fetch direct, no SDK, env-driven, structured log, non-fatal on failure).

**Fetch direct pattern** (notify-therapist-capture-complete lines 128-157 — copy idiom):
```typescript
import 'server-only'

const ASAAS_API_BASE_URL = process.env.ASAAS_API_BASE_URL ?? 'https://api.asaas.com/v3'

async function asaasRequest<T>(
  path: string,
  init: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const apiKey = process.env.ASAAS_API_KEY
  if (!apiKey) return { ok: false, status: 500, error: 'ASAAS_API_KEY missing' }
  try {
    const res = await fetch(`${ASAAS_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        access_token: apiKey,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[asaas] ${path} HTTP ${res.status} — ${detail.slice(0, 300)}`)
      return { ok: false, status: res.status, error: detail.slice(0, 300) }
    }
    return { ok: true, data: (await res.json()) as T }
  } catch (err) {
    console.error(`[asaas] ${path} fetch failed:`, err instanceof Error ? err.message : err)
    return { ok: false, status: 0, error: 'network' }
  }
}

export async function createAsaasCustomer(input: { ... }) { return asaasRequest<...>('/customers', { method: 'POST', body: JSON.stringify(input) }) }
export async function createAsaasPayment(input: { ... }) { ... }
export async function refundAsaasPayment(paymentId: string, body?: { value?: number; description?: string }) { ... }
```

> Per RESEARCH `## Don't Hand-Roll` and memory `feedback_auto_block_expensive_branches`: do NOT install the npm `asaas` package. Use `fetch()` direct.

---

### `apps/web/lib/asaas/types.ts` (utility, zod schemas)

**Analog:** `apps/web/app/api/vision/webhook/route.ts:64-79` (zod envelope with `superRefine` for conditional required fields).

**Envelope schema pattern** (vision/webhook lines 64-79 — copy idiom):
```typescript
import { z } from 'zod'

export const asaasPaymentSchema = z.object({
  id: z.string().min(1),
  customer: z.string().min(1),
  value: z.number().positive(),
  netValue: z.number().optional(),
  billingType: z.enum(['UNDEFINED', 'PIX', 'BOLETO', 'CREDIT_CARD']),
  status: z.string().min(1),  // PENDING|RECEIVED|CONFIRMED|REFUNDED|...
  externalReference: z.string().uuid().nullable().optional(),
  paymentDate: z.string().nullable().optional(),
}).passthrough()  // Asaas may add fields; don't reject

export const asaasWebhookEnvelopeSchema = z.object({
  id: z.string().min(1),  // event.id — idempotency key
  event: z.enum([
    'PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED',
    'PAYMENT_OVERDUE', 'PAYMENT_DELETED',
    'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED',
    'PAYMENT_CHARGEBACK_REQUESTED',
  ]),
  dateCreated: z.string().min(1),
  payment: asaasPaymentSchema,
})

export type AsaasWebhookEnvelope = z.infer<typeof asaasWebhookEnvelopeSchema>
```

---

### `apps/web/app/actions/billing.ts` (server action, 'use server' + zod)

**Analog:** `apps/web/app/actions/admin-therapists.ts:inviteTherapistAction` (founder/auth gate + zod validate + dedupe check + service-role INSERT + structured log + revalidatePath).

**Module header rule** (admin-therapists lines 1-2 — verbatim required per memory `feedback_use_server_export_hygiene`):
```typescript
'use server'
import 'server-only'
```
**Only export async functions.** Move types/consts to a sibling `.schemas.ts` or `lib/billing/`.

**Auth gate + zod pattern** (admin-therapists lines 41-92 — copy idiom):
```typescript
export async function createChargeAction(
  packageSku: string,
): Promise<{ ok: boolean; invoiceUrl?: string; error?: string }> {
  // 1. Session gate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  // 2. Zod validate (use billing.schemas.ts)
  const parsed = createChargeSchema.safeParse({ sku: packageSku })
  if (!parsed.success) return { ok: false, error: 'SKU inválido.' }

  // 3. SELECT package + verify active (RLS allows authenticated to read credit_packages)
  const { data: pkg } = await supabase.from('credit_packages').select('*').eq('sku', parsed.data.sku).eq('active', true).maybeSingle()
  if (!pkg) return { ok: false, error: 'Pacote não encontrado.' }

  // 4. createAsaasCustomer (if profile.asaas_customer_id null) + createAsaasPayment
  const service = createServiceClient()
  // (...)

  // 5. INSERT customer_credits as pending; webhook will activate
  await service.from('customer_credits').insert({ user_id: user.id, package_id: pkg.id, ... status: 'pending' })

  // 6. Audit log
  await logAuditEvent({ actor_user_id: user.id, event_type: 'credit.purchase_initiated', target_type: 'credit', metadata: { sku, asaas_payment_id } })

  // 7. revalidatePath
  revalidatePath('/assinatura')
  return { ok: true, invoiceUrl: payment.invoiceUrl }
}
```

**Service-role bypass commentary** (admin-therapists lines 19-21 — keep this idiom of explaining WHY service is needed):
```typescript
// Service client porque customer_credits INSERT acontece dentro de RLS
// self-insert policy, mas o webhook handler tem que escrever sem session.
```

---

### `apps/web/lib/billing/credits.ts` (service, FIFO consume + SELECT FOR UPDATE)

**Analog:** No direct precedent in repo for `SELECT FOR UPDATE`. Closest patterns:
- `apps/web/app/actions/admin-therapists.ts:182-225` (multi-step service-role operation with explicit error returns)
- `apps/web/lib/invite/tokens.ts:markTokenUsed` (idempotent UPDATE via `.is('used_at', null)` WHERE guard)
- `supabase/migrations/0028_report_findings.sql:96-103` (partial unique index as defense)

**Structure pattern** (mix admin-therapists + invite/tokens — pure async function with structured return):
```typescript
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type ReserveCreditResult =
  | { ok: true; source: 'internal' | 'trial' | 'credit'; credit_id?: string; reservation_id: string }
  | { ok: false; reason: 'no_balance' | 'consent_missing' | 'concurrent_race' | 'db_error'; error?: string }

export async function reserveCreditForReading(
  userId: string,
  readingId: string,
): Promise<ReserveCreditResult> {
  // 1. Internal_use bypass (D-09)
  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('internal_use').eq('id', userId).maybeSingle()
  if (profile?.internal_use) {
    const { data: r } = await service.from('credit_reservations').insert({ user_id: userId, credit_id: null, reading_id: readingId, expires_at: ... }).select('id').single()
    return { ok: true, source: 'internal', reservation_id: r.id }
  }

  // 2. Trial check
  const inTrial = await isInTrial(userId)
  if (inTrial) {
    // Atomic increment trial_readings_used via UPDATE … WHERE used < max
    const { data: t, error } = await service.from('trial_status').update({ trial_readings_used: ... }).eq('user_id', userId).lt('trial_readings_used', 3).select('*').maybeSingle()
    if (!t) return { ok: false, reason: 'no_balance' }
    // INSERT reservation with credit_id=NULL
    return { ok: true, source: 'trial', reservation_id: ... }
  }

  // 3. FIFO credit consume — see SQL in RESEARCH §FIFO Consumption SQL
  //    Need to call a SQL function (0037 helper) because SELECT FOR UPDATE
  //    must run inside one TX; supabase-js can't chain that natively.
  const { data: result, error } = await service.rpc('fifo_reserve_credit', { p_user_id: userId, p_reading_id: readingId })
  // ...
}
```

> Per RESEARCH §FIFO Consumption SQL: the SELECT FOR UPDATE + UPDATE + INSERT triplet should live as a Postgres function in `0037_phase_8_helper_functions.sql`, called via `supabase.rpc('fifo_reserve_credit', ...)`. supabase-js can't express `FOR UPDATE` from TS directly.

**Constants imported from config** (billing/config.ts pattern from `beta/config.ts:1-4`):
```typescript
export const TRIAL_READINGS_MAX = 3 as const
export const TRIAL_DAYS = 60 as const
export const CREDIT_VALIDITY_DAYS = 365 as const  // 12 months ≈ 365
export const RESERVATION_DAYS = 7 as const
export const REFUND_WINDOW_DAYS = 7 as const
```

---

### `apps/web/lib/billing/trial.ts` (service, pure-ish state check)

**Analog:** `apps/web/lib/gates/profile-completeness.ts` (pure functions, exported as single source of truth, importable from both Zod and gate).

**Pure-helper pattern** (profile-completeness lines 55-76 — copy idiom):
```typescript
export type TrialState =
  | { status: 'active'; readings_remaining: number; days_remaining: number }
  | { status: 'ended'; reason: 'readings_exhausted' | 'days_elapsed' }
  | { status: 'no_trial' }  // user has credits but trial never started or already ended

export function evaluateTrial(
  trial: { trial_started_at: string; trial_expires_at: string; trial_readings_used: number; trial_readings_max: number; ended_at: string | null } | null,
  now: Date = new Date(),
): TrialState {
  if (!trial) return { status: 'no_trial' }
  if (trial.ended_at) return { status: 'ended', reason: ... }
  if (new Date(trial.trial_expires_at) <= now) return { status: 'ended', reason: 'days_elapsed' }
  if (trial.trial_readings_used >= trial.trial_readings_max) return { status: 'ended', reason: 'readings_exhausted' }
  return { status: 'active', readings_remaining: ..., days_remaining: ... }
}
```

The async wrapper `isInTrial(userId)` lives in `billing/credits.ts` (DB-side) and calls `evaluateTrial(row)`.

---

### `apps/web/lib/auth/cpf.ts` (utility, pure CPF módulo-11)

**Analog:** `apps/web/lib/gates/profile-completeness.ts:computeAge` (pure, regex parse, no Date math libs) + `apps/web/lib/profile/fields.ts:phoneIsValidBR` (pure validation).

**Pure module-11 pattern** (profile/fields.ts:67-70 style — short, defensive, tested):
```typescript
// Pure, no dep, no server-only — usable in client form mask + server zod
export function cpfDigits(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '')
}

export function formatCpfBR(v: string): string {
  const d = cpfDigits(v).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function isValidCpf(v: string | null | undefined): boolean {
  const clean = cpfDigits(v)
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false  // rejects 111…111 etc.
  // módulo-11 (RESEARCH lines 698-718 has the canonical algorithm)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i)
  let mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  if (mod !== parseInt(clean[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i)
  mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  return mod === parseInt(clean[10])
}
```

**23505 dedup handling pattern** (admin-therapists lines 84-92 — for `inviteTherapistAction` dedupe; copy to signup flow CPF dedupe):
```typescript
// Modify signup action — when INSERT to profiles fails with PG 23505 on cpf:
if (error?.code === '23505' && error.message.includes('profiles_cpf_unique_idx')) {
  return { error: 'Já existe cadastro com este CPF. Faça login.' }
}
```

> Per memory `project_clients_unique_email_tech_debt`: this 23505 pattern is the established convention.

---

### `apps/web/lib/consent/sign.ts` (service, append-only INSERT)

**Analog:** `apps/web/app/actions/invites.ts:165-201` (`completeInviteNewClientAction` step 3 — reads current term, INSERTs client_consents).

**INSERT pattern** (invites lines 184-201 — copy verbatim with new fields):
```typescript
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export async function signBiometricTerm(input: {
  client_id: string
  reading_id: string
  consent_channel: 'office_handoff' | 'office_qr' | 'remote_link' | 'therapist_created'
  ip?: string | null
  user_agent?: string | null
  cpf_titular?: string | null  // optional, raises probative value
}): Promise<{ ok: true; consent_id: string; pdf_url: string } | { ok: false; error: string }> {
  const service = createServiceClient()

  // 1. Read current term (mirror invites.ts:189-194)
  const { data: currentTerm } = await service
    .from('consent_terms')
    .select('version, body, content_sha256')
    .eq('is_current', true)
    .maybeSingle()
  if (!currentTerm) return { ok: false, error: 'Termo vigente não configurado.' }

  // 2. INSERT client_consents (mirror invites.ts:195-201)
  const { data: consent, error } = await service.from('client_consents').insert({
    client_id: input.client_id,
    reading_id: input.reading_id,
    term_version: currentTerm.version,
    event_type: 'initial',
    consent_channel: input.consent_channel,
    ip: input.ip ?? null,
    user_agent: input.user_agent ?? null,
  }).select('id').single()
  if (error || !consent) return { ok: false, error: error?.message ?? 'INSERT failed' }

  // 3. Trigger PDF generation (call /api/consent/generate-pdf or inline)
  // 4. UPDATE clients.consent_signed_at + consent_document_url
  // ...
}
```

---

### `apps/web/app/api/consent/generate-pdf/route.ts` (api route, Gotenberg)

**Analog:** `apps/web/app/api/readings/[id]/pdf/route.tsx` (full Gotenberg flow — env check, render HTML, fetch with basic auth, AbortController timeout, error handling).

**Gotenberg fetch pattern** (readings/[id]/pdf lines 136-272 — copy structure but SINGLE render, no split+merge needed for termo):
```typescript
export const runtime = 'nodejs'
export const maxDuration = 30  // single PDF, no merge

const RENDER_TIMEOUT_MS = 20_000

export async function POST(request: NextRequest) {
  // Auth: session OR invite-token (mirror invite finalize route auth)
  // Body: { client_id, reading_id, consent_channel, ip, user_agent, cpf_titular }
  // ...

  const gotenbergUrl = process.env.GOTENBERG_URL
  if (!gotenbergUrl) return NextResponse.json({ error: 'PDF service not configured' }, { status: 503 })

  const termoHtml = renderTermoHtml({ ... })  // similar to renderCoverHtml(), in lib/consent/pdf-template.tsx
  const form = new FormData()
  form.append('files', new Blob([termoHtml], { type: 'text/html' }), 'index.html')
  form.append('paperWidth', '8.27'); form.append('paperHeight', '11.69')
  form.append('marginTop', '0.8'); form.append('marginBottom', '0.8')
  form.append('marginLeft', '0.7'); form.append('marginRight', '0.7')

  const headers: Record<string, string> = {}
  const basicAuth = process.env.GOTENBERG_BASIC_AUTH
  if (basicAuth) headers.Authorization = `Basic ${Buffer.from(basicAuth).toString('base64')}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)
  try {
    const res = await fetch(`${gotenbergUrl.replace(/\/$/, '')}/forms/chromium/convert/html`, {
      method: 'POST', body: form, headers, signal: controller.signal,
    })
    if (!res.ok) return NextResponse.json({ error: `PDF render failed (${res.status})` }, { status: 502 })
    const pdfBuffer = await res.arrayBuffer()

    // Upload to Supabase Storage — bucket 'client-consents'
    const service = createServiceClient()
    const path = `${therapistId}/${clientId}/${consentId}.pdf`
    await service.storage.from('client-consents').upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: false })
    const { data: signed } = await service.storage.from('client-consents').createSignedUrl(path, 60 * 60 * 24 * 365)
    return NextResponse.json({ ok: true, url: signed?.signedUrl })
  } finally { clearTimeout(timeout) }
}
```

> Per memory `feedback_pdf_gotenberg_architecture`: this is the **canonical** PDF path. Never `@react-pdf/renderer`, never local Puppeteer.

---

### `apps/web/components/billing/TermoBiometricoStep.tsx` (component, client checkbox)

**Analog:** `apps/web/components/clientes/InviteLinkDialog.tsx:181-205` (checkbox + label + helper text + isPending toast) + `apps/web/app/(auth)/signup/page.tsx:65-69` (tosAccepted state).

**Checkbox pattern** (InviteLinkDialog lines 181-199 — copy verbatim with new copy):
```tsx
<div className="space-y-2 rounded-md border border-border bg-muted/20 px-3 py-2.5">
  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
    <input
      type="checkbox"
      checked={accepted}
      onChange={(e) => setAccepted(e.target.checked)}
      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-dark"
      data-testid="termo-biometrico-accept"
    />
    <span className="font-medium leading-snug">
      Li e aceito o Termo de Consentimento para tratamento de dados biométricos
    </span>
  </label>
  <p className="pl-6.5 text-xs leading-relaxed text-muted-foreground">
    Suas fotografias de íris serão tratadas conforme a LGPD…
  </p>
</div>
```

**Server-side gate before checkbox** (signup line 68-69 — copy idiom):
```typescript
if (!accepted) return setFormError('É necessário aceitar o termo antes de prosseguir.')
```

---

### `apps/web/app/api/cron/daily/route.ts` (api route, scheduled batch)

**Analog:** `apps/web/app/api/vision/webhook/route.ts:87-115` (auth header check) + `apps/web/app/actions/admin-therapists.ts:182-225` (sequential service-role operations with explicit logging).

**CRON_SECRET bearer auth pattern** (new — Vercel Cron docs):
```typescript
import { NextResponse, type NextRequest } from 'next/server'
export const runtime = 'nodejs'
export const maxDuration = 60  // way under 800 ceiling

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Sequential best-effort batch (per RESEARCH §Cron Daily Jobs)
  const results = {
    reservations_released: await releaseExpiredReservations(),
    credits_expired: await expireOldCredits(),
    trials_ended: await expireOldTrials(),
    warnings_sent: await sendExpirationWarnings(),
  }
  console.info(`[cron-daily] ${JSON.stringify(results)}`)
  return NextResponse.json({ ok: true, ...results })
}
```

**`vercel.json` schedule pattern** (new — Vercel docs canonical):
```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "0 5 * * *" }
  ]
}
```
Location: `apps/web/vercel.json` (per memory: Vercel Root Directory points to `apps/web/`, so this is the effective file).

---

### `apps/web/lib/audit/log.ts` (service, append-only INSERT)

**Analog:** `apps/web/lib/notifications/notify-therapist-capture-complete.ts:128-157` (best-effort, non-blocking, structured log on failure) + `supabase/migrations/0023_capture_attempts.sql` (decoupled schema, append-only).

**Best-effort INSERT pattern** (capture-complete lines 128-157 idiom — never throw, never block):
```typescript
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type AuditEventType =
  | 'auth.login' | 'auth.signup'
  | 'consent.term_signed'
  | 'reading.created' | 'reading.images_uploaded' | 'reading.analyzed' | 'reading.delivered'
  | 'credit.purchase_initiated' | 'credit.purchase_confirmed' | 'credit.consumed' | 'credit.refunded' | 'credit.expired'
  | 'lgpd.deletion_requested'

export async function logAuditEvent(event: {
  actor_user_id?: string | null
  actor_email?: string | null
  event_type: AuditEventType
  target_type?: string | null
  target_id?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const service = createServiceClient()
    const { error } = await service.from('audit_events').insert({
      actor_user_id: event.actor_user_id ?? null,
      actor_email: event.actor_email ?? null,
      event_type: event.event_type,
      target_type: event.target_type ?? null,
      target_id: event.target_id ?? null,
      metadata: event.metadata ?? null,
    })
    if (error) console.warn(`[audit] insert failed type=${event.event_type}:`, error.message)
  } catch (err) {
    // Non-fatal — never break the caller's flow
    console.warn('[audit] catch:', err instanceof Error ? err.message : err)
  }
}
```

> This mirrors the `capture_attempts` philosophy: insert in try/catch, pipeline degrades gracious if table doesn't exist or write fails. Audit is for forensics, not authorization.

---

## Shared Patterns

### 1. Migration boilerplate

**Source:** `supabase/migrations/0020_consent_infra.sql` (1-37 header) + `0028_report_findings.sql` (1-37 header) + `0033_therapist_invites_and_client_email_unique.sql` (1-35 header)

**Apply to:** All migrations 0035-0038.

Every new migration MUST have:
1. File-header comment explaining **why** (CONTEXT.md decision IDs) and **what** (additive, idempotent claims)
2. `create table if not exists` (never `create table`)
3. `add column if not exists` for ALTER TABLE
4. `drop policy if exists` then `create policy` (idempotent RLS — see 0020:110-115)
5. `comment on table … is '…'` AND `comment on column … is '…'` with decision IDs and rationale (0028:86-96)
6. Partial unique indexes where appropriate (0028:99-103, 0020:48-50)

### 2. RLS policy triad

**Source:** `supabase/migrations/0020_consent_infra.sql:110-154`

**Apply to:** `credit_packages`, `customer_credits`, `credit_transactions`, `credit_reservations`, `trial_status`, plus founder-only `asaas_webhook_events` + `audit_events`.

Pattern for self-data tables:
```sql
alter table public.X enable row level security;
drop policy if exists "X_self_read" on public.X;
create policy "X_self_read" on public.X for select to authenticated using (user_id = auth.uid());

drop policy if exists "X_self_insert" on public.X;
create policy "X_self_insert" on public.X for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "founder_full_access" on public.X;
create policy "founder_full_access" on public.X for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');
```

Pattern for founder-only (no `authenticated` policy = blocked):
```sql
alter table public.X enable row level security;
drop policy if exists "founder_full_access" on public.X;
create policy "founder_full_access" on public.X for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');
```

### 3. Server action skeleton

**Source:** `apps/web/app/actions/admin-therapists.ts:1-9, 41-131` + `apps/web/app/actions/therapist-invites.ts:1-7`

**Apply to:** All server actions in `app/actions/billing.ts`, `app/actions/consent.ts`, modifications to `invites.ts` and `readings.ts`.

```typescript
'use server'
import 'server-only'   // memory feedback_use_server_export_hygiene

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
// Schemas + types live in sibling .schemas.ts — never exported from this file
// ('use server' = only async functions exported)

export interface FooResult { ok: boolean; error?: string; ... }

export async function fooAction(input: ...): Promise<FooResult> {
  // 1. Session gate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  // 2. Zod validate
  const parsed = fooSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors }

  // 3. Domain logic (service-role only when bypassing RLS is needed)
  // ...

  // 4. Structured log (correlation prefix in brackets)
  console.log('[billing] FOO_OK', { userId: user.id, ... })

  // 5. revalidatePath if user-visible cache exists
  revalidatePath('/assinatura')
  return { ok: true, ... }
}
```

### 4. Webhook idempotency triad

**Source:** `apps/web/app/api/vision/webhook/route.ts:152-208` + `apps/web/lib/invite/tokens.ts:markTokenUsed:80-99` + RESEARCH §Idempotency

**Apply to:** `app/api/asaas/webhook/route.ts`.

1. **Dedup at insertion**: `INSERT INTO asaas_webhook_events (event_id, …)` — PG returns 23505 on dup → return 200 no-op.
2. **State-guarded UPDATE**: `UPDATE customer_credits SET … WHERE id = … AND status = 'pending'` — race-safe via DB.
3. **No-op on missing row**: `if (!existing) return NextResponse.json({ ok: true, noop: 'not_found' })` — never resurrect deleted rows.

### 5. Resend email send (best-effort)

**Source:** `apps/web/lib/notifications/notify-therapist-capture-complete.ts:128-157`

**Apply to:** New emails: `notify-credit-purchase-confirmed.ts`, `notify-credit-expiring-30d/7d/0d.ts`, `notify-refund-processed.ts`.

```typescript
const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Iris Codex <noreply@iriscodex.com>'

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) { console.log('[notify-X] RESEND_API_KEY ausente — pulando email'); return }

const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM
try {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to: therapistEmail, subject, text, html }),
  })
  if (!res.ok) { console.error(`[notify-X] resend HTTP ${res.status}`); return }
} catch (err) { console.error('[notify-X] resend fetch falhou:', err) }
```

**Always:**
- `escapeHtml()` helper for user-controlled fields (`notify-therapist-capture-complete.ts:160-167`)
- Defensive fallbacks: `therapistName ? Olá, ${therapistName} : 'Olá'`
- Non-fatal in catch — never throw to caller

### 6. Gate composition

**Source:** `apps/web/lib/gates/client-gates.ts:22-51` + `apps/web/lib/gates/profile-completeness.ts`

**Apply to:** New `lib/gates/billing-gate.ts` and `lib/gates/consent-gate.ts` — wire them into `client-gates.ts:resolveClientGate` at the Fase 2 seam (lines 44-49 comment shows the exact hook point).

Pattern:
```typescript
// lib/gates/billing-gate.ts
export type BillingGate =
  | { status: 'ok' }
  | { status: 'no_balance'; trial_state: TrialState; redirect_to: '/assinatura/comprar' }

export function evaluateBilling(input: { /* trial + credits snapshot */ }): BillingGate { ... }
```

Then in `client-gates.ts`:
```typescript
if (gate.status === 'ok') {
  const billing = evaluateBilling(input.billing)
  if (billing.status !== 'ok') return billing
  const consent = evaluateBiometricConsent(input.consent)
  if (consent.status !== 'ok') return consent
}
return { status: 'ok' }
```

### 7. Constants single source of truth

**Source:** `apps/web/lib/beta/config.ts:1-4` + `apps/web/lib/consent/tos.ts:9-12` + `apps/web/lib/gates/profile-completeness.ts:10` (MIN_AGE)

**Apply to:** All Phase 8 magic numbers in `apps/web/lib/billing/config.ts` (TRIAL_READINGS_MAX, TRIAL_DAYS, CREDIT_VALIDITY_DAYS, RESERVATION_DAYS, REFUND_WINDOW_DAYS) and `apps/web/lib/audit/events.ts` (event type union).

Always:
- `export const X = 3 as const`
- One file, one concept
- History comment: `// Histórico: 18 → 0 em 2026-05-20 → 18 em 2026-05-26`

### 8. Structured console logs

**Source:** `apps/web/app/actions/admin-therapists.ts:116-122, 247-253` + `apps/web/app/api/vision/webhook/route.ts:113, 148, 154, 218`

**Apply to:** All new server actions, webhook handler, cron route.

Format: `[<scope>] <EVENT_NAME>`, then JSON-stringifiable object with correlation keys (`userId`, `paymentId`, `readingId`, `at` ISO timestamp, `by` actor email).

Examples:
- `[asaas-webhook] PAYMENT_RECEIVED_APPLIED { eventId, paymentId, userId, leituras_purchased }`
- `[billing] CREDIT_RESERVED { userId, readingId, source: 'trial'|'credit'|'internal' }`
- `[cron-daily] BATCH_COMPLETE { reservations_released, credits_expired, ... }`

### 9. Idempotent UPDATE via WHERE-guard

**Source:** `apps/web/lib/invite/tokens.ts:80-99` (`.is('used_at', null)`) + `apps/web/app/actions/invites.ts:179-183` (`.is('client_id', null)`)

**Apply to:** All state transitions in `customer_credits`, `credit_reservations`, `trial_status`.

```typescript
// Reservation: active → converted (one writer wins under race)
const { data, error } = await service
  .from('credit_reservations')
  .update({ status: 'converted' })
  .eq('reading_id', readingId)
  .eq('status', 'active')   // <-- guard: only flip if still active
  .select('id')
  .maybeSingle()
if (!data) {
  // No row updated → already converted/released/expired by another path. No-op.
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/lib/asaas/client.ts` | service | REST out | No outbound REST integration in repo (only Resend + Gotenberg + Anthropic, all via fetch direct). Pattern is **idiomatically the same** as notify-* and Gotenberg (fetch + env + structured log + non-fatal catch). |
| `supabase/migrations/0038_phase_8_seed_packages.sql` | migration seed | DDL INSERT | No precedent for **migration-level seed** in repo. `consent_terms` is seeded via founder script (out-of-migration). Phase 8 plans should: option A — seed in migration with `INSERT … ON CONFLICT DO NOTHING`; option B — match consent precedent with `apps/web/scripts/seed-packages.mjs` script. Planner decides; **recommend A** (less moving parts; founder runs `supabase db push` and packages exist immediately). |

---

## Metadata

**Analog search scope:**
- `apps/web/app/api/**/route.{ts,tsx}` (all 15 routes — vision/webhook + readings/pdf central matches)
- `apps/web/app/actions/**/*.ts` (all 18 actions — admin-therapists, invites, therapist-invites, readings central matches)
- `apps/web/lib/{auth,beta,billing,consent,gates,invite,notifications,profile,supabase,vision}/**/*.ts`
- `supabase/migrations/00{20,23,28,33,34}_*.sql` (consent + audit + therapist invites — Phase 8 precursors)
- `apps/web/middleware.ts`
- `apps/web/components/clientes/InviteLinkDialog.tsx` (modal flow precedent)
- `apps/web/app/(auth)/signup/page.tsx` (form + checkbox + zod precedent)

**Files scanned:** 31 source files + 5 migrations + 3 config files

**Pattern extraction date:** 2026-05-27

**Key insight repeated:** Most Phase 8 weight is schema + state machines + external integration. **Infrastructure for consent, audit-vocab CI gate, PDF generation, email, structured logging, RLS triad, server action hygiene, idempotent UPDATE — ALL already exist and are battle-tested in prod.** Phase 8 plans should explicitly cite the analog file + line numbers in each task's Action section, not invent new patterns.

---

*Phase: 08-pagamento-lgpd*
*Pattern mapping: 2026-05-27*
