# E2E test reset (go-live v2)

One-time migration from legacy Playwright accounts to canonical **`@mywealthmaps.test`** identities that do not receive production mail.

**Staging vs production:** Run `seed:e2e` on your **staging Supabase project** for CI and `.env.test`. Production seeds only when intentionally testing prod. Full flow: [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md).

**Drip verification:** `npm run verify:drip` — replaces manual `consumer21@rolobe` inbox check (historical).

**Source of truth:** [scripts/e2e-test-identities.ts](../scripts/e2e-test-identities.ts)

---

## Stripe re-key on staging (after new sandbox / new `sk_test_`)

When staging Stripe keys or price IDs change, **null dangling Stripe columns** on test profiles before billing E2E — otherwise checkout fails with HTTP 500 (`No such customer` / `No such price`) even when Vercel env is correct.

```bash
# Requires .env.local → staging Supabase (ref cmzyxpxfyvdvbsykjvsg)
npm run reset:staging-stripe
```

Clears on every `@mywealthmaps.test` + canonical E2E email: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status` → `none`, `subscription_plan`, `subscription_period_end`.

**Checkout guards (code):** `lib/app-url.ts` `getOrigin()` · `lib/billing/processConsumerCheckout.ts` customer retrieve-or-create · see [DECISION_LOG.md § Stripe checkout cross-environment guards](./DECISION_LOG.md).

**Smoke:** `PLAYWRIGHT_BASE_URL=https://estate-planner-staging.vercel.app npx playwright test tests/e2e/consumer/consumer-tier1-billing-checkout.spec.ts --project=consumer-tier1-setup --project=consumer-tier1 --workers=1`

---

## Connection billing fixture reset (staging)

When manually walking advisor connection billing on staging, reset **`e2e-advisor-empty@mywealthmaps.test`** before each spine pass — otherwise stale `advisor_clients` rows, invites, or Stripe qty drift from prior walks.

```bash
npm run reset:staging-e2e-advisor-empty-billing
```

Requires `.env.test.staging` (staging Supabase + Stripe test keys). Clears connected clients + pending invites, re-seeds connection checkout state (`client_limit`, `billing_floor`, Stripe subscription qty).

**Invite-accept walk helper** (after #197 merge): `TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/walk-staging-invite-accepts.ts` — lists pending invite URLs for the empty-advisor firm.

### Attorney connection billing (staging)

Reset **`e2e-attorney@mywealthmaps.test`** before attorney connection billing walks:

```bash
npm run reset:staging-e2e-attorney-connection-billing
```

Seeds pending `consumer_requested` rows for `/attorney/requests`. Spine (after reset):

```bash
npm run walk:staging-attorney-connection-accepts   # accept #1 + checkout gate on #2
npm run walk:staging-attorney-step4                # checkout sim → accept #2 → raise → accept #3
```

Inspect: `npx tsx scripts/inspect-staging-attorney-billing-state.ts`

Proof checklist: [ATTORNEY_RAISE_CONNECT_PARITY_FIX.md](./ATTORNEY_RAISE_CONNECT_PARITY_FIX.md) staging re-walk (step 4 = raise + accept 3rd).

See [CONNECTION_BILLING_STICKY_FLOOR_FIX.md § Post-merge staging proof](./CONNECTION_BILLING_STICKY_FLOOR_FIX.md#post-merge-staging-proof-live-in-order).

---

## Canonical accounts (keep forever)

| Role | Login email | Password | Notes |
|------|-------------|----------|--------|
| Consumer (tier 3) | `e2e-consumer@mywealthmaps.test` | `E2eTest!2026Mwm` | Full household + assets; `PLAYWRIGHT_HOUSEHOLD_ID` |
| Consumer (tier 1) | `e2e-consumer-tier1@mywealthmaps.test` | same | Upgrade-banner Playwright project |
| Advisor portal | `e2e-advisor@mywealthmaps.test` | same | Firm owner (`ensureAdvisorFirmForE2e`) + linked client below |
| Advisor (zero clients) | `e2e-advisor-empty@mywealthmaps.test` | same | Connection-billing spine walks; firm `MWM E2E Empty Advisory` |
| Advisor client | `e2e-advisor-client@mywealthmaps.test` | same | Rich FL household (401k, IRA, domicile, RMD E2E); **3 `asset_beneficiaries` on 401k** (verified by `verifyE2eAccounts()`) |
| Attorney portal | `e2e-attorney@mywealthmaps.test` | same | Newsletter kit on `/attorney` |
| Golden path (optional) | `e2e-golden-path@mywealthmaps.test` | same | Stage-1 onramp smoke |
| Advisor listing (no login) | `e2e-advisor-listing@mywealthmaps.test` | — | `?ref=e2eadv01` |
| Attorney listing (no login) | `e2e-attorney-listing@mywealthmaps.test` | — | `?aref=e2eatt01` |
| Drip smoke | `e2e-drip@mywealthmaps.test` | — | Verify via `npm run verify:drip` |

**Also keep (real demo / user-specific — not @mywealthmaps.test):**

| Account | Purpose |
|---------|---------|
| `avoels@comcast.net` | Advisor “My Plan” demo source of truth |
| `avoels@outlook.com` | Consumer “Voels Household” + `verify:estate --preset voels` |
| `david@gmail.com` | Personal — protected |
| `stephen.a.voels@sbcglobal.net` | Personal — protected |
| Other real beta users | Add emails to `GO_LIVE_PROTECTED` in `cleanup-test-accounts.ts` before purge |

**Public tests** need no login — they hit marketing/event routes only.

---

## Go-live database cleanup

**Pre-launch gate:** Full checklist (purge, re-seed, compliance admin cleanup, sign-off) —
[this doc § Go-live database cleanup](#go-live-database-cleanup) (also [LAUNCH.md](./LAUNCH.md) Gate 1 pre-flip smoke).

**Production auth table (2026-06-07):** **10 accounts** — canonical `@mywealthmaps.test` + Voels + `david@gmail.com` + `stephen.a.voels@sbcglobal.net`. Purge removed last stragglers (`e2e-client.johnson@`, `test1@rolobe.resend.app`). Re-run purge before flip if new test signups accumulated.

**Keep everything in the protected list:**

1. Canonical `@mywealthmaps.test` accounts (table above)
2. Voels + personal accounts in `GO_LIVE_PROTECTED` ([scripts/cleanup-test-accounts.ts](../scripts/cleanup-test-accounts.ts))

**Delete all other auth users (WCPA-safe):**

```bash
# Preview KEEP vs DEL
npm run cleanup:purge:dry-run

# Execute — uses lib/compliance/deleteUser.ts + deletion_audit_log
npm run cleanup:purge
# or non-interactive:
npm run cleanup:purge -- --yes
```

Each deletion clears household data, owner tables, advisor/attorney links, FK sweep, then Auth — with in-process verification. Post-check: `npm run verify:deletion -- --email user@example.com`.

**Legacy one-off cleanup** (rolobe list / retired E2E emails only — superseded by purge for go-live):

```bash
npm run cleanup:rolobe
dotenv -e .env.local -- npx tsx scripts/cleanup-test-accounts.ts --legacy
```

**Do not** delete arbitrary emails without checking `PROTECTED` / `GO_LIVE_PROTECTED` in the cleanup script.

After purge, re-seed automation accounts if needed:

```bash
npm run seed:e2e
npm run verify:estate:e2e
```

---

## Full reset (recommended before go-live)

### 1. Seed all fixtures on target Supabase

Requires `.env.local` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and optional `.env.test` for `PLAYWRIGHT_BASE_URL`.

```bash
npm run seed:e2e
```

This will:

- Create or reset auth users (passwords set to `E2eTest!2026Mwm`)
- Seed estate-tier consumer household + sample assets + completed health check
- Mark terms accepted and advisor-invite onboarding complete (dashboard smoke)
- Seed tier-1 consumer household
- Seed advisor portal user + directory row with `e2eadv01`
- Seed **E2E advisor client** (`e2e-advisor-client@`) with rich advisor workspace data + link to advisor
- Seed attorney portal user + directory row with `e2eatt01`
- **Verify** all `@mywealthmaps.test` profiles
- Print a complete **`.env.test` block** — copy into your local `.env.test`

Faster (skips linked advisor client household):

```bash
npm run seed:e2e:fast
```

### 2. Pre-flip automated smoke (after seed)

```bash
npm run test:e2e:go-live-profile
npm run verify:estate:e2e
```

### 3. Update `.env.test`

Copy the printed block from step 1, or start from [.env.test.example](../.env.test.example) and fill `PLAYWRIGHT_HOUSEHOLD_ID` from seed output.

**Billing smoke (optional):** `PLAYWRIGHT_STRIPE_WEBHOOK_SECRET` · `PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID` — see [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · `npm run test:e2e:billing`

### 4. Prune Playwright test debris (optional)

```bash
npm run prune:e2e
```

### 5. Run the suite

```bash
npm run test:e2e:complete -- --workers=1
```

---

## Retired: Michael Johnson

`e2e-client.johnson@mywealthmaps.test` and `michael.johnson.demo@local.estate` are **legacy**. Advisor workspace E2E data now lives on **`e2e-advisor-client@mywealthmaps.test`**, seeded by `seedE2eAdvisorClientHousehold()` in `seed-e2e-lib.ts`.

Playwright auth state: `.auth/advisor-client.json` (was `johnson-client.json`).

---

## What stays manual

- [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) — dollar checks, Stripe C-4, drip DB verify
- Voels post-deploy: `npm run verify:estate:voels`
- Full signup → Supabase `profiles.referral_code` attribution (sessionStorage is automated)
