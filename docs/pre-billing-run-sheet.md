# Pre–Live-Billing Run Sheet

Work straight down. Two gates are hard **STOP**s — if either fails, do not run live
billing.

**Pair with:** [prod-smoke-canary-runbook.md](./prod-smoke-canary-runbook.md) — that
doc is *how the prod safety net is built* (lands with Track 2 / #158); this doc is
*what to verify before you touch prod billing*.

**Re-verify before each run:** prod commit, deploy timestamp, and ledger rows drift over
time. Section 0 records the baseline from the 2026-06-27 pre-billing pass; do not treat
it as permanently true without a quick re-check.

---

## 0. KEYSTONE — verified 2026-06-27 (restate; re-run drift check if unsure)

- Prod commit: `63df4fa8` ([#170](https://github.com/Voels2000/estate-planner/pull/170) prod smoke fixes merged to `main`)
- Deployed after #150 promote; #170 landed 2026-06-27
- Prod ledger contains `20260726130000_profiles_advisor_select_status_gate`
  and `20260723120000_profiles_stripe_subscription_id`
- Migration self-recording path already fired once, in its own window (not during billing)
- **Step 5 attested:** real-card live smoke + C-4 billing walkthrough (Al / 2026-06-27)

Optional drift confirm (should show no unexpected MISSING):

```bash
DB_URL='<prod>' bash scripts/collect-migration-ledger-info.sh production
```

---

## 1. GATE A (STOP) — Stripe API version on the WEBHOOK path

The failure mode that matters is the *webhook* handler running an unpinned client,
not app-initiated calls. Check a call fired from inside the webhook.

- Stripe Dashboard → Developers → Logs
- Find a recent **webhook-triggered** call (e.g. a `subscriptions.retrieve` fired by
  your webhook handler, not a checkout the user started in-app)
- Read the `Stripe-Version` header on the request

**PASS:** version is `2026-02-25.clover` on the webhook-path call.

**STOP:** account-default / `acacia` / mixed versions → prod is not running the
pinned client on the webhook path despite the code being on main. Do not run billing.

Code reference: `lib/stripe/config.ts` → `STRIPE_API_VERSION = '2026-02-25.clover'`.

---

## 2. GATE B (STOP) — Basil-shaped `subscription.updated` → prod webhook

This is the path that 500'd in prod while unit tests passed. The unit test proves the
code; only a real Basil-shaped payload against the deployed handler proves prod.

**Prefer replaying a REAL prod event** (it's the actual shape Stripe sends):

- Stripe Dashboard → Developers → Webhooks → recent `customer.subscription.updated`
  delivery → **Resend / replay** to prod endpoint

Synthetic fallback (ONLY if you confirm the payload omits the top-level field):

```bash
stripe trigger customer.subscription.updated
```

> A synthetic trigger that includes a top-level `current_period_end` passes for the
> WRONG reason — the bug was the *absence* of that field. The test only counts if the
> payload is item-level-only (no top-level `current_period_end`). Replaying a real
> prod delivery sidesteps this entirely.

Then read Vercel prod logs for `Webhook received: customer.subscription.updated`:

**PASS:** HTTP 200, no `RangeError: Invalid time value`, profile/firm update completes
or skips gracefully (null period end → renewal reminder skipped, no throw).

**STOP:** HTTP 500 on `subscription.updated` → the Basil fix is not behaving in
deployed prod. Do not run live billing. Diagnose prod webhook behavior, not test plumbing.

Unit corroboration (necessary, not sufficient):

```bash
npx playwright test tests/unit/subscriptionPeriod.spec.ts --project=import-unit
```

Code reference: `lib/stripe/subscriptionPeriod.ts` (item-level read first);
`app/api/stripe/webhook/route.ts` (`getSubscriptionPeriodEnd`, `subscriptionPeriodEndIso`).

---

## 3. BROADER GATE — post-deploy + RLS

```bash
npm run release:post-deploy        # verify:post-deploy-voels + verify:rls --require-sql
```

Confirms #150 policy live (profiles advisor status gate) and Voels golden fixture intact.

`stripe_subscription_id` column on prod: confirmed EXISTS (text) 2026-06-27. Optional
read-only sanity:

```sql
SELECT id, stripe_subscription_id, subscription_status
FROM profiles WHERE stripe_customer_id IS NOT NULL LIMIT 5;
```

After any sandbox checkout, confirm the row gets `stripe_subscription_id` **populated** —
not just `subscription_status` flipping with a null sub id. Null sub id = silent
activation failure.

---

## 4. #158 TRACK 2 → staging → main/prod

Lands **before** billing for two reasons: reporting marker (clean MRR/revenue post-run)
and prod isolation smokes (safety net banked before billing mutates prod state).

**Clean-slice check (do this before promoting to main):**

- Confirm the main promotion of #158 carries the reporting marker + `PROD_SMOKE_EXCLUDE`
  drop + the ~50-line `request-auth-retry.ts` helper **ONLY**
- Confirm it does **NOT** carry the `E2E_DIAG_ROUTE_AUTH` route probe or the diag stack —
  the probe must never reach the production route via #158
- Fast proof:

```bash
git diff origin/main..feat/prod-canary-track2 -- app/api/advisor/client-export-payload/route.ts
# expect: no output (file untouched)
```

You sliced it clean for staging; this verifies the main promotion is the same slice.
`E2E_DIAG_ROUTE_AUTH` reaching the production route is exactly the kind of thing that
slips in via an adjacent file and lives in prod for a year.

Bank the first prod smoke (don't trust the merge — watch it run):

```bash
npm run audit:prod-foreign-canary-target     # linkPrecondition + foreign target both OK
npm run test:e2e:prod:smoke
```

Read the job log in order:

1. Link active (audit OK) — if this fails it's fixture teardown, not a regression
2. `[security]` advisor isolation blocks **execute** (not skipped)
3. Negative denies the **populated** foreign canary (`canary-advisor-client@`) — clean 403/404, not 500, not accessible
4. Positive reaches linked `canary-consumer@`

See [prod-smoke-canary-runbook.md](./prod-smoke-canary-runbook.md) for fixture recovery.

---

## 5. LIVE BILLING RUN — ✅ attested 2026-06-27

Completed after Gates A + B passed, post-deploy clean, #158/#170 on prod + smoke banked.

- Revenue dashboard reads clean (canary excluded from MRR via reporting marker)
- Real-card checkout → webhook → subscription active verified
- C-4 billing walkthrough complete (Al / 2026-06-27)

**Re-run only if** billing code or Stripe env changes materially.

---

## HOLD (not billing dependencies)

- **#159 retry soak** — mid-soak on staging. Billing run is NOT a reason to
  short-circuit the watch. Promote to main only after several staging isolation runs
  show `request-auth-retry` firing-and-recovering (or a long clean stretch). Remove the
  route probe at that point.
- **#157 parallel restructure** — open only after the #159 soak concludes, so a red
  run is unambiguously restructure-vs-retry.

**CI workflow validation gap (merged ≠ main-gate validated):** Changes to
`.github/workflows/e2e-smoke.yml` (or scripts it invokes) can merge to **`staging`**
without ever running that gate — `e2e-smoke.yml` triggers only on PRs to **`main`**.
Staging-green therefore does not prove the main-branch e2e graph. A promote PR is the
first time the modified workflow is exercised. Same class as the billing-deploy check:
assume nothing until the gate that matters has run. Fix (workflow self-proof before
merge) is #159 territory — do not revert parallel CI on staging mid-soak.

---

### One-line gate summary

Keystone ✅ → **Gate A** (webhook API version = clover) → **Gate B** (real Basil
`subscription.updated` replay → 200) → post-deploy/RLS → **#158** (clean slice, no
probe) + prod smoke banked → **billing**. Hold #159, #157.
