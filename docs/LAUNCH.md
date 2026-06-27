# LAUNCH.md — single source of truth for go-live

**Last updated:** 2026-06-26 (cutover steps 0–4 attested; refund ack on staging; step 5 open)
**Supersedes:** `docs/archive/LAUNCH_CHECKLIST.md`, `docs/archive/LAUNCH_GATE.md`, `docs/archive/RELEASE_ROUTINE.md`

Status target before launch: **B&O-READY**  
= every box below checked **except** `(B&O-blocked)` items and Bucket C (flip sequence).  
When the WA DAS/B&O ruling lands: resolve Bucket A, then run Bucket C in order.

**Checkbox vocabulary**

```
[x]  done — evidence recorded inline
[ ]  open
(verify: ...)   code-verifiable; check only when command/file passes
(attest: __ / YYYY-MM-DD)   ops fact; human initials + date
(B&O-blocked)   wait for WA SaaS/DAS ruling
```

**Related (not absorbed):** [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [BILLING_DISCLOSURES_CHECKLIST.md](./BILLING_DISCLOSURES_CHECKLIST.md) · [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) · [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md) · [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md) · [TIER_RESTRUCTURE_INDEX.md](./TIER_RESTRUCTURE_INDEX.md) (tier restructure outcomes)

**Working tracker (manual attestations):** [LAUNCH_TRACKER_SYNC.md](./LAUNCH_TRACKER_SYNC.md) — browser UI at `tools/launch-tracker.html` (`npm run launch:tracker`); sync to this file via `npm run sync:launch-tracker`.

**Migrations before flip:** per-environment pairing — apply on staging before staging deploy, on production before/at production deploy (not both at staging-merge time). See [DEPLOYMENT.md § Migration gate](./DEPLOYMENT.md#1-apply-migrations-ongoing--prevents-schema-drift) and `bash scripts/apply-migration.sh staging|production …`. Vercel does not run migrations.

**Canonical seed:** `npm run seed:e2e` only (legacy `seed-test-*.ts` scripts removed).

---

## Bucket A — Blocked by the B&O / WA SaaS-DAS ruling (small, by design)

- [ ] WA SaaS / DAS sales-tax position finalized (the ruling itself) (B&O-blocked)
- [ ] Stripe Tax: collect WA sales tax at checkout — on/off decision (B&O-blocked)
- [ ] ToS tax-treatment section — counsel pre-drafts **both** branches now; one-line swap when ruling lands (B&O-blocked for final selection)
- [ ] ToS §13 (Governing Law / Dispute Resolution) — counsel sign-off tied to final tax branch (B&O-blocked)

---

## Bucket B — Do-now, fully completable BEFORE the ruling

### B1. Redeploy + automated smoke (do first)

- [x] Vercel redeploy of latest `main` (attest: Al / 2026-06-09)
- [x] `npm run release:preflight` (verify: **green** — 2026-06-09; lint/build/unit + RLS JWT + go-live-profile **17/17** + security-smoke **5/5**; `--workers=1`)
- [x] `npm run test:e2e:go-live-profile` (verify: **17/17** — 2026-06-09; spouse field `id`s + `npm run build` before local run; `--workers=1`)
- [x] `npm run test:e2e:security-isolation` (verify: **10/10** — 2026-06-09; stray `advisor_clients` link to e2e-consumer pruned via `pruneStrayE2eAdvisorClientLinks` in seed/prune)
- [x] `npm run test:e2e:cross-role` (verify: green — 2026-06-09; `advisor-client-setup`)
- [x] `npm run release:post-deploy` (verify: **Voels 7/7 + RLS 3/3** — 2026-06-09; `SUPABASE_DB_URL` in `.env.local` only — Session pooler URI from Supabase **Connect → Copy**, must be `SUPABASE_DB_URL=postgresql://...`; region must match project e.g. `us-west-2`)
- [x] `npm run test:e2e:prod:smoke -- --workers=1` (verify: **40/42 passed, 2 advisory skips** — 2026-06-09; `.env.test.prod` live `PLAYWRIGHT_ADVISOR_FIRM_*` aligned with Vercel `STRIPE_PRICE_ADVISOR_*_MONTHLY`; skips: webhook (`PLAYWRIGHT_STRIPE_WEBHOOK_SECRET` unset) + referral 429 (in-memory limits without Upstash); `--workers=1`)
- [x] E2E environment guard in place and proven to fire (`scripts/testEnv.ts` → `tests/e2e/globalSetup.ts`). Target/env mismatch, localhost-in-remote, Supabase-ref mismatch, leaked-prod-secret, and unguarded production runs all hard-fail at `globalSetup`. `resolveE2eEmail` gated so production uses real canary credentials. Staging tier-1 billing: 3/3. Prod consumer canary auth: green. (attest: Al / 2026-06-23)

### B2. TERMS-1

- [x] Signup checkbox sets `terms_accepted_at` on account creation (verify: `app/(auth)/signup/_signup-form.tsx:64-67,73,101` — metadata on `signUp`; email-confirm path syncs profile via `app/auth/callback/route.ts:40-54` → `recordTermsAcceptance`)
- **Deferred (post-B&O-READY, not blocking launch):** persist `terms_version` at signup — checkbox/metadata today writes only `terms_accepted_at`; `recordTermsAcceptance` sets `terms_version` from `TERMS_OF_SERVICE_VERSION` (`lib/legal/terms-of-service-sections.ts:5`) on callback/accept page, not in signup metadata. Follow-up: add `terms_version` to signup metadata or call `recordTermsAcceptance` on immediate session path.

### B3. CI discipline (production secrets never in GitHub; staging-only secrets now OK)

**Revised rule (2026-06-13):** The original “no secrets in GitHub” rule applied while **production and CI shared one Supabase project**. That condition no longer holds — local + Preview use **staging** (`cmzyxpxfyvdvbsykjvsg`); Production uses **prod** (`fnzvlmrqwcqwiqueevux`). See [DEPLOYMENT.md](./DEPLOYMENT.md).

**Still never in GitHub:** production Supabase keys, **production** `SUPABASE_DB_URL`, production Stripe/Resend/cron secrets, `.env.test.prod` contents.

**Now actionable:** E2E/RLS workflows on PRs to `main` use **staging-only** repository secrets + `E2E_SMOKE_IN_CI` / `RLS_VERIFY_IN_CI`. Staging **`SUPABASE_DB_URL`** (session pooler) enables `rls-verify --require-sql` in CI. Details: [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md) · [DEPLOYMENT.md §7](./DEPLOYMENT.md#7-github-actions).

**Today on GitHub:** `.github/workflows/ci.yml` → **`verify`** (lint + **`tsc --noEmit`** + unit; full build on PR → `main`) · `e2e-smoke.yml` · `rls-verify.yml` (`--require-sql`) · `staging-keepalive.yml`. Merged [PR #8](https://github.com/Voels2000/estate-planner/pull/8) 2026-06-14; hardened [PR #27](https://github.com/Voels2000/estate-planner/pull/27) 2026-06-17.

**Enforcement (automated):** GitHub branch protection — `main`: **`verify`** + **`e2e-smoke`** + **`rls-verify`**; `staging`: **`verify`** only (`staging-pr-gate`). Require PR before merge on both.

**Enforcement (manual — mandatory):** See [ENVIRONMENT_TESTING.md § Release discipline](./ENVIRONMENT_TESTING.md#release-discipline--what-to-run-when).

- [x] Branch protection on `main`: **`verify` + `e2e-smoke` + `rls-verify` required**; PR required; admins included (attest: Al / 2026-06-14)
- [x] Confirm **no production** credentials in GitHub Actions secrets/variables (attest: Al / 2026-06-13)
- [x] Local release discipline adopted (attest: Al / 2026-06-13)
- [x] Two-DB split live: Preview → staging; Production → prod (attest: Al / 2026-06-13)
- [x] Staging keep-alive workflow on `main` and green in Actions (attest: Al / 2026-06-13)
- [x] Restore E2E/RLS PR workflows with **staging-only** GitHub secrets — `E2E_SMOKE_IN_CI` + `RLS_VERIFY_IN_CI` true; 8 staging secrets; green on PRs #8–#10 (attest: Al / 2026-06-14)
- [x] CI hardening + staging branch — `tsc --noEmit`, `rls-verify --require-sql`, `staging-pr-gate` (attest: Al / 2026-06-17 · PR #27)
- [x] Pre-launch security fixes — token logging, cron fail-closed, admin MFA routes, introduce hardening, email-capture rate limit (attest: Al / 2026-06-17 · PR #28; E2E security-smoke 5/5 + isolation 20/20)
- [x] Cross-household isolation in **`e2e-smoke`** CI — `test:e2e:security-isolation` (20 tests); gate-validated break/revert on `requireHouseholdAccess` (attest: Al / 2026-06-17 · PR #30)

### B3b. Staging → main promotion (pre-launch hardening — not the flip)

Accumulated security/correctness on **`staging`** (PRs #28–#39). Does **not** open prod signups or retire flip blockers. Canonical runbook: [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md).

- [ ] Prod secrets confirmed — `RECOMPUTE_SECRET`, `CRON_SECRET`, `INTERNAL_API_KEY` on `estate-planner` (attest: __ / __)
- [ ] Prod migration verified — `20260718120000_attorney_drip_unsubscribed_at.sql` present (`supabase migration list` or `information_schema`) (attest: __ / __)
- [ ] Staging→`main` PR merged on green CI (`verify` + `e2e-smoke` + `rls-verify`) (attest: __ / __)
- [ ] Prod deploy green; post-deploy passive smoke — recompute/cron logs OK; checkout **block paths** 403/409 (defer live Stripe charge to real-card test) (attest: __ / __)

### B4. Manual smokes — automated on staging where noted

**PR gate (`e2e-smoke`):** `test:e2e:b4-gate` + `test:e2e:security-isolation` (20 cross-household tests) — prospect form logic, health-score behaviors, playbook empty/activation, drip step-1 DB assert.

**Preflight only (`release:preflight`):** `test:e2e:b4-deep` — full PDF narrative HTML (slow).

**Still manual (irreducible):**

- [ ] Prospect step 10 — BCC inbox (`avoels@comcast.net`) (attest: __ / __)
- [ ] Drip cron steps 2/3 (day 3 / day 7) unless backdated cron run on staging (attest: __ / __)
- [ ] End-to-end fresh signup on **production URL** — AT-FLIP only (`PUBLIC_SIGNUP_OPEN=true`) (attest: __ / __)

**Automated walkthroughs (staging seed + specs — PR #12 `test:e2e:b4-gate` / preflight `b4-deep`):**

- [x] Prospect + Mobile — Track 1 steps 3–9, 11 + PDF header (`b4-prospect-form.spec.ts`); Track 2 steps 13–19 (`consumer-mobile-review.spec.ts`, `test:e2e:mobile`) (attest: CI / PR #12 e2e-smoke 2026-06-14)
- [x] Health Score + Advisor Playbook — **10 documented behaviors** (not 18 numbered steps in repo): score/context, strategy badge, health-check labels, stale prompt, playbook empty + activation (`b4-health-score.spec.ts`, `b4-playbook-activation.spec.ts`) (attest: CI / PR #12 e2e-smoke 2026-06-14)
- [x] PDF narrative engine — steps 1–9 content (`b4-pdf-narrative.spec.ts`, preflight) (attest: local preflight 2026-06-14)
- [x] Drip step 1 — `email_captures.drip_step_1_sent_at` (`b4-drip-step1.spec.ts` + `npm run verify:drip`) (attest: CI / PR #12 e2e-smoke 2026-06-14)

### B5. Stripe (code wired; live config is ops-attested)

**Machine-verifiable on `main` (attested 2026-06-15):**

- [x] Admin env verifier: `GET /api/admin/verify-env` + `lib/env/manifest.ts` + `lib/env/verifyEnv.ts` (verify: `app/api/admin/verify-env/route.ts`, PRs #3/#5)
- [x] `?live=1` retrieves each `STRIPE_PRICE_*` / advisor / attorney price via `stripe.prices.retrieve()` and fails on missing/inactive (verify: `lib/env/verifyEnv.ts`, PR #12)
- [x] Production consumer price throw-guard: `resolveConsumerPriceId` throws when unset in `VERCEL_ENV=production` (verify: `lib/billing/stripePrices.ts:99-110`, PR #4)
- [x] **Live prod attestation (keys + prices):** `GET /api/admin/verify-env?live=1` on `www.mywealthmaps.com` → `missing` empty, `liveness.stripe: LIVE_OK`, **11/11** live prices `active` (6 consumer + 3 advisor + 2 attorney) (attest: Al / 2026-06-15)
- [x] **Live prod attestation (post-webhook secret fix):** re-run `verify-env?live=1` after `STRIPE_WEBHOOK_SECRET` aligned in Vercel Production → still `missing` empty, `LIVE_OK`, 11/11 `active` (attest: Al / 2026-06-15)
- [x] **Post-cutover re-attest (Plan & Export price live):** `verify-env?live=1` on prod after `sk_live_` fix → `missing` empty, `LIVE_OK`, **12/12** live prices `active` (attest: Al / 2026-06-25)
- [x] **Live Stripe webhook plumbing:** endpoint on canonical `www.mywealthmaps.com`, signing secret aligned in Vercel Production, delivery confirmed **200** on resend (e.g. `customer.created`) — prior attestation assumed delivery; this proves it (attest: Al / 2026-06-15)
- [x] **`?live=1` webhook event subscriptions:** canonical www endpoint subscribed to all 5 handler events; MISSING → `LIVE_FAIL` (verify: `lib/env/stripeWebhookVerify.ts`, PR #15)
- [x] **`?live=1` price `tax_behavior`:** INFO-only per live price (pending WA B&O ruling — report, do not assert) (verify: `lib/env/verifyEnv.ts`, PR #15)

**What `verify-env?live=1` proves:** live Stripe key mode, every configured price ID is real, active, and wired in Vercel Production env.

**What webhook resend proves:** endpoint reachable, signature verifies, handler returns 200.

**What neither proves:** a real `checkout.session.completed` activating a subscription in-app — only the real-card smoke below exercises checkout → live webhook → subscription active.

**Ops — still open (human / card-required):**

- [ ] Vercel dashboard housekeeping: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` rename if needed; declare `PUBLIC_SIGNUP_OPEN`, `REQUIRE_PRIVILEGED_MFA`, `EMAIL_FROM`; delete dead vars (`STRIPE_CUSTOMER_PORTAL_URL`, `RESEND_WEBHOOK_SECRET` if present) (attest: __ / __)
  - [x] **`SENTRY_AUTH_TOKEN`** — verify-env REVIEW is expected; keep on Vercel for source maps (attest: Al / 2026-06-21)
  - [x] **Dead vars absent** — `STRIPE_CUSTOMER_PORTAL_URL`, `RESEND_WEBHOOK_SECRET` not on Production or Preview (attest: Al / 2026-06-21 · `vercel env ls`)
  - [x] **Production vs Preview env names** — two-DB split healthy; live prices/webhook Production-only (attest: Al / 2026-06-21)
  - [x] **`PUBLIC_SIGNUP_OPEN` / `REQUIRE_PRIVILEGED_MFA` / `EMAIL_FROM`** — present on Production (`verify-env` vars OK, 2026-06-21)
- [ ] C-4 manual walkthrough on prod: signup → checkout → active → cancel → deletion schedule — [BILLING_DISCLOSURES_CHECKLIST.md](./BILLING_DISCLOSURES_CHECKLIST.md) (attest: __ / __)
- [ ] One real-card live smoke, smallest tier, refund/cancel after verify — **proves live checkout → `checkout.session.completed` → subscription active** (attest: __ / __)

### B6. Legal / entity (ops-attested, ex-tax)

- [x] Legal placeholders in product (verify: `lib/legal/company.ts` → `/terms`, `/privacy`)
- [ ] ~~Counsel sign-off ToS §10, §11~~ → **post-go-live** (revenue approaching nexus in first state) — attest: Al / 2026-06-20
- [ ] ~~Counsel redline privacy policy (#60)~~ → **post-go-live** (same gate) — engineering draft live on `/privacy`; matrix Q1–Q10 deferred
- [x] **Household-alert copy counsel review** — six consumer `estate_*` alerts (`lib/alerts/estateHouseholdAlerts.ts`, merged #51): fact-not-advice voice (state user's data → name structure/observation → redirect to licensed professional). **Counsel review complete — passed.** (attest: Al / 2026-06-19)
- [x] WA LLC UBI / EIN / registered agent confirmed on SOS (attest: __ / __)
- [x] Business bank account open (attest: __ / __)
- [x] B&O / DOR account registered (attest: __ / __ — confirm w/ accountant OK pre-ruling)
- [ ] Email aliases `security@`, `legal@` live (`privacy@` routed) (attest: __ / __)

### B7. Database cleanup (prod one-time done; ongoing purge is staging-only)

**Production one-time cleanup** — synthetic rows removed; prod holds exactly three protected auth users (`david@gmail.com`, `avoels@comcast.net`, `canary-consumer@mywealthmaps.com`). Never run `cleanup:purge` against production.

- [x] One-time prod cleanup executed (attest: Al / 2026-06-13)
- [x] `canary-consumer@mywealthmaps.com` in `GO_LIVE_PROTECTED` (verify: `scripts/cleanup-test-accounts.ts:76`)
- [x] PROTECTED list verified (verify: `scripts/cleanup-test-accounts.ts:70-97` — includes `@mywealthmaps.test` cast, go-live emails, rolobe list, canary)
- [x] Purge safety guards on production ref (verify: `assertPurgeTargetSafe` at `scripts/cleanup-test-accounts.ts:35-55`)

**Staging purge** (low-stakes; repeatable anytime `.env.local` points at staging):

- [x] Confirm staging target: `.env.local` → staging Supabase, not prod (verify: [DEPLOYMENT.md §3](./DEPLOYMENT.md#3-environment-files-local))
- [ ] When needed: `npm run cleanup:purge:dry-run` → `npm run cleanup:purge` → `npm run seed:e2e` (attest: __ / __ — staging only)

### B8. Engineering gates (shipped on `main` — spot-check only)

- [x] `app/robots.ts` — public routes allowed, sitemap live (verify: `app/robots.ts:5-37`)
- [x] Security hardening manual smoke 4/4 (2026-05-30)
- [x] Deletion / WCPA / privacy compliance code (Sprint C-6/C-7)
- [x] Billing code + B2B2C handoff + pricing surfaces
- [x] Production `@production` smoke harness (`test:e2e:prod:smoke`, canary subset)
- [x] Prod canary reset: `npm run seed:prod-canary -- --confirm` (verify: `package.json`, `scripts/seed-prod-canary.ts`, `PROD_CANARY` in `scripts/e2e-test-identities.ts:19-23`)
- [x] **Track 2 — advisor↔consumer prod canary:** [runbook](./prod-smoke-canary-runbook.md) — link pair + manual isolation ✅; reporting marker + `@production` advisor isolation + `PROD_SMOKE_EXCLUDE` removed (watch first prod run for advisor blocks executing). **Before live billing:** [pre-billing-run-sheet.md](./pre-billing-run-sheet.md).
- [x] Two-DB steady-state docs + scripts on `main` (verify: `docs/DEPLOYMENT.md`, PR #6)
- [x] **`lifetime_exemption_summary` PostgREST IDOR closed** — revoke `anon`/`authenticated` on SECURITY DEFINER view; CI invariant #6 + isolation attack-sim (PR #16; prod migration applied 2026-06-15)
- [x] Stale estate-readiness banner shipped (`isScoreStale()` wired in `EstateReadinessCard`; PR #12)
- [x] WA state estate tax — Regime D attested against RCW 83.100.040 (restored by ESB 6347, eff. 2026-07-01): 10–20% schedule, $3.0M frozen exemption; golden vectors taxable $6M→$910,000, $8M→$1,295,000, $9M→$1,490,000, $10M→$1,690,000; Engine B + migrations `20260613120000` / `20260613140000`; live DOR web page may show SB 5813 35% schedule until republished post-07-01 — attest against statute/reference manual (verify: `tests/unit/waRegime.spec.ts`, `lib/estate/waRegimeDorGoldens.ts`; attest: Al / 2026-06-15)
- [ ] `handle_new_user` + signup defaults migrations applied on prod (verify: fresh signup → `subscription_status = 'none'`, `consumer_tier = 1`)
- [ ] Optional: Upstash Redis for referral rate limits (falls back to in-memory; prod smoke skips 429 assertion until configured)

---

## Bucket C — Gate 2 flip sequence (DO NOT run until B&O-READY)

**Rule:** Do NOT set `PUBLIC_SIGNUP_OPEN=true` until every Bucket B box is checked.

### Tier restructure code gate — **CLOSED on staging** (2026-06-25)

Consumer billing enforcement PRs are merged to **`staging`** and verified. This gate is **not** the same as `PUBLIC_SIGNUP_OPEN` — it means the restructured tier model is safe to cut over on production **before** the signup flip.

- [x] **PR 1** — `trial_ends_at`, `has_ever_subscribed`, `resolveEffectiveTier` (staging + prod migration path documented)
- [x] **PR 2** — input vs computed boundary ([INPUT_COMPUTED_BOUNDARY.md](./INPUT_COMPUTED_BOUNDARY.md))
- [x] **PR 3** — Tier 0 dashboard slice ([TIER0_DASHBOARD_PR3.md](./TIER0_DASHBOARD_PR3.md))
- [x] **PR 4** — projections split (Tier 1 modeling gate)
- [x] **PR 5** — `trialDays: 0` + Subscribe CTA; `npm run verify:pr5-staging-gate` green on staging
- [x] **PR 6** — inputs-only consumer data export (#120)
- [x] **PR 7** — Plan & Export deliverable rules (#123)
- [x] **PR 8** — E2E persona matrix in `npm run seed:e2e` (tiers 0–3, app trial, Plan & Export purchaser) — see [TIER_RESTRUCTURE_INDEX.md](./TIER_RESTRUCTURE_INDEX.md)
- [x] **Audit Pass 2** — resolver G1/G2, deliverable B2–B5 migrations, Stripe Check C (#126, #127); E2E break-gates confirmed on staging

**Hard ordering (tier restructure):** The **prod cutover** (steps 0–5 below) is **not** the signup gate flip. It gets tier-restructure code safely onto production. `PUBLIC_SIGNUP_OPEN=true` is Gate 2 — a separate day, still blocked on B&O-READY and real-card smoke. Do not compress cutover and flip into one session.

**Principle (PR 4.5 / #117 lesson):** Migrations and config reach prod **before** the code that depends on them — with a **verify-the-schema-is-present** gate between migration and deploy. Not "apply migration, deploy code" — "apply migration, **prove** columns/tables exist on the prod DB, **then** deploy code."

**Before step 1:** Confirm Supabase PITR/backups ON ([PRE_FLIP §A](./PRE_FLIP_CHECKLIST.md#a-hard-blockers--broken-product-or-serious-exposure-if-skipped)). Pre-launch blast radius is tiny (three protected auth users). Know the schema rollback below before applying migrations — pre-flip only; after `PUBLIC_SIGNUP_OPEN`, use PITR not column drops.

**Schema rollback (pre-flip only — verified against forward files 2026-06-25):**

| Forward migration | Creates | Reverse complete? |
|-------------------|---------|-------------------|
| `20260624140000_one_time_purchases.sql` | `one_time_purchases` table, 3 indexes, RLS + owner-read policy | Yes — `DROP TABLE` drops table-attached indexes/policies; no standalone types/sequences |
| `20260724120000_tier_restructure_pr1_trial_columns.sql` | `trial_ends_at`, `has_ever_subscribed` on `profiles`; data UPDATEs; **`handle_new_user()` replaced** | **Partial** — column drops below; also restore prior `handle_new_user()` from `supabase/migrations/20260527130500_fix_signup_subscription_defaults.sql` |

**Reverse order** (opposite of Step 1 apply): `20260724120000` first, then `20260624140000` (habit for dependent migrations; these two are independent today).

```sql
-- Reverse 20260724120000 (apply first if reversing both)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS trial_ends_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS has_ever_subscribed;
-- Then re-run CREATE OR REPLACE FUNCTION handle_new_user() body from
-- 20260527130500_fix_signup_subscription_defaults.sql (forward file also replaced this).

-- Reverse 20260624140000 (apply second)
DROP TABLE IF EXISTS public.one_time_purchases;
```

**When to reverse vs re-apply:** Step 2 query fails → migration may not have applied — diagnose (wrong DB target, permissions) and **re-run forward**; don't reverse. Reverse only when forward **applied but is wrong**. After gate flip, trial column drops destroy real data — PITR is the recovery path.

### Post-cutover pending migrations (pre-flip)

Apply **per environment** before the code that writes these columns — staging before staging merge/deploy; production before/at production deploy ([DEPLOYMENT.md § Migration gate](./DEPLOYMENT.md#1-apply-migrations-ongoing--prevents-schema-drift)).

| Forward migration | Adds | Reverse |
|-------------------|------|---------|
| `20260726120000_one_time_purchases_refund_ack.sql` | `refund_ack_at`, `refund_ack_version` on `one_time_purchases` (nullable) | `ALTER TABLE public.one_time_purchases DROP COLUMN IF EXISTS refund_ack_at, DROP COLUMN IF EXISTS refund_ack_version;` |
| `20260726130000_profiles_advisor_select_status_gate.sql` | `profiles` advisor SELECT requires `advisor_clients.status IN ('active','accepted')` | Re-run forward file (DROP/CREATE policy) — **applied staging + prod 2026-06-26** ([#150](https://github.com/Voels2000/estate-planner/pull/150)) |

**Verify after apply:**
```sql
SELECT refund_ack_at, refund_ack_version FROM one_time_purchases LIMIT 1;  -- must not 42703
```

**Pairs with:** Plan & Export refund-ack checkbox PR — server gate at checkout API; ack persisted on `one_time_purchases` at webhook fulfillment. Step 5 Plan & Export real-card smoke should run **after** this code is on prod.

### Tier restructure prod cutover — steps 0–5 (then stop)

| Step | Status | Attestation |
|------|--------|-------------|
| **0** Docs reconciliation | ✅ | [PR #128](https://github.com/Voels2000/estate-planner/pull/128) merged |
| **1** Prod migrations (no code) | ✅ | `20260624140000` + `20260724120000` applied prod (Al / 2026-06-25) |
| **2** Schema gate on prod | ✅ | `trial_ends_at` / `one_time_purchases` queries pass (Al / 2026-06-25) |
| **3** Promote → deploy | ✅ | [PR #130](https://github.com/Voels2000/estate-planner/pull/130) → `main`; CI quartet green; Vercel prod deploy not skipped (Al / 2026-06-25) |
| **4** Post-deploy verify | ✅ (partial) | Resolver + canary browser + `verify-env` below; **`release:post-deploy` not attested** |
| **5** Live-money smoke | ⬜ | Follow [pre-billing-run-sheet.md](./pre-billing-run-sheet.md) first (Gates A/B, #158, prod smoke bank); then real-card + C-4 billing walkthrough |

**Step 4 attestation detail (Al / 2026-06-25–26):**
- `GET /api/admin/verify-env?live=1` → `missing: []`, `LIVE_OK`, **12/12** prices active
- **Resolver (prod DB):** `canary-consumer@mywealthmaps.com` → tier 3 active-paid deliverable; `avoels@comcast.net` → **superuser+consumer tier 3** (post [#134](https://github.com/Voels2000/estate-planner/pull/134)); `david@gmail.com` → tier 1 read-only (never sign in)
- **Browser:** canary sign-in + dashboard on `www.mywealthmaps.com`
- **Stripe account guard:** `sk_live_` + correct account on prod
- **Open:** `npm run release:post-deploy` (Voels 7/7 + RLS 3/3)

**Step 0 — Land docs reconciliation.** [PR #128](https://github.com/Voels2000/estate-planner/pull/128) merged (LAUNCH + PRE_FLIP migration runbooks aligned through `20260724120000`). Execute from reconciled docs only — do not reconcile mid-cutover.

**Step 1 — Migrations to prod only (no code).** Apply in timestamp order via `bash scripts/apply-migration.sh production …`:
- `supabase/migrations/20260624140000_one_time_purchases.sql`
- `supabase/migrations/20260724120000_tier_restructure_pr1_trial_columns.sql`

Vercel does not run migrations; this is a deliberate manual step against prod Supabase.

**Step 2 — Verify schema present on prod (gate between migration and code).** Run against the **prod** DB — migration "applied" ≠ "present on prod DB":
```sql
SELECT trial_ends_at, has_ever_subscribed FROM profiles LIMIT 1;   -- must not 42703
SELECT 1 FROM one_time_purchases LIMIT 1;                           -- must not "relation does not exist"
```
Both must succeed. If either fails, **stop** — deploying code now would drop every consumer to tier 0 (PR 1) or error every deliverable check (PR 7). Do not skip because step 1 "looked like it worked."

**Step 3 — Promote staging → `main` and deploy to prod.** [PR #130](https://github.com/Voels2000/estate-planner/pull/130) merged staging→`main`; CI green (`verify` + `e2e-smoke` + `rls-verify` per branch protection); Vercel prod deploy **not skipped** (attest: Al / 2026-06-25). Carries the full inventory delta (tier restructure PRs 1–8, export, deliverable rules, guards, audit). Step 2 passed → code lands on schema that supports it.

**Step 4 — Verify on prod immediately (before trusting anything).**
- `npm run release:post-deploy` — Voels gate + RLS SQL verify (standard Gate 4).
- `GET /api/admin/verify-env?live=1` on prod → `missing` empty, `liveness.stripe: LIVE_OK`, prices active (re-run even if attested 2026-06-15 — env may have changed).
- **Prod canary tier-resolution** — sign in as `canary-consumer@mywealthmaps.com`; confirm effective tier resolves correctly and dashboard renders (`getUserAccess` against real prod schema). If step 2 passed but canary resolves to tier 0, stop before any real user sees it.
- **Stripe account guard (live)** — confirm prod asserts `sk_live_` + correct account; money-path guard must not throw.

**Prod test pass:** same suite as staging for resolver/gate/boundary logic; exclude automated live-charge — replace with step 5 manual real-card smoke.

**Step 5 — Live-money checks (deliberate, real card).** P0: one real-card live smoke (checkout → `checkout.session.completed` → subscription active), smallest tier, refund/cancel after. Plus C-4 billing walkthrough. Proves deliverable/subscription paths on live Stripe now that PR 7 is in the cutover.

**Then stop.** Steps 0–5 complete the cutover. Gate flip (`PUBLIC_SIGNUP_OPEN=true`, fresh-email signup smoke) is Gate 2 below — separate operation when B&O-READY clears.

`getUserAccess` fails loud on profile read errors — but a missing column still means every consumer page errors until step 1 lands (PR 4.5 / #117 lesson).

### Dashboard unlock gate — prod cutover (no migration)

Code-only change. Rollback = **deploy revert** (restores old gate, not data). Canary `seed:prod-canary` adds income/expenses rows — **inert under old gate** (wizard+score+anydata already passed); note in PR if reverting so seed history vs row count is not surprising.

**Before push — pick one mitigation for the step 1→2 window** (canary blocked on new gate until re-seed):
- **A.** Run steps 1 and 2 back-to-back (minimal red), or
- **B.** Silence canary alerts first — **set a reminder to re-arm** (silenced canary worse than momentary red).

| Step | Action | Status |
|------|--------|--------|
| 1 | Deploy gate code to prod | ✅ #141 |
| 2 | `npm run seed:prod-canary -- --confirm` (canary only — password from `.env.test.production` `PLAYWRIGHT_CONSUMER_PASSWORD`) | ✅ 2026-06-26 |
| 3 | `npm run audit:dashboard-gate` — canary income present + unlocked; avoels + david unlocked | ✅ 2026-06-26 |
| 4 | Confirm canary monitoring/alerting **live again** post-cutover | ✅ prod smoke re-enabled (#142) |

**Prod smoke pause (cutover window):** removed in #142 — `@production` consumer setup always runs; no `PLAYWRIGHT_CANARY_CUTOVER_PAUSE` hook.

**Staging vs prod:** Staging merge + verify exercises gate logic, onramp UI, and E2E seeds — it does **not** run `seed:prod-canary` (prod-only write). Green staging ≠ canary re-seeded. Step 3 `audit:dashboard-gate` against prod is the first real proof that step 2 landed.

**Step 2 password:** in `.env.test.production` as `PLAYWRIGHT_CONSUMER_PASSWORD` (same value as Vercel `E2E_CANARY_PASSWORD`). Run `npm run seed:prod-canary -- --confirm` — no shell prefix needed. One-shot override still works: `E2E_CANARY_PASSWORD='…' npm run seed:prod-canary -- --confirm`.

### Gate 2 — Go-live day sequence (in order)

1. Verify Bucket B — every checkbox above is checked
2. Verify tier-restructure prod cutover steps 0–5 above are complete (schema verified on prod **before** code deploy; post-deploy canary tier-resolution green)
3. **Env pre-check:** `GET /api/admin/verify-env?live=1` with `x-admin-token` → `missing` empty, `liveness.stripe: LIVE_OK`, all live prices `active` — **attested Al / 2026-06-15**; **re-attested Al / 2026-06-25** (12/12 active post-cutover); re-run before flip if env changes
4. Supabase Auth → confirm email-confirm flow is ON for production project
5. Verify `/auth/callback` works on production (sign in with existing account)
6. Set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production environment variables
7. Redeploy (trigger Vercel redeploy from dashboard or push empty commit)
8. Core smoke with a FRESH email address (not a test account):
   - Sign up → confirm email → profile → wizard → dashboard → billing upgrade
9. `npm run release:post-deploy` (Voels gate + RLS SQL verify)
10. Check Stripe Dashboard: new subscription appears under the fresh signup customer

### Expanded flip steps (same order — do not reorder)

**1. Supabase Dashboard first** — Authentication → Settings:

- [ ] Email confirmations → **ON**
- [ ] Secure email change → **ON**
- [ ] Minimum password length → **12**

**2. Verify auth callback**

- [ ] Production build includes `/auth/callback`
- [ ] Test signup → confirm email → login on staging with a fresh address

**3. Flip Vercel Production env**

- [ ] `PUBLIC_SIGNUP_OPEN` = `true`
- [ ] `REQUIRE_PRIVILEGED_MFA` = `true` (admin/advisor/attorney). Keep **`false`** in Preview, `.env.test`, and CI.
- [ ] **Redeploy** (required after env change)

**4. Verify signup surfaces**

- [ ] `https://mywealthmaps.com/signup` → signup form (not `/waitlist`)
- [ ] Homepage **Get Started** → `/signup`
- [ ] `/login` works; `/signup?invite=…` still works

**5. Fresh-email smoke**

- [ ] Core §1–3 — [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)

**Re-enable waitlist:** remove `PUBLIC_SIGNUP_OPEN` from Vercel Production and redeploy.

---

## Bucket D — Post-go-live + ongoing

### Gate 3 — Post-launch ops (first 72 hours)

- [ ] Day 1: Verify first real signup appears in Supabase `auth.users`
- [ ] Day 1: Confirm drip step 1 email delivered (check Resend activity log)
- [ ] Day 3+: `npm run verify:drip -- --email [first real signup email]` — confirms step 2 scheduled
- [ ] Day 7: Attorney drip steps 2 & 3 — manual DB check once a real attorney has registered:

```sql
SELECT attorney_drip_step_1_sent_at, attorney_drip_step_2_sent_at, attorney_drip_step_3_sent_at
FROM profiles WHERE role = 'attorney' LIMIT 5;
```

- [ ] Week 1: Check Vercel logs for any `[triggerEstateHealthRecompute]` errors
- [ ] Week 1: Check compliance cron — `COMPLIANCE_EMAIL` inbox for alerts

### Gate 4 — Production (after every Vercel deploy of `main`)

```bash
npm run release:post-deploy
```

Runs: `verify:post-deploy-voels` + `verify:rls --require-sql` (needs `SUPABASE_DB_URL` in `.env.local` only — never GitHub).

**Optional** prod browser smoke:

```bash
PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com npm run test:e2e:prod:smoke -- --workers=1
```

**When:** Within 30 minutes of every production deploy that changes auth, RLS, billing, or estate math.

### Release routine (every meaningful PR)

| Gate | Command / action |
|------|------------------|
| Local minimum (any PR) | `npm run release:local` |
| Local full (sensitive paths — see ENVIRONMENT_TESTING) | `npm run release:preflight -- --workers=1` |
| Preview | Vercel Preview build green + spot-check if auth/billing touched |
| CI (GitHub — **no secrets**) | **`verify` only** — lint, build (placeholders), unit tests |
| Production (after deploy) | `npm run release:post-deploy` (+ optional `test:e2e:prod:smoke`) |

**Credential policy:** [ENVIRONMENT_TESTING.md § Credential policy](./ENVIRONMENT_TESTING.md#credential-policy--two-database-steady-state). **Deploy matrix:** [DEPLOYMENT.md](./DEPLOYMENT.md). **Commit-type matrix:** [ENVIRONMENT_TESTING.md § Release discipline](./ENVIRONMENT_TESTING.md#release-discipline--what-to-run-when).

---

## Phase 0 inventory notes (2026-06-12 consolidation)

**Duplicates resolved:** Stripe C-4, counsel ToS, email aliases, E2E preflight, CI discipline — merged into Bucket B.

**Conflicts resolved:**

| Item | Resolution |
|------|------------|
| robots.txt | [x] — `app/robots.ts:5-37` (GATE had open; CHECKLIST had done) |
| TERMS-1 | [x] `terms_accepted_at` at signup (`_signup-form.tsx:101`); `terms_version` deferred post-launch (callback sets via `recordTermsAcceptance`) |
| Purge guard | [x] `assertPurgeTargetSafe` — prod ref abort unless `--force` (`cleanup-test-accounts.ts:35-55`) |
| seed scripts | Canonical `npm run seed:e2e` only |
| Migration count | Not pinned — use `db push` / dashboard compare |

**References updated (2026-06-13):** `MASTER_ARCHITECTURE.md`, `DECISION_LOG.md`, `ROADMAP.md`, `DEPLOYMENT.md`, `ENVIRONMENT_TESTING.md` aligned to two-DB steady state. `CALCULATION_ENGINES.md` unchanged.

---

## Launch status scoreboard (2026-06-15)

**Bucket B:** **45 of 55** checked (10 open).

**Done since 2026-06-14:** B4 app-logic automated (PR #12) · stale-score UI · B5 live `verify-env?live=1` + webhook delivery + webhook-event verifier (PR #15) · `lifetime_exemption_summary` IDOR closed on staging + prod (PR #16).

**Launch blockers (pre-flip):** consolidated checklist → [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md).

| Priority | Item | Bucket |
|----------|------|--------|
| **P0** | One real-card live smoke (checkout → `checkout.session.completed` → subscription active) | B5 |
| **P0** | WA B&O / DAS ruling | A |
| **P1** | C-4 billing walkthrough on prod | B5 |
| **P1** | Email aliases (`security@`, `legal@`) | B6 |
| **Post-go-live** | Counsel ToS §10/§11 + privacy redline (first-state nexus / revenue) | B6 / Bucket D |
| **P2** | BCC inbox, drip cron 2/3, optional Vercel dashboard housekeeping | B4 / B5 |
| **AT-FLIP** | Fresh prod signup smoke | B4 / C |

---

## Prompt 2 sweep scoreboard (2026-06-09, superseded — see above)

**Bucket B:** **45 of 55** checked (10 open).

**Checked this sweep:** B1 Vercel redeploy · B1 release:preflight (full green) · B1 go-live-profile (17/17) · B1 security-isolation (10/10) · B1 cross-role · B1 post-deploy (Voels 7/7 + RLS 3/3) · B1 prod smoke (40/42, 2 advisory skips) · B2 TERMS-1 · B6 legal placeholders (prior) · B7 PROTECTED + purge guards · B8 robots/security/deletion/billing/prod harness (prior).

**Still open — verify (re-run locally):**

| Item | Action |
|------|--------|
| B1 prod smoke optional passes | Set `PLAYWRIGHT_STRIPE_WEBHOOK_SECRET` (live `whsec_`) in `.env.test.prod`; enable Upstash on Vercel for 429 test |
| B8 signup defaults on prod | Fresh signup → `subscription_status = 'none'`, `consumer_tier = 1` |

**Still open — attest (Al):** B4 irreducible (BCC inbox, drip cron 2/3) + AT-FLIP fresh signup · B5 real-card smoke + C-4 walkthrough (+ optional Vercel dashboard housekeeping) · B6 counsel ToS §10/§11 + email aliases.

**B&O/DOR note:** B6 B&O registration may be doable pre-ruling — confirm sequencing with accountant before filing.
