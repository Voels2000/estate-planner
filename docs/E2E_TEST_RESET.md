# E2E test reset (go-live v2)

One-time migration from legacy Playwright accounts to canonical **`@mywealthmaps.test`** identities that do not receive production mail.

**Drip verification:** `npm run verify:drip` — replaces manual `consumer21@rolobe` inbox check (historical).

**Source of truth:** [scripts/e2e-test-identities.ts](../scripts/e2e-test-identities.ts)

---

## Canonical accounts

| Role | Login email | Password | Notes |
|------|-------------|----------|--------|
| Consumer (tier 3) | `e2e-consumer@mywealthmaps.test` | `E2eTest!2026Mwm` | Full household + assets; `PLAYWRIGHT_HOUSEHOLD_ID` |
| Consumer (tier 1) | `e2e-consumer-tier1@mywealthmaps.test` | same | Upgrade-banner Playwright project |
| Advisor portal | `e2e-advisor@mywealthmaps.test` | same | Linked to Johnson client |
| Advisor client | `e2e-client.johnson@mywealthmaps.test` | same | Michael Johnson demo (RMD tab) |
| Attorney portal | `e2e-attorney@mywealthmaps.test` | same | Newsletter kit on `/attorney` |
| Advisor listing (no login) | `e2e-advisor-listing@mywealthmaps.test` | — | `?ref=e2eadv01` |
| Attorney listing (no login) | `e2e-attorney-listing@mywealthmaps.test` | — | `?aref=e2eatt01` |
| Drip smoke | `e2e-drip@mywealthmaps.test` | — | Verify via `npm run verify:drip` |

**Public tests** need no login — they hit marketing/event routes only.

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
- Run Michael Johnson advisor client seed + link advisor ↔ client
- Seed attorney listing + portal with `e2eatt01`
- Print a complete **`.env.test` block** — copy into your local `.env.test`

### 2. Pre-flip automated smoke (after seed)

```bash
npm run test:e2e:go-live-profile
```

Profile save, slim-profile layout, inline `ProfileFieldPrompt` UI, and partial PATCH merge — see [GO_LIVE_E2E.md](./GO_LIVE_E2E.md).

Faster (skips Johnson client assets):

```bash
npm run seed:e2e:fast
```

Partial seed:

```bash
npx dotenv-cli -e .env.local -e .env.test -- npx tsx scripts/seed-e2e-fixtures.ts --only=consumer,attorney
```

### 3. Update `.env.test`

Copy the printed block from step 1, or start from [.env.test.example](../.env.test.example) and fill `PLAYWRIGHT_HOUSEHOLD_ID` from seed output. The block must include **`NEXT_PUBLIC_SUPABASE_URL`** (same project as Vercel / `.env.local`).

Verify Auth passwords (optional):

```bash
npm run verify:e2e-auth
```

Setup projects auto-sync the canonical password (`E2eTest!2026Mwm`) before UI login when `SUPABASE_SERVICE_ROLE_KEY` is present.

### 4. Prune Playwright test debris (optional, before each full run)

Removes `Playwright*` assets, strategy rows, and family members from the E2E consumer household — does **not** delete users.

```bash
npm run prune:e2e
```

### 5. Run the suite

```bash
npm run test:e2e:complete -- --workers=1
```

---

## Retire legacy accounts

After `.env.test` points at the new emails and CI passes:

1. Review [scripts/cleanup-test-accounts.ts](../scripts/cleanup-test-accounts.ts) `PROTECTED` list (legacy emails are still protected until you remove them).
2. Delete disposable legacy users:

```bash
dotenv -e .env.local -- npx tsx scripts/cleanup-test-accounts.ts --legacy
```

3. Remove legacy emails from `PROTECTED` once deleted.

**Retire all @rolobe accounts:**

```bash
npm run cleanup:rolobe
```

Confirms before delete; logs to `deletion_audit_log`.

---

## What stays manual

- [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) — dollar checks, Stripe C-4, drip DB verify (`verify:drip`)
- Full signup → Supabase `profiles.referral_code` attribution (sessionStorage is automated)
- Import API against **local** `PLAYWRIGHT_BASE_URL=http://localhost:3001` when testing F-2 migrations

---

## Related docs

- [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) — pre-flip profile + inline prompt gate
- [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) — commands and spec index
- [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md) — automated vs manual map
