# Stripe Webhook Idempotency + Auto-Retry (Option B) — Post-Launch Plan

**Status:** Queued — **not a launch gate.** Implement after launch once real billing traffic exists and **after Option A is merged** ([PR #32](https://github.com/Voels2000/estate-planner/pull/32): Sentry capture on webhook failures).

**Prerequisite shipped (Option A):** Failures are visible in Sentry; HTTP statuses unchanged (critical Supabase failures still return **200** → manual Stripe resend).

**Goal (Option B):** Critical billing-state failures return **500** so Stripe auto-retries transient DB blips. **Retry is only safe after event-level dedup + side-effect hardening.**

**Rule:** Two PRs — Phase 1 (idempotency) merges and is proven **before** Phase 2 (retry) begins. Never the reverse.

Canonical handler: `app/api/stripe/webhook/route.ts`

---

## Live bug — fix independently (not Phase 1, not Option A)

**`trackTierUpgrade` fires when the profile update failed** (`route.ts` ~237–247). Today, if `checkout.session.completed` logs a Supabase profile error and returns 200, `void trackTierUpgrade(...)` still runs. Funnel analytics can record an upgrade that never landed on `profiles` — a **current data-integrity defect**, not a future-retry concern.

- **Option A** alerts on the failed write; it does **not** stop the spurious analytics event.
- **Fix:** One-line scope — call `trackTierUpgrade` only after a **successful** profile update (no error). No dedup table required.
- **Delivery:** Standalone PR (`chore/webhook-track-tier-upgrade-order`), not bundled with Option A or Phase 1. See [WEBHOOK_TRACK_TIER_UPGRADE_FIX.md](./WEBHOOK_TRACK_TIER_UPGRADE_FIX.md).

**Not a launch gate** — **shipped** [PR #34](https://github.com/Voels2000/estate-planner/pull/34) (2026-06-18). Do not defer into the Phase 1 bundle because it shares a file with retry work.

---

## Current state audit (2026-06-18)

### Event dedup

- **No `event.id` dedup** anywhere in the webhook path.
- Stripe may deliver the same event more than once; today every delivery runs the full handler.

### DB transactions

- **No transaction** wraps the handler. Each Supabase call is independent; partial completion is possible mid-switch.

### Handled event types

| Event | Purpose |
|-------|---------|
| `checkout.session.completed` | Firm or consumer subscription activation |
| `customer.subscription.deleted` | Cancel sync + optional deletion schedule |
| `customer.subscription.updated` | Status/tier sync + reactivation deletion cancel |
| `invoice.payment_failed` | Mark firm/consumer `past_due` |
| `invoice.upcoming` | Consumer renewal reminder email |

---

## Non-idempotent side effects (Phase 1 must address)

Priority order for post-launch hardening:

1. **Compliance — deletion scheduling** (highest severity under retry)
2. **Event dedup table + stuck-`processing` policy**
3. **`trackTierUpgrade` dedup under retry** (ordering fix is separate PR above)

These are **not** safe under Stripe retry or duplicate delivery today.

| Location | Side effect | Re-run risk | Recommended fix |
|----------|-------------|-------------|-----------------|
| `route.ts` ~300–304 | `scheduleDeletionOnSubscriptionCancelled(...)` | **Double `deletion_schedule` row** (no unique on pending per user). **Compliance:** duplicate or mistimed deletion schedules. | **DB-level partial unique index** on pending `user_id` (preferred — holds across all code paths); or check-before-insert; optional `stripe_event_id` audit column. |
| `route.ts` ~242–247 | `void trackTierUpgrade(...)` | **Double `funnel_events` insert** on Stripe redelivery. Ordering bug (fires on failed write) → **standalone PR**, not Phase 1. | For Phase 1 retry safety only: optional guard on `stripe_event_id` if replay test shows double-fire after ordering fix. |
| `route.ts` ~315–318 | `cancelPendingDeletionOnReactivation(...)` | **Low** — `UPDATE … WHERE status = 'pending'` is naturally idempotent. | No change required; safe under retry. |
| `sendConsumerRenewalReminder` ~88–106 | Email + `stripe.subscriptions.update` metadata `renewal_reminder_sent_for` | Email could send twice if metadata update fails after send. Metadata guard helps on exact retry. | Keep on **Option A** (200 + Sentry warning) in Phase 2; optional: check metadata before send (already partial). |
| Various | `stripe.subscriptions.retrieve` | Read-only | Safe. |

### Mostly idempotent writes (lower Phase 2 risk)

These are `.update().eq(...)` profile/firm field syncs — re-applying the same values is generally safe:

- Firm/consumer checkout profile updates (~171–240)
- Firm/consumer subscription deleted/updated (~258–390)
- `invoice.payment_failed` past_due marks (~413–446)

**Gap today:** ~~several paths **do not check** Supabase `error`~~ **Pre-flip (2026-06-19):** alerting extended to all writes in `subscription.deleted`, `subscription.updated`, and `invoice.payment_failed` handlers. Phase 2 must still add error checks before throwing 500 for retry.

---

## Phase 1 — Idempotency (makes retry safe)

### Design (proposed)

**Table:** `stripe_webhook_events`

| Column | Type | Notes |
|--------|------|-------|
| `event_id` | `text PRIMARY KEY` | Stripe `event.id` (e.g. `evt_…`) |
| `event_type` | `text NOT NULL` | e.g. `checkout.session.completed` |
| `status` | `text NOT NULL` | `processing` \| `processed` \| `failed` |
| `attempt_count` | `int NOT NULL DEFAULT 1` | Increment on retry delivery |
| `processed_at` | `timestamptz` | Set when fully successful |
| `created_at` | `timestamptz DEFAULT now()` | |
| `last_error_code` | `text` | Optional; **pg_code only**, no row values |

**RLS:** Service-role only (webhook uses `createAdminClient()`). Add to `scripts/assert-rls-coverage.sql` expectations (no `public`/`authenticated` access).

**Gate flow (after signature verify):**

```text
1. INSERT event_id AS processing (ON CONFLICT → see below)
2. If status = processed → return 200 immediately (skip all work)
3. Run handler switch
4. On full success → UPDATE status = processed, processed_at = now()
5. On failure → leave processing/failed; do NOT mark processed
   (Phase 2: throw → 500 → Stripe retries → step 1 sees unprocessed, re-attempts)
```

**Stuck `processing` (crash mid-handler):** **Must be explicitly designed in Phase 1 — not hand-waved.** Add `processing_started_at` + reclaim if older than N minutes (e.g. 15), or transition to `failed` and allow retry increment on next delivery. Without this, events stay permanently `processing` and never retry. Document chosen policy in DECISION_LOG.

**Phase 1 behavior change for callers:** None — still return current HTTP statuses. Dedup only prevents duplicate work on Stripe redelivery.

### Validation (required)

1. Send same `event.id` twice (Stripe CLI resend or signed replay).
2. Assert: first run processes; second returns 200 with **no** side-effect re-fire.
3. Explicitly verify: `funnel_events` count +1 not +2; `deletion_schedule` at most one pending row.
4. `npm run lint` · `npx tsc --noEmit` · `npm run build` · `npm run verify:rls` green.

**Branch:** `chore/webhook-idempotency` → `staging`

---

## Phase 2 — Enable auto-retry (Option B)

**Only after Phase 1 merged and replay test passed.**

### Paths to flip (log-only Supabase failure → throw → 500)

| Event / path | Line range (approx) | Phase 2 flip? |
|--------------|---------------------|---------------|
| `checkout.session.completed` — firm + consumer DB writes | 171–240 | **Yes** |
| `customer.subscription.deleted` — firm + consumer | 258–304 | **Yes** (deletion schedule gated by Phase 1) |
| `customer.subscription.updated` — firm + consumer | 331–390 | **Yes** |
| `invoice.payment_failed` — firm + consumer | 413–446 | **Yes** (add error checks first) |
| `invoice.upcoming` — renewal email | 463–476 | **No** — stay 200 + Sentry warning |
| Signature failure | 135–140 | **No** — stay 400 |

Sentry capture (Option A) stays; throws propagate to outer catch which already returns 500 + captures.

### Validation (required)

1. **Transient:** Force Supabase write to fail once, succeed on retry → first 500, second 200, final state correct, side effects once.
2. **Persistent:** Failure every attempt → 500, Stripe retries per schedule, Sentry alerts, no double side effects.
3. Partial Phase 2 acceptable: only flip paths where Phase 1 proved side-effect safety.

**Branch:** `chore/webhook-retry` → `staging`

---

## Level of effort

| Phase | Scope | Estimate | Notes |
|-------|--------|----------|-------|
| **Phase 1** | Migration + RLS + claim gate + deletion-schedule hardening + replay validation | **2–3 eng days** | Deletion schedule constraint + stuck-`processing` policy + `verify:rls`; ordering fix is separate PR |
| **Phase 2** | Throw-on-failure for critical paths + add missing error checks + retry validation | **0.5–1 eng day** | Thin if Phase 1 is solid; mostly flipping existing Option A capture sites to `throw` |
| **Total** | Both phases + two PRs | **~3–4 eng days** | Schedule in **weeks 1–2 post-launch** (aligns with post-launch hardening window) |

Assumes: Option A merged, Stripe CLI or staging webhook endpoint available, familiar with project migration/RLS discipline.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Phase 2 before Phase 1** | **Critical** | Process gate: two PRs; Phase 2 blocked on replay test evidence |
| **Double deletion schedule** | **High** | **DB partial unique index** (preferred) or check-before-insert; test with replay |
| **Double analytics (`funnel_events`)** | Medium | Standalone ordering PR; event-id guard in Phase 1 only if replay still double-fires |
| **Stuck `processing` row** | **High** (subtle) | **Required Phase 1 design** — TTL reclaim or `failed` state; not optional |
| **Persistent bug → retry storm** | Medium | Sentry already alerts; Stripe backs off over ~3 days; fix forward |
| **Partial handler success** | Medium | Event-level dedup alone insufficient — per-side-effect guards required |
| **`trackTierUpgrade` on failed profile update** | **High (live today)** | [Standalone PR](./WEBHOOK_TRACK_TIER_UPGRADE_FIX.md) — not deferred into Phase 1 bundle |
| **Paths without error checks** | Medium | Audit all Supabase writes before Phase 2 throws |
| **Sentry noise increase** | Low | Same tags as Option A; tune alert rules if needed |

---

## Launch gate vs post-launch

| Concern | Launch gate? | Owner |
|---------|--------------|-------|
| Webhook failure **visibility** (Option A) | **Yes** — PRE_FLIP §A | PR #32 + doc-reconciliation |
| Webhook failure **auto-recovery** (Option B) | **No** | This plan — post-launch |
| Handler **idempotency** (dedup table) | **No** (but PRE_FLIP mentions “confirm idempotent” — Option A + manual resend satisfies visibility; full idempotency is this plan) | Phase 1 |

---

## Implementation checklist (when ready)

### Phase 1
- [ ] Option A merged to `main` / production
- [ ] **Standalone:** `trackTierUpgrade` ordering fix merged (recommended before or early in Phase 1 window)
- [ ] Audit re-read (handler may have drifted)
- [ ] Migration `stripe_webhook_events` + RLS + coverage gate
- [ ] Claim/gate in `route.ts`
- [ ] Harden `trackTierUpgrade` + `scheduleDeletionOnSubscriptionCancelled`
- [ ] Replay same `event.id` twice — evidence in PR
- [ ] DECISION_LOG entry

### Phase 2
- [ ] Phase 1 merged + replay test green
- [ ] Add error checks on unchecked Supabase writes
- [ ] Flip critical paths to throw → 500
- [ ] Transient + persistent failure validation — evidence in PR
- [ ] DECISION_LOG entry

---

## Related docs

- [PRE_FLIP_CHECKLIST.md §A](./PRE_FLIP_CHECKLIST.md) — webhook failure visibility
- [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) — deletion scheduling
- [BILLING_B2B2C_POLICY.md](./BILLING_B2B2C_POLICY.md) — managed-profile webhook skip
- [WEBHOOK_TRACK_TIER_UPGRADE_FIX.md](./WEBHOOK_TRACK_TIER_UPGRADE_FIX.md) — standalone ordering fix (live bug)
- Option A PR #32 — webhook Sentry capture → `staging`
