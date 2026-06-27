# Production Smoke Canary — Setup Runbook

**Goal:** re-enable **advisor isolation** smokes in production (linked advisor can see
their client, cannot see others) — then retire `PROD_SMOKE_EXCLUDE` in
`playwright.config.ts`.

**Scope (read this first):** Track 2 delivers **advisor isolation in prod**, not full
advisor feature coverage. Prospect PDF, presets, firm billing, and other advisor
feature smokes **remain staging-only by choice** — they require firm-subscription
provisioning we are not putting on a prod canary. Do not assume "advisor smokes are
on in prod" means those feature specs run; only the isolation/authz subset is in scope.

**Related docs:** [LAUNCH.md](./LAUNCH.md) (canary accounts, cutover steps) ·
[GO_LIVE_E2E.md](./GO_LIVE_E2E.md) (prod smoke harness) ·
[PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) (`test:e2e:prod:smoke`)

**Core principles:** dedicated plain-advisor canary (not admin/superuser), linked
the real way (invite→accept), tested read-only, excluded from real reporting.

The staging fixture (`consumer-advisor-link.setup` + `cross-household-isolation.spec.ts`)
is the template. Prod uses real signup/invite and prod identities — **never** a
hand-made `advisor_clients` row.

---

## What already exists in this repo

| Asset | Location | Notes |
|-------|----------|--------|
| Consumer canary | `canary-consumer@mywealthmaps.com` (`PROD_CANARY`) | Reset: `npm run seed:prod-canary -- --confirm` |
| Role canary accounts | `canary-advisor@`, `canary-advisor-empty@`, etc. | `PROD_ROLE_CANARIES` in `scripts/e2e-test-identities.ts` |
| Role seed (login-only) | `npm run seed:prod-role-canaries -- --confirm` | **Intentionally** no links, subscriptions, or authz data |
| Prod smoke filter | `PROD_SMOKE_EXCLUDE` in `playwright.config.ts` | Drops advisor projects until linked pair lands |
| Cleanup protection | `GO_LIVE_PROTECTED` in `scripts/cleanup-test-accounts.ts` | All `PROD_CANARY_EMAILS` protected from purge |

**Step 1 is largely done.** The seed scripts stopping short of links/subscriptions is
correct design — the safety-sensitive work starts at Step 2 below.

---

## Step 2 — Firm state for link accept (not paid Stripe)

**Two different gates — do not conflate them:**

| Gate | Subscription / firm needed? |
|------|----------------------------|
| **Isolation assertions** (`client-export-payload`, foreign-household 403/404) | **No** — `getUser` + role + link only |
| **`POST /api/advisor/accept-request`** (creates the link) | **Yes** — `getAdvisorClientCapacity` requires `firm_id` + firm `subscription_status` in `active` or `trialing` |

So Step 2 is **not** "provision paid Stripe for feature smokes." It **is** "advisor
canary must have a firm in `active`/`trialing` before accept will succeed." No money
needs to change hands — `trialing` clears the gate.

**Do not** run `seed-prod-role-canaries` alone and go straight to invite→accept.
That script explicitly sets `firm_id: null` and skips billing — accept will **403**
`tier_limit_reached`.

### What each advisor-creation path lands in (code-confirmed)

| Path | `firm_id` | Firm `subscription_status` | Accept works? |
|------|-----------|------------------------------|---------------|
| `seed-prod-role-canaries` | **null** (cleared) | — (no firm row) | **No** |
| Real advisor signup (`bootstrapAdvisorFirm` in `completeSignup.ts`) | Created + linked | **`null`** (not auto-trialing) | **No** until status set |
| Staging E2E (`ensureAdvisorFirmForE2e` in `seed-e2e-lib.ts`) | Created + `firm_members` owner | **`active`** | **Yes** |

Real signup **does not** auto-trial the firm — it inserts the firm with
`subscription_status: null`. Stripe firm checkout is the product path to
`active`/`trialing`; staging bypasses that with `ensureAdvisorFirmForE2e`.

### Recommended prod provisioning (before invite)

**Use the version-controlled script** — not one-off SQL. It transcribes staging's
`ensureAdvisorFirmForE2e` via shared `ensureAdvisorFirmBootstrap`, changing only
`active` → `trialing`:

```bash
npm run seed:prod-role-canaries -- --confirm   # advisor profile (login-only, no firm)
npm run seed:prod-advisor-firm -- --confirm    # firm + owner member + trialing
# then invite → accept (firm BEFORE invite avoids dangling consumer_requested / 409)
```

Implementation: `scripts/seed-prod-advisor-firm.ts` → `ensureAdvisorFirmBootstrap` in
`scripts/seed-e2e-lib.ts` (same writes as staging; status is the only delta).

If accept still **403s**, diff script output against `ensureAdvisorFirmForE2e` —
do not guess missing fields.

**Avoid:** setting only `firms.subscription_status` without `firm_id` linkage and
`firm_members` — works until some other path reads missing fields.

### Feature smokes (out of scope)

Prospect PDF, presets, firm billing specs remain **staging-only** — those may need
real Stripe. Track 2 isolation does not.

### Reference — isolation routes (when enabled)

42 tests tagged `@production` across 12 files. **No file under `tests/e2e/advisor/`**
is `@production`-tagged today.

Security/isolation coverage in prod smoke today:

| Spec / block | Auth | Routes | Subscription gate? |
|--------------|------|--------|-------------------|
| `cross-household-isolation` — **Consumer isolation @production** | consumer canary | `gifting-summary`, `estate-composition`, `export-estate-plan`, `documents`, `data-export` | No (authz / household scope) |
| `cross-household-isolation` — **PostgREST @production** | anon + consumer sign-in | PostgREST `lifetime_exemption_summary` | No |
| `route-authz` — **Consumer role boundaries @production** | consumer | `GET /api/advisor/strategy-tab` (expects 401/403/404) | No |

**Advisor isolation blocks** (advisor-empty, advisor foreign-household denial,
`client-export-payload`) are **not** `@production`-tagged yet. Track 2 adds them
after the linked pair exists.

### Routes the advisor isolation smokes will call (when enabled)

| Route | Gate | Firm subscription required? |
|-------|------|----------------------------|
| `GET /api/advisor/client-export-payload` | `getUser` → `role === advisor` → `advisor_clients` link | **No** — no billing check in route or `loadClientExportPayload` |
| `POST /api/gifting-summary` (foreign household) | Household authz → 403/404 | **No** subscription check in route |
| `POST /api/estate-composition` (foreign household) | Household authz → 403/404 | **No** subscription check in route |
| `GET /api/export-estate-plan` (foreign household) | Authz denial expected | Consumer tier/billing on *success* path; isolation expects **denial** |

`ensureE2eAdvisorFirmSubscriptionActive` is staging fixture setup only
(`consumer-advisor-link.setup.ts`).

### Reference — what prod smoke runs today (`npm run test:e2e:prod:smoke`)

## Step 3 — Give the consumer canary realistic data

Enough to exercise advisor read paths: household, net worth, estate composition,
export payload markers.

- Reset baseline: `npm run seed:prod-canary -- --confirm` (synthetic household on
  `canary-consumer@`)
- Small synthetic dataset is cleaner than cloning real financial data into prod
- If isolation markers are needed (staging uses `seedExportIsolationMarkers`), add
  minimal prod-safe markers after link is established

---

## Step 4 — Link them the real way (NOT a hand-made database link)

### Email is not the mechanism (registered advisor)

When the invited email matches an existing advisor profile, `invite-advisor` inserts
a `consumer_requested` row with **no invite token**. Email is a notification linking
to `/advisor` — acceptance is **`POST /api/advisor/accept-request`** while logged
in (UI or API). **Deliverable inbox not required** for `canary-advisor@` /
`canary-consumer@`.

The token-in-email path applies only to **unregistered** invitees (signup with
`connect=` token).

### Link steps

1. Ensure advisor canary has firm in **`active` or `trialing`** (Step 2).
2. Log in as **consumer canary** → invite **advisor canary** by email.
3. Log in as **advisor canary** → accept the pending request (UI at `/advisor` or API).
4. Confirm (read-only) the link shows **active / accepted**.

Why: invite→accept records consumer consent through real code. A DB-forged
`advisor_clients` row can grant access that shouldn't exist.

**Never** insert `advisor_clients` rows by hand for this pair.

### Retry / 409 recovery (leftover pending state)

If invite succeeds but accept **403s** on firm state, a `consumer_requested` row
remains. A second invite returns **409** ("already have a pending or active
connection") — not a new bug.

**Recovery:** fix firm state (Step 2), then **accept the existing pending row** —
do not invite again. Or clear the pending row first, then re-invite.

Same pattern as 5c leftover-state poisoning, in a manual flow.

---

## Step 5 — Verify isolation MANUALLY, once, before automating

**Do not skip.** This is what lets you trust the automated version.

As **advisor canary** (plain advisor, no admin):

- **Positive:** can read linked consumer canary data (client workspace / export payload).
- **Negative:** cannot reach another household — use a foreign `clientId` or
  `householdId` and confirm **403/404** (not 200, not 500).

Keep it read-only — never mutate prod records during the check.

---

## Step 6 — Exclude canary accounts from real reporting

Flag both linked canaries so they do not count in revenue, signups, analytics, or
admin funnels.

### Reporting audit (2026-06-27 — prod DB read)

| Account | Profile in prod? | `funnel_events` | `account_created` event |
|---------|------------------|-----------------|-------------------------|
| `canary-consumer@mywealthmaps.com` | Yes (since 2026-06-13) | **0** | **0** |
| `canary-advisor@` and other role canaries | **No** (role seed not run on prod) | — | — |

**Finding:** `canary-consumer@` was created via admin seed (`ensureAuthUser`), not
the signup form — so it never fired `account_created` and has **no funnel rows**.
Repeated `seed:prod-canary` re-runs do not inflate funnel metrics.

**Still open:** admin dashboard **profile counts** (`newToday` / `newThisWeek` /
`newThisMonth` in `app/admin/page.tsx`) count all profiles by `created_at` with
**no canary exclusion**. The consumer canary is one row in "new this month" if its
profile `created_at` falls in the window — not from re-seeds, but still visible in
signup-style headline counts. Role canaries, once seeded and linked, will add more
profiles unless excluded.

**Code gap (closed 2026-06-27):** `lib/admin/reportingCanary.ts` — profiles matching
`*canary*@mywealthmaps.com` are excluded from admin headline counts (`newToday` /
`newThisWeek` / `newThisMonth`, `totalUsers`, MRR inputs) and canary-owned firms are
excluded from firm MRR. Pattern-based, not a hardcoded email list.

---

## Step 7 — Wire prod identities into `@production` smoke

1. Add prod env resolution (`.env.test.production`): canary emails, household IDs,
   linked `clientId` / owner user IDs — mirror staging fixture env pattern.
2. Tag the advisor isolation blocks `@production` in
   `cross-household-isolation.spec.ts` (or a dedicated prod-safe subset file).
3. Ensure prod `security` project can run advisor setup against canary storage
   (browser login or pre-minted prod auth files — same session-shape discipline as
   staging CI).

---

## Step 8 — Remove `PROD_SMOKE_EXCLUDE` (one PR) and watch it actually run

Remove the exclusion set in `playwright.config.ts` so advisor projects run in prod.

On the **first** prod run after merge:

- Confirm advisor smokes **executed** — not skipped (`--list` / job log).
- Confirm **green** — wiring isn't banked until you've seen it fire.

Use `npm run test:e2e:prod:smoke -- --workers=1`.

---

## Step 9 — Document the canary as a permanent fixture

Record both accounts and their purpose in:

- [LAUNCH.md](./LAUNCH.md) — prod canary section
- `scripts/e2e-test-identities.ts` — `PROD_CANARY` / `PROD_ROLE_CANARIES`
- Ops note: password in Vercel `E2E_CANARY_PASSWORD` only; never commit

Future-you (or anyone onboarding) should know these accounts are intentional and must
not be deleted during cleanup.

---

## Order of operations summary

```
npm run seed:prod-role-canaries -- --confirm   # 1. advisor profile
npm run seed:prod-advisor-firm -- --confirm    # 2. firm → trialing (BEFORE invite)
npm run seed:prod-canary -- --confirm          # consumer data (if needed)
→ invite → accept (checkpoint: accept 200)
→ manual isolation hand-check (negative case deliberate)
→ reporting exclusion ✅ → @production tags ✅ → drop PROD_SMOKE_EXCLUDE ✅
```

**Manual isolation (Step 5) before removing the filter (Step 8).** Prove by hand once,
then let automation keep proving it.

---

## After Track 2 lands

| Still open | Notes |
|------------|--------|
| **#157** serial restructure | Architecture debt in `cross-household-isolation.spec.ts`; not this flake's local cause, but still fragile |
| **PR #156 retry watch** | Monitor `request-auth-retry` in staging isolation CI over several runs |
| **getSession route probe** | Remove once captured-or-clean (`E2E_DIAG_ROUTE_AUTH` gated) |
