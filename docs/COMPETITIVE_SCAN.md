# Competitive scan — My Wealth Maps

**Date:** 2026-06-07  
**Scope:** Code + docs review vs leading consumer fintech, RIA planning tools, and legal-tech platforms.  
**Purpose:** Prioritized backlog to close competitive gaps over time — not a market-share study.

**Related:** [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) · [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)

---

## Positioning summary

MWM targets **$2M–$30M households** with a **living estate + financial planning dashboard** that consumers maintain, advisors collaborate on, and attorneys use for intake prep.

| Persona | Closest comps | MWM wins when… | MWM loses when… |
|---------|---------------|----------------|-----------------|
| **Consumer** | Trust & Will, Personal Capital, advisor PDFs | Complex estate, ongoing readiness, advisor-linked plan | User wants doc drafting, Plaid sync, simple mobile app |
| **Advisor** | eMoney, MGP, Holistiplan | Estate-first RIA, engagement between meetings, B2B2C | RIA needs aggregation, CRM, full cash-flow, AUM reporting |
| **Attorney** | Clio, WealthCounsel | Intake prep, gap visibility, vault collaboration | Firm needs PMS, drafting, e-sign, multi-attorney firm |

**Core moat:** one household dataset, three roles, RLS-scoped — consumer owns data; advisor collaborates; attorney reads/uploads.

**Unusual engineering strengths:** WCPA deletion pipeline, RLS audit trail, cross-surface `verify:estate` matrix.

---

## Competitive grades (code scan)

| Dimension | vs industry leaders | Grade |
|-----------|---------------------|-------|
| Consumer estate depth | Ahead of Trust & Will / Vanilla on modeling | **A−** (target segment) |
| Consumer simplicity / mobile | Behind mass-market apps | **C** |
| Advisor estate workspace | Ahead on collaboration; behind on OS breadth | **A−** (estate RIAs) |
| Advisor as eMoney/Orion replacement | Not in scope | **D** |
| Attorney intake/collaboration | Ahead on financial intel; behind on PMS/drafting | **B+** (adjunct) |
| RLS / tenant isolation | Above typical early-stage fintech | **Strong** |
| WCPA / deletion | At or above GDPR-ready indie SaaS | **Strong** |
| Estate verification suite | Category differentiator | **Strong** |
| E2E coverage | Broad (~254+ tests); not CI-gated | **Competitive** |
| API contract discipline | Partial Zod; thin OpenAPI | **Adequate** |
| Accessibility | No a11y CI | **Gap** |

---

## Prioritized backlog

Status key: `[ ]` not started · `[~]` in progress · `[x]` done

### High impact (competitive + revenue)

| # | Item | Status | Doc section |
|---|------|--------|-------------|
| H1 | [Attorney FK alignment](#h1-attorney-fk-alignment-vault--invite-flows) | `[x]` wired — run `npm run repair:attorney-fks:dry-run` on prod if needed | Fix before attorney GTM scale |
| H2 | [Account linking / import friction](#h2-account-linking--import-friction-plaid--custodian-csv) | `[x]` Phase A — custodian guides + header aliases | Biggest consumer/advisor gap vs PC/eMoney |
| H3 | [CI Playwright smoke on PR](#h3-ci-playwright-smoke-on-pr) | `[x]` workflow added — enable `E2E_SMOKE_IN_CI=true` | Match how mature fintech ships |
| H4 | [Mandatory MFA for privileged roles](#h4-mandatory-mfa-for-privileged-roles) | `[x]` wired — **`REQUIRE_PRIVILEGED_MFA=false` until go-live** | Banking-grade baseline |

### Medium impact (differentiation depth)

| # | Item | Status |
|---|------|--------|
| M1 | Expand `assertHouseholdAccess` to all household-scoped API routes + shared Zod schemas | `[x]` |
| M2 | Consumer document vault (self-upload) — without full doc generation | `[x]` `/settings/documents` |
| M3 | Wire `verify:estate:voels` into post-deploy checklist / cron | `[x]` daily cron self-heals Voels MC + verify; manual `verify:post-deploy-voels` |
| M4 | Shared rate-limit store (Upstash/Redis) — replace in-memory `simpleRateLimit` | `[x]` Upstash when env set; memory fallback |
| M5 | Attorney Stripe products live + attorney E2E suite expansion | `[ ]` |

### Lower impact (scale polish)

| # | Item | Status |
|---|------|--------|
| L1 | Accessibility program — eslint-jsx-a11y + axe-playwright on critical paths | `[ ]` |
| L2 | Mobile E2E expansion (automate LAUNCH_CHECKLIST mobile smoke items) | `[x]` `consumer-mobile-review.spec.ts` Track 2 steps 13–19; `npm run test:e2e:mobile` |
| L3 | Post-migration RLS verify script in CI against staging | `[ ]` |
| L4 | OpenAPI or typed API contract for `/api/consumer/*` | `[ ]` |
| L5 | Firm multi-seat for attorneys (parity with advisor firms) | `[ ]` |

---

## High impact items — what should change

### H1: Attorney FK alignment (vault + invite flows)

**Problem**

In 2026, `attorney_clients` was migrated to the canonical model:

- `attorney_id` → `attorney_listings.id` (not `auth.users.id`)
- `client_id` → `households.id` (not consumer `profiles.id`)

Migration: `supabase/migrations/20260630100000_attorney_clients_fk_listing_household.sql`

Newer attorney APIs use the correct pattern via shared helpers:

- `lib/attorney/verifyAttorneyHouseholdAccess.ts`
- `lib/attorney/attorneyClientCap.ts` → `getAttorneyListingIdForUser()`

**Legacy paths still use the old model** — attorney vault upload and invite accept will fail or write inconsistent rows:

| File | Issue |
|------|--------|
| `app/api/documents/upload/route.ts` | Checks `attorney_clients.attorney_id = user.id` instead of listing id |
| `app/api/attorney/invite/route.ts` | Inserts `attorney_id: user.id` |
| `app/attorney-invite/[token]/page.tsx` | Sets `client_id: user.id` (auth uid) instead of `households.id` |

**What “done” looks like**

1. **Upload route** — replace inline connection check with `verifyAttorneyHouseholdAccess(supabase, user.id, household_id)` (same as `document-requests`, `matter`, `notes`).
2. **Invite route** — resolve `listingId = getAttorneyListingIdForUser()` before insert; store `attorney_id: listingId`.
3. **Invite accept page** — on accept, set `client_id` to consumer’s `households.id` via `resolveConsumerHouseholdId()`, not `user.id`.
4. **Data repair** — one-time SQL or script to fix any prod rows where `attorney_id` is still a profile uuid or `client_id` is owner uuid instead of household uuid.
5. **E2E** — attorney upload + invite accept spec against canonical FK model.

**Why high impact**

Attorney portal is a B2B2C distribution channel. Broken vault upload or invite accept blocks the freemium → paid attorney funnel and undermines trust vs Clio’s reliable client portal.

**Effort:** ~1–2 days focused (routes + migration script + E2E).

**Shipped (2026-06-07):** `verifyAttorneyHouseholdAccess` on document upload; listing id on invite; household id on invite accept; `npm run repair:attorney-fks`.

---

### H2: Account linking / import friction (Plaid + custodian CSV)

**Problem**

Leading consumer and advisor platforms assume **automatic account sync** (Plaid, Schwab/Fidelity feeds, Orion). MWM requires manual entry or generic CSV/XLSX import (`/import`, `ingestion_jobs`).

Explicit product decision deferred Plaid:

- `docs/SPRINT_FRICTION_REDUCTION.md` — “No Plaid. No new tables.”
- `docs/ROADMAP.md` — friction sprint without aggregation

**What exists today**

- CSV/XLSX import with field mapping: `app/(dashboard)/import/`, `app/api/ingest/`, `app/api/import/commit/`
- Custodian **label** normalization in `lib/import/type-normalizer.ts` (Schwab, Fidelity, Vanguard account type strings → internal types) — but **no dedicated custodian export templates or guided “export from Schwab” UX**

**What “done” looks like (phased — Plaid optional)**

**Phase A — No Plaid (recommended first, ~1 sprint)**

1. **Custodian template library** — downloadable sample CSVs + step-by-step “Export from Schwab/Fidelity/Vanguard” help on `/import`.
2. **Smarter auto-mapping** — extend `type-normalizer.ts` + header detection for common custodian export column names.
3. **Import progress UX** — show “last imported”, row count, link to re-import; reduce fear of stale data.
4. **Advisor-visible import status** — surface “data last updated” on client Overview (already partially via staleness checks in advisor loaders).

**Phase B — Plaid (~2–4 sprints, schema + compliance)**

1. Plaid Link integration (consumer-only initially).
2. New tables: `linked_accounts`, sync jobs, token storage (encrypted).
3. Map Plaid holdings → `assets` / `liabilities` with dedup vs manual rows.
4. Privacy policy + data retention updates; Plaid agreement in Terms.
5. Tier gate: Estate tier or advisor-connected households.

**Why high impact**

#1 friction complaint vs Personal Capital / eMoney is re-keying balances. For $2M–$30M users with many accounts, manual entry is the main drop-off point in onboarding wizard and the main reason advisors keep Orion as system of record.

**Competitive note:** Phase A closes ~40% of the gap at ~10% of Plaid cost/complexity.

---

### H3: CI Playwright smoke on PR

**Problem**

~254+ Playwright tests exist (`tests/e2e/`, `docs/PLAYWRIGHT_E2E.md`) including:

- `cross-household-isolation.spec.ts` — IDOR matrix
- `test:e2e:go-live-profile` — profile + spouse layout
- `test:e2e:security-smoke` — health, referral, Monte Carlo

**CI today** (`.github/workflows/ci.yml`) runs only:

- ESLint, production build, security-audit.sh, UX language audit, route slug validation, import-unit tests

**E2E is manual / pre-release only** — below how mature fintech ships (Betterment, Stripe-adjacent startups run smoke E2E on every PR).

**What “done” looks like**

**Tier 1 — PR smoke (~1 day)**

Add GitHub Actions job with secrets:

- `PLAYWRIGHT_*` from `.env.test`
- `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (staging or dedicated E2E project)

Run against **preview URL** or `localhost` + `npm run build && start`:

```bash
npm run test:e2e:go-live-profile -- --workers=1
npm run test:e2e:security-smoke -- --workers=1
```

**Tier 2 — Nightly full suite**

Scheduled workflow: `npm run test:e2e:complete -- --workers=1` + `npm run verify:estate:e2e`.

**Tier 3 — Post-deploy gate**

After Vercel prod deploy: `npm run verify:estate:voels` (already scripted).

**Why high impact**

You have invested heavily in E2E; without CI, regressions ship silently — especially RLS/IDOR and billing handoffs. Competitors at similar stage treat security-isolation tests as merge blockers.

**Effort:** Tier 1 ~1 day; Tier 2 ~2 days (flake tuning, secrets, staging DB).

**Shipped (2026-06-07):** `.github/workflows/e2e-smoke.yml` — off until `E2E_SMOKE_IN_CI=true`. Pre-launch enable steps: [LAUNCH_CHECKLIST § GitHub Actions E2E smoke](./LAUNCH_CHECKLIST.md#github-actions-e2e-smoke-pre-go-live).

**M3 cron (2026-06-07):** `/api/cron/post-deploy-verify` daily 9:00 UTC — `ensureVoelsMonteCarloCached()` then 7 checks. Manual: `npm run verify:post-deploy-voels`; immediate: `npm run smoke:mc-voels`.

---

### H4: Mandatory MFA for privileged roles

**Problem**

MFA is **implemented but opt-in**:

- Enroll: `/mfa-enroll`, challenge: `/mfa-challenge`, settings: `/settings/security`
- Middleware enforces AAL2 **only if user already enrolled** (`middleware.ts` lines 141–155)

There is **no requirement** for:

- `profiles.is_admin` / superusers
- Advisors with active `advisor_clients`
- Attorneys with vault access
- Admin portal `/admin`

Leading fintech and SOC 2–ready SaaS typically **require** 2FA for anyone with access to other users’ financial data.

**What “done” looks like**

1. **Policy definition** — which roles must enroll within N days of first login (admin: immediate; advisor/attorney: before first client connection).
2. **Middleware gate** — after role check, if `requiresMfa(role)` and no verified TOTP factor → redirect to `/mfa-enroll` (not optional skip).
3. **Admin portal** — block `/admin` until MFA enrolled (stricter than consumer).
4. **Grace period** — existing users: banner + 14-day deadline before hard block.
5. **Recovery** — document support process for lost authenticator (Supabase admin reset).
6. **Launch checklist** — flip Supabase “Secure email change” + document MFA requirement in Privacy Policy / Terms.

**What not to change**

- Consumer-only users with no advisor/attorney links can stay opt-in MFA (reduce signup friction for mass funnel).
- Or: require MFA only at Estate tier / paid subscription — product decision.

**Why high impact**

You store estate values, beneficiary names, document vault PDFs, and WCPA deletion capability. A compromised advisor or admin account is a **firm-wide** breach. Mandatory MFA is table stakes for enterprise advisor sales and reduces regulatory narrative risk (WCPA + “reasonable security”).

**Effort:** ~2–3 days (middleware + enroll UX + policy docs + comms).

**Shipped (2026-06-07):** `lib/security/privilegedMfaPolicy.ts`, middleware + `requireAdminApi` gates, `REQUIRE_PRIVILEGED_MFA` env (default **false**). Set `REQUIRE_PRIVILEGED_MFA=true` in Vercel Production at go-live; keep **false** in `.env.test` for Playwright.

---

## Medium / lower items (brief)

| ID | Change |
|----|--------|
| **M1** | Audit all `app/api/**` routes that accept `householdId`; add `assertHouseholdAccess` (today only ~5 routes use it). Prevents IDOR if RLS ever misconfigured. |
| **M2** | Let consumers upload PDFs to `legal_documents` (today attorney-upload + consumer download; no self-serve vault). Closes gap vs Trust & Will without building doc generation. |
| **M3** | Add `verify:estate:voels` to post-deploy runbook / optional Vercel hook — operationalizes verification moat. |
| **M4** | `lib/api/simpleRateLimit.ts` is in-memory per serverless instance — ineffective at scale; move to Upstash Redis. |
| **M5** | Attorney billing: create Stripe products, set `STRIPE_PRICE_ATTORNEY_*`, expand `tests/e2e/attorney/` beyond 2 specs. |
| **L1–L5** | See prioritized backlog table above. |

---

## Where MWM is already ahead (don’t regress)

- Multi-horizon estate tax + strategy sandbox (GRAT/SLAT/ILIT/CST/DAF)
- Advisor collaboration ledger (recommend → accept/decline/withdraw)
- Gap workflow + meeting prep + prospect PDF mode
- Estate readiness score (6 subcategories)
- Domicile analysis + move breakeven
- WCPA deletion (`deleteUser`, audit log, admin UI, `verify:deletion`)
- Cross-surface verification (`verify:estate`, Verify my plan on Security settings)
- RLS audit baselines (`docs/audits/`)

---

## Suggested sequencing

```
Quarter 1 (pre/post go-live)
  H1 Attorney FK fix
  H3 CI Tier 1 smoke
  H4 MFA for admin + advisors (minimum)

Quarter 2 (growth)
  H2 Phase A custodian import UX
  M1 assertHouseholdAccess sweep
  M3 post-deploy verify:estate

Quarter 3+ (scale)
  H2 Phase B Plaid (if metrics justify)
  M2 consumer vault
  L1 accessibility CI
```

---

## Evidence index

| Area | Paths |
|------|-------|
| Product positioning | `docs/PRODUCT_STRATEGY.md` |
| Consumer flows | `docs/CONSUMER_FLOWS.md`, `app/(dashboard)/` |
| Advisor portal | `app/advisor/`, `components/advisor/` |
| Attorney portal | `app/(attorney)/`, `lib/attorney/` |
| Deletion / WCPA | `lib/compliance/deleteUser.ts`, `app/admin/_components/DeletionCompliance.tsx` |
| Verification | `lib/verify/`, `scripts/verify-estate-suite.ts` |
| E2E | `tests/e2e/`, `docs/PLAYWRIGHT_E2E.md` |
| CI | `.github/workflows/ci.yml` |
| MFA | `middleware.ts`, `app/(auth)/mfa-enroll/` |
| Import | `app/(dashboard)/import/`, `lib/import/type-normalizer.ts` |
| RLS audits | `docs/audits/`, `scripts/verify-loose-rls-policies.sql` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-07 | Voels cron MC self-heal — daily `/api/cron/post-deploy-verify` backfills then verifies |
| 2026-06-07 | M1–M4 shipped: household access sweep, consumer document vault, post-deploy verify cron, Upstash rate limits |
| 2026-06-07 | H1–H4 wired: attorney FK fix, custodian import Phase A, e2e-smoke workflow, privileged MFA flag |
| 2026-06-07 | Initial competitive scan + prioritized backlog (code review session) |
