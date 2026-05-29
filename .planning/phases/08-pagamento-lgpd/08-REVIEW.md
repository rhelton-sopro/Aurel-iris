---
phase: 08-pagamento-lgpd
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - apps/web/lib/asaas/client.ts
  - apps/web/lib/asaas/webhook-auth.ts
  - apps/web/lib/asaas/idempotency.ts
  - apps/web/lib/asaas/types.ts
  - apps/web/lib/billing/apply-payment.ts
  - apps/web/lib/billing/credits.ts
  - apps/web/lib/billing/reservations.ts
  - apps/web/lib/billing/trial.ts
  - apps/web/lib/billing/refund-policy.ts
  - apps/web/lib/billing/config.ts
  - apps/web/lib/billing/cron-jobs.ts
  - apps/web/lib/gates/billing-gate.ts
  - apps/web/lib/gates/termo-gate.ts
  - apps/web/lib/gates/therapist-profile.ts
  - apps/web/lib/auth/cpf.ts
  - apps/web/lib/audit/log.ts
  - apps/web/lib/audit/events.ts
  - apps/web/lib/consent/sign.ts
  - apps/web/lib/consent/hydrate-term.ts
  - apps/web/lib/consent/pdf-template.tsx
  - apps/web/app/actions/billing.ts
  - apps/web/app/actions/billing.schemas.ts
  - apps/web/app/actions/billing-extras.ts
  - apps/web/app/actions/consent.ts
  - apps/web/app/actions/consent.schemas.ts
  - apps/web/app/actions/invite-consent.ts
  - apps/web/app/actions/invite-consent.schemas.ts
  - apps/web/app/actions/readings.ts
  - apps/web/app/actions/invites.ts
  - apps/web/app/actions/profile.ts
  - apps/web/app/api/asaas/webhook/route.ts
  - apps/web/app/api/cron/daily/route.ts
  - apps/web/app/api/consent/generate-pdf/route.ts
  - apps/web/app/api/readings/[id]/analyze/route.ts
  - apps/web/app/convite/[token]/capturar/InviteCaptureWrapper.tsx
  - apps/web/app/convite/[token]/capturar/InviteTermoStep.tsx
  - apps/web/app/convite/[token]/capturar/page.tsx
  - apps/web/middleware.ts
  - apps/web/scripts/seed-consent-term-v1.mjs
  - supabase/migrations/0035_phase_8_billing_lgpd_schema.sql
  - supabase/migrations/0036_phase_8_billing_lgpd_rls.sql
  - supabase/migrations/0037_phase_8_helper_functions.sql
  - supabase/migrations/0038_phase_8_seed_packages.sql
  - supabase/migrations/0039_signup_cpf_trigger_extension.sql
findings:
  critical: 3
  warning: 9
  info: 7
  total: 19
status: issues_found
---

# Phase 8: Code Review Report — Pagamento + LGPD

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 39 (42 listed; 3 migrations beyond 0035-0039 scope were cross-referenced read-only)
**Status:** issues_found

## Summary

This is the critical money + biometric-consent surface. The architecture is generally sound: the
webhook idempotency triad (event_id PK → status guards → defensive `.eq('user_id')`) is correct, the
FIFO reserve uses `pg_advisory_xact_lock` + `FOR UPDATE`, the timing-safe webhook compare is right, CPF
módulo-11 is correct, the termo gate reads the live current-pointer columns (not the dropped 0019
columns), and best-effort email/audit are properly fire-and-forget off the credit-granting path.

However, three correctness defects can cause **wrong balances or wrong refund amounts**, plus a
**payment customer mapping bug that sends the CPF as the phone number to Asaas**. The cron bearer check
is not constant-time and fails-open if `CRON_SECRET` is unset. Several LGPD consent-trail integrity
issues are present (duplicate/incomplete consent rows, `inet` insert that can hard-fail the sign path).

Weighting per the phase mandate (money + consent), the BLOCKERs below should be fixed before shipping.

---

## Critical Issues

### CR-01: `mobilePhone` is populated with `cpfDigits(profile.phone)` — wrong Asaas customer data (BLOCKER)

**File:** `apps/web/app/actions/billing.ts:81`
**Issue:** When creating the Asaas customer, the phone field is built with `cpfDigits(profile.phone)`.
`cpfDigits` is the CPF-stripper (`replace(/\D/g, '')`) and happens to also strip phone formatting, so it
"works" by accident — but the intent/name is wrong and, more importantly, the surrounding code uses
`cpfDigits` for `cpfCnpj` on line 79 too. The real risk: if `profile.phone` is stored already as digits
or with `+55`, `cpfDigits` silently drops the `+`, and any future change to `cpfDigits` (e.g. to validate
11-digit CPF length) will corrupt the phone. Using the CPF helper as a phone sanitizer couples two
unrelated fields. A payment-customer record with a malformed phone can break Asaas PIX/boleto receipts
and refund notifications.
**Fix:** Use a dedicated phone digit-stripper (or inline `profile.phone.replace(/\D/g, '')`) and add the
`+55` country prefix if Asaas expects E.164. Do not reuse `cpfDigits` for non-CPF fields.
```ts
mobilePhone: profile.phone.replace(/\D/g, ''), // dedicated, not cpfDigits
```

### CR-02: Cron bearer check is not constant-time and fails-open when `CRON_SECRET` is unset (BLOCKER)

**File:** `apps/web/app/api/cron/daily/route.ts:23-27`
**Issue:** Two problems on `if (auth !== \`Bearer ${process.env.CRON_SECRET}\`)`:
1. **Fail-open on missing env:** if `CRON_SECRET` is undefined, the expected string becomes the literal
   `"Bearer undefined"`. An attacker who sends `Authorization: Bearer undefined` would pass the check and
   trigger the cron (which expires credits, ends trials, releases reservations — all money-affecting,
   service-role writes). The webhook auth helper (`webhook-auth.ts:26`) correctly returns `misconfigured`
   when the secret is absent; this endpoint does not.
2. **Timing side-channel:** plain `!==` short-circuits on first differing byte, leaking secret length/prefix.
   The webhook path deliberately uses `timingSafeEqual`; the cron path should too.
**Fix:**
```ts
const secret = process.env.CRON_SECRET
if (!secret) {
  console.error('[cron-daily] CRON_SECRET not configured')
  return NextResponse.json({ error: 'misconfigured' }, { status: 401 })
}
const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '') ?? ''
const a = Buffer.from(provided), b = Buffer.from(secret)
if (a.length !== b.length || !timingSafeEqual(a, b)) {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}
```

### CR-03: Manual partial refund value is computed on a different base than the webhook reconciliation — risk of double/mismatched debit (BLOCKER)

**File:** `apps/web/app/actions/billing.ts:230-251` + `apps/web/lib/billing/apply-payment.ts:282-303`
**Issue:** Two independent code paths reconcile the same partial refund and they do NOT agree on the
"leituras debited" math:
- Manual (`refundPackageAction`, partial branch) zeros `leituras_remaining` and `leituras_reserved`
  outright and inserts a transaction of `amount: -policy.leituras_to_refund` where
  `leituras_to_refund = refundable = remaining + reserved`.
- Webhook (`PAYMENT_PARTIALLY_REFUNDED`) recomputes from `refundedValue / unitPrice`, sums prior
  `type='refund'` transactions into `jaDebitado`, and debits the delta.
The unit prices differ between the two: `refund-policy.ts:75` uses `price_brl / leituras_purchased`,
while `apply-payment.ts:282` uses `pkg.price_brl / pkg.leituras_count`. These are usually equal, but the
manual path zeros the balance *immediately* (terapeuta "loses the rest"), whereas the webhook treats the
refund as proportional and could compute a different `leiturasDeviasDebitar` than what was already zeroed.
If `refundedValue` (Asaas's reported number) rounds differently from `policy.value_brl`, `debitoDelta`
can be positive after the manual path already zeroed the balance, producing a spurious extra
`type='refund'` ledger row with a negative `amount` against a balance that is already 0 — corrupting the
auditable ledger sum (`Σ amount per credit_id`). For total refunds this is masked because manual sets
`status='refunded'` and the webhook no-ops; the partial path has no such guard.
**Fix:** Make one path authoritative. Recommended: the manual partial path should NOT zero the balance;
it should debit exactly the proportional amount and leave the webhook as the single reconciler, OR the
webhook partial branch should short-circuit when a manual refund transaction already exists for the
payment within a tolerance window. At minimum, gate the webhook partial branch on
`status='active' AND leituras_remaining > 0` (currently only checks `status='active'`), so a
manually-zeroed credit cannot accrue a second negative ledger entry.

---

## Warnings

### WR-01: `release_reservation` decrements a real trial counter for `internal_use` reservations

**File:** `supabase/migrations/0037_phase_8_helper_functions.sql:244-252`
**Issue:** In `release_reservation`, the `credit_id IS NULL` branch handles both trial AND internal_use
reservations (both reserve with `credit_id=null`). It blindly runs
`update trial_status set trial_readings_used = greatest(trial_readings_used - 1, 0)`. The founder is
`internal_use=true` **and** likely has a `trial_status` row (created at signup). When a founder/internal
reservation expires or is cancelled, this wrongly decrements the founder's real `trial_readings_used`,
silently re-granting trial leituras. The reserve path (`fifo_reserve_credit:106-115`) correctly does NOT
touch trial for internal — release is asymmetric.
**Fix:** Distinguish trial vs internal at release time. Either store `source` on `credit_reservations`,
or re-check `internal_use` before decrementing:
```sql
else
  if not coalesce((select internal_use from public.profiles where id = v_reservation.user_id), false) then
    update public.trial_status set trial_readings_used = greatest(trial_readings_used - 1, 0)
     where user_id = v_reservation.user_id and ended_at is null;
  end if;
end if;
```
Also note the ledger insert at :255-263 writes a `type='release'`/`'expire'` row for internal reservations
that never debited — harmless but pollutes analytics.

### WR-02: `client_consents.ip` is `inet` — a malformed `x-forwarded-for` hard-fails the consent sign

**File:** `apps/web/lib/consent/sign.ts:51` + `0020_consent_infra.sql:82`
**Issue:** `signBiometricTerm` inserts `ip: input.ip` into `client_consents.ip` which is Postgres type
`inet`. The IP comes from `x-forwarded-for?.split(',')[0]?.trim()` (consent.ts:51, invite-consent.ts:63).
If a proxy ever yields a non-IP token (e.g. `unknown`, an IPv6 with zone id, or a comma artifact), the
INSERT fails with `invalid input syntax for type inet`, and the entire termo signature fails — blocking
biometric capture for a legitimate client. This is the LGPD-critical path; it should degrade to NULL, not
hard-fail.
**Fix:** Validate/sanitize the IP before insert; coerce to `null` on parse failure:
```ts
const isIp = (s: string | null) => !!s && /^(\d{1,3}\.){3}\d{1,3}$|:/.test(s)
ip: isIp(input.ip) ? input.ip : null,
```
Or store the raw header value in a `text` column. Same applies to the PDF route which passes `ip` into the
footer (that path is safe since it's text).

### WR-03: `completeInviteNewClientAction` writes an incomplete duplicate consent row that never updates the current-pointer

**File:** `apps/web/app/actions/invites.ts:205-217`
**Issue:** During new-client invite registration, an `event_type='initial'`, `consent_channel='remote_link'`
row is INSERTed into `client_consents` with **no `reading_id`, no `ip`, no `user_agent`, and no
corresponding PDF**, and crucially it does NOT update `clients.consent_last_at`. The real biometric consent
is later captured by `signInviteTermAction` (with PDF + IP + pointer update). Result: every invited new
client gets TWO `initial` rows in the legal audit trail — one phantom (checkbox-only, no proof artifacts)
and one real. For an LGPD audit trail this is an integrity defect: the phantom row asserts consent was
given with no IP/PDF/hash to back it. The gate is still fail-closed (it reads `consent_last_at`, which the
phantom row does not set), so this is not an auth bypass — but it corrupts the evidentiary record.
**Fix:** Remove the consent insert at invites.ts:205-217 entirely; the biometric consent is owned by
`signInviteTermAction` at capture time. The checkbox in the registration form is UI acknowledgment, not the
biometric LGPD consent.

### WR-04: `expireOldCredits` records `amount: 0` for expirations, losing the forfeited balance in the ledger

**File:** `apps/web/lib/billing/cron-jobs.ts:79-89`
**Issue:** The expire job UPDATEs `leituras_remaining = 0` and then reads the post-update row (always 0),
so the `credit_transactions` row is written with `amount: 0`. The forfeited balance is permanently lost
from the auditable ledger — `Σ amount per credit_id` will not reconcile to zero for expired credits, and
there's no record of how many leituras were forfeited. The code comment even acknowledges this.
**Fix:** Capture the pre-update remaining. Either do a SELECT-then-UPDATE, or use a CTE returning the old
value, or run the expiry inside a Postgres function. Minimal fix:
```ts
const { data: toExpire } = await service.from('customer_credits')
  .select('id, user_id, leituras_remaining')
  .eq('status', 'active').lt('expires_at', new Date().toISOString())
// then UPDATE by id, and write amount: -row.leituras_remaining
```

### WR-05: Webhook responds 200 even when `applyPaymentEvent` returns `db_error` — Asaas will never retry a real failure

**File:** `apps/web/app/api/asaas/webhook/route.ts:86-97`
**Issue:** After `recordWebhookEvent` succeeds (event_id persisted), `applyPaymentEvent` runs and the route
always returns `200 {...result}` regardless of `result.applied`/`result.reason`. If
`applyPaymentEvent` hits a transient `db_error` (e.g. the `customer_credits` UPDATE fails), the credit is
never activated, but Asaas receives 200 and will NOT re-deliver. Because the event_id is already recorded,
a manual re-delivery would also be a `first_seen:false` idempotent no-op. Net effect: a paying therapist
permanently loses credits on a transient DB error, with no automatic recovery.
**Fix:** On `applied:false` with `reason==='db_error'`, return a 5xx so Asaas retries (the event_id row can
be left with `status='failed'` and the idempotency INSERT should only short-circuit for *successfully
processed* events). Consider only recording the event as processed after a successful apply, or add a
`status='failed'` path that allows reprocessing.

### WR-06: `analyze/route.ts` converts the reservation only on the happy path — abandoned/errored generations never debit, but the credit stays reserved

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:418-430` (catch branch :534-564 has no convert)
**Issue:** `convertReservationToConsume` runs only inside the successful stream-finalize block. If Stage 2
throws (catch branch at :534), the reservation is left `active`. It is not released either. The credit
stays reserved for up to 7 days until the cron releases it — so a therapist who hits repeated generation
errors sees their available balance (`remaining - reserved`) depressed with no immediate feedback. Not data
loss (cron recovers), but a confusing balance bug on the money surface.
**Fix:** This is arguably acceptable (reserved, not debited), but consider releasing the reservation in the
error catch when the failure is terminal, so balance frees up immediately rather than after 7 days.

### WR-07: `convertReservationToConsume` debit is two non-atomic statements — a crash between them desyncs the balance

**File:** `apps/web/lib/billing/credits.ts:114-149`
**Issue:** The flip to `status='converted'` (race-guarded) and the `customer_credits` decrement of
`leituras_remaining`/`leituras_reserved` are separate round-trips with no transaction. If the process dies
after the status flip but before the decrement, the reservation is `converted` (so it will never be retried
or released) yet `leituras_reserved` is never decremented — permanently locking 1 reserved slot against
that credit (and `remaining` never debited, so the customer keeps a leitura they used). The reserve path is
atomic via the SECURITY DEFINER function; the consume path is not.
**Fix:** Move the consume logic into a SECURITY DEFINER Postgres function (mirror `fifo_reserve_credit`),
doing the status flip + balance decrement + ledger insert in one transaction.

### WR-08: `evaluateTrial` precedence: explicit `ended_at` masks an exhausted-readings reason as `manual`

**File:** `apps/web/lib/billing/trial.ts:37-44`
**Issue:** When `ended_at` is set, the reason is derived only from the stored `ended_reason` string, falling
back to `'manual'` for anything not exactly `'readings_exhausted'`/`'days_elapsed'`. But the cron writes
`ended_reason='days_elapsed'` and `fifo_reserve_credit` increments `trial_readings_used` without ever
setting `ended_at`/`ended_reason` when the trial hits max via reservation. So a trial that exhausts via the
3rd reservation never gets `ended_at` set anywhere — it's only detected lazily by `evaluateTrial`'s
`used >= max` branch. That's fine for reads, but the `trial.ended` audit event (cron `expireOldTrials`) only
fires for the days-elapsed path, never for readings-exhausted. The `trial.ended` reason
`'readings_exhausted'` in the audit log will essentially never appear.
**Fix:** Either have `fifo_reserve_credit` set `ended_at`/`ended_reason='readings_exhausted'` when the trial
UPDATE brings `used` to `max`, or add a cron job that finalizes exhausted trials and emits the audit event.

### WR-09: PDF signed URL TTL of 365 days for biometric-consent documents is excessive

**File:** `apps/web/app/api/consent/generate-pdf/route.ts:224`
**Issue:** `createSignedUrl(path, 60 * 60 * 24 * 365)` mints a 1-year signed URL to a private bucket
containing a biometric-consent PDF with the client's name, CPF, IP and signature hash (LGPD sensitive
data). This URL is returned to the public invite flow (no session) and stored in audit metadata. A leaked
URL grants a year of unauthenticated access to sensitive PII.
**Fix:** Issue a short-lived signed URL (minutes/hours) for the immediate download, and generate a fresh
short-lived URL on demand when the therapist later views the document. Do not persist long-lived signed
URLs.

---

## Info

### IN-01: `verifyAsaasToken` length-mismatch branch leaks token length via early return

**File:** `apps/web/lib/asaas/webhook-auth.ts:33`
**Issue:** The `a.length !== b.length` early return is acknowledged in the comment as acceptable. Fine for a
fixed-length shared secret, but if the secret length is ever variable, this leaks length. Documented; no
action required unless secret format changes.

### IN-02: `signBiometricTerm` selects `content_sha256` but never uses it

**File:** `apps/web/lib/consent/sign.ts:38`
**Issue:** The query selects `version, content_sha256` but only `version` is consumed. The per-hydration
hash is recomputed in the PDF route. Dead column in the select; harmless. Remove `content_sha256` from the
select or store it on the consent row for tamper-proofing.

### IN-03: `clientAge` uses a fixed `31_557_600_000` ms/year divisor

**File:** `apps/web/app/api/readings/[id]/analyze/route.ts:172`
**Issue:** Magic number for average year length (365.25 days). Acceptable for age display, but extract to a
named constant for clarity; pre-existing pattern from Phase 7.

### IN-04: `audit_events.event_type` comment lists a stale/different vocabulary than `events.ts`

**File:** `supabase/migrations/0035_phase_8_billing_lgpd_schema.sql:242-243`
**Issue:** The column comment enumerates `credit_purchased | term_accepted | ...` but the canonical type
union in `lib/audit/events.ts` uses `credit.purchase_confirmed | consent.term_signed | ...`. The DB comment
is documentation drift; the column is free-text so no runtime impact. Align the comment.

### IN-05: `cleanupStaleEmptyReadingsAction` deletes readings but not their reservations

**File:** `apps/web/app/actions/readings.ts:435`
**Issue:** Stale empty `pending` readings are deleted directly. `credit_reservations.reading_id` has no FK
(by design), so any reservation tied to such a reading is orphaned until the cron expiry. For empty
readings (0 images) created via the authed path, a reservation does exist (createReadingAction reserves
before redirect). The orphan is recovered by cron, but the immediate balance stays depressed. Low impact;
note for completeness.

### IN-06: `createChargeAction` compensation delete can leave an Asaas customer with no local credit row on partial failure

**File:** `apps/web/app/actions/billing.ts:128-132`
**Issue:** If `createAsaasPayment` fails, the pending credit row is deleted (good). But if the subsequent
`update` linking `asaas_payment_id` (line 135) fails silently (no error check), the webhook later cannot
find the credit by `asaas_payment_id` and the payment is orphaned (`not_found`). The update result is not
checked.
**Fix:** Check the update result; if it fails, surface an error and consider compensating the Asaas payment.

### IN-07: `middleware.ts` profile gate query runs on every protected request without caching

**File:** `apps/web/middleware.ts:57-61`
**Issue:** Acknowledged in-comment as "aceitável no beta". Out of scope for v1 (performance), noted only
because it queries `profiles` per request; not a correctness issue.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
