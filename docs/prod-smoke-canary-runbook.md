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

## Step 2 — Firm subscription provisioning

**Confirmed not required for isolation-only smokes — skip unless tagging advisor
feature smokes (prospect PDF, presets, billing) for prod.**

Isolation routes gate on `getUser` + `role === advisor` + `advisor_clients` link —
**not** on Stripe or firm subscription. `ensureE2eAdvisorFirmSubscriptionActive`
is staging fixture setup only (`consumer-advisor-link.setup.ts`); it was never part
of the isolation path, only of feature tests we are not enabling in prod.

| If you enable… | Subscription needed? |
|----------------|---------------------|
| **Isolation-only** (Track 2 scope) | **No** — authenticated plain advisor + invite→accept link |
| **Advisor feature smokes** (out of scope) | **Yes** — firm checkout / `ACTIVE_FIRM_STATUSES` |

Do not provision a comped Stripe subscription preemptively. An unnecessary comped
sub pollutes revenue reporting and creates exclusion work.

### Reference — what prod smoke runs today (`npm run test:e2e:prod:smoke`)

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

`ensureE2eAdvisorFirmSubscriptionActive` appears in **staging** `consumer-advisor-link.setup.ts`
only — not in prod smoke specs. **Step 2 action: skip.**

---

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

1. Log in as **consumer canary** → invite **advisor canary** by email.
2. Log in as **advisor canary** → accept the request.
3. Confirm (read-only) the link shows **active / accepted**.

Why: invite→accept records consumer consent and activates through real code. A
DB-forged link can grant access that shouldn't exist — the bug class guarded against
throughout staging isolation work. Applies doubly in production.

**Never** use `seed-prod-role-canaries` or admin SQL to insert `advisor_clients` rows
for this pair.

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

**Code gap:** `GO_LIVE_PROTECTED` (cleanup script) ≠ analytics exclusion. No
`PROD_CANARY_EMAILS` filter exists in funnel queries or profile signup aggregates
today. Step 6 should add explicit exclusion before linking adds two more accounts.

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
Accounts (mostly done)
  → Step 2: SKIP (isolation-only — not subscription-gated)
  → Step 3: seed consumer data
  → Step 4: link (invite → accept)
  → Step 5: manual isolation proof  ← do not skip
  → Step 6: reporting exclusion (profile counts + future linked pair)
  → Step 7: wire prod env + @production tags (isolation blocks only)
  → Step 8: remove PROD_SMOKE_EXCLUDE + confirm run green
  → Step 9: document in LAUNCH.md
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
