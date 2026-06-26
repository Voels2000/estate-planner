# DECISION_LOG.md
# My Wealth Maps — Key Decisions and Reasoning
# Last updated: 2026-06-26 (Profiles advisor SELECT status gate)

---

## Dashboard unlock gate — profile + assets + income (2026-06-26)

**Problem.** Dashboard onramp required wizard completion **and** `estate_health_scores.score ≥ 60`, blocking data-rich users (e.g. avoels at score 56, david with assets+income but no wizard) while canary passed on wizard+assets alone.

**Decision.** Single canonical predicate in `lib/dashboard/canUnlockDashboard.ts`: `isMinimumViableProfile(household) && assets>0 && income>0`. `shouldShowOnramp()` and `getDashboardState()` State 1 both delegate to it. Wizard and estate score are **not** unlock gates; score remains on full dashboard via `EstateReadinessCard`. `DashboardOnramp` shows three explicit unlock checkboxes (profile / assets / income) and three equal entry paths (wizard, import, manual).

**E2E / seeds:** Golden-path and armGate1 fixtures seed assets+income (not score floor). `ensureMinEstateHealthScore` unused for gating. Canceled persona seed gets MVI + assets + income for tier-0 dashboard reach.

**Prod cutover (no migration):** (1) deploy code → (2) `seed:prod-canary -- --confirm` → (3) `npm run audit:dashboard-gate` → (4) confirm canary alerting live. Between 1–2 canary reads blocked — silence alerts or run back-to-back. Rollback = code revert only; richer canary rows are inert under old gate (wizard+score+anydata).

**Cutover pause:** removed in #142 — `@production` consumer setup always runs after cutover complete.

**Verify:** `npm run audit:dashboard-gate` · `npx tsx scripts/check-golden-path-onramp-gate.ts` · `npm run test:e2e:golden-path`

---

## Migration ledger backfill + self-recording apply (2026-06-26)

**Problem.** Manual `apply-migration.sh` runs updated schema but not `supabase_migrations.schema_migrations` — prod had 128 ledger rows vs 136 repo files; staging had 0. Drift invisible to `migration list` / push.

**Decision.** One-time idempotent backfill (`scripts/generate-ledger-backfill.sh` → `ledger-backfill.sql`, `ON CONFLICT DO NOTHING`) applied staging (136 inserted) + prod (8 inserted). **`apply-migration.sh` now INSERTs `(version, name)` after successful `psql -f`** so the gap cannot reopen. **`scripts/collect-migration-ledger-info.sh`** — read-only repo-vs-ledger drift check.

**Naming convention:** Backfill generator and collector skip files whose leading token is not a 14-digit timestamp (e.g. `VERIFY_session27_*.sql`). Any future real migration with a non-timestamp filename would be invisible to both tools — not a concern while naming stays consistent.

**`statements` column:** Backfill records `version` + `name` only; `statements` stays NULL on those rows. Fine for push/list (version-only). If CLI is linked later, `db pull` or repair may offer to repopulate NULLs — cosmetic fidelity, not drift.

**Shipped:** #144 → staging · #145 → main. No schema migration required.

---

## Profiles advisor SELECT — status gate on revoke (2026-06-26)

**Problem.** `Advisors can view client profiles` matched on `advisor_id + client_id` only — no `status IN ('active','accepted')`. Consumer revoke (`disconnect-advisor`) and advisor remove set `status: 'removed'` but retain ids; ~60 other advisor policies honor status. Post-revocation PostgREST reads on `profiles` still returned name/email PII while app-layer gates hid it in the UI.

**Decision.** Migration `20260726120000_profiles_advisor_select_status_gate.sql` — add the same connected-status filter as household/asset policies. Regression: `tests/e2e/security/advisor-profiles-revocation-rls.spec.ts` (revoke link → advisor JWT → direct `profiles` SELECT must deny).

**Verification (2026-06-26):** Staging **RED** pre-migration — revoked advisor PostgREST read returned `Morgan Demo` / `e2e-advisor-client@…`. Policy SQL applied; **GREEN** (4/4 security project). Prod policy applied same day; ledger `20260726120000` present (`INSERT 0 0` on record = already in `schema_migrations`).

**Shipped:** [#150](https://github.com/Voels2000/estate-planner/pull/150) → staging · promote to `main` with code.

---

## Plan & Export refund acknowledgment (2026-06-26)

**Problem.** One-time deliverable needs per-purchase, persisted evidence that the buyer acknowledged immediate digital delivery and non-refundable terms — for chargeback defense, not UX friction alone.

**Decision.** Mirror ToS acceptance shape on `one_time_purchases`: `refund_ack_at` + `refund_ack_version` (`REFUND_POLICY_VERSION` in `lib/legal/plan-export-refund-policy.ts`). Checkbox gates UI; **checkout API rejects (400) without ack** — server stamps metadata at session create; webhook copies to row on fulfill. Fail-closed fulfillment without ack metadata → no `one_time_purchases` row; **`captureStripeWebhookFailure` → Sentry** (charged-but-not-fulfilled must not be silent).

**Counsel (at nexus):** pressure-test "all sales are final and we do not offer refunds" in launch states.

**Sequencing:** Migration staging → prod before code. Step 5 Plan & Export real-card smoke after this ships (test final flow once).

---

## isAdvisor capability vs identity (2026-06-25)

**Problem.** `getAccessContext().isAdvisor` is `isSuperuser || role === 'advisor'` — a **capability** flag for portal/API access. Several page-level branches used it for **identity** decisions (billing model, firm linkage, consumer vs advisor UI chrome). A superuser with `role='consumer'` could reach firm billing (“Firm not linked”) despite tier resolution and middleware already keying identity on `role === 'advisor'`.

**Not a security bug** — nobody gained access they should not have; superusers got the wrong primary experience. Core load-bearing paths were already correct: `buildUserAccessFromProfile`, `middleware.ts` advisor billing redirect, non-superuser `layout.tsx`.

**Decision.** Add `isAdvisorIdentity(role)` (`lib/access/isAdvisorIdentity.ts`) for identity branches. Keep `getAccessContext().isAdvisor` unchanged for capability. Fix identity hotspots: `/billing` (`resolveBillingExperience`), superuser dashboard layout sidebar props, `/print` deliverable bypass, import history visibility, unlock-estate redirect, trust-strategy and incapacity `userRole`. Regression tests: `resolveBillingExperience.spec.ts`, `printPageAdvisorIdentity.spec.ts`.

**Latent (unchanged).** `isAttorney` and `isAdmin` use the same `isSuperuser || role` pattern in `getAccessContext`. No parallel billing bug today (`/attorney/billing` uses `attorney_tier`; admin uses middleware bypass). Record for future UX audits; do not fix preemptively.

**Ops.** Prod `avoels@comcast.net` role flip to `consumer` **after** code deploy — re-attest tier 3 + consumer billing + portal access. **Done Al / 2026-06-26:** [#133](https://github.com/Voels2000/estate-planner/pull/133) on staging → [#134](https://github.com/Voels2000/estate-planner/pull/134) to `main` (`b7f7093`); Vercel prod deploy success-not-skipped; `UPDATE profiles SET role='consumer'` (kept `is_superuser`, `is_admin`, `is_attorney`); resolver re-attest **PASS** — **superuser+consumer tier 3** (not advisor-bypass), `resolveBillingExperience` → `consumer`, deliverable ✅; `/billing` consumer checkout confirmed (not “Firm not linked”).

**Diagnostic:** `scripts/audit-isadvisor-capability-vs-identity.sh`

---

## Tier restructure — PR 8 E2E persona matrix (2026-06-19)

**Problem.** Consolidation PRs touch the seed harness — the easiest place to drop a persona that was the only coverage for a resolver branch (`has_ever_subscribed` canceled → 0, app trial window, tier 2, Plan & Export purchaser).

**Decision.** Canonical matrix in `scripts/e2e-persona-matrix.ts`; `npm run seed:e2e` seeds all six consumer branches in one run; `verifyE2eAccounts` calls `verifyE2ePersonaMatrix` post-seed. Do not merge two personas without proving the branch remains exercised.

**Docs.** [TIER_RESTRUCTURE_INDEX.md](./TIER_RESTRUCTURE_INDEX.md) maps planning docs → outcomes; [LAUNCH.md](./LAUNCH.md) Bucket C records code gate closed on staging + prod cutover runbook.

**Files:** `scripts/e2e-test-identities.ts` · `scripts/seed-e2e-lib.ts` · `scripts/verify-e2e-persona-matrix.ts` · `tests/unit/e2ePersonaMatrix.spec.ts`

**Ops:** `verify:e2e-persona-matrix` exits **2** with “run seed:e2e first” when profiles are missing (not a resolver bug). CI `e2e-smoke` runs `seed:e2e:persona-matrix` before tests. App-trial `trial_ends_at` refreshes to ~2y on each seed.

---

## Stripe account guard — mode, source, and account at startup (2026-06-18)

**Problem.** Two independent failures produced the same symptom (`resource_missing` / “wrong key”): (1) a shell-exported `STRIPE_SECRET_KEY` overriding `.env.test.staging` because `dotenv -e` does not override an already-set var without `-o`; (2) a key from the wrong Stripe test sandbox while Vercel staging creates objects in the main account (`acct_1TAIt0ENTkKmTNa3`). Mode alone cannot distinguish staging-test from prod-live (same account); account alone cannot distinguish main test mode from a separate test sandbox.

**Enforcement.** `assertStripeAccountGuard(testEnv)` in `scripts/testEnv.ts` runs at startup before any Stripe call: **Check A** — `sk_test_` vs `sk_live_` per `ENVIRONMENTS[testEnv].stripeMode`; **Check B** — active key last4 must match `STRIPE_SECRET_KEY` read directly from `.env.test.<env>` (shell override fails loud); **Check C** — `stripe.accounts.retrieve()` must return `ENVIRONMENTS[testEnv].stripeAccountId` (fail-closed on API error). Guard runs whenever a key is **present** in `process.env` (any source) — not only when "we loaded" it; must run **before** `stripLeakedProductionSecrets()` so production shell exports fail instead of being stripped and skipped. `runPlaywrightStartupGuards()` orders Stripe guard → Playwright guard. Wired into Playwright `globalSetup` and staging money-path scripts. Call-site tests in `stripeAccountGuardCallSite.spec.ts` prove callers halt (not just that the guard throws in isolation).

**Principle.** When a config value can come from multiple sources, the runtime must prove which source and which target it resolved to — loudly, at the boundary, at startup — never infer it from a downstream failure. Same habit as Supabase project-ref guards.

**Files:** `scripts/testEnv.ts` · `tests/e2e/globalSetup.ts` · `scripts/verify-pr5-staging-gate.ts`

---

## Tests must match production call-site wiring (2026-06-25)

**Problem.** Green unit tests that invoke a guard or gate with different arguments than production callers prove nothing about production — same false-pass family as un-awaited async guards, empty isolation fixtures, and shell-export overrides misread as "wrong key."

**Rule.** A test of `hasDeliverableDownloadAccess`, `assertStripeAccountGuard`, export isolation, etc. must use the **same wiring shape** as the call site: e.g. purchase context via `toPlanExportPurchaseContext(getUserPlanExportPurchase(...))`, not a hand-built option the route never passes; guards `await`ed at the caller; isolation seeds both personas with data in every exported table.

**Instances.** PR-A caller-halt tests · PR 6 A/B marker sweep · PR 7 deliverable matrix (`planExportAppTrialDeliverable.spec.ts`).

**Principle.** Companion to the multi-source-config rule: prove resolution at the boundary **the way production resolves it**.

---

## Tier restructure — PR 5 retire Stripe consumer trial (2026-06-24)

**Decision.** Ship atomically: `PRICE_META` Estate `trialDays: 0` (immediate charge at checkout) **and** consumer CTA/marketing copy that no longer promises “Start free trial.” App-managed trial (`trial_ends_at`, PR 1) is separate from Stripe `trialing` status.

**Legacy.** Existing `subscription_status = 'trialing'` rows remain valid; `consumerCheckoutBlockReason`, `resolveEffectiveTier`, webhook status mapping, and `resolveBillingTrialBanner` Stripe fallback intentionally retain `trialing` reads. New Estate checkouts write `active` directly.

**Launch gate.** PR 5 completes the billing-page → prod blocker (with PRs 2–4).

---

## Tier restructure — PR 1 load-bearing spec (2026-06-24)

**Decision.** Before PR 1 code: (1) `has_ever_subscribed` flips **true** on first successful `customer.subscription.created` or first `active`/`canceling` status — evaluated **before** trial window in `resolveEffectiveTier`, so subscribe-then-cancel never re-enters trial; (2) `resolveEffectiveTier` is the **single source of truth** for tier — `getUserAccess` and dashboard sidebar must call it (fixes raw `consumer_tier` vs `getUserAccess().tier` divergence); (3) PR 1 ships unit test for subscribe-then-cancel → Tier 0 and a grep audit — **display** reads of raw tier OK, **access/gating** reads must use resolver even in billing code.

**PR 6 boundary.** Export serializer shares PR 2's input/computed boundary — same list, two consumers; PR 2 authoritative.

**Canonical sequence:** [TIER_RESTRUCTURE_PR_SEQUENCE.md](./TIER_RESTRUCTURE_PR_SEQUENCE.md). **Launch gate:** PRs 2–5 before consumer flip.

---

## Consumer billing page — cumulative capability matrix (2026-06-24)

**Decision.** Replace three side-by-side plan cards on `/billing` with a **four-column cumulative matrix** (Free + Financial + Retirement + Estate). Rows group capabilities (finances / planning / confidence / estate); checks are cumulative (`minTier` ≤ column tier). Copy: tier **questions** + **one-liners** in column headers; Free shows **$0 always**. Estate column: subtle navy tint only — **no** “For estate households” marketing tag. Mobile: single focused column + **Compare all plans** expander (default focus Estate unless user has active paid tier).

**Trial banner.** `resolveBillingTrialBanner` — prefer app `trial_ends_at` when set (future tier-restructure trial); fallback Stripe `trialing` + `subscription_period_end` (legacy subs only after PR 5). Financial/Retirement subscribe immediately; Estate checkout charges immediately (`trialDays: 0`).

**Plan & Export.** One-time SKU block stays **below** the subscription ladder (not a matrix column).

**Matrix vs gates.** Rows align with `FEATURE_TIERS` where keys exist; Tier 0 rows (`net-worth-view`, `data-export`) are matrix-only until tier-restructure gates ship — not added to `FEATURE_TIERS` (would break `DELIVERABLE_MIN_TIER` typing). **Enforcement plan:** [TIER_RESTRUCTURE_PR_SEQUENCE.md](./TIER_RESTRUCTURE_PR_SEQUENCE.md).

**Files:** `lib/billing/billingCapabilityMatrix.ts` · `billingTierPresentation.ts` · `resolveBillingTrialBanner.ts` · `components/billing/BillingCapabilityMatrix.tsx` · `BillingPageTrialBanner.tsx` · `BillingPlanAndExportSection.tsx` · `app/billing/_billing-client.tsx` · unit specs · [BILLING_PAGE_COPY_SPEC.md](./BILLING_PAGE_COPY_SPEC.md).

---

## Plan & Export one-time SKU + credit-on-subscribe (2026-06-18)

**Decision.** One-time **Plan & Export** SKU at **$1,490** (derived from `estate_annual.annualTotal × 100`), Stripe `mode: payment`. Generated deliverable (estate-plan PDF) gated via **extended `hasPaidDownloadAccess`** — active Tier 3 **or** completed `one_time_purchases` row; **`trialing` excluded** (unchanged). Raw personal data: **`canExportRawData() → true`** policy stub; self-serve portability endpoint deferred to a separate PR (manual `/api/consumer/privacy-request` remains).

**Credit-on-subscribe.** Full purchase amount credited via Stripe customer balance on **`customer.subscription.created` only**, with `UPDATE … WHERE credit_applied_at IS NULL` consume-once guard. `checkout.session.completed` (subscription) does **not** apply credit.

**Trial.** Estate trial shortened **14 → 7 days** in `PRICE_META` (`trial_period_days` at checkout). Marketing/billing copy reads trial length from `getConsumerPlanDisplay(3, 'monthly').trialDays`.

**Deliverable scope.** One-time purchase grants **indefinite download** of generated artifacts; **plan editing** (update/generate) is included for **`PLAN_EXPORT_EDIT_WINDOW_DAYS` (90)** from purchase, then requires subscription. Warning emails at 14d/3d via daily `/api/cron/plan-export-warnings`.

**Files:** `one_time_purchases` migration · `lib/billing/stripePrices.ts` (`ONE_TIME_SKU_META`) · `lib/billing/oneTimePurchases.ts` · `lib/access/requirePaidDownloadAccess.ts` · `lib/billing/exportAccess.ts` · checkout/webhook branches · `/print` UI alignment.

---

## E2E environment resolution: single switch + enforced guard (2026-06-23)

**Decision.** E2E target selected by one variable, `TEST_ENV` (`local` | `staging` | `production`). Base URL derived in code from `ENVIRONMENTS` (`scripts/testEnv.ts`), never read from an env file. `.env.test.<env>` files hold secrets only — no base URL.

**Why.** A multi-day "staging checkout broken" investigation root-caused not to Stripe but to test-target misdirection: `dotenv -o` promoted `.env.test`'s pinned `PLAYWRIGHT_BASE_URL=127.0.0.1` over the staging URL passed on the command line, so "staging" runs silently hit localhost — a different Stripe account. Every "No such customer/price" error was accurate but described the wrong environment, which is why config checks kept passing while runs kept failing.

**Enforcement.** `assertPlaywrightEnvGuard()` runs in Playwright `globalSetup` before any test and hard-fails on: (1) resolved base URL ≠ `ENVIRONMENTS[TEST_ENV]`; (2) remote env resolving to localhost; (3) Supabase project ref ≠ the ref mandated per environment (all three locked); (4) production without `I_KNOW_THIS_IS_PRODUCTION=yes`. `stripLeakedProductionSecrets()` prevents a shell `STRIPE_SECRET_KEY` / service-role key (e.g. from `.env.local`) leaking into prod smoke.

**Prod auth.** `resolveE2eEmail` (`tests/e2e/helpers/e2e-auth.ts`) previously remapped any non-`.test` address to a canonical `.test` fallback in every environment, which silently broke production canary login. Now gated: under `TEST_ENV=production` the real address is used as-is; non-prod keeps the `.test`-only remap.

**Local note.** `.env.test.local` intentionally uses the staging Supabase ref (`cmzyxpxfyvdvbsykjvsg`) with a localhost app URL — same model as `.env.local` for day-to-day dev. Documented in `.env.test.local.example`; guard locks it as a chosen config, not an accident.

**Proven.** Deliberate break (`staging.baseURL` → `127.0.0.1`) produced a guard failure at `globalSetup`, not a silent run. Reverted. Staging tier-1 billing 3/3. Prod consumer canary authenticated path green.

**Principle.** Structure over memory — target/environment match enforced by failing code, not by remembering the right flags.

**Files:** `scripts/testEnv.ts` · `tests/e2e/globalSetup.ts` · `playwright.config.ts` · `tests/e2e/helpers/e2e-auth.ts` · `.env.test.local.example` · `.env.test.staging.example` · `.env.test.production.example` · legacy `.env.test` / `.env.test.prod` retired.

**Follow-up (provisioning):** Closed 2026-06-23 — non-consumer role auth stays **staging-only** (`npm run test:e2e:staging` + `seed:e2e`). Prod smoke `@production` = consumer canary + public/read-only checks only; no prod role canary creds. Same deploy artifact on staging and production; role login/billing/isolation certified before promote. Consumer canary on prod remains the live “real auth on production” spot-check.

**Staging cast subscription drift (2026-06-23):** `npm run reset:staging-stripe` sets `subscription_status: 'none'` on all `@mywealthmaps.test` profiles (Stripe re-key hygiene). That drops CI consumer to tier 1 on `/social-security` (UpgradeBanner, no ProfileFieldPrompt). Fix class: re-seed (`npm run seed:e2e`) after stripe reset; fix failure: `deferProfileAccessRestore` in go-live-profile SS tests with throw-on-failed-restore + explicit tier-gate test in the same file.

**CI household ID drift (2026-06-23):** Stale `PLAYWRIGHT_HOUSEHOLD_ID` in GitHub secrets (pre-`seed:e2e`) pointed at a household the advisor could access → cross-household isolation saw HTTP 200 instead of 403/404. Fix: `append-ci-e2e-household-ids.ts` patches `.env.test.local` from canonical `e2e-consumer` / `e2e-advisor-client` emails; `cross-household-isolation` beforeAll prefers canonical lookup when service role is present.

---

## Stripe checkout cross-environment guards (2026-06-23)

**Decision:** Consumer checkout must survive Stripe re-keys (new sandbox, new `sk_test_`, new price catalog) without manual per-user DB surgery. Three layers:

1. **`getOrigin(request)`** (`lib/app-url.ts`) — Stripe `success_url` / `cancel_url` hosts come from request `Origin` → `Host` → `NEXT_PUBLIC_APP_URL` fallback. **`assertAbsoluteHttpUrl`** throws if the resolved value is not `http(s)://` (clear local error vs cryptic Stripe 400).
2. **`processConsumerCheckout`** — before session create: `customers.retrieve(stripe_customer_id)`; clear id on `deleted` or `resource_missing`; create + persist new customer in current environment. Validate `baseUrl` is absolute before `checkout.sessions.create`.
3. **Staging DB reset after re-key** — `scripts/reset-staging-stripe-test-users.ts` nulls `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_plan`, `subscription_period_end` on all `@mywealthmaps.test` / canonical E2E profiles (staging Supabase ref guard). Run after every Stripe sandbox/key rotation on staging.

**Symptom pattern (three instances, same root cause):** live price ID + `sk_test_`; old-sandbox price + new sandbox key; old-sandbox `stripe_customer_id` + new sandbox key → checkout HTTP 500 / Stripe `No such price` / `No such customer`.

**Rule:** Stripe API keys, webhook secrets, price env vars, and profile `stripe_customer_id` must all belong to the **same** Stripe environment (default test-mode sandbox vs named sandbox vs live). `NEXT_PUBLIC_APP_URL` is for emails/recompute/sitemap — **not** checkout return URLs.

**Prod note:** Self-heal (2) prevents recurrence when a user’s stored customer id is from a prior environment; prod re-key still requires `reset-staging-stripe-test-users` equivalent discipline for test accounts only — never bulk-null prod consumer profiles.

---

## Client Stripe price resolution — server-only (2026-06-21)

**Decision:** Client code must **never** resolve Stripe price IDs. `STRIPE_PRICE_*` env vars are server-only and invisible in `'use client'` bundles, where they silently fall back to stale test literals or make `hasPriceConfig()` return false. The client sends `{ tier, period }`; the server is the single source of price truth. Applies to **checkout** and any client display of price availability (annual toggles, upgrade banners).

**Symptom (production only):** Consumer Subscribe returned HTTP 400 — "Invalid plan. Use firm or attorney checkout for professional subscriptions." Staging looked fine (test price IDs on both client fallback and server).

**Root cause:** `getConsumerPlansForPeriod()` / `handleSubscribe` ran in client components and called `getPriceConfig()` → `resolveConsumerPriceId()`. In the browser, env vars are unset → legacy `price_1TIL…` literals POSTed to `/api/stripe/checkout` while production server validated live `price_*` IDs.

**Surfaces fixed (PR #86):**
| Surface | Before | After |
|---------|--------|--------|
| `/billing`, `/pricing` Subscribe | POST `{ priceId }` from client | POST `{ tier, period }` |
| Plan catalog | `ConsumerPlanForCheckout.priceId` | Removed; `getConsumerPlanDisplay()` for UI amounts only |
| `UpgradeBanner` | `hasPriceConfig()` in client → annual copy hidden | `AnnualBillingProvider` from dashboard layout (server flag) + display-only metadata |

**Regression guard:** E2E clicks real **Get started** on `/billing`, intercepts POST, asserts `not.toHaveProperty('priceId')`.

**Rule for future work:** If a client component needs "is annual available?" or a Stripe price ID, pass a boolean or tier from a Server Component / API route — do not read `STRIPE_PRICE_*` or call `getPriceConfig()` / `hasPriceConfig()` from `'use client'` code.

---

## Stripe Clover pin + Basil period migration (2026-06-22)

**Decision:** All Stripe clients pinned to **`2026-02-25.clover`** via single `createStripeClient()` in `lib/stripe/config.ts`; never rely on account-default API version. Basil+ moved `current_period_end` onto `SubscriptionItem` — all period reads go through `lib/stripe/subscriptionPeriod.ts` helpers (item-level → top-level fallback → null, never throw).

**Symptom:** `customer.subscription.updated` HTTP 500, `RangeError: Invalid time value` when top-level `current_period_end` was undefined on webhook payloads (live smoke, incomplete→active).

**SDK types:** `stripe` npm may not yet list Clover in `LatestApiVersion`; runtime sends `'2026-02-25.clover'` via cast — update when package types ship Clover.

**Surfaces migrated:** webhook (renewal reminder, checkout completed, subscription updated), cancel route, terms accept, admin Stripe sync, repair script, B2B2C subscription lifecycle (replaced unversioned raw `fetch`).

**Not period reads (verified):** firm checkout webhook retrieve (price/seats/tier only), `syncFirmQuantity` retrieve (item id + quantity only). `cancel_at_period_end` remains on Subscription (boolean), not a period timestamp.

**Dashboard:** account/webhook endpoint API version unchanged — code-level pin only.

---

## Counsel sign-off — post-go-live (2026-06-20)

**Decision:** Defer counsel redline on **privacy policy (#60)** and **ToS §10/§11** until **post-go-live**, when revenue approaches nexus in the first state. Engineering draft stays live on `/privacy` and `/terms`; `PUBLIC_SIGNUP_OPEN` flip is not blocked on counsel completion.

**Reasoning:** Pre-launch traffic is waitlist-gated; state-law applicability thresholds are not met today. Voluntary multi-state posture is shipped in code; formal counsel pass is timed to commercial nexus, not deploy.

**Still pre-flip:** email aliases (`security@`, `legal@`), real-card smoke, C-4 walkthrough, B&O Bucket A.

---

## privacy_requests consumer INSERT RLS failure (2026-06-20)

**Symptom:** `POST /api/consumer/privacy-request` returned `new row violates row-level security policy for table "privacy_requests"`.

**Root cause:** Sprint C-7 migration (`20260625170000`) enabled RLS and INSERT/SELECT policies but **omitted explicit `GRANT`s** (pre–MIGRATION_TEMPLATE standard). Consumer route inserted via user JWT + `.select()` (RETURNING). On production, authenticated role could not satisfy INSERT/SELECT + RLS for PostgREST — admin intake (`createAdminClient`) worked because service_role bypasses RLS.

**Fix:** Route uses `createAdminClient()` after session auth (same pattern as `delete-account`); migration `20260722120000_privacy_requests_grants.sql` adds `GRANT SELECT, INSERT TO authenticated` and recreates consumer policies.

**Ops:** Apply migration on production before relying on user-JWT path; deploy route fix to Vercel Production.

---

## US-only access policy (2026-06-19)

**Decision:** Restrict the service to US residents (18+). Launch with existing ToS §3 representation; **defer dedicated residency attestation pending counsel.**

| Layer | Status |
|-------|--------|
| ToS eligibility (18+/US resident, §3 v2026-06-02) | **Live** — represented + accepted at signup |
| Dedicated residency attestation (checkbox + `us_residency_attested_at`) | **PENDING COUNSEL — not built.** Launching on embedded §3 representation per [Al] decision; add if counsel requests. Do not build until counsel confirms standard/wording. |
| IP geo-gate (Layer 1) | **Implemented** — middleware page-gate + signup API; `/api` excluded by matcher (webhooks/crons untouched); null country → allow; `/not-available` with recourse |
| Stripe US-billing validation (Layer 2) | **Implemented** — `billing_address_collection: required` on consumer/firm/attorney checkout; non-US billing rejected in `checkout.session.completed` (cancel subscription, do not provision) |
| State-level restriction | **None found at launch** — country-level gate; revisit if a state-specific UPL/licensing issue surfaces |

**Standard adopted:** country/residency representation (ToS §3) + IP perimeter + billing-country at checkout. "US person" / stronger verification not adopted pending counsel ruling.

**Implementation:** `lib/geo/usOnlyAccess.ts`, `lib/billing/rejectNonUsBillingCheckout.ts`, `middleware.ts`, `app/api/auth/signup/route.ts`, `app/not-available/page.tsx`, checkout session creates, `app/api/stripe/webhook/route.ts`.

---

## Sprint E — dead-code sweep + knip tooling (2026-06-19)

**Decision:** Add **knip** + **`@next/bundle-analyzer`** as standing repo capability (#42 `ddd17a2`, doc note #43 `1007af3`). Dead-code questions are answered by `npm run knip` / `npm run knip:production`, not manual grep alone. Config at repo root (`knip.ts`) declares app router, `scripts/**`, `tools/**`, Supabase functions, Sentry boundaries, and Playwright unit specs as entry points so live tooling is not flagged.

**Principle — parity-before-delete:** When domain logic is reimplemented, require a **rule-by-rule parity diff** before deletion. “A live version exists” ≠ “complete replacement.” Unwired specs can document product gaps that silent non-firing hides.

**Findings behind “unused” labels (verify-before-delete paid off):**
1. **MC assumptions (#50, merged):** Orphan `mergeAssumptions` used `Number()`; live `monteCarloAssumptionsFromRow` did not — string DB values passed through. Fixed live helper + spec before delete.
2. **Household alerts (#51, merged):** Sprint 70 `strategyAlertRules.ts` was never wired; Sprint 81 shipped a different rule set. GRAT/Roth port + six-alert fact-not-advice voice — **counsel review complete — passed** (attest: Al / 2026-06-19; [LAUNCH.md § B6](./LAUNCH.md#b6-legal--entity-ops-attested-ex-tax)).

**Mechanical tier merged (#42–#47):** export aliases, SectionHeader `right`, Button variants (`654fa50`), waitlist test migration (`cb2fbe9`) + wrapper removal (`b613e39` — delete `shouldBypassWaitlistForSignup`, un-export `hasBetaSignupAccessCookie`), orphan emails (`3222746`).

**6f `lib/validations/*`:** Merged #53 — delete drifted schemas; post-launch validation map logged separately.

---

## Sprint E 6f — validation schemas: delete, do not wire (2026-06-19)

**Decision:** Delete orphaned `lib/validations/{assets,income,expenses,household}.ts`. **Do not wire them in.** Drift check (2026-06-19) showed all four model a **superseded data shape**, not a stale enum — wiring would reject valid current input and add false confidence. Deleting is **not** accepting the validation gap; live write paths still use thin inline presence-checks.

**Why delete (drift summary):**
- **Assets:** Schema nests type-specific fields in `details` jsonb; live `/api/consumer/assets` writes **flat columns** (`institution`, `cost_basis`, `liquidity`, `titling`, `is_ilit`, `situs_*`, `estate_inclusion_status`) and never writes `details`. Type enum: 5 hardcoded values vs live `asset_types` ref (20+ canonical slugs).
- **Income:** Schema enum (`salary`, `pension`, …) vs live `income_types` ref; missing `name`, `ss_person`, `start_month`, `end_month`, `annual_growth_rate`.
- **Expenses:** Schema enum (`housing`, `food`, …) vs live `expense_types` ref; missing `name`, `owner`, month fields.
- **Household:** Schema targets a form shape **with no live write route**. Household data goes through `PATCH /api/consumer/profile` → `validateProfileSavePayload` + `buildHouseholdRow` (`lib/profile/buildHouseholdPayload.ts`) and `PATCH /api/consumer/growth-assumptions`. Filing status in schema uses long form (`married_filing_jointly`); live uses `mfj`/`mfs`/`hoh`/`qw`.

**Deps:** Keep **`zod`** — live in `app/api/rmd/route.ts` and `lib/api/schemas/householdAccess.ts`. Removed **`react-hook-form`** + **`@hookform/resolvers`** (zero source usage; re-grepped before uninstall).

**Household note:** Deleting the orphan schema says nothing about whether the **live** household path validates well — that rigor lives in `validateProfileSavePayload` + `buildHouseholdRow`, which feeds the tax engine directly. Deleting the household schema removed dead code; it did not address household validation.

**Post-launch — input validation on estate-data write paths** *(logged 2026-06-19; definite work, not "only if an issue appears")*

**Why deferred, not done now:** Input validation guards **new writes**, not resting data — adding it post-launch carries no migration risk to existing users. Better built **after** launch, when real user input reveals the true variety of valid shapes; building pre-launch against test fixtures risks rejecting valid live input (the exact failure the drift check found in the old schemas). Weak-but-stable presence-checks through the flip window is the lower-risk choice.

**The gap:** Live write paths validate presence only (`if (!body.x)`). No type, range, or enum enforcement on data that feeds the WA tax engine, Monte Carlo, and composition calcs.

**DO NOT start from `lib/validations/*`** (deleted — modeled a superseded shape). Build fresh against current truth — one atomic PR per route; each is a behavior change (stricter 400s) requiring good-input AND bad-input tests:

| Entity | Write path | Validate against (current truth) |
|--------|-----------|-----------------------------------|
| Assets | `/api/consumer/assets` insert/update shape | Flat columns (`type`, `name`, `value`, `institution`, `cost_basis`, `liquidity`, `titling`, `is_ilit`, `situs_*`, `estate_inclusion_status`) — **NOT** jsonb `details`; `type` against `asset_types` ref (`CANONICAL_ASSET_TYPES`, 20+ values); `ref_liquidity_types`, `ref_titling_types` |
| Income | `buildIncomeRow` / `/api/consumer/income` | `source`, `amount`, `start_year`, `end_year`, `name`, `ss_person`, `start_month`, `end_month`, `annual_growth_rate`; `source` against `income_types` ref incl. `GROWABLE_INCOME_SOURCES` (`self_employment`, `equity_awards`, `business`) and `employment` |
| Expenses | `buildExpenseRow` / `/api/consumer/expenses` | `category`, `amount`, `start_year`, `end_year`, `name`, `owner`, `start_month`, `end_month`; `category` against `expense_types` ref (incl. `living`) |
| Household | `/api/consumer/profile` (`validateProfileSavePayload` + `buildHouseholdRow`) AND `/api/consumer/growth-assumptions` | Filing status `mfj`/`mfs`/`hoh`/`qw` (NOT long form); `person1_first_name`/`last_name`/`name`, `person1_ss_pia`, `deduction_mode`, `custom_deduction_amount`, `gross_estate_estimate`, `has_minor_children`, `has_business_interests`, `risk_tolerance`, `growth_assumptions` jsonb |

**Reference enums live in ref tables** (`asset_types`, `income_types`, `expense_types`) — validation must read from those, not hardcode lists, or it drifts again the moment a type is added. (This is exactly how the deleted schemas went stale.)

**Optional pre-launch (not in scope for 6f delete):** Non-blocking Sentry shape logging on write paths (observability only — no rejection) to measure how often real input would fail strict validation; informs post-launch prioritization. Separate small PR if pursued; not a substitute for enforcement above.

**Sprint E retro judgment:** Drift check turned a tempting "adopt existing Zod work" into correct "don't resurrect stale code" — reusable parity-before-delete principle (same family as MC coercion + never-wired GRAT/Roth alerts).

---

## Sprint E 6d — GRAT/Roth household alerts port (2026-06-19)

**Decision:** Port GRAT and Roth opportunity alerts from unwired Sprint 70 `strategyAlertRules.ts` into the live consumer engine. Sprint 81 `evaluateEstateAlerts` shipped a different rule set and never included GRAT/Roth — not a silent drop during a rewrite.

**Implementation:** New `lib/alerts/estateHouseholdAlerts.ts` (`buildEstateHouseholdAlertRules()`). `evaluateAlerts` loads `businesses`, `business_interests`, and active `strategy_line_items`. Roth fires on pre-tax balance > $500k only (no “low-income year” trigger without reliable income data). Deleted `lib/strategy/strategyAlertRules.ts`.

**Alerts (six, fact-not-advice voice):** `estate_ilit_gap`, `estate_gifting_gap`, `estate_grat_opportunity`, `estate_roth_window`, `estate_large_no_trust`, `estate_no_base_case` — state user's data → name structure/observation → redirect to licensed professional.

**Compliance:** Counsel review **complete — passed** for all six alert strings (attest: Al / 2026-06-19; [LAUNCH.md § B6](./LAUNCH.md#b6-legal--entity-ops-attested-ex-tax)). Consumer launch copy gate cleared.

---

## Edge-systems Tier 1 — webhook alerting remainder (2026-06-19)

**Decision:** Extend `captureStripeWebhookSupabaseFailure` to all previously silent Supabase writes in `customer.subscription.deleted`, `customer.subscription.updated`, and `invoice.payment_failed` handlers — consumer profile updates plus firm `firms` / owner `profiles` paths that were fire-and-forget.

**Why pre-flip:** These paths return **200** on DB-write failure; Stripe does not retry and failures were invisible. Option A (#32) captured only where `console.error` already existed. Visibility before first real customers — not idempotency/retry (post-launch per [WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md](./WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md)).

**Explicit non-goals:** No HTTP status change; no Stripe retry; no dedup table. Closes **alerting half** of Tier 1 #4.

---

## Edge-systems Tier 1 — cron drip correctness (2026-06-19 · Tier 1 #5)

**Decision:** Fix launch-critical bugs in `app/api/cron/notifications/route.ts` before flip — step-3 ordering, §7 window, honest sent/error counters, §9 unsubscribe filter. PR `fix/cron-drip-correctness`.

**Issues fixed:**
1. **False-success counting** — drip `fetch` calls use `.catch(() => {})` then `results.sent++`; failed sends count as sent. Fix: `errors++` on failure, don't increment `sent`.
2. **Fragile 1-day window** (email-capture step 3) — fires only when `step1At >= eightDaysAgo && step1At < sevenDaysAgo`; missed cron day skips step 3 permanently. Fix: `step1At <= sevenDaysAgo` (advisor pattern) or "≥N days & not sent".
3. **Step 3 without step 2** (advisor/attorney) — step 3 checks only `!step3At && step1At <= sevenDaysAgo`, no `step2At` requirement. Fix: require `step2At` before step 3.

---

## Staging → main promotion runbook (2026-06-18)

**Decision:** Canonical checklist for promoting accumulated pre-launch hardening from **`staging`** to **`main`**: [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md). Covers PRs #28–#39 (40 commits), one additive migration (`20260718120000_attorney_drip_unsubscribed_at.sql`), prod secret pre-checks (`RECOMPUTE_SECRET`, `CRON_SECRET`, `INTERNAL_API_KEY`), and **passive** post-deploy smoke (recompute/cron from logs; checkout **403/409 block paths only** — defer eligible-consumer live Stripe charge to dedicated real-card test). **#39** is docs-only (runbook + master-doc cross-links); no change to migration or env surface.

**Reasoning:** Hardening deploy to pre-launch prod does not open signups or retire flip blockers. Unit tests cover #36 happy-path logic; live charge validates Stripe e2e, not this PR. Recompute/cron confirm from logs without forcing writes or charges.

**After clean prod promote:** DECISION_LOG note on `unsubscribeToken.ts` HMAC secret rotation invalidating links; follow-ups for `RECOMPUTE_SECRET` in CI E2E and attorney drip sender honoring `attorney_drip_unsubscribed_at`.

---

## Recompute route fail-closed auth (2026-06-18 · PR #35)

**Decision:** `/api/recompute-estate-health` uses `requireRecomputeAuth` — header `x-recompute-secret` must match `RECOMPUTE_SECRET`. Unset env → **500** (not open route). Constant-time compare via `safeCompareSecrets`.

**Callers:** `triggerEstateHealthRecompute` only (server-side from `afterHouseholdWrite`); not Vercel cron.

**Tests:** `tests/unit/internalApiAuth.spec.ts`; `tests/e2e/public/recompute-estate-health.spec.ts` (skips without secret in CI).

---

## Consumer checkout API eligibility guards (2026-06-18 · PR #36)

**Decision:** `consumerCheckoutBlockReason()` in `lib/billing/b2b2cBillingPolicy.ts` — shared by billing page and `POST /api/stripe/checkout` via `processConsumerCheckout`. Blocks: advisor/attorney-managed, `past_due`/`unpaid`, active/trialing/canceling, connected advisor client. Returns `{ error, code }` with 403/409.

**Reasoning:** UI already blocked; API was permissive — managed users could reach Stripe session creation.

**Live prod smoke:** block paths only (403/409, no charge). Happy-path live charge deferred to real-card smoke test.

---

## Attorney drip unsubscribe column + routing (2026-06-18 · PR #37)

**Decision:** `GET /api/email/unsubscribe?type=attorney` writes `profiles.attorney_drip_unsubscribed_at` (not `email_captures`). Migration `20260718120000_attorney_drip_unsubscribed_at.sql`. `lib/email/applyEmailUnsubscribe.ts` centralizes routing; unknown `type` → 400; DB failure → 500.

**Follow-up:** Attorney drip *sender* (not built) must filter `.is('attorney_drip_unsubscribed_at', null)` before send.

---

## Migration apply order — per environment, not both at once (2026-06-18)

**Decision:** Schema migrations pair with the **deploy in the same environment**. Apply on staging before staging merge/deploy; apply on production at **staging→main promotion** (merge → prod apply → verify → prod deploy). Do **not** apply production migrations while code is still staging-only.

**Reasoning:** Additive nullable columns tolerate schema-ahead-of-code, but the habit generalizes badly — rename/drop/NOT NULL migrations break production when schema leads code. One rule for all migration types. “Apply both early so nothing is missed” inverts safe ordering.

**Until pipeline apply exists:** `bash scripts/apply-migration.sh staging|production <file>`; staging→`main` PR lists **pending production migrations**; verify with `supabase migration list` on prod before/after apply.

**Follow-up:** Wire migration apply into deploy pipeline (structural fix — not launch gate).

**Runbook:** [DEPLOYMENT.md § Migration gate](./DEPLOYMENT.md#1-apply-migrations-ongoing--prevents-schema-drift)

---

## Pre-launch FOR ALL RLS leak — estate_health_scores, household_alerts, beneficiary_conflicts (2026-06-15)

**Finding:** Three policies named "service role can …" were granted `TO public` with `USING (true)` and `FOR ALL` (not SELECT-only). Any authenticated JWT could read, insert, update, or delete **all rows** in those tables across tenants — an integrity-and-availability hole on financial-planning data (silent corruption of another household's alerts, health scores, or beneficiary-conflict cache), not merely a confidentiality leak.

**Timeline:** Discovered on **staging** via `npm run verify:rls` JWT isolation (consumer read foreign `household_id`). Fixed in migrations `20260713130000`, `20260713140000`, `20260713150000` **before public launch**. Staging held E2E/test identities only (`@mywealthmaps.test`); **no real customer PII or third-party data** existed in those tables at time of fix. **Zero production rows ever affected**; no customer notification required.

**Structural gate:** `scripts/assert-rls-coverage.sql` added — detects tenant-scoped tables (any `household_id` / `user_id` / `owner_id` / link-column table) with missing RLS, zero policies, or permissive `USING (true)` reachable by `public`/`anon`/`authenticated`. Also caught: `businesses` advisor UPDATE with omitted `WITH CHECK` (Postgres defaulted `true`); `estate_flow_share_links` public `SELECT true` (replaced with `get_share_link_display_meta` SECURITY DEFINER RPC). `NAME_ROLE_MISMATCH` (service-role-named policies granted to `{public}`) is **blocking** after `20260713150000`.

**Posture:** Found and closed pre-launch with test data only — meaningfully different from a post-launch discovery requiring incident response.

**PR:** negative-authz / authz test plan (#21)

---

## WA Regime D — Engine B launch + top-band gate (2026-06-15)

**Decision:** Washington forward planning uses **Regime D only** (ESB 6347, eff. 2026-07-01): frozen **$3.0M** exemption, restored RCW 83.100.040 marginal schedule (10–20%), **19.5%** on $7M–$9M taxable (not 19%). Engine B (`calculateStateEstateTax`) is canonical; `resolveStateEstateBrackets` overrides stale WA DB rows; SQL RPC `calculate_estate_composition` matches survivor `(G − X) − exemption` with funding cap `X = min(exemption, first-spouse share)`.

**Projection-aware CST:** At Death horizon and `estate-tax-projection` grow CST at household `growth_rate_accumulation`; drawdown does not shrink the irrevocable pot. Today column remains snapshot.

**Goldens:** Voels without bypass **$1,063,259** · with bypass snapshot **$519,060** · DOR vectors through **$10M taxable → $1,690,000**. Attestation: [LAUNCH.md](./LAUNCH.md) B8.

**Disclaimers:** `lib/estate/waDisclaimers.ts` — consumer, advisor, PDF surfaces.

**PR:** #20

---

## Post-deploy Voels verify — prod My Plan fallback (2026-06-15)

**Decision:** `resolveVoelsPostDeployContext()` resolves Voels household at runtime: legacy consumer UUID → `avoels@outlook.com` → **`avoels@comcast.net` My Plan** (prod after go-live cleanup removed outlook). Hardcoded `5ea14f56…` is staging-only.

**Prod steady state:** Post-deploy cron uses advisor household `23c8d2fb…`; PDF narrative check skipped on My Plan (403 without linked client — MC checks still run).

**Override:** `VOELS_POST_DEPLOY_HOUSEHOLD_ID` env var.

---

## deleteUser schema drift — loud skip vs silent success (2026-06-15)

**Decision:** Harden `deleteByColumn` in `lib/compliance/deleteUser.ts` via `lib/compliance/deleteUserSchema.ts`:
- **Missing table** → warn (`SCHEMA DRIFT (missing table — skipped)`), record in `schemaSkips`, continue (benign evolution).
- **Missing/wrong column** → error log, **abort** before Auth delete, audit `success=false` with `schema_skip: table.column (missing_column)` — never a silent green when zero rows were deleted.

**Why:** 6/7 purge failures (`beneficiaries` table gone; `asset_beneficiaries.household_id` never existed) showed hand-maintained deletion lists drift from schema. Swallowing column errors is a WCPA violation; missing-table skip is OK.

**Follow-up (not built):** CI invariant that every `deleteUser` table/column exists in migrations — same class as RLS check #6.

**Tests:** `tests/unit/deleteUserSchema.spec.ts`

---

## E2E advisor-client seed — `asset_beneficiaries` not `beneficiaries` (2026-06-15)

**Decision:** `seedE2eAdvisorClientHousehold()` seeds **3** `asset_beneficiaries` rows (401k primary 50/50 + contingent) linked to inserted asset id. `verifyE2eAccounts()` requires `>= 2` rows for `e2e-advisor-client@mywealthmaps.test`. Fail loudly on insert error (no `console.warn` swallow).

**Why:** Dead `beneficiaries` table reference caused silent seed failure — green-but-hollow fixture data.

---

## Launch tracker v4 + LAUNCH.md scoreboard (2026-06-15)

**Decision:** Browser tracker (`tools/launch-tracker-app.jsx`, `localStorage` `mwm-launch-tracker-v4`) reflects B4 automated walkthroughs, B5 machine slice attested, B6 partial ops (LLC/bank/B&O), irreducible B4 manual items. Sync via `npm run sync:launch-tracker` + `tools/launch-tracker-mapping.json`.

**Scoreboard:** [LAUNCH.md](./LAUNCH.md) — **44 of 55** Bucket B checked (11 open). P0 blockers: real-card smoke, WA B&O ruling.

---

## Two-database topology — staging vs production (2026-06-13)

**Decision:** Split Supabase into **staging** (`mwm-staging` / `cmzyxpxfyvdvbsykjvsg`) and **production** (`fnzvlmrqwcqwiqueevux`). **Local dev + Vercel Preview** use staging; **Vercel Production** uses prod only. Code promotes via git → Vercel; **data never promotes** between projects.

**What lives where:**
- **Staging:** full `@mywealthmaps.test` E2E cast, multi-role testing, wipe-able via `cleanup:purge`.
- **Production:** exactly three protected auth users — `david@gmail.com`, `avoels@comcast.net`, `canary-consumer@mywealthmaps.com`.

**Docs / scripts:** [DEPLOYMENT.md](./DEPLOYMENT.md) (steady state), archived [TWO_DB_MIGRATION.md](./archive/TWO_DB_MIGRATION.md) (one-time runbook, PR #6).

**Reasoning:** Shared prod/staging caused purge risk and blocked staging-only CI secrets. Staging is disposable; prod is never bulk-wiped again.

---

## GitHub credential rule revision — staging-only secrets OK (2026-06-13)

**Decision:** Revise the 2026-06-09 solo rule. **Production** credentials (`SUPABASE_DB_URL`, prod service role, prod Stripe/Resend, `.env.test.prod`) **still never** go in GitHub Actions. **Staging-only** Supabase URL/keys + `PLAYWRIGHT_*` **may** go in repository secrets to restore E2E/RLS workflows on PRs.

**Reversal:** The 2026-06-09 entry remains valid for its context (one shared project). It is **superseded for staging CI** now that Preview/local no longer touch prod data.

**Still on GitHub without secrets:** `ci.yml` → `verify`; `staging-keepalive.yml` (public health ping).

**Reasoning:** The original ban existed because CI and production shared one database. Two-DB split removes that blast radius for staging keys.

---

## Stripe mode separation — Preview test / Production live (2026-06-13)

**Decision:** Vercel **Preview** uses Stripe **test** keys; Vercel **Production** uses Stripe **live** keys. Env verifier cross-checks `stripe_key_mode` vs deployment scope (`lib/env/verifyEnv.ts`).

**Reasoning:** Prevents accidental live charges on preview deploys and catches mis-scoped keys before flip.

---

## Lazy resolve-time initialization — Stripe clients + consumer prices (2026-06-13)

**Decision:** Do not construct `new Stripe()` at module load in API routes (breaks Vercel Preview build when env empty). Construct inside request handlers. Consumer Stripe price IDs resolve lazily via `resolveConsumerPriceId()` — throws in production if env unset (no silent test-price fallback).

**Files:** `lib/billing/stripePrices.ts`, deferred-init routes (PR #3 follow-up), `lib/tiers.ts` consumer getters.

**Reasoning:** Module-load Stripe init failed Preview builds; eager price bake-in hid missing prod env vars until checkout.

---

## Prod consumer canary + staging-only purge (2026-06-13)

**Decision:** Keep one synthetic consumer on production — `canary-consumer@mywealthmaps.com` — for `@production` E2E smoke. Password in Vercel `E2E_CANARY_PASSWORD` only. Reset via `npm run seed:prod-canary -- --confirm`. Protected in `cleanup-test-accounts.ts` `GO_LIVE_PROTECTED`.

**Purge rule:** `npm run cleanup:purge` targets **staging** (via `.env.local`). Production bulk delete was one-time (attested); ongoing cleanup uses `bash scripts/run-cleanup-prod.sh` with keep-list.

**Reasoning:** Prod needs a headless consumer login without `@mywealthmaps.test` fixtures; purge must never threaten prod residents.

---

## Sentry error monitoring (2026-06-17)

**Decision:** Add Sentry (`@sentry/nextjs`) **error-only** — no tracing, replay, or logs. US data region. `sendDefaultPii: false` in all init files. Browser events tunnel via `/monitoring` (public middleware bypass; no collision with admin/ops routes). Per-DSN rate limit in Sentry dashboard (~150–170/day). `SENTRY_AUTH_TOKEN` in Vercel Production + Preview for source maps.

**Reasoning:** Close PRE_FLIP observability gap without draining free tier or leaking household PII into error reports.

**Attested (Al / 2026-06-17):** Preview deploy event captured end-to-end; `SENTRY_AUTH_TOKEN` on both Vercel projects (all scopes); per-DSN rate limit 150/12h; test issue resolved; [PR #29](https://github.com/Voels2000/estate-planner/pull/29) merged to `staging`. First Production-environment event confirms on first prod deploy after merge to `main`.

**Verify-env REVIEW (2026-06-21):** `GET /api/admin/verify-env?live=1` may flag `SENTRY_AUTH_TOKEN` as REVIEW (not in `lib/env/manifest.ts`). **Keep on Vercel** — used at build time for source maps, not runtime. No delete; no manifest change required pre-flip.

**Vercel env name audit (2026-06-21):** `vercel env ls` on `estate-planner` — Production (32) vs Preview (18) keys; **`STRIPE_CUSTOMER_PORTAL_URL`** and **`RESEND_WEBHOOK_SECRET`** absent both scopes; intentional Production-only live `STRIPE_PRICE_*` + `STRIPE_WEBHOOK_SECRET`; Preview staging Supabase + `WAITLIST_MODE`. Values not compared (secrets). **Attest: Al / 2026-06-21.**

---

## Webhook `tier_upgraded` analytics integrity (2026-06-18)

**Finding:** On `checkout.session.completed`, `trackTierUpgrade` ran even when the consumer `profiles` Supabase update failed — `funnel_events` could record `tier_upgraded` while the profile never updated (analytics vs billing state mismatch).

**Fix:** [PR #34](https://github.com/Voels2000/estate-planner/pull/34) — call `trackTierUpgrade` only in the `else` branch after a successful profile write. No dedup table; no HTTP status change.

**Reasoning:** Live data-integrity defect, independent of post-launch idempotency/retry work ([WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md](./WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md)).

---

## Pre-launch security fixes (2026-06-17)

**Beneficiary grant tokens:** Removed capability token and email from `sendGrantInviteEmail` server logs — log grant id only.

**Cron/internal auth:** Centralized `requireCronAuth` / `requireCronOrInternal` in `lib/api/internalApiAuth.ts` — fail closed when `CRON_SECRET` or `INTERNAL_API_KEY` unset; constant-time compare.

**Admin API MFA:** Directory admin, referrals admin, and terms update routes now use `requireAdminApi()` (privileged MFA when `REQUIRE_PRIVILEGED_MFA=true`).

**Introduction emails:** `POST /api/advisor-directory/introduce` binds sender identity to session profile; HTML-escapes user note; validates advisor id/email match.

**Email capture:** Rate-limited (10/min/IP); raw email removed from logs; drip trigger uses `internalApiHeaders()`.

---

## Cross-household isolation in `e2e-smoke` CI (2026-06-17)

**Decision:** Run `test:e2e:security-isolation` (20 tests) inside the existing **`e2e-smoke`** workflow on every PR to `main` when `E2E_SMOKE_IN_CI=true` — staging Supabase + localhost app; optional `PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID` passthrough.

**Shipped:** [PR #30](https://github.com/Voels2000/estate-planner/pull/30) (`chore/ci-security-isolation`, `52536a5`). Gate-validated: commented out `requireHouseholdAccess` in `app/api/gifting-summary/route.ts` → suite failed on `Consumer isolation › POST gifting-summary on foreign household returns 403 or 404` → reverted → 20/20 green (break not committed).

**Reasoning:** Post-launch hardening item #3 — cross-tenant isolation as a merge blocker without a separate workflow.

---

## CI hardening + staging branch flow (2026-06-17)

**Decision:** Harden PR gates and adopt a long-lived **`staging`** integration branch before production merges.

**Shipped:** [PR #27](https://github.com/Voels2000/estate-planner/pull/27) — `ci.yml`: ESLint + **`npx tsc --noEmit`** + unit on all PRs; full build/audits on PR → `main` only; PR triggers include **`staging`**. `rls-verify.yml`: `npm run verify:rls -- --require-sql` with staging **`SUPABASE_DB_URL`** from GitHub secrets (session pooler, `cmzyxpxfyvdvbsykjvsg` only). Branch protection: **`staging-pr-gate`** on `staging` (requires **`verify`**); **`main-no-direct-push`** unchanged ( **`verify`** + **`e2e-smoke`** + **`rls-verify`** ).

**Git flow:** `feature/*` → PR → **`staging`** (`estate-planner-staging.vercel.app`) → PR → **`main`** (`www.mywealthmaps.com`).

**Credential revision:** Staging **`SUPABASE_DB_URL`** may live in GitHub secrets for RLS structural coverage in CI. **Production** `SUPABASE_DB_URL` still never in GitHub or Vercel.

**Reasoning:** Catch type errors and RLS schema drift before merge; lightweight gate on staging PRs; full E2E/RLS only on path to production.

---

## E2E/RLS on PRs — staging-only GitHub secrets (2026-06-14)

**Decision:** Restore E2E smoke + RLS verify workflows on every PR to `main`, using **staging** Supabase credentials only. Production keys remain forbidden in GitHub; staging **`SUPABASE_DB_URL`** added in PR #27 for `--require-sql` coverage.

**Shipped:** [PR #8](https://github.com/Voels2000/estate-planner/pull/8) — `.github/workflows/e2e-smoke.yml`, `rls-verify.yml`, `scripts/write-ci-staging-env.sh`. Repo variables `E2E_SMOKE_IN_CI=true`, `RLS_VERIFY_IN_CI=true`. Eight staging repository secrets. Branch protection requires **`verify`** + **`e2e-smoke`** + **`rls-verify`**.

**Evidence:** Green workflow runs on PRs #8–#10 (2026-06-14). Staging ops: tax reference data synced from prod; `estate-monte-carlo` edge deployed to staging.

**Reasoning:** Two-DB split unblocked staging-only CI. Automated PR gates catch data/schema gaps (first run surfaced empty tax tables on staging) without exposing prod credentials.

**Maintenance:** [DEPLOYMENT.md §9](./DEPLOYMENT.md#9-refreshing--maintaining-staging) — `db push` to staging, reference-data copy, `PLAYWRIGHT_HOUSEHOLD_ID` refresh after re-seed.

---

## Env verifier + production price throw-guard — silent test-price risk (2026-06-13)

**Decision:** Standing infra closes the “test price ID in production” risk:
1. **`GET /api/admin/verify-env`** — token-gated (`ADMIN_VERIFY_TOKEN`); manifest-driven presence/shape/exposure flags; optional `?live=1` Stripe/Supabase liveness.
2. **`resolveConsumerPriceId` throw** — runtime seatbelt when `VERCEL_ENV=production` and consumer price env empty.

**Manifest SSOT:** `lib/env/manifest.ts` — dual Supabase key formats (`eyJ` | `sb_secret_` / `sb_publishable_`); dead vars intentionally omitted until dashboard deletion.

**Gate-2 use:** Run `verify-env?live=1` before `PUBLIC_SIGNUP_OPEN=true` — attest only when report is actually clean (after Vercel dashboard fixes).

**Reasoning:** Periodic audit + runtime throw beats hoping env vars stayed correct across deploys.

---

## GitHub credential hard rule — solo (2026-06-09)

**Decision:** While production and local E2E share **one Supabase project**, **no sensitive credentials go in GitHub Actions** — no repository secrets. Only `ci.yml` → **`verify`** runs in GitHub. E2E/RLS workflow YAML removed from `.github/workflows/`; templates in `docs/templates/github-workflows/`. Local: `release:preflight` + `release:post-deploy`.

**Only exception:** After dedicated staging Supabase — restore templates, staging-only keys in GitHub. Production keys and `SUPABASE_DB_URL` **still never** in GitHub.

**Commit-type → check matrix:** [ENVIRONMENT_TESTING.md § Release discipline](./ENVIRONMENT_TESTING.md#release-discipline--what-to-run-when).

**Supersedes (for solo):** Pre-go-live guidance to enable `E2E_SMOKE_IN_CI` with staging secrets on a shared project.

---

## Domicile API gate + shared roster net worth (2026-06-12)

**Decision:** Align domicile advisor access with `assertHouseholdAccess` (`CONNECTED_ADVISOR_CLIENT_STATUSES` only). Share one roster net-worth loader and column definition across advisor and attorney home pages.

**Domicile:** `lib/domicile/assertDomicileSubjectAccess.ts` — advisor must have `active` or `accepted` link (not `pending` / `consumer_requested`). Matches `/domicile-analysis` client picker; closes API hole.

**Roster net worth:** `lib/roster/rosterNetWorth.ts` — `loadRosterNetWorthByOwner` (assets + RE equity + business FMV + non-ILIT insurance − liabilities). Attorney `/attorney` roster now uses same formula as `/advisor`. **`RosterNetWorthColumnHeader`** + **`ROSTER_NET_WORTH_TOOLTIP`** on both portals (“Est. Net Worth”). Client workspace composition unchanged.

**Reasoning:** Attorney roster previously summed assets + full RE value (mislabeled “Estate Value”). Product approved aligning formulas and labeling honestly; attorney roster numbers may shift vs old column.

**Files:** `assertDomicileSubjectAccess.ts`, `lib/roster/rosterNetWorth.ts`, `RosterNetWorthColumnHeader.tsx`, domicile API routes, `app/(attorney)/attorney/page.tsx`, `app/advisor/_advisor-client.tsx`.

---

## Code audit Sprint C + D — safe perf + dead code (2026-06-12)

**Decision:** Close audit sprints C and D. Defer gifting summary cache and dashboard bundle dedupe (stale-read / refactor risk).

**Sprint C (shipped):**

| Change | Why safe |
|--------|----------|
| Vercel recompute + base-case use `after()` + 3s debounce | Same eventual recompute as local; reduces IO storms on rapid saves |
| Advisor roster `Promise.all` | Query scheduling only; same loaders and props |
| Domicile + attorney roster (see above) | Access tightening + shared roster definition |

**Sprint D (shipped):** Delete zero-import components (`GiftingDashboardClient`, legacy health score blocks), unused `lib/brand/classes` + `lib/ui/form`, deprecated `EstateCalloutCard()` wrapper and `PLANNING_MISSING_PROJECTION_ACTIONS` alias, superseded one-off seed scripts (canonical `seed:e2e`), redundant `app/advisor/prospect/page.tsx` (`next.config.ts` redirect preserved).

**Sprint A leftover:** `afterHouseholdWrite` on strategy-config upsert/delete — aligns with other consumer write routes; no new client behavior.

**Still deferred:** Gifting summary cache; dashboard bundle dedupe refactor.

**Files:** `triggerEstateHealthRecompute.ts`, `triggerBackgroundBaseCase.ts`, `app/advisor/page.tsx`, `app/api/strategy-configs/route.ts`, deleted dead-code paths above.

---

## Admin-Redesign — Tax Rules RLS + debug state tax path (2026-06-09)

**Tax Rules RLS confirmed:** `state_estate_tax_rules` and `federal_estate_tax_brackets` have authenticated **Admin** insert/update/delete policies (see `docs/audits/rls-policies-2026-05-27.csv`). Tax Rules tab handlers correctly use `createClient()` with the admin user's JWT — **no API wrapper or `createAdminClient()` migration required** for bracket CRUD.

**Debug tab state tax:** `state_tax_rates` was dropped pre-go-live (`20260708120000`). The debug tab Engine 1 (Income & Tax) now queries the **top bracket rate** from `state_income_tax_brackets` for the household state and selected year. This is a **diagnostic approximation only** — not the canonical `stateIncomeTax.ts` progressive engine used in projections.

---

## Admin P1 — federal tax config, user detail, waitlist (2026-06-09)

**Decision:** Ship three admin UI surfaces that currently require raw Supabase edits — federal exemption/gift exclusion, user billing support, and waitlist invites — before open signups and live billing.

**Reasoning:** `federal_tax_config` feeds `computeFederalEstateTax()` on every PDF, export, and horizon column; one typo in SQL affects all households. Stripe webhook misses need a one-click resync, not manual `profiles` edits. Beta invites were hand-built URLs from the Funnel cheat sheet.

**Shipped:**

| Before | After |
|--------|-------|
| Raw Supabase edit for federal exemption | Tax Rules → Federal Tax Configuration + confirmation + audit |
| Manual `profiles` tier fix | Users tab → Sync from Stripe |
| Personal email with hand-built beta URL | Waitlist tab → Invite / Bulk invite |

**Not in scope:** Impersonation (login-as-user), `app_config` key/value editor, revenue MRR panel — deferred post-launch.

**Schema nuance — `federal_tax_config` is not a single row:** The table uses `scenario_id` + `is_active` (e.g. `current_law`, `no_exemption`). Engines and RPCs load `WHERE is_active = true LIMIT 1` (or all active rows for strategy tab). The sprint spec assumed one row; **GET returns all active rows** and **PATCH updates by row `id`** — the UI edits every active scenario. This matters when updating the 2027 exemption: confirm which `scenario_id` rows are active before saving, not just a lone config row.

---

## Admin-A — Ops Home + ops_tasks engine (2026-06-09)

**Decision:** Extend cron + Postgres with `ops_tasks` and `cron_health` tables instead of adopting a workflow engine (Inngest, Trigger.dev). Admin **Ops Home** is the default `/admin` tab.

**Reasoning:** Solo-operator scale; compliance calendar obligations were documented but not enforced. Tax rules scan→rollover→apply is the model for human+system workflows. Cron already handles deletions and compliance email — ops tasks and cron health fit the same stack with no new vendors.

**Shipped:** `ops_tasks` (13 seeded tasks), `cron_health`, `recordCronHealth`, extended `compliance-reminders`, deletion retry backoff, post-deploy failure email, privacy admin intake, Directories tab.

---

## CI build placeholders — not production secrets (2026-06-08)

**Decision:** Add **non-functional dummy env vars** to the GitHub Actions `Production build` step in `.github/workflows/ci.yml` so `next build` can collect API route modules without real credentials.

**Reasoning:** Several routes import `lib/resend` and instantiate `Stripe` at module load. CI previously had only Supabase `NEXT_PUBLIC_*` placeholders; build failed on `Missing RESEND_API_KEY` / `Neither apiKey nor config.authenticator provided`. Vercel Production and Preview use **real** secrets from the Vercel dashboard — they never read `ci.yml`. Placeholder strings are committed in plain text by design (not secrets).

**CI build env (GitHub only):**

| Variable | Value (dummy) |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://placeholder.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `placeholder-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | `placeholder-service-role-key` |
| `RESEND_API_KEY` | `re_placeholder_ci_build_only` |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder_ci_build_only` |

**Still open:** CI `verify` job may fail on UX language audit (13 flagged phrases) — unrelated to build; does not affect Vercel env. Manual Vercel redeploy or fix audit to unblock auto-deploy if deployment protection waits on checks.

**Commits:** `201e9be`, `b9eef05`

---

## Pre-go-live tax data cleanup (2026-06-08)

**Decision:** Remove deprecated `state_income_tax_rates` table and purge tax years 2023–2025 from all rollover tables before go-live. Anchor year **2026** only; annual updates via existing scan · rollover · commit workflow.

**Reasoning:** No production users yet — historical years added dev noise and blocked clean scan. Engines select latest year ≤ projection year, so 2026-only is sufficient until 2027 rollover. Flat-rate table was admin-archive-only (no engine reads). Inheritance rules needed explicit 2026 seed after purge (previously only existed for older years).

**Migrations:** `20260708120000_cleanup_legacy_tax_tables.sql`, `20260708130000_seed_state_inheritance_tax_rules_2026.sql`

**Verify:** `npm run verify:tax-coverage` — all domains PASS for 2026.

---

## Admin tax rules — scan · rollover · commit (2026-06-07)

**Decision:** Three-phase admin workflow for annual tax table updates — read-only scan, client-held rollover draft (copy Y→Y+1), admin-approved commit. No external tax API; manual verify flags in `data/tax-rollover/manual-verify.json`. `federal_tax_config` never auto-copied.

**Reasoning:** Reduces year-end ops risk — scan catches gaps before projections break; rollover copies unchanged jurisdictions in bulk; commit requires explicit ack for flagged states/sections. Shared scan engine powers UI and `npm run verify:tax-coverage` CLI.

**Files:** `lib/tax/admin/*`, `app/api/admin/tax-rules/*`, `app/admin/tax-rules-workflow.tsx`, `data/tax-rollover/manual-verify.json`

**Canonical doc:** [MASTER_ARCHITECTURE § Admin tax rules maintenance](./MASTER_ARCHITECTURE.md#admin-tax-rules-maintenance-scan--rollover--commit) · [CALCULATION_ENGINES § Admin tax data maintenance](./CALCULATION_ENGINES.md#admin-tax-data-maintenance)

---

## B2B2C consumer billing handoff — configurable per role (2026-06-07)

**Decision:** Configurable B2B2C consumer billing handoff per professional role — advisor default ON (eMoney-class norm), attorney default OFF until market validates. Shared `lib/billing/managedConsumerBilling.ts`; env toggles `B2B2C_*`. Pricing matrix TBD in Stripe before open signups.

**Canonical doc:** [BILLING_B2B2C_POLICY.md](./BILLING_B2B2C_POLICY.md) — includes [competitive seat pricing benchmarks](./BILLING_B2B2C_POLICY.md#competitive-pricing-benchmarks-2026) (eMoney, RightCapital, Clio, Holistiplan).

---

## Release discipline — three-gate routine (2026-06-07)

**Decision:** Enforce local → preview → production with npm script bundles + GitHub branch protection toggled at go-live prep — not a custom release bot.

| Gate | Enforcement |
|------|-------------|
| Local | `release:local` / `release:preflight` — exit non-zero on failure |
| Preview | Vercel branch deploy + manual smoke (auth, billing if touched) |
| CI | Required checks on `main` once `E2E_SMOKE_IN_CI` + `RLS_VERIFY_IN_CI` enabled |
| Production | `release:post-deploy` local-only (`SUPABASE_DB_URL` never GitHub) |

**Canonical doc:** [RELEASE_ROUTINE.md](./RELEASE_ROUTINE.md)

**Alternatives considered:** Full RLS SQL in GitHub CI (rejected — credential power); skipping preview gate (rejected — catches Vercel/env issues E2E misses).

---

## Environment testing & credential placement (2026-06-07)

**Decision:** Solo-founder pragmatic split — CI and preview use Supabase keys safe for GitHub; production service role and `SUPABASE_DB_URL` never in GitHub. **Today:** one Supabase project is typical; **optional upgrade:** dedicated staging project before collaborators.

| Credential | Placement |
|------------|-----------|
| Supabase URL/keys for CI | GitHub Actions, Vercel Preview, local `.env.test` |
| Production service role | Vercel Production + local `.env.local` only |
| `SUPABASE_DB_URL` | **Local only** — post-deploy `verify:rls --require-sql`; never GitHub/Vercel |

**CI behavior:** `e2e-smoke.yml` → localhost app + staging Supabase. `rls-verify.yml` → JWT isolation on staging only (no SQL in CI). SQL RLS invariants run manually after production deploy.

**Not required (solo):** read-only Postgres CI role, scheduled rotation, separate GitHub org.

**Do require:** 2FA (authenticator) on GitHub and Vercel.

**Canonical doc:** [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md)

**Alternatives considered:** Production Supabase in GitHub (rejected — blast radius); `SUPABASE_DB_URL` in GitHub for full RLS CI (rejected — low solo risk, high credential power).

---

## Voels post-deploy cron — MC self-heal (2026-06-07)

**Decision:** Daily cron `/api/cron/post-deploy-verify` (9:00 UTC) should **backfill** missing Voels `monte_carlo_results` before running the 7 verify checks — not only alert on failure. Manual `npm run verify:post-deploy-voels` stays verify-only (fail fast with `npm run smoke:mc-voels` hint). Up to ~24h lag if cache drops mid-day; sufficient for demo/ops gate.

**Why not regen on every household write:** Base case + MC is expensive; consumer writes only bump staleness and regen on page load. Voels cron is the ops safety net for the prod smoke account.

**Files:** `lib/verify/runPostDeployVoelsChecks.ts` (`ensureVoelsMonteCarloCached`, `remediate` option), `app/api/cron/post-deploy-verify/route.ts`, `vercel.json`

---

## Competitive scan M1–M4 (2026-06-07)

**Decision:** Ship medium-impact competitive backlog (except M5 attorney billing — Stripe at go-live).

| Item | Approach |
|------|----------|
| M1 | `requireHouseholdAccess` + Zod `householdId` on RPC/composition/document/advisor routes |
| M2 | Consumer `/settings/documents` vault — PDF upload via existing `/api/documents/upload` |
| M3 | `runPostDeployVoelsChecks` + daily cron (self-heals MC) + `npm run verify:post-deploy-voels` + `npm run smoke:mc-voels` |
| M4 | `@upstash/ratelimit` when `UPSTASH_REDIS_*` set; memory fallback for dev/CI |

**Files:** `lib/api/schemas/householdAccess.ts`, `lib/api/requireVaultAccess.ts`, `components/consumer/ConsumerDocumentVault.tsx`, `lib/verify/runPostDeployVoelsChecks.ts`, `lib/api/simpleRateLimit.ts`

---

## Competitive scan H1–H4 + GitHub E2E smoke (2026-06-07)

**Decision:** Ship high-impact competitive backlog items before go-live; gate privileged MFA and CI E2E with env flags so automation keeps working until launch.

| Item | Approach |
|------|----------|
| H1 Attorney FKs | Upload/invite/accept use listing + household IDs; `npm run repair:attorney-fks` for legacy rows |
| H2 Import Phase A | Custodian export guides + header/type normalizer (Plaid deferred) |
| H3 CI E2E smoke | `.github/workflows/e2e-smoke.yml`; **`E2E_SMOKE_IN_CI=false` until pre-go-live checklist** |
| H4 Privileged MFA | `REQUIRE_PRIVILEGED_MFA=false` until go-live; flip with `PUBLIC_SIGNUP_OPEN` |

**Update (2026-06-14 / 2026-06-17):** `E2E_SMOKE_IN_CI` + `RLS_VERIFY_IN_CI` enabled with staging secrets — [LAUNCH.md § B3](./LAUNCH.md). Cross-household isolation added to `e2e-smoke` — [PR #30](https://github.com/Voels2000/estate-planner/pull/30).

**Pre-launch ops:** Enable GitHub E2E (`E2E_SMOKE_IN_CI=true` + secrets) **before** open signups — canonical status [LAUNCH.md § B3](./LAUNCH.md) (done 2026-06-14); archived steps in [LAUNCH_CHECKLIST](./archive/LAUNCH_CHECKLIST.md#github-actions-e2e-smoke-pre-go-live).

**Files:** `lib/security/privilegedMfaPolicy.ts`, `middleware.ts`, `lib/attorney/resolveAttorneyProfileId.ts`, `lib/import/custodianImportGuides.ts`, `.github/workflows/e2e-smoke.yml`, `docs/COMPETITIVE_SCAN.md`

---

## Admin deletion email lookup (2026-06-07)

**Decision:** Admin Execute Deletion form resolves UUID from email via `GET /api/admin/deletions?view=lookup&email=` (profiles first, then auth pagination). Scheduled deletions and privacy deletion requests link to Execute tab with pre-filled fields — no manual UUID copy from Supabase.

**Files:** `app/api/admin/deletions/route.ts`, `app/admin/_components/DeletionCompliance.tsx`

---

## E2E advisor client — Johnson retired (2026-06-07)

**Decision:** Replace `e2e-client.johnson@mywealthmaps.test` with **`e2e-advisor-client@mywealthmaps.test`**. Rich advisor workspace fixture data (401k, IRA, FL domicile, RMD birth year 1965) now seeded via `seedE2eAdvisorClientHousehold()` in master `seed:e2e`. Old Johnson email added to `LEGACY_E2E_EMAILS` for `--legacy` cleanup.

**Go-live:** Keep canonical `@mywealthmaps.test` + Voels + `GO_LIVE_PROTECTED` (`david@gmail.com`, `stephen.a.voels@sbcglobal.net`); delete everything else via **`npm run cleanup:purge`** (uses `deleteUserData`, not auth-only delete).

---

## Go-live auth purge + deleteUser table coverage (2026-06-07)

**Decision:** Add **`--purge-unprotected`** to `scripts/cleanup-test-accounts.ts` — paginate auth users, skip full `PROTECTED` set (case-insensitive), delete remainder via **`lib/compliance/deleteUser.ts`**. Extend `deleteUser.ts` household/owner table lists (composition cache, checklist, domicile, MC results, advisor notes/gaps, listings) and skip missing prod tables gracefully.

**Why:** Washington WCPA requires full data removal, not orphaned FK rows. Past cleanups failed on incomplete table lists and schema drift (`asset_beneficiaries` uses `owner_id`, not `household_id`).

**Commands:** `npm run cleanup:purge:dry-run` · `npm run cleanup:purge` · `npm run verify:deletion -- --email …`

**Outcome:** Prod auth reduced to **10** accounts; Johnson + last rolobe stragglers removed with audit log entries.

---

## Estate verification suite — cross-surface matrix + user self-service (2026-06-07)

**Decision:** Unify scattered `scripts/verify-*.ts` checks into **`npm run verify:estate`** with labeled comparison matrix (composition cache, live `calculate_estate_composition`, export Engine B, strategy Today). Optional e2e-only strategy lifecycle probe (mutates `strategy_line_items`), HTTP scrape via magic-link session, frozen goldens per preset, and **`POST /api/verify-estate-plan`** + **Verify my plan** on consumer Security settings for owners/advisors without service role.

**Why not replace Playwright:** Matrix proves **numeric consistency**; E2E (~280 tests) still covers auth, UI, and security. Voels preset for prod smoke; e2e preset for CI foundation.

**Files:** `lib/verify/*`, `scripts/verify-estate-suite.ts`, `tests/fixtures/estate-golden/`, `app/api/verify-estate-plan/route.ts`, `app/(dashboard)/settings/security/_plan-verification-client.tsx`

---

## Voels demo account sync — comcast source of truth (2026-06-07)

**Decision:** **`avoels@comcast.net`** (advisor “My Plan”) and **`avoels@outlook.com`** (consumer client) are intentionally separate households for the advisor/client demo, but must stay value-aligned for smoke. No automatic DB mirror — ops script **`npm run sync:voels-demo`** copies financial rows (match by name + type, multiset pairing for duplicate names) from comcast → outlook and triggers **`recompute-estate-health`** on Voels Household.

**Why not a trigger:** Demo-only pair; explicit script avoids prod coupling and duplicate-name pairing bugs.

**Files:** `scripts/sync-voels-demo-accounts.ts`, `scripts/compare-voels-accounts.ts`, `package.json` (`sync:voels-demo`).

---

## Engine B export standardization — estate-plan PDF API + dead loader removal (2026-06-07)

**Decision:** Replace legacy SQL RPCs **`calculate_federal_estate_tax`** / **`calculate_state_estate_tax`** on **`/api/export-estate-plan`** with Engine B helpers shared with advisor export: **`getCachedComposition`**, **`computeFederalExportTax`**, **`calculateStateEstateTax`** + **`resolveActiveStateTax`**, **`deriveHasBypassTrustFromLineItems`**. Remove unused advisor **`estateTax`** dataset fetch (was **`calculate_state_estate_tax`** on tax/domicile/strategy tabs — Tax tab already horizon-driven). Trust/will guidance fallback reads composition cache instead of live classify RPC.

**Files:** `lib/export/buildEstatePlanPdfTaxPayload.ts`, `lib/export/loadEstatePlanPdfTaxPayload.ts`, `app/api/export-estate-plan/route.ts`, `lib/advisor/loaders.ts`, `lib/trusts/loadTrustWillGuidance.ts`, `scripts/verify-engine-b-tax-surfaces.ts`

**Regression:** grep legacy RPC names in `lib/` + `app/` must be zero (see **`CALCULATION_ENGINES.md`**).

---

## Attorney portal collaboration v2 — consumer-owned data + firm workflow (2026-06-07)

**Decision:** Expand attorney portal with collaboration and firm ops without mutating consumer estate data. **Read-only** estate/tax views unchanged; attorneys **upload** to **`legal_documents`** vault. Add **`matter_stage`** / **`client_status`** on **`attorney_clients`** (firm workflow only); **`attorney_notes`** (listing-scoped, never visible to consumer); **`attorney_document_requests`** (attorney asks → consumer notified on **`/my-attorney`**). Portal nav: Clients · Requests · Billing · Firm settings. Connection inbox wires existing accept/decline APIs; accept → **`active`** (advisor parity); claim-listing + directory connect create **`consumer_requested`** rows.

**Files:** `app/(attorney)/` · `components/attorney/Attorney*Panel.tsx` · `app/api/attorney/{matter,notes,document-requests,listing}/` · `supabase/migrations/20260702120000_attorney_collaboration_workflow.sql`

---

## ATG intake — separate table + gifting tab section (2026-06-07)

**Decision:** Keep **`adjusted_taxable_gifts`** separate from **`gift_history`** (`gift_type='lifetime'`). ATG is IRC §2001(b) taxable-estate add-back, not lifetime exemption used. Intake: **`AdjustedTaxableGiftsSection`** on gifting tab; writes via **`/api/consumer/adjusted-taxable-gifts`** (same auth pattern as gift-history). Restore RPC add-back in migration **`20260701120000`**. Horizon **`lifetimeGiftsUsed`** unchanged — still from **`calculate_gifting_summary.lifetime_exemption_used`**.

**Files:** `components/gifting/AdjustedTaxableGiftsSection.tsx` · `lib/gifting/adjustedTaxableGifts.ts` · `app/api/consumer/adjusted-taxable-gifts/route.ts` · `supabase/migrations/20260701120000_restore_atg_in_calculate_estate_composition.sql`

---

## Consumer Monte Carlo — full advisor assumption parity (2026-06-07)

**Decision:** Consumer **`/monte-carlo`** applies the same **7** assumption fields as advisor MC when accepted or edited manually: return mean, volatility, withdrawal rate, success threshold, simulation count, planning horizon, inflation. **`applyConsumerMCAssumptionsToInputs`** maps to **`MonteCarloInputs`** optional overrides; **`annualPortfolioReturn`** in **`lib/monte-carlo.ts`** replaces stocks/bonds/cash blend when advisor return model is set. Accept/revert banner copy updated; assumptions step renders **`CONSUMER_MC_ASSUMPTION_FIELDS`**.

**Files:** `lib/monte-carlo/applyConsumerAssumptionInputs.ts` · `app/(dashboard)/monte-carlo/_monte-carlo-client.tsx` · `lib/monte-carlo.ts` · `app/api/monte-carlo/route.ts`

---

## Titling list virtualization — window virtualizer for card lists (2026-06-07)

**Decision:** Virtualize titling card rows with **`@tanstack/react-virtual`** (`useWindowVirtualizer`) when a list has **≥ 20** items. **`VirtualTitlingCardList`** measures variable-height **`AssetTitlingCard`** rows dynamically; falls back to a plain map for smaller lists. Applied per owner bucket (assets/insurance) and per tab list (real estate, business).

**Files:** `components/titling/VirtualTitlingCardList.tsx` · `lib/titling/virtualizeConstants.ts` · `app/(dashboard)/titling/_titling-client.tsx`

---

## Titling modal code-split — lazy-load edit dialogs (2026-06-07)

**Decision:** Extract **`TitlingModal`**, **`BeneficiaryModal`**, and **`BeneficiaryGapModal`** to **`components/titling/`** and load via **`next/dynamic`** (`ssr: false`) only when opened. Shared **`ModalShell`** / form constants in **`titlingModalShared.tsx`**; beneficiary picklist logic in **`lib/titling/beneficiaryPicklist.ts`**; row types in **`lib/titling/titlingEntityTypes.ts`**.

**Deferred:** (none — titling perf sprint complete).

**Files:** `components/titling/TitlingModal.tsx` · `BeneficiaryModal.tsx` · `BeneficiaryGapModal.tsx` · `app/(dashboard)/titling/_titling-client.tsx`

---

## Titling & Beneficiaries perf — lookups + memoized warnings (2026-06-07)

**Decision:** Extract O(1) titling/beneficiary lookups to **`lib/titling/buildTitlingLookups.ts`**; memoize **`getTitlingWarnings`** in **`lib/titling/getTitlingWarnings.ts`**; extract memoized **`AssetTitlingCard`**; share display helpers in **`lib/titling/titlingDisplayHelpers.ts`**. **`/titling`** page loads **`household_people`** in parallel with other queries (join on **`households.owner_id`**).

**Deferred:** (none).

**Files:** `lib/titling/*` · `components/titling/AssetTitlingCard.tsx` · `app/(dashboard)/titling/_titling-client.tsx` · `app/(dashboard)/titling/page.tsx`

---

## Advisor logo file-upload — Storage + settings UI (2026-06-07)

**Decision:** Advisors upload firm logo at **`/advisor/settings`**; **`POST /api/advisor/profile/logo`** writes to public bucket **`advisor-branding`** at `{advisor_id}/logo.{ext}` and sets **`profiles.firm_logo_url`** to the public object URL. **`DELETE`** removes storage object(s) and clears the column. PNG/JPEG/WebP only, 2 MB cap. PDF cover render (2026-06-06) consumes the same URL — no PDF code change.

**Migration:** `20260630120000_advisor_branding_storage.sql` — bucket + RLS (advisor folder scope + public read).

**Files:** `app/api/advisor/profile/logo/route.ts` · `app/advisor/settings/_settings-client.tsx` · `app/advisor/settings/page.tsx`

**Next:** (see ROADMAP backlog).

---

## Federal bracket engine — eliminate remaining flat 40% paths (2026-06-06)

**Decision:** Extend **`computeFederalExportTax()`** / **`computeFederalTaxOnly()`** / **`federalTaxSavedByReduction()`** to every production path that still used flat **`gross × 0.40`** or **`taxable × TOP_RATE`** for federal estate tax. Shared bracket fetch: **`latestFederalBracketsFromRows()`** on **`federal_estate_tax_brackets`**.

**Surfaces:** strategy horizon overlay + composability; Tax tab stress; estate MC (lib, **`runEstateMonteCarloAsync`**, edge); projection death-year federal; ILIT/CST heuristics; strategy alert ILIT savings; PDF narrative sunset + **`ilitTaxSavingsEstimate`**.

**MC async fix:** **`householdFederalExemption()`** (OBBBA) replaces **`currentFederalExemption()`** from narrativeEngine.

**Edge:** Inlined progressive federal in **`supabase/functions/estate-monte-carlo/index.ts`**; accepts **`federalBrackets`** in POST or fetches from DB. **Redeploy required** after merge.

**Fallback:** When bracket rows empty, helpers fall back to top rate on taxable base (same as export path).

**Files:** `lib/tax/federalExportTax.ts` · `lib/strategy/validateComposability.ts` · `lib/calculations/estate-monte-carlo.ts` · `lib/calculations/estate-tax-projection.ts` · `lib/my-estate-strategy/horizonSnapshots.ts` · advisor Strategy/Tax tabs · consumer trust-strategy horizon table.

---

## Export federal — bracket engine for advisor export (2026-06-06)

**Decision:** Replace flat 40% in **`exportMappers`** / PDF page 3 with **`computeFederalExportTax()`** — wraps **`computeFederalEstateTax()`** + **`federal_estate_tax_brackets`**, OBBBA exemption minus **`lifetimeGiftsUsed`**, **`no_exemption`** via zero credit. PDF page 3 uses precomputed **`PDFReportData.federalTax`** (no duplicate inline calc). Fallback when brackets empty: **`estimateFederalEstateTaxSnapshot`** (horizons parity).

**Verify:** `scripts/verify-export-federal-brackets.ts`

**Files:** `lib/tax/federalExportTax.ts` · `lib/advisor/exportMappers.ts` · `lib/advisor/loadAdvisorExportWiring.ts` · `lib/export/generatePDFReport.ts`

---

## Post-deploy verification scripts (2026-06-06)

**Decision:** Index repeatable prod smoke scripts for Voels / post-deploy gates. **`verify-post-deploy-voels.ts`** checks MC Phase 3 (projections threshold data, estate-tax copy signal, depletion tile data, PDF MC narrative via advisor session). Complements **`regenerate-base-case-voels.ts`**, **`verify-state-tax-panel-states.ts`**, **`verify-state-tax-coverage.ts`**.

**Run:** `npx dotenv-cli -e .env.local -- npx tsx scripts/verify-post-deploy-voels.ts`

---

## PDF cover logo — `firm_logo_url` on cover page (2026-06-06)

**Decision:** Render **`profiles.firm_logo_url`** on PDF cover when URL is http(s). **`exportMappers`** passes **`firmLogoUrl`** from **`resolveAdvisorBranding`**; **`generatePDFHTML`** inserts sanitized **`<img class="firm-logo">`** above firm name. Invalid/non-http URLs omitted silently. Logo upload UI remains deferred.

**Files:** `lib/export/generatePDFReport.ts` · `lib/advisor/exportMappers.ts`

---

## StateTaxPanel multi-state + non-estate tax coverage (2026-06-06)

**Decision:** **`StateTaxPanel`** UI registry expanded from 6 hardcoded codes (incl. erroneous AZ) to all **13 modeled estate-tax states** (`MODELED_ESTATE_TAX_STATES` in **`stateEstateTax.ts`**). Tax tab copy no longer hardcodes “Washington”. Advisor dataset prefetch uses **`buildAdvisorStatesToFetch()`** (all modeled estate states + household primary) instead of **`['WA','NY','MA','OR','CT','AZ']`**. **`stateHasNoPortability`** centralized in engine B (was WA/MA/OR-only stub in **`parseBypassTrustSavings`**). NY added to no-portability set for CST/MFJ parity.

**Non-estate tax coverage (verified):**

| Tax type | Engine | DB source | Coverage |
|----------|--------|-----------|----------|
| State **income** | **`stateIncomeTax.ts`** | **`state_income_tax_brackets`** | 42 states + DC with 2026 brackets; 9 no-income-tax states (AK, FL, NV, NH, SD, TN, TX, WA, WY) correctly $0 |
| State **inheritance** | **`calculateInheritanceTax`** / **`computeStateInheritanceTax`** | **`state_inheritance_tax_rules`** | 6 states: IA, KY, MD, NE, NJ, PA |
| State **estate** | **`stateEstateTax.ts`** engine B | **`state_estate_tax_rules`** | 13 states + DC |

**Verify:** **`scripts/verify-state-tax-panel-states.ts`** · **`scripts/verify-state-tax-coverage.ts`**

**Files:** `stateEstateTax.ts` · `stateRegistry.ts` · `StateTaxPanel.tsx` · `TaxTab.tsx` · `advisorStateFetchScope.ts` · `parseBypassTrustSavings.ts`

---

## Base-case regenerate — engine C→B stored rows (2026-06-06)

**Decision:** Post engine C→B deploy, bump **`households.updated_at`** for all households with a saved base case so **`isProjectionStale`** fires and **`generateBaseCase`** runs on next dashboard / estate-strategy / advisor client load. Mirrors ENG-2 growth-assumptions backfill (**`20260527130400`**).

**Voels:** Death year **2057** **`estate_tax_state`** = **$18,273,170** before and after explicit regenerate — stored rows already engine B; migration ensures other households catch up without manual SQL.

**Files:** `supabase/migrations/20260605130000_bump_staleness_after_engine_cb.sql` · `scripts/regenerate-base-case-voels.ts`

---

## Advisor portal — `profiles.firm_name` fallback (2026-06-05)

**Decision:** **`getAccessContext`** resolves **`firm_name`** as **`firms.name` → `profiles.firm_name` → null** — same priority as export branding. Portal roster banner, firm settings, and advisor layout nav no longer show generic **"Firm"** when advisor has **`profiles.firm_name`** but no **`firms`** row (or empty **`firms.name`**).

| Surface | Before | After |
|---------|--------|-------|
| **`/advisor` roster banner** | **`firms.name`** only | Resolved name (Voels: **Voels Financial Group**) |
| **Advisor layout nav** | Email only | Firm name when resolved |
| **Export PDF** | Already used **`profiles.firm_name`** | Unchanged — now aligned with portal |

**Files:** `lib/access/getAccessContext.ts` · `app/advisor/layout.tsx`.

**Voels:** Alan `854051be…` — **`profiles.firm_name: Voels Financial Group`**, no **`firm_id`**.

---

## Codebase cleanup + perf/constants pass (2026-06-05)

**Decision:** Low-risk cleanup and render/fetch optimizations without UX changes. Removed orphaned components and unused estate-tax DB queries; centralized annual gift exclusion constants; wired PDF MC narrative to stored **`first_tax_year_p10`**; memoized fan charts and indexed scenarios table lookups.

| Change | Detail |
|--------|--------|
| **Dead code** | Deleted **`AssetAllocationSummary`**, orphan **`_attorney-client.tsx`**, unused **`buildAllocationContext`** |
| **Estate-tax server** | Dropped **`assets`/`real_estate`/`businesses`** fetches — **`getCachedComposition`** only |
| **`/my-advisor`** | **`advisor_clients`** query uses **`.order('accepted_at').limit(1)`** — fixes PGRST116 when multiple active rows |
| **`lib/gifting/perRecipientLimit.ts`** | **`perRecipientLimitFromSplit`**, **`annualGiftingCapacity`** — replaces scattered **`19000`/`38000`** |
| **Estate-tax client** | Bypass-trust synthetic uses **`stateExemption`** from brackets (no **`3_000_000`** fallback) |
| **PDF** | **`firstTaxYearP10`** on **`PDFReportData`**; **`narrativeEngine`** prefers stored signal |
| **Perf** | **`React.memo`** on **`EstateOutlookChart`**; **`MonteCarloFanChart`** extracted; scenarios **`rowsByAge` Map** |
| **Fetch** | **`getFullHouseholdForOwner`** (`React.cache`) on **`/dashboard`** |

---

## Phase 3 MC UI complete (2026-06-05)

**Decision:** Phase 3 MC UI complete — MonteCarloPanel depletion risk tile (precomputed + edge-run), EstateOutlookChart amber threshold line at state exemption, `/estate-tax` WA threshold probability sentence below state tax row. All three surfaces confirmed passing smoke.

| Surface | Implementation |
|---------|----------------|
| **`MonteCarloPanel`** | **`longevity_depletion_pct`** + **`depletion_floor_amount`** from **`mcSummary`** — Depletion Risk tile (green ≤20%, red >20%) |
| **`EstateOutlookChart`** | **`stateExemption`** from **`state_estate_tax_rules`** — amber dashed line + legend on `/projections` fan chart |
| **`/estate-tax`** | **`wa_threshold_prob_by_year[0]`** via **`loadScenarioMonteCarlo`** — probability sentence after state tax waterfall row |

**Voels:** depletion 0% · threshold line ~$2.19M · “exceeds the WA exemption in all simulated market scenarios” (pct 100).

**Optional follow-up:** PDF Phase 2D — confirm **`first_tax_year_p10`** reads stored value vs recomputed bands → **shipped** in cleanup pass (**`firstTaxYearP10`** on **`PDFReportData`**).

---

## `/my-advisor` — multiple active advisor_clients rows (2026-06-05)

**Decision:** Consumer **`/my-advisor`** connected-advisor query orders by **`accepted_at` DESC**, **`limit(1)`**, then **`maybeSingle()`** — returns most recently accepted link instead of PGRST116 when duplicate active rows exist for one **`client_id`**.

**Files:** `app/(dashboard)/my-advisor/page.tsx`.

---

## MC Phase 3 UI — EstateOutlookChart state exemption threshold line (2026-06-05)

**Decision:** Consumer **`/projections`** **`EstateOutlookChart`** accepts optional **`stateExemption`** prop. When > 0, draw amber (`#f59e0b`) dashed horizontal line at exemption Y (same scale as P90 max), **"WA exempt."** label at right edge, and legend entry **╌╌ State exemption threshold**. Line z-order: above fan bands, below P50 median — matches PDF cliff callout color.

**Data:** Server **`projections/page.tsx`** reads **`state_estate_tax_rules.exemption_amount`** for `household.state_primary` (current year, fallback latest available year). No new MC query — threshold is the static exemption amount, not **`wa_threshold_prob_by_year`**.

**Voels:** ~$2,193,000 line near bottom of chart.

**Files:** `EstateOutlookChart.tsx` · `_projections-client.tsx` · `page.tsx`.

---

## MC Phase 3 UI — MonteCarloPanel depletion tile (2026-06-05)

**Decision:** Surface precomputed **`longevity_depletion_pct`** on advisor **`MonteCarloPanel`** as a **Depletion Risk** stat tile — props from **`mcSummary`** via **`StrategyTab`**. Tile visible when precompute exists (before edge Run); green when ≤20%, red when >20%; hint shows floor from **`depletion_floor_amount`** (default **`MC_DEPLETION_FLOOR`** $500K). Edge-run tiles unchanged.

**Voels:** `longevity_depletion_pct=0` → green **0% Depletion Risk**.

---

## Phase 3 MC signals — shipped ✅ (2026-06-05)

**Decision:** Phase 3 MC signals shipped — **`wa_threshold_prob_by_year`** (P10–P90 ladder per year), **`first_tax_year_p10`** (first year P10 exceeds state exemption), **`longevity_depletion_pct`** (% paths below $500K floor at death year), **`depletion_floor_amount`**. Voels smoke: **`first_tax_year_p10=2026`**, **`depletion=0`**, **`threshold_years=25`**. UI wiring shipped same sprint (see Phase 3 MC UI complete entry).

**Compute/store:** `runEstateMonteCarloAsync` · **`loadScenarioMonteCarlo`** · migration **`20260605110000_mc_phase3_signals.sql`** · **`MC_DEPLETION_FLOOR`** = 500_000. State exemption from **`stateBrackets[0].exemption_amount`**.

**Next sprint — UI surfaces:**

| Surface | Signal | Copy / UI |
|---------|--------|-----------|
| Consumer `/estate-tax` | `wa_threshold_prob_by_year` | “In most market scenarios your estate is above the WA threshold today” |
| PDF cover narrative | `first_tax_year_p10` | Phase 2D wired — confirm reads stored value |
| Strategy tab / `MonteCarloPanel` | `longevity_depletion_pct` | “0% of scenarios show estate depletion by age 90” |
| Projections `EstateOutlookChart` | `stateExemption` from `state_estate_tax_rules` | Amber dashed threshold line on fan chart ✅ |

---

## Advisor Profile Settings UI — `/advisor/settings` (2026-06-05)

**Decision:** Advisors edit export branding on their **`profiles`** row via **`/advisor/settings`** + **`PATCH /api/advisor/profile`** (`full_name`, `firm_name`, `phone` partial update; max-length validation). **`email`** read-only. **`firm_logo_url`** via logo upload API (2026-06-07). Nav **Profile ⚙️** visible to all advisors (not gated on `firm_role`).

**Verify:** Voels PATCH → PDF `?type=report` cover shows updated **`firm_name`**; `scripts/verify-advisor-settings-voels.ts`.

**Next:** portal **`profiles.firm_name`** fallback · PDF logo from **`firm_logo_url`**.

---

## fetchAdvisorProfile debug logs removed (2026-06-05)

**Decision:** Temporary **`fetchAdvisorProfile`** server logs (added in `5b92da7`) **removed pre-launch** in `52ddc23` — silent null stub on query failure restored. Diagnosis confirmed: **`exportWiring: true`** on meeting-prep path; Voels Alan row has **`profiles.firm_name`**; PDF `'My Wealth Maps'` when logged in as e2e-advisor or on fetch error.

---

## Advisor export branding — profiles migration + wiring (2026-06-05)

**Decision:** Migration **`20260605100000_profiles_branding_columns.sql`** adds **`profiles.firm_name`**, **`firm_logo_url`** ( **`phone`** idempotent). Prod history synced via **`20260529120500`** renumber + **`migration repair`** (`11a867d`). Export via **`fetchAdvisorProfile`** → **`resolveAdvisorBranding`**.

**Next:** portal **`profiles.firm_name`** fallback · PDF logo · logo upload UI.

---

## Advisor export branding — seed profiles before settings UI (2026-06-05)

**Decision:** PDF cover / meeting brief branding reads **`profiles`** via **`fetchAdvisorProfile`** → **`resolveAdvisorBranding`**. Alan Voels seeded **`Voels Financial Group`**. **`firm_logo_url`** not rendered in PDF HTML yet.

---

## exportMappers gross alignment — Option A shipped (2026-06-05)

**Decision:** exportMappers gross alignment — Option A shipped; **`grossForExport`** prefers **`advisorHorizons.today.grossEstate`** over **`latestOutput`** year-0; **`page.tsx`** direct call and **`fetchNarrativePdfFields`** both aligned; **`projectionChartRows`** unchanged (per-year growth, intentional).

**Files:** `lib/advisor/exportMappers.ts`, `lib/advisor/loadAdvisorExportWiring.ts`, `app/advisor/clients/[clientId]/page.tsx`.

**Voels check:** PDF cover gross moves from base-case year-0 (~$9.30M) to Strategy tab Today composition gross (~$9.49M).

---

## Projection Engine C→B shipped — death-year state tax engine B (2026-06-05)

**Decision:** Projection Engine C→B — **`computeStateEstateTaxFromBrackets`** removed from **`estate-tax-projection.ts`**; replaced with engine B at both death-year sites (single first death + second death with **`hasBypassTrust`**). **`generate-base-case.ts`** fetches line items and derives **`hasBypassTrust`** before **`computeEstateTaxProjection`** call. Voels smoke: death-year **2057** state tax **$18,273,170** (zero diff vs engine B expected). Non-death years and MFJ first-death marital deduction unchanged.

**Files:** `lib/calculations/estate-tax-projection.ts`, `lib/actions/generate-base-case.ts`, `lib/export/generatePDFReport.ts` (`detectTaxCliff` data-source comment).

**Follow-up:** Regenerate base case per household so stored **`outputs_s1_first`** reflects engine B (Excel Projection sheet + PDF cliff chart).

---

## Monte Carlo Phase 2D shipped — PDF cover MC narrative line (2026-06-05)

**Decision:** Monte Carlo Phase 2D — one MC summary sentence appended to PDF cover **tax callout detail** via **`buildMCNarrativeLine()`** in **`narrativeEngine.ts`**. Finds first band year where `p10_gross` exceeds WA state exemption (no-portability) or federal exemption; age from matching **`projectionChartRows`** year join. Null **`projectionChartBands`** → narrative unchanged.

**Copy:** `Under adverse market conditions, {WA estate|estate} tax exposure may begin as early as age {N}.`

**Sprint closed:** Phases 0–2D complete.

---

## Monte Carlo Phase 2C shipped — PDF page 2 MC band polygons (2026-06-05)

**Decision:** Monte Carlo Phase 2C — **`buildEstateSVGChart`** extended with optional **`projectionChartBands`**; **`buildAdvisorExportPayloads`** made async (**`supabase`** param added); call sites in **`page.tsx`** and verify script updated. Bands join by year; 25 MC years overlaid on 32 projection rows.

**Implementation:** **`loadScenarioMonteCarlo`** in **`exportMappers.ts`** → maps `percentiles_by_year` to inline band shape on **`PDFReportData`**; gross P10–P90 fill `#3b82f6` (0.12), net P10–P90 fill `#10b981` (0.10); polygons render behind deterministic gross/net lines. Null bands → page 2 SVG unchanged.

**Files:** `lib/export/generatePDFReport.ts`, `lib/advisor/exportMappers.ts`, `lib/advisor/loadAdvisorExportWiring.ts`, `app/advisor/clients/[clientId]/page.tsx`.

**Next:** Phase 2D narrative one-liner (`narrativeEngine.ts`).

---

## Monte Carlo Phase 2C pre-flight — PDF chart wiring recon (2026-06-05)

**Decision:** Phase 2C adds MC fan bands to PDF page 2 by extending existing **`buildEstateSVGChart()`** — not a new chart component. Wire **`loadScenarioMonteCarlo`** through export path; **`projectionChartBands`** is a new optional field on **`PDFReportData`** (distinct from deterministic **`projectionChartRows`**).

**Pre-flight confirmed:**

- **`buildEstateSVGChart(rows, domicileState)`** — `lib/export/generatePDFReport.ts`; rows are engine-C **`scenarioOutputs`** mapped to `{ year, age, gross, netToHeirs, fedTax, stateTax, totalTax }`.
- **`exportPdfData`** — no `projectionChartBands` / `percentiles_by_year` today; optional **`monteCarlo`** block (page 5 tax percentiles) is separate from page 2 chart.
- **`loadAdvisorExportWiring.ts`** — uses **`monteCarloResults`** from **`fetchMonteCarloSummary`** (slim export-wiring type); replace or supplement with **`loadScenarioMonteCarlo`** for `percentiles_by_year`.

**Reference implementation:** **`EstateOutlookChart`** (Phase 2A) — same `PercentileByYear[]` polygon pattern, print-safe inline SVG.

---

## Monte Carlo Phase 2A+2B shipped — projections EstateOutlookChart + Strategy tab badge (2026-06-05)

**Decision:** Monte Carlo Phase 2A+2B shipped — projections **EstateOutlookChart** (`percentiles_by_year` SVG bands), Strategy tab at-death **P10/P90 badge**, **MonteCarloPanel** “Last precomputed” timestamp. **`PrecomputedMonteCarloSummary`** alias added to advisor client shell to avoid export-wiring **`MonteCarloSummary`** type clash.

**Phase 2A:** `/projections` — standalone Estate Outlook section below retirement BarChart; server `loadScenarioMonteCarlo` via `households.base_case_scenario_id`.

**Phase 2B:** Advisor Strategy tab — `mcSummary` prop thread (`page.tsx` → shell → `StrategyTab` → `StrategyHorizonTable` + `MonteCarloPanel`); badge on at-death gross cell only; precomputed timestamp without changing manual Run / edge POST.

**Next:** Phase 2C PDF SVG bands; Phase 2D narrative one-liner.

**Files:** `app/(dashboard)/projections/_components/EstateOutlookChart.tsx`, `app/advisor/clients/[clientId]/page.tsx`, `components/shared/StrategyHorizonTable.tsx`, `components/advisor/MonteCarloPanel.tsx`, `lib/advisor/loadScenarioMonteCarlo.ts`.

---

## Projection engine C→B — sprint queued (2026-06-05)

**Decision:** Queue **Projection Engine C→B Unification** sprint post–Monte Carlo integration. Replace `computeStateEstateTaxFromBrackets` in `estate-tax-projection.ts` death-year logic with `calculateStateEstateTax` + `resolveActiveStateTax` (engine B). MFJ first-death marital deduction ($0 tax) unchanged; second death uses engine B with `hasBypassTrust`, portability, NY cliff.

**Why now:** Export Tax Analysis and Strategy tab use engine B; Excel Projection sheet and PDF SVG chart still read stored `outputs_s1_first` row taxes (engine C, death-year-only). Voels export (2026-06-05): Tax Analysis WA ~$911K correct; Projection rows 2026–2056 show $0 tax by design until death year.

**After ship:** Regenerate base case (`generateBaseCase`) so stored rows reflect engine B. Regression: `detectTaxCliff()` on projection chart; `scripts/verify-estate-mc-voels-smoke.ts`.

**Depends on:** Monte Carlo integration sprint (shared projection row schema).

**Files:** `lib/calculations/estate-tax-projection.ts`, `scripts/verify-estate-mc-voels-smoke.ts`.

---

## stateBrackets fetch — latest tax year fallback (2026-06-05)

**Decision:** `loaders.ts` stateBrackets — year fallback added; `tax_year = currentYear` with fallback to latest available; fixes engine B $0 state tax when 2026 rules not yet seeded.

**Context:** `state_estate_tax_rules` query filtered `tax_year = new Date().getFullYear()` only. No 2026 rows → `stateBrackets = []` → `calculateStateEstateTax` returned $0 on export panel / Excel Tax Analysis despite engine B in `exportMappers.ts`.

**Fix:** Two-step fetch in `loadAdvisorClientDatasets` — current year first; if empty, latest available year (up to 20 bracket rows, `tax_year` desc).

**Related:** `exportMappers.ts` — `fedTaxExport` / `stTaxExport` now engine B (aligned with PDF page 3).

**Files:** `lib/advisor/loaders.ts`, `lib/advisor/exportMappers.ts`.

---

## Domain 5 — documentation sync (2026-06-05)

**Decision:** Documentation sync — `CALCULATION_ENGINES.md`, `SCORE_TAXONOMY.md`, `ROADMAP.md` updated to reflect unification audit completion.

- **Monte Carlo:** Engine B canonical for estate MC; flat `stateEstateTaxRate` deprecated (`fc85ff8`). Retirement MC (`lib/monte-carlo.ts`, `monte_carlo_runs`) documented as separate engine.
- **Score label:** "Plan health score" retired; **`Estate readiness`** (`ESTATE_READINESS_LABEL`) sole canonical consumer label.
- **Sprint status:** Pre-Monte Carlo Unification Audit marked complete (Domains 1–5); Monte Carlo integration sprint unblocked.

**Files:** `docs/CALCULATION_ENGINES.md`, `docs/SCORE_TAXONOMY.md`, `docs/ROADMAP.md`, `docs/DECISION_LOG.md`.

---

## Domain 3 — projections chart disclaimer + gifting tooltips (2026-06-01)

**Decision:** Close remaining Domain 3 explainer surfaces. **`/projections`** chart tab: **Base case** legend on deterministic bar chart + **`DISCLAIMER_STRINGS.projectionsChart`** below chart (`ProjectionTabs` + `_projections-client.tsx`). **`GiftingDashboard`**: **`annual_exclusion`** on Annual Exclusion Used label; **`superfunding`** on 529 superfunding helper line in annual exclusion card.

**Files:** `lib/compliance/language-policy.ts`, `app/(dashboard)/projections/_components/ProjectionTabs.tsx`, `app/(dashboard)/projections/_projections-client.tsx`, `components/GiftingDashboard.tsx`.

**Domain 3 tax exposure callouts:** complete (dashboard hero · `/estate-tax` · **`StateTaxPanel`** · projections chart · gifting).

---

## Domain 3 — tax term explainers wired on StateTaxPanel (2026-06-01)

**Decision:** Wire **`InfoTooltip`** on advisor **`StateTaxPanel`** — **`No portability`** badge and **Exemption** table header only. Copy: `state_no_portability`, `state_exemption` with **`taxTermCtx`** from `currentYearRow.exemption`, `unifiedStateCode`, `isMFJ`.

**Skipped:** `ny_cliff`, `inflation_indexed`, `tracks_federal` badges — no keys in **`taxTermExplainers.ts`**.

**Unchanged:** `getPortabilityGapLabel()` amber callout, NY cliff warning, violet horizon box, table data cells.

**Files:** `components/advisor/StateTaxPanel.tsx`.

**Next:** Chart disclaimers (`/projections`) · gifting tooltips (`GiftingDashboard`).

---

## Domain 3 — tax term explainers wired on /estate-tax (2026-06-01)

**Decision:** Wire **`InfoTooltip`** on consumer **`/estate-tax`** summary card labels and waterfall row labels. Copy from **`taxTermExplainer`**: `gross_estate`, `taxable_estate`, `federal_exemption` (summary cards); `state_exemption`, `state_no_portability` (waterfall) with full **`TaxTermContext`** (`stateCode`, `stateExemption`, `isMFJ`).

**Pattern:** **`SummaryCard`** extended with optional **`labelTooltip?: ReactNode`** — label stays `string`; tooltip is sibling inside label row (not wrapped in prop). **`taxTermCtx`** built once after `stateExemption` derivation from `primaryStateBrackets[0]?.exemption_amount`.

**Unchanged:** Blue MFJ bypass callout, green no-federal block, dollar value cells, section headers.

**Files:** `app/(dashboard)/estate-tax/_estate-tax-client.tsx`.

**Next:** Advisor **`StateTaxPanel`** — badge pills + Exemption column header only.

---

## Domain 3 — tax term explainers wired on dashboard hero tiles (2026-06-01)

**Decision:** Wire **`InfoTooltip`** on **`EstateSummaryHeroAndMetrics`** four-tile grid labels only (not **`EstateTaxSnapshotPanel`** sidebar). Copy from **`lib/estate/taxTermExplainers.ts`**: `federal_headroom`, `federal_exemption`, `state_exemption` with `{ stateCode: statePrimary }` only.

**Deferred:** `stateExemption` / `isMFJ` context at hero — props not available on **`EstateSummaryHeroAndMetrics`** without new dashboard-body wiring; generic/state-name-only fallback acceptable for v1.

**Files:** `lib/estate/taxTermExplainers.ts`, `components/dashboard/EstateCalloutCard.tsx` (hero path only).

**Next:** `/estate-tax` summary cards + waterfall row labels (full context available client-side).

---

## Estate readiness subcategory explainers — InfoTooltip (2026-06-01)

**Decision:** Add inline `?` explainers on each of the six **`EstateReadinessCard`** subcategory labels. Copy lives in **`SCORE_CATEGORY_EXPLAINERS`** keyed by stable **`ScoreCategoryKey`** (`documents`, `incapacity`, `beneficiaries`, `titling`, `domicile`, `estate_tax`) — not on computed **`HealthScoreComponent`** rows. UI uses custom **`InfoTooltip`** (`components/ui/InfoTooltip.tsx`); no Radix/shadcn dependency.

**Files:** `lib/estate-health-score.ts` (`SCORE_CATEGORY_EXPLAINERS`, `scoreCategoryExplainer`), `components/ui/InfoTooltip.tsx`, `components/dashboard/EstateReadinessCard.tsx`.

**Copy alignment:** Documents score = will + trust only (POA/HCD under Incapacity). Titling = documented coverage + trust bonus (not joint-vs-single). Estate tax = base case on file + estate-size tiers (not vague “reviewed and documented”).

**Visibility:** Card renders only when **`estateHealthScore`** is present and user passes onramp gate (`shouldShowOnramp` false — score ≥ 60, wizard complete, household data). Voels consumer (score 56) currently sees onramp only, not the six tooltips.

**Smoke:** e2e consumer on localhost — six icons; all popovers match **`SCORE_CATEGORY_EXPLAINERS`**; adjusted copy checks pass.

---

## PDF page 3 metric cards — engine B (2026-06-01)

**Decision:** PDF tax-analysis page 3 metric cards (Federal Estate Tax, State Estate Tax, Net to Heirs) compute at render time via engine B — not `latestOutput` projection rows (engine C).

**Files:** `lib/export/generatePDFReport.ts` only (`page3FederalTax`, `page3StateTax` via `calculateStateEstateTax` + `resolveActiveStateTax` with `data.hasBypassTrust`; `page3NetToHeirs`).

**Rationale:** Federal card had used `data.federalTax` from `estate_tax_federal` on the last projection row; state card always showed `withoutBypassTrust` even when CST was in place. Cover/narrative already used engine B; page 3 cards were split-brain.

**Deferred:** `lib/advisor/exportMappers.ts` — `fedTaxExport` / `stTaxExport` still from `latestOutput` for Excel and export panel (separate sprint).

**Smoke (Voels):** Federal $0 (below OBBBA exemption); state ~$943K when `hasBypassTrust` false; net = gross − state.

---

## Estate MC unified to engine B for state tax (2026-06-01)

**Decision:** Estate Monte Carlo state tax uses engine B (`calculateStateEstateTax` + `resolveActiveStateTax`) on each simulated estate value instead of flat `stateEstateTaxRate` derived from today’s display tax ÷ gross estate.

**Files:** `lib/calculations/estate-monte-carlo.ts`, `supabase/functions/estate-monte-carlo/index.ts`, `components/advisor/MonteCarloPanel.tsx`, `app/advisor/clients/[clientId]/_tabs/StrategyTab.tsx` (+ `stateBrackets` hoisted via `_client-view-shell.tsx` / `page.tsx`).

**Rationale:** Flat rate produced incorrect tax on progressive WA brackets and ignored bypass-trust (CST) distinction. State-tax sensitivity row removed (bracket sweep meaningless); scenario comparison deferred to MC sprint.

**Follow-up:** `MonteCarloPanel` footnote + **Zero-Tax Paths** label (`4bdda56`); edge redeploy; `scripts/verify-estate-mc-voels-smoke.ts`. Prior cached runs with omitted state tax inflated `success_rate` (~45% federal-only ghost on Voels).

**Federal follow-up (2026-06-06):** Federal portion of **`calcEstateTax`** now uses progressive brackets (lib + edge); **`federalBrackets`** on MC POST; async runner uses **`householdFederalExemption`**. Redeploy edge after merge.

---

## PDF beneficiary summary page (2026-06-01)

**Problem:** Export estate report had no beneficiary designation summary; `asset_beneficiaries` was already fetched for meeting-prep (`inc.beneficiaries = true`) but dropped before **`buildAdvisorExportPayloads`**.

**Decision:**
- **`lib/advisor/beneficiaryHelpers.ts`** — **`buildBeneficiaryAccountGroups()`** groups raw `asset_beneficiaries` by linked account (asset / RE / insurance / business), primary + contingent, status badges (`complete` / `missing_primary` / `missing_contingent`).
- **`PDFReportData.beneficiaryData`** optional; **`determinePDFPages`** inserts **`beneficiary_summary`** after **`estate_snapshot`** only when `groups.length > 0`.
- Export wiring passes **raw** `beneficiariesResult.data` (not `mapAdvisorClientDatasets` UI rows). Estate tab keeps its **separate** local grouping function — not replaced (different API/shape).

**No new DB fetch.** Legacy **`beneficiaries`** table remains seed-demo only.

---

## PDF strategy page — dedupe gap recommendations (2026-06-01)

**Problem:** Page 4 “Strategies worth discussing” listed raw `data.actionItems` — duplicate trust alerts (HIGH + MEDIUM) while action-items page used `dedupeActionItems(enrichActionItems(...))`.

**Decision:** Strategy gap list uses **`enrichedActions`** (same deduped pipeline as action-items page).

---

## PDF page 2 — inline SVG chart for print (2026-06-01)

**Problem:** Chart.js `<canvas>` requires JS before print/PDF capture — chart was blank in print preview and saved PDFs.

**Decision:** Replace canvas + Chart.js CDN with **`buildEstateSVGChart()`** — static inline SVG in page 2 HTML (`viewBox="0 0 600 180"`). Same data: `projectionChartRows`, `detectTaxCliff()`. No JS, no CDN. Renders in print, PDF viewers, and email attachments.

---

## PDF page 2 — estate snapshot chart (2026-06-01)

**Problem:** Page 2 was a static asset table + health bars only; year-by-year projection data lived in Excel, not in a visual estate-growth story for advisors.

**Decision:**
- **`PDFReportData.projectionChartRows`** — derived from **`params.scenarioOutputs`** (`outputs_s1_first`) in `exportMappers.ts`; no new DB fetch.
- **`generatePDFReport.ts`** page 2: inline SVG estate growth chart (replaced Chart.js); `detectTaxCliff()`; amber cliff callout or green no-exposure callout.
- Asset breakdown + health components in **two-column** `snapshot-grid` below chart.
- Empty state when no base case rows. Excel export unchanged (full year table).

---

## Print brief at-death tax — horizon `totalTaxLiability` (2026-06-01)

**Problem:** After stat-card fix, **Est. tax exposure** showed **$0** for MFJ households. Brief read `estate_tax_federal + estate_tax_state` on the `findAtDeathRow` projection row; `estate-tax-projection` stores **$0** on first-death rows (marital deduction). Survivor death year often maps to that row.

**Decision:** `loadAdvisorExportWiringForClient` returns **`meetingPrepAtDeath`** (`grossEstate`, `totalTaxLiability`, `headerTitle`) from `advisorHorizons.atDeath` — same **`computeColumnTaxes`** path as Strategy tab / Meeting Prep modal. `renderMeetingBriefHtml` uses it for tax cards; projection-row tax only in **`else`** fallback.

---

## Client-safe `normalizePdfFilingStatus` — build fix (2026-06-01)

**Problem:** `MeetingPrepTab` (`'use client'`) imported `normalizePdfFilingStatus` from `fetchNarrativePdfFields.ts`, which imports `lib/supabase/server` → production build failed (`next/headers` in client bundle).

**Decision:** Pure helper moved to **`lib/export/pdfFilingStatus.ts`** (no server imports). Client components import from there; `fetchNarrativePdfFields.ts` re-exports for server-only callers.

---

## Print brief stat cards — at-death row + tax fields (2026-06-01)

**Problem:** `renderMeetingBriefHtml()` used `outputs[length - 1]` (end-of-plan estate) with hardcoded subtitle **"At retirement"** and read `estate_tax_total` (undefined on projection rows). Advisors saw ~$92M labeled as retirement when the modal/horizons use **at-death** via `findAtDeathRow`.

**Decision:**
- Household fetch (before `Promise.all`) includes `has_spouse`, birth years, longevity ages for `findAtDeathRow`.
- At-death gross/tax/net from death-year row; tax = `estate_tax_federal + estate_tax_state`.
- Alert enrichment uses **current** estate (first projection row or composition), not at-death.
- One-page layout stays **3 cards:** health score · est. tax exposure (at death) · projected estate (at death, dynamic label `At death (age X)`).
- Template marker **`sprint-four-surface-polish-v2`**.

**Scope:** `app/api/advisor/meeting-prep-pdf/[clientId]/route.ts` — modal and export PDF unchanged. **Tax (follow-up):** at-death tax from `meetingPrepAtDeath.totalTaxLiability` via export wiring, not projection row fields.

---

## Four-surface advisor polish — shared brief helpers (2026-06-01)

**Problem:** Export PDF, meeting brief print, meeting prep tab, and notes were polished independently — alert enrichment duplicated, PDF page 2 empty (`assetBreakdown` / `healthComponents`), meeting brief print still hardcoded "My Wealth Maps", modal vs print were different pipelines.

**Decision:**
- **`lib/advisor/advisorBriefHelpers.ts`** — single source: `formatAlertsForBrief()`, `deriveAgenda()`, `scoreTrendLabel()`, `engagementLabel()`, `resolveAdvisorBranding()`, `buildPdfAssetBreakdown()`, `mapHealthComponentsForPdf()`.
- **Export PDF:** `lib/advisor/exportMappers.ts` wires asset breakdown (rows + composition fallback), health components from `component_scores`, always-on strategies page empty state, branding + `meetingDate` on cover.
- **Meeting brief print:** `GET …/meeting-prep-pdf/[clientId]?type=brief` → `renderMeetingBriefHtml()` uses shared helpers + `loadAdvisorExportWiringForClient` enrichment context; template marker `sprint-four-surface-polish-v2` (v1: agenda/enrichment; v2: at-death stat cards); `Cache-Control: no-store`.
- **Meeting prep tab/modal:** enriched alerts in seed + modal; **Open print brief** opens server route (not `window.print()` on React layout).
- **Notes:** `advisor_notes.note_type` migration (`prep` / `meeting_record` / `follow_up`); API GET/POST; Notes tab selector + badges; brief prefers prep note.

**Three brief surfaces (do not conflate):** Header **Meeting brief** and **Open print brief** → server HTML; **Prepare for Meeting** → React modal preview (Tailwind, not Georgia print layout).

---

**Problem:** Three state estate tax implementations coexisted: **A** — hardcoded flat rates in `narrativeEngine.ts`; **B** — `calculateStateEstateTax` (progressive brackets, portability gap, NY cliff); **C** — deprecated `computeStateEstateTaxFromBrackets` (projection death rows only). PDF cover used A while horizons used B; page 3 showed projection row amounts from C. CST `strategy_type` mismatch (`credit_shelter_trust` reads vs `cst` writes) would have prevented `hasBypassTrust` from ever activating.

**Decision:**
- **Delete engine A.** All display surfaces import **`lib/calculations/stateEstateTax.ts`**.
- **`lib/constants/strategyTypes.ts`** — single source for CST DB strings; `deriveHasBypassTrustFromLineItems()` / `deriveHasBypassTrustFromConfigs()`.
- **`hasBypassTrust`** threaded into `computeColumnTaxes` / `buildStrategyHorizons` from **callers** (consumer = accepted line items only; advisor projected = any active CST recommendation).
- **Governance:** [docs/CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) + regression greps in [NEXT_SESSION.md](./NEXT_SESSION.md) standing rules.
- **Engine C unchanged** this sprint — projection death-year pipeline is a separate follow-up.

**PDF:** Page 3 shows with/without bypass trust scenario table when `cstBenefit > 0`; `STATE_PORTABILITY_NOTES` for WA/OR/MN/MA/IL/NY.

---

## PDF tax page exemption aligned with narrative engine (2026-05-30)

**Problem:** PDF page 3 (Tax Analysis) showed **$15M** federal exemption for MFJ households while the cover narrative correctly referenced **~$28M**. Root cause: `exportMappers.ts` read `assumption_snapshot.estate_exemption_individual` (per-person OBBBA $15M) without applying filing status.

**Decision:** `PDFReportData.federalExemption` now uses **`currentFederalExemption(normalizePdfFilingStatus(...))`** — same source as cover copy in `narrativeEngine.ts` ($27.98M MFJ / $13.99M single). Projection tax **amounts** on page 3 still come from scenario `latestOutput`; only the exemption **display** label is unified.

**Duplicate action items:** `dedupeActionItems()` sorts by enrichment (`dollarImpact` + `nextStep`), then dedupes by **`actionItemDedupeKey()`** — filler words stripped (`without`, `a`, etc.) + 20-char alphanumeric stem so near-duplicate titles collide (e.g. `"Large estate without a trust"` and `"Large Estate Without Trust"` → `largeestatetrust`). Enriched row wins. PDF: **Documents & trust structure**, not raw **Additional recommendations**.

**Cover worst-case phrasing:** When MFJ + no bypass trust + portability gap, executive summary appends **"without a bypass trust"** to state tax exposure (worst-case number is intentional until CST confirmed).

---

## PDF action-item dedupe — filler-normalized keys (2026-05-31)

**Problem:** `0f9305e` kept enriched rows by score but **`actionItemDedupeKey`** treated `"Large estate without a trust"` and `"Large Estate Without Trust"` as different keys (`…withoutatrust` vs `…withouttrust`) after alphanumeric strip — both alerts could appear in PDF.

**Decision:** Sort enriched items first; dedupe with **`actionItemDedupeKey`** that strips common filler words before alphanumeric normalize + 20-char stem. Both trust titles → **`largeestatetrust`**; enriched row (impact + next step) wins.

**Files:** `lib/export/narrativeEngine.ts`

---

## household_alerts trust title — sentence case (2026-05-31)

**Decision:** Canonical title **`Large estate without a trust`** everywhere — matches `evaluateAlerts` sentence case. Conflict detector `conflictTitle(large_estate_no_trust)` updated; PDF **`enrichActionItems`** normalizes title on trust enrichment so legacy DB rows with Title Case still render correctly.

**Files:** `lib/conflict-detector.ts`, `lib/export/narrativeEngine.ts`

---

## PDF export paths unified — narrative engine on all estate reports (2026-05-30)

**Problem:** Narrative engine shipped on `ExportPanel` only. Header **"Prepare for meeting"** and in-tab **"Prepare for Meeting"** modal used legacy one-page brief HTML — advisors saw old output.

**Decision:** One shared server loader (`lib/advisor/loadAdvisorExportWiring.ts`) builds `exportPdfData` for both the client page and print API. **`GET /api/advisor/meeting-prep-pdf/[clientId]?type=report`** returns full narrative PDF via `generatePDFHTML`. **`?type=brief`** keeps the original one-page meeting brief.

**UI:** Client header → **Export estate report** (narrative) + **Meeting brief** (legacy). Meeting Prep tab → **Export estate report (PDF)** link + **Export PDF Report** in `ExportPanel` (same engine).

---

## PDF narrative engine — rule-based report enrichment (2026-05-30)

**Decision:** Add a deterministic, rule-based narrative layer to advisor PDF export — no new tables, no external APIs.

**Engine (`lib/export/narrativeEngine.ts`):** Executive summary (tiered by estate size), tax callout (`clear` / `sunset_risk` / `exposed`), health score trend, enriched action items (dollar impact + next step + owner), gifting capacity bar, theme grouping.

**Data wiring (`lib/export/fetchNarrativePdfFields.ts`):** Parallel fetch includes **`federal_estate_tax_brackets`**. **`sunsetTaxEstimate`** = **`computeFederalExportTax({ lawScenario: 'no_exemption' })`**. **`ilitTaxSavingsEstimate`** = **`federalTaxSavedByReduction()`** on non-ILIT death benefit (fallback top rate when brackets empty). **`filingStatus`** normalized from `married_filing_jointly` → `mfj` before all narrative branches.

**Action items:** `household_alerts` selects **`title` + `description`**; fetch maps to **`title`** + **`message`** (not `body` at source). PDF uses enriched **`ActionItem`** from `@/lib/export-wiring`.

**Export path:** `loadAdvisorExportWiringForClient()` → `buildAdvisorExportPayloads` → `generatePDFHTML`. Used by Meeting Prep tab `ExportPanel`, header/API **`?type=report`**, and `page.tsx` when `exportWiring` is on.

**Meeting Prep:** Top 3 open alerts surfaced above Export & Reports (same `actionItems` query as PDF).

**Smoke note:** `sunset_risk` callout requires **`sunsetTaxEstimate > $100K`** — MFJ gross estate **> ~$14.25M**. At exactly $9.3M MFJ, formula yields $0 federal sunset exposure → **`clear`** (state tax may still appear in detail). Verify wiring by confirming `sunsetTaxEstimate` is populated on cover metrics, not by assuming $9.3M always triggers sunset branch.

---

## Advisor Retirement tab — wire projection data + polish (2026-05-30)

**Decision:** Polish advisor **Retirement** tab by wiring three existing data sources server-side in `page.tsx` — no new migrations.

**Data wiring (`page.tsx`, `tab === 'retirement'`):**
- **`scenarioOutputs`** — `YearRow[]` from `projection_scenarios.outputs_s1_first` / `outputs` (loaders now enable `scenario: true` on retirement tab).
- **`advisorSsData`** — `loadSocialSecurityData(supabase, clientId)` (owner id, same as consumer `/social-security`).
- **`advisorRothData`** — `runRothAnalysis()` from `@/lib/calculations/roth-analysis` with federal brackets fetch + `resolveDeduction`; uses **`optimalConversionWindow`**, **`totalLifetimeTaxSavings`**, **`totalConversions`**.

**UI (`RetirementTab.tsx`):** Readiness hero (funds outlast + net worth at retirement from **`net_worth`** / **`income_total`** / **`expenses_total`**); asset mix cards; SS coordination with **`person2.survivorBenefit`** + breakeven from **`person1.scenarios`**; RMD timeline; Roth block (analysis or heuristic); withdrawal sequencing. Kept RMD planning banner + Planning Assumptions.

**Verify:** Alan household — readiness hero · retirement-year snapshot · survivor benefit · Roth window when pre-RMD.

---

## Advisor Estate tab — visual polish (2026-05-30)

**Decision:** Polish advisor **Estate** tab (`EstateTab.tsx` only) using existing props — no new fetches.

**Liquidity hero:** Shown when coverage ratio **&lt; 1.0x**. Liquid total from **`composition.inside_liquid`**, fallback sum of assets with **`liquidity === 'liquid'`**. Tax liability = horizon/composition federal + state estimates.

**Layout:** Two-column grid — left: **`EstateCompositionCard`** (`showMetrics={false}`) + IRS waterfall (replaces redundant Gross/Net/Admin/Taxable pills); right: conflict cards (`description` + `recommended_action`).

**Documents:** Hero alert when critical docs (`will`, `dpoa`, `medical_poa`) not confirmed via **`docMap[type].exists`**.

**Beneficiaries:** Group by linked asset (`asset_id` on raw records when present; single-asset type match fallback); show account name, value, owner, missing-contingent flag.

**Estate flow:** Summary tiles (Financial / RE / Business / Retirement) always visible; full **`EstateFlowDiagram`** behind toggle.

**Accounts:** Six consolidated groups (IRA, 401(k), brokerage, Roth, bank, other) from **`assetAccountType()`** values.

**Unchanged:** Death-sequence toggle, admin expense override, DLOC/DLOM, RE table, insurance, **`BeneficiaryGrantPanel`**.

---

## Advisor strategy tab — visual hierarchy polish (2026-05-30)

**Decision:** Polish advisor **Strategy** tab presentation without new data fetches: alert hierarchy, severity-colored situation cards, illustrative savings on opportunity rows, Monte Carlo empty state, hide composite waterfall when no recommendations.

**Alerts (`StrategyAlertBanners`):** One **primary** red banner for liquidity coverage **&lt; 1.0x**; compact **secondary** amber banners for unused exemption (&lt; 50%) and tight GRAT §7520 margin.

**Situation (`AdvisoryMetricCard` + `SituationMetricsGrid`):** Optional **`severity`** (default `neutral`) drives card/value/status colors; **`getMetricStatusLabel()`** adds short status lines (“Critical — at risk”, “Headroom available”, etc.).

**Opportunities:** **`estimateStrategySavings()`** in `lib/advisor/estimateStrategySavings.ts` — keys match catalog ids (`cst`, `ilit`, `annual_gifting`, `slat`, `grat`, `liquidity`; aliases `bypass_trust` / `credit_shelter_trust` → `cst`). Savings context built in **`StrategyTabContent`** from existing metrics props.

**Composite (`CompositeOverlay`):** Waterfall + summary hidden in **From Recommendations** mode when **`activeRecommendedItems.length === 0`** (avoids “All 0 strategies…” copy).

**Monte Carlo (`MonteCarloPanel`):** Dashed empty state when **`!result && !loading`**, using existing **`simulationCount`**.

**Verify:** Strategy tab — liquidity shortfall primary banner; CST/ILIT rows show emerald savings line; composite empty until a recommendation is sent.

---

## Tax Horizons & Strategy — consumer page polish (2026-05-30)

**Decision:** Polish **`/my-estate-strategy`** layout: readiness as header pill; bypass-trust impact bar; remove embedded completeness/topics; grouped asset summary in estate flow; hide empty what-if tab.

**Readiness:** Remove **`MyEstateStrategyHealthScore`** block; compact pill in page header uses existing **`healthScore`** prop.

**Bypass bar:** **`parseBypassTrustSavings()`** shared with dashboard (`lib/estate/parseBypassTrustSavings.ts`); shown between horizon cards and table when savings &gt; 0.

**Removed from page:** Embedded **`EstatePlanningDashboard`** (Estate Plan Completeness + Common Planning Topics — live on dashboard / estate-tax).

**What-if tab:** Hidden when **`projectedCount === 0`**.

**Estate flow assets:** **`ConsumerEstateFlowView`** — grouped summary tiles + “Show all accounts” expand (Financial / Real estate / Business / Retirement / Insurance / Other).

**Files:** `_my-estate-strategy-client.tsx`, `page.tsx`, `ConsumerEstateFlowView.tsx`

**Commit:** `56762ad`

---

## Roth conversion — methodology note (2026-05-30)

**Decision:** Expand **“How this calculation works”** on **`/roth`** to document projection source, RMD-era target rate, eligibility (both spouses ≥ 60), bracket headroom, combined IRA/401(k) pool, SS simplification, and WhatIf slider vs table engine.

**Commit:** `6cb942a`

---

## Roth conversion — bracket headroom + display context (2026-05-30)

**Decision:** Fix **`runRothAnalysis`** gap-year conversion amounts and **`/roth`** rate display after UI polish regressions.

**Engine (`roth-analysis.ts`):** Headroom must use **`peakRmdFederalRate`** (not combined federal+state) with legacy **`>`** bracket walk. When RMD-era federal marginal is **24%+**, fill through the **22% bracket ceiling** (just under 24% threshold). Previously `>=` against combined rate stopped one bracket early (~$43K–$63K/yr instead of ~$150K–$170K/yr for typical MFJ gap).

**UI (`_roth-client.tsx`):** **`pickRothConversionDisplayContext()`** — insight + **`WhatIfPanel`** use first **conversion-window row** marginal (retirement gap ~10–12%), not **`rows[0]`** (often still working-year rate).

**Tests:** `tests/unit/roth-analysis.spec.ts` (`import-unit` project).

**Verify:** Alan/Cathi pre-RMD gap — emerald rows with conversions to top of 22% bracket; insight shows low current % vs ~24% projected RMD.

**Commit:** `cae89fc`

---

## Three-state dashboard progression (2026-05-30)

**Decision:** Three display states on **`/dashboard`**, driven by data completeness:

| State | Condition | Hero |
|-------|-----------|------|
| 1 | `foundationScore < 60` OR wizard incomplete OR no household data | **`DashboardOnramp`** (early return in `page.tsx`) |
| 2 | Past onramp AND both taxes $0 AND no estate-plan signals | Net worth hero + financial metrics + amber estate-unlock prompt |
| 3 | Past onramp AND (`estimatedTaxState/Federal > 0` OR `hasEstatePlanData`) | Tax exposure hero + consolidated alerts + readiness strip (Alan layout unchanged) |

**`hasEstatePlanData`:** beneficiary conflicts, any health-score component score &gt; 0, or execution checklist rows.

**Files:** `determinePlanStage.ts` (`getDashboardState`), `dashboard/_dashboard-body.tsx`, `_dashboard-client.tsx`, `DashboardIntroSection.tsx`, `FinancialSummarySection.tsx`

**Verify:** State 2 user — net worth hero, no tax hero, no readiness strip. Alan — State 3 unchanged. **Commit:** `b71af63`

---

## Estate flow consumer view — horizon display pipeline (2026-05-31)

**Decision:** Consumer “What happens when I die?” must use **`horizonOverride`** sourced from **`buildStrategyHorizons`** (via **`selectedHorizons`** on **`/my-estate-strategy`**) — same single source of truth as the tax horizons table. Do **not** rely on **`generateEstateFlow`** internal projection lookup alone for display totals. Match advisor **`EstateFlowDiagram`** pattern: map `federalTaxEstimate` / `stateTax` → override; **`netToHeirs = gross − federal − state`**.

**UX (supporting):** Stale-fetch **`cancelled`** guard; tabs visible during load; prominent **`gross_estate`** above asset tiles; horizon caption from local **`horizon`** state (not **`graph.horizonLabel`**). Asset category tiles stay today's holdings — only aggregate estate total changes per tab.

**Pre-flight note (engine pass):** `horizon` was already in `useEffect` deps; projection data in `outputs_s1_first` was correct — bug was display pipeline, not engine math.

**Files:** `components/estate-flow/ConsumerEstateFlowView.tsx`, `app/(dashboard)/my-estate-strategy/_my-estate-strategy-client.tsx` (engine pass: `lib/estate-flow/generateEstateFlow.ts`)

---

## Estate flow horizon tabs — engine lookup (2026-05-31)

**Decision:** Timeframe tabs (Today / In 10 Years / In 20 Years / At Longevity) must update the **owner estate total** and **summary trust/probate** from projection rows. **Do not** project individual account balances in asset category tiles — structure is today's holdings; only aggregate estate total changes. Use `findClosestOutputRow()` for 10y/20y (nearest year, not `lastOutput` fallback). Use `findAtDeathRow()` for At Longevity (aligned with `horizonSnapshots.ts`).

**Files:** `lib/estate-flow/generateEstateFlow.ts`

---

## Score-driven consumer dashboard — Sprint B (2026-05-29)

**Decision:** Replace **`ConsolidatedAlertPanel`** (conflict-derived ranked alert list) with a score-first State 3 layout: adaptive greeting by score band, **`EstateReadinessCard`** (benchmark bar vs avg American / avg MWM user, six component pills, optional trend delta, disclaimer), and a single **`PriorityAlertCard`** sourced from open **`household_alerts`** rows (not recomputed from conflicts). Remaining alerts collapse behind "+ N other items". Presentation only — no changes to score engine, alert evaluation, or DB schema.

**Benchmark constants:** `NAT_AVG_PCT = 28`, `MWM_AVG_PCT = 63` in `lib/dashboard/readinessBenchmarks.ts` until platform aggregates exist.

**Trend delta caveat:** `priorScore` queries second-most-recent `estate_health_scores` row; table upserts one row per household today, so delta often hidden until score history is stored.

**Files:** `dashboard/_dashboard-body.tsx`, `_dashboard-client.tsx`, `components/dashboard/EstateReadinessCard.tsx`, `components/dashboard/PriorityAlertCard.tsx`, `lib/dashboard/scoreDisplayHelpers.ts`

---

## Dashboard score display — single surface (2026-05-29, Sprint B follow-up)

**Decision:** **`EstateReadinessCard`** is the sole consumer dashboard score UI. Remove **`EstateHealthScoreBlock`** and the six-bar component grid from collapsible **`EstateSummarySection`** (keep composition card + titling conflict badges). Show greeting + score card + priority alert whenever **`estateHealthScore`** is present — do not gate on **`sectionVisible(3)`** / **`planStage.stage`**. Checklist + tax snapshot grid and **`EstateSummarySection`** collapsible remain stage-gated.

**Reasoning:** Duplicate score blocks caused screenshots to show the old layout in the Estate Summary accordion while the new Sprint B cards were hidden behind plan-stage gating.

**Files:** `_dashboard-client.tsx`, `EstateSummarySection.tsx`

---

## Estate Summary collapsible — composition only (2026-05-29)

**Decision:** Remove titling & beneficiary conflict badges from dashboard **`EstateSummarySection`**. Titling gaps are already surfaced via **`PriorityAlertCard`** / open **`household_alerts`** in the main State 3 flow; duplicating them in the collapsible Estate Summary added noise.

**Files:** `EstateSummarySection.tsx`, `_dashboard-client.tsx`

---

## Dashboard — remove asset allocation card from Financial Summary (2026-05-30)

**Decision:** Remove **`AssetAllocationSummary`** from the **`FinancialSummarySection`** collapsible on **`/dashboard`**. Full allocation editing, benchmarks, and portfolio breakdown remain on **`/allocation`** via **`loadAssetAllocationData`**. **`buildAllocationContext`** stays in **`lib/dashboard/mappers.ts`** for reuse; dashboard no longer builds or passes allocation context on load.

**Reasoning:** Duplicate surface — users with tier 2+ access use the dedicated Asset Allocation route; the dashboard card added scroll without unique actions.

**Files:** `FinancialSummarySection.tsx`, `_dashboard-client.tsx`, `dashboard/_dashboard-body.tsx`

**Verify:** `/dashboard` Financial Summary shows net worth, by-source bars, income/expense/savings/debt cards only — no allocation donut or target mix.

---

## Consolidated dashboard alert panel (2026-05-30)

**Decision:** Replace scattered dashboard alerts (intro pills, bypass blue card, succession banner, checklist red flags) with one **`ConsolidatedAlertPanel`**. Alert detection uses **`conflict_type`**, **`estateHealthScore.components`** keys (`documents`, `incapacity`, `beneficiaries`), and **`successionGap`** — not fragile description substring matching alone. Compliant copy defers to advisors/attorneys; disclaimer renders **after** all alert rows.

**Files:** `_dashboard-client.tsx`, `DashboardIntroSection.tsx`, `EstateExecutionChecklist.tsx` (`deemphasizeFlagged`)

---

**Decision:** When **`projectedRmdPct <= currentRatePct`**, **`WhatIfPanel`** must not show stuck **$0** / **"—"** cells. Use signed **`lifetimeNetBenefit`** (label **Lifetime extra cost** when negative), **"Delay is better"** instead of break-even dash, and slider-reactive **`iraBalanceAtRmd`** via simplified conversion impact. Title: **"(delay is optimal)"**. Local **`fmtPanel`** inside **`WhatIfPanel`** only — top-level **`fmt()`** unchanged.

**Reasoning:** Slider was never broken; **`rateDiff = max(0, …)`** hid the “converting now costs more” message. Alan (24% current vs 22% projected): **$12K** tax at $50K/yr, **−$15K** lifetime extra cost, IRA at RMD drops with slider.

**Files:** `app/(dashboard)/roth/_roth-client.tsx` — **`WhatIfPanel` only**

---

## Estate Tax Snapshot — interactive strategy panel (2026-05-30)

**Decision:** Replace static **`EstateCompositionCard`** on **`/estate-tax`** with interactive composition waterfall + toggleable strategy panel. Asset rows use composition fields (`inside_financial`, `inside_real_estate`, `inside_business_gross`, `inside_insurance`). Strategy panel hidden when both state and federal estimated tax are $0. **`getStrategyDescription`** is module-level (not in component). Entitled path: separate **`getCachedComposition`** + **`strategy_line_items`** fetch in `page.tsx`.

**Files:** `_estate-tax-client.tsx`, `estate-tax/page.tsx`, `sidebar-nav.tsx`

---

## Script A — readiness pill + allocation connections (2026-05-30)

**Decision:** Surface **`estateHealthScore.score`** as compact pill on the same flex row as conflict pills in **`DashboardIntroSection`**. Keep full **`EstateHealthScoreBlock`** in **`EstateSummarySection`**. On **`/allocation`**, downstream note to Projections + Monte Carlo after save.

**Files:** `DashboardIntroSection.tsx`, `_dashboard-client.tsx`, `allocation/_allocation-client.tsx`

---

## Dashboard — single conflict alert location (2026-05-30)

**Decision:** Remove the **middle dismissible conflict banner** from `_dashboard-client.tsx` (full-width red/amber block with description + “See details ↓” between checklist grid and persona alerts). Keep **one** above-the-fold surface: severity pill chips in **`DashboardIntroSection`** (🚨 critical / ⚠️ warnings + “See details →”). Titling badges in **`EstateSummarySection`** collapsible unchanged.

**Reasoning:** Duplicate critical/warning messaging in intro pills and mid-page banner added noise without new information.

**Files:** `_dashboard-client.tsx`

**Verify:** Household with conflicts — pills under greeting only; no second banner mid-page.

---

## Dashboard cleanup — bypass trust alert (2026-05-30)

**Decision:** Remove **Common Planning Topics** from dashboard estate summary. **Titling & Beneficiary Conflicts** shows badge pills + link to `/titling` only — **`criticalCount` / `warningCount`** from **`conflictReport`** preserved. Surface **bypass trust** savings as blue alert in **`EstateSummaryHeroAndMetrics.afterMetrics`** (after four metric tiles, before checklist/tax snapshot grid). Savings via **`parseBypassTrustSavings`**: primary match `by $…` in `bypass_trust` RPC reason; fallback last `$` in reason; then `(grossEstate − stateExemption) × 0.10`.

**Files:** `_dashboard-client.tsx`, `EstateSummarySection.tsx`, `EstateCalloutCard.tsx`

**Verify:** Alan — reason parses **$645,463**; alert sits between metric tiles and two-column grid.

---

## RMD Calculator page polish (2026-05-30)

**Decision:** Polish `/rmd` client UI only (`_rmd-client.tsx`): hero lifetime/peak stats above status cards; status cards with years-away/active badges; standardized accounts grid with per-person totals; tax impact callout; decade navigator wired to existing **`periodOffset`** pagination; inflection row highlights (P1 start blue, P2 start emerald, peak amber) + legend. Full projection array is **`rows`** (sliced to `visibleRows`); peak/first-RMD years computed from `rows`, not the visible page.

**Reasoning:** No marginal rate in RMD page props — tax callout uses **28% blended** estimate. Account grids use **`grid-cols-1 sm:grid-cols-3`** for long account names on mobile. Decade buttons call same **`goToPage(i)`** as Prev/Next.

**Files:** `app/(dashboard)/rmd/_rmd-client.tsx`

**Verify:** Decade navigator active state `i === periodOffset`; clicking segment updates visible rows.

---

## Social Security page polish — SVG cumulative chart (2026-05-30)

**Decision:** Polish `/social-security` client UI only (`_ss-client.tsx`): hero elected cards, insight card (replaces recommendation paragraph), cumulative **SVG** line chart (3 scenarios), claiming tables with relative bar column. Chart uses existing `cumulativeByAge: { age, cumulative }[]` from `loadSocialSecurityData` — calendar-age lookup, not `cumulative_by_year` index padding. Breakeven age computed by comparing elected vs FRA cumulative at matching ages. Spousal & Survivor Strategy section below tables unchanged.

**Reasoning:** No Chart.js in project; `cumulativeByAge` already aligns scenarios on calendar age (age-62 line highest early, FRA crosses later, elected crosses FRA when delay pays off). Insight survivor stat reads `person2.survivorBenefit` (not a separate spousal object).

**Files:** `app/(dashboard)/social-security/_ss-client.tsx`

**Verify:** Alan household — survivor $4,888/mo; elected vs FRA breakeven age 84 at 2.5% COLA / longevity 90.

---

## Dashboard estate summary consolidate (2026-05-30)

**Decision:** Replace beige `EstateCalloutCard` with **`EstateSummaryHeroAndMetrics`** (full-width tax hero + four metric tiles) and **`EstateTaxSnapshotPanel`** in a **`sm:grid-cols-2`** grid beside **`EstateExecutionChecklist`**. Hero is **red** when `estimatedTaxState > 0`, **amber** when federal-only. Greeting subtitle includes `state_primary`; alert pills stay compact. **`EstateSummarySection`** (readiness, planning gaps, titling) unchanged below Financial/Retirement.

**Files:** `_dashboard-client.tsx`, `EstateCalloutCard.tsx`, `DashboardIntroSection.tsx` · **Commit:** `deb0080`

---

## State exemption on dashboard tax snapshot (2026-05-30)

**Decision:** Fetch `state_estate_tax_rules` (current year + `state_primary`) in **`dashboard/_dashboard-body.tsx`** inside existing **`Promise.all`** — not a sequential query. Add **`no_portability`** column on `state_estate_tax_rules` (WA/MA/OR true); dashboard shows exemption, portability note, state taxable estate (gross − exemption), state tax. WA 2025+ exemption data corrected to **$3M** in migration.

**Migration:** `20260630110000_state_estate_tax_rules_no_portability.sql` · **Commit:** `0686f52` · **Prod:** `supabase db push` before deploy

---

## Onboarding wizard — 6 steps (2026-05-29)

**Decision:** Expand `/onboarding/wizard` from 3 to **6 steps**: assets → income → liabilities → expenses → insurance → advisor invite. Steps 3–5 optional (**Skip for now**); steps 1–2 required (no skip). Insurance saves via **`POST /api/insurance`** (not under `/api/consumer/`). **`guidedOnboardingHref`** — core complete = all five data sections have rows; wizard page redirect uses same gate.

**Files:** `_wizard-client.tsx`, `guidedOnboardingHref.ts`, `guided-onboarding-href.spec.ts` (11 tests)

**Verify:** Fresh user — 6 step indicator; skip on 3–5 only; step 5 hits `/api/insurance`

---

## Onramp guided path — wizard backfill bounce fix (2026-05-29)

**Decision:** (1) **`resolveGuidedOnboardingHref()`** — resume wizard when any of assets/income/liabilities/expenses/insurance missing after backfill; all five present → `/dashboard`. (2) **Wizard page** redirects only when wizard complete **and** all five sections have data. (3) Persona/wizard profile gates pass **`from=`** on required profile redirect.

**Reasoning:** Onramp stays visible when score &lt; 60 even after `onboarding_wizard_completed_at` is set (import backfill). Old logic linked Guide → `/onboarding/wizard` → instant redirect to `/dashboard` — felt broken.

**Files:** `lib/dashboard/guidedOnboardingHref.ts`, `app/(dashboard)/dashboard/page.tsx`, `onboarding/wizard/page.tsx`, `onboarding/persona/page.tsx`, `tests/unit/guided-onboarding-href.spec.ts`

**Verify:** `npx playwright test tests/unit/guided-onboarding-href.spec.ts --project=import-unit` · import then Guide → wizard step 2 (income), not dashboard bounce

---

## Import upload page — formats first, templates above drop zone (2026-05-29)

**Decision:** On `/import` upload step, show **`SupportedFormats`** (broker CSV, multi-sheet Excel, single-table CSV) first, then persona + single-table CSV template download blocks, then the drop zone. **`DashboardOnramp`** import card copy names broker exports, Excel, and CSV explicitly; format hint line under the card.

**Reasoning:** Drop zone first implied users must already have a file. Broker-export users never saw that they can upload Schwab/Fidelity/Vanguard CSV as-is; template seekers scrolled past the drop zone to find downloads.

**Files:** `app/(dashboard)/import/_SupportedFormats.tsx`, `_import-client.tsx`, `components/dashboard/DashboardOnramp.tsx`

**Manual verify:** `/import` — SupportedFormats visible without scroll; templates above drop zone; onramp import card shows format hint.

---

## Onramp guided path and wizard gate exemption (2026-05-30)

**Decision:** (1) `DashboardOnramp` **guided** link uses dynamic `guidedHref`: `/onboarding/persona` when `onboarding_persona` is null, else `/onboarding/wizard` — wizard page redirects to persona if skipped. (2) Add **`/dashboard`** to `wizardGateExemptPrefixes` so `WizardOnboardingGate` does not auto-redirect consumers away from the onramp before they choose Import / Guide / Self.

**Reasoning:** Linking Guide directly to `/onboarding/wizard` bounced users to persona (“What describes you?”) — felt like a loop. Layout client gate also hijacked `/dashboard` to wizard, preventing path choice.

**Manual verify:** Fresh user — Import → `/import`; Guide → persona → wizard; Self → `/assets`.

---

## Dashboard onramp for incomplete users (2026-05-30)

**Decision:** Show a lightweight `/dashboard` onramp (`DashboardOnramp`) instead of the full dashboard body when any gate fails: wizard not complete, `estate_health_scores.score` &lt; 60, or no assets/income.

**Reasoning:** Full dashboard SSR is heavy and shows empty/misleading estate figures for sparse accounts. Onramp offers three entry paths (import, wizard, manual assets) without loading `DashboardBody`.

**Gate:** `lib/dashboard/onrampGate.ts` — `ONRAMP_SCORE_THRESHOLD = 60` (single knob). **E2E:** golden-path seed calls `ensureMinEstateHealthScore(householdId, 60)` so `npm run test:e2e:golden-path` still sees `PlanProgressBar`, not onramp.

**Verify:** `npx tsx scripts/check-golden-path-onramp-gate.ts`

---

## Card component forwards div props for interactive tiles (2026-05-30)

**Decision:** Extend `components/ui/Card.tsx` with `ComponentPropsWithoutRef<'div'>` and spread `{...rest}` onto the root `<div>` so callers can pass `aria-pressed`, `role`, `tabIndex`, and other native div attributes.

**Reasoning:** Persona onboarding (`_persona-client.tsx`) sets `aria-pressed={isSelected}` on `<Card>` for toggle semantics, but the previous `Card` implementation dropped unknown props — `aria-pressed` never reached the DOM. Playwright could not assert selection state; clicking the inner `h2` was unreliable for tests targeting the interactive wrapper.

**Also shipped:** `onboarding-persona.spec.ts` clicks `page.locator('[aria-pressed]').filter({ hasText: … })`, asserts `aria-pressed="true"`, waits for `PATCH /api/consumer/profile` before navigation.

**Verify:** `npm run test:e2e:cross-role` — persona spec in bundle (12 tests).

---

## Prod API route slug conflict fix (2026-05-30)

**Decision:** Move household document list from `/api/documents/[household_id]` to `/api/documents/household/[household_id]` so it no longer collides with `/api/documents/[id]/status` at the same dynamic segment depth.

**Reasoning:** Next.js 16 on Vercel silently failed to initialize all App Router route handlers when sibling dynamic segments used different param names (`household_id` vs `id`). Pages (SSR) worked; every existing `/api/*` handler hung with 0 bytes. Build passed with no error; `getSortedRoutes()` catches it locally.

**Also shipped:** `lib/supabase/routeAuth.ts` (`getSession()` for route handlers); `GET /api/health` liveness probe; middleware matcher excludes `/api/` from Edge auth (auth per route handler).

**Commit:** `af12ff0`. **Verify:** `npm run test:e2e:security-smoke` — 7/7 on prod 2026-05-30.

---

## RPC household access guards + attorney RLS + edge auth (2026-05-29)

**Decision:** Close remaining audit follow-ups with DB and edge-layer enforcement — not app-only patches.

**RPC guards:** `assert_household_caller_access(p_household_id)` in Postgres; called at top of `calculate_estate_composition`, `calculate_gifting_summary`, and `generate_estate_recommendations`. Allows household owner, connected advisor (`advisor_clients.client_id = owner_id`), or connected attorney (`attorney_clients.client_id = household_id` via `attorney_listings.profile_id`). `service_role` bypasses for recompute cron.

**Attorney RLS:** Policies rewritten — `attorney_clients.attorney_id` is `attorney_listings.id` (not `auth.uid()`); `client_id` is `households.id`. Fixed `legal_documents` and `document_download_log` attorney policies to join through listing.

**Monte Carlo edge:** `estate-monte-carlo` validates JWT, checks owner or connected advisor, then persists with service role only after access check.

**Rate limits:** `lib/api/simpleRateLimit.ts` — 60 req/min per IP on `/api/referral/track`; 120 req/min + auth required on `/api/telemetry/horizon-input-missing`.

**Migrations:** `20260629120000_rpc_household_access_guards.sql`, `20260629130000_attorney_rls_policy_fix.sql`. **Deploy:** `supabase db push` + `supabase functions deploy estate-monte-carlo`.

---

## Security hardening — internal email routes and household access (2026-05-29)

**Decision:** Server-only email notify routes (`/api/email/advisor-notify`, `attorney-notify`, `attorney-invite`) require `x-internal-key: INTERNAL_API_KEY`. HTML in emails escaped via shared `escapeHtml()`; attorney invite `signupUrl` must match app origin.

**Household IDOR:** `assertHouseholdAccess()` added — owner or connected advisor required before RPC reads on `gifting-summary`, `estate-composition`, `strategy-configs`, `export-estate-plan`.

**Other:** Signed unsubscribe tokens (HMAC via `CRON_SECRET`); Resend inbound webhook requires cron/internal auth; `debug-tier` hidden in production; invite accept validates invited email; referral signup notify requires authenticated user with matching profile referral code; projection/run no longer accepts bare service-role Bearer without internal key header.

---

## Health score narrative + advisor first-client playbook (2026-05-29)

**Decision:** Unify health score display language across consumer and advisor surfaces; add in-product first-client activation without new DB tables.

**Track 1 — Score narrative:** `HealthScoreBadge` is the single display component. Canonical labels: Strong (75+) / Needs Attention (50–74) / At Risk (0–49). `scoreContextSentence()` on consumer surfaces; `scoreContextSentenceForAdvisor()` on advisor surfaces. Stale indicator when `computed_at` > 30 days. **Score calculation in `computeEstateHealthScore` unchanged.**

**Track 2 — Advisor playbook:** Empty state offers intake, invite, prospect (lowest friction first). First-client 3-step panel persisted in `localStorage` keyed by advisor ID — not a compliance record. Steps auto-complete on client view mount, strategy tab mount, and recommendation send. `first_client_connected` notification via existing `create_notification` RPC when advisor has exactly one active client. "Needs attention" uses existing `healthScoreMap` and `alertCountsMap` — no new queries.

---

## Professional Acquisition & Activation — intake, referral impact, meeting prep (2026-05-29)

**Decision:** Three independent acquisition/retention tracks — attorney intake invitations, advisor referral feedback loop, advisor meeting prep print export.

**Track 1 — Intake:** `attorney_intake_requests` table; attorney sends Resend email with `/intake/[token]`; consumer signup/login stores token; auto-grant attorney access on profile save; free tier 5 requests/month server-side.

**Track 2 — Referral impact:** Clicks from `referral_clicks.created_at` (not `clicked_at`); signups from `funnel_events` where `event_name = account_created` and matching `referral_code` — **not** `referral_clicks.user_id` (column does not exist). Advisor notified on attributed signup.

**Track 3 — Meeting prep:** HTML route + `window.print()` after 500ms — intentional, no PDF library dependency.

**Migration:** `20260530_attorney_intake_requests.sql`.

---

## Persona-based onboarding — routing only, not feature gates (2026-05-29)

**Decision:** Add a single "What describes you?" screen immediately after slim profile save. Answer stored on `profiles.onboarding_persona` drives first-run copy (wizard step 1, recommended import template, dashboard insight card) — **does not gate features or billing**.

**Four personas:** `business_owner`, `real_estate`, `executive`, `accumulator` — cover $2M–$30M target segment.

**Locked:**
- `persona_set_at` set once on first answer; immutable even if user changes selection later (analytics anchor).
- Sidebar navigation away from persona screen → implicit skip sets `accumulator` (most neutral fallback).
- `PersonaInsightCard` — 7-day first-run only (account `created_at`); dismiss via sessionStorage.
- Wizard enforces persona before step 1; existing users with NULL persona see screen on next wizard visit.

**Config:** `lib/onboarding/personaConfig.ts` — single source for wizard copy, first asset type, import template, dashboard emphasis.

**Migration:** `20260530_onboarding_persona.sql`.

---

## Attorney Stripe checkout + upgrade prompts + drip (2026-05-29)

**Decision:** Wire attorney monetization in three layers: (1) `POST /api/stripe/attorney-checkout` + webhook `attorney_tier` from price ID; (2) `AttorneyUpgradePrompt` at client cap, PDF export, and doc-health dashboard gates; (3) 3-step attorney onboarding drip mirroring advisor activation pattern.

**Stripe:** Checkout route returns **503** when `STRIPE_PRICE_ATTORNEY_*` env vars are unset (`TODO_*` placeholders). **Products/prices still created manually** in Stripe Dashboard before go-live.

**Gating UX:**
- Free tier at **3 active clients** → upgrade prompt on dashboard; **403** from `grant-access` and `accept-request` when at cap.
- Tier 0 → blurred doc-health preview + upgrade overlay (not hidden entirely).
- PDF export → `AttorneyUpgradePrompt` instead of plain text link.

**Drip:** Step 1 on attorney signup callback, claim-listing, and portal page visit; steps 2–3 via `GET /api/cron/notifications` → `POST /api/email/attorney-drip`. Columns: `attorney_drip_step_*_sent_at` on `profiles`. BCC `avoels@comcast.net` on sends (matches attorney-notify). **Cron timing:** step 2 when step 1 sent ≥3 days ago; step 3 when step 1 sent ≥7 days ago (mirrors advisor drip — not `created_at`). **Post-ship:** manual SQL verification ~3 days after first real attorney — see [NEXT_SESSION.md § Queued next](./NEXT_SESSION.md#queued-next-post-ship-ops).

**Deferred (low priority):** Dashboard nudge when `checkProjectionReadiness().canShowPartial` — revisit after ~2 weeks of traffic ([ROADMAP.md backlog](./ROADMAP.md)).

---

## Projections readiness vs inline profile prompts (2026-05-29)

**Decision:** Replace binary `projections.length === 0` empty state with `checkProjectionReadiness()` — requires birth year, retirement age, and (assets **or** income). When financial data exists but age fields are missing, show **`ProfileFieldPrompt`** above chart output (partial view), not a blocking empty state.

**Reasoning:** Users who filled retirement/longevity via `/scenarios` prompts still hit generic “Complete your profile” on `/projections`. Readiness is server-computed on each render; scenarios PATCH persists to DB — the bug was the empty-state condition, not cache staleness.

**`/complete` unchanged:** Still uses legacy TIER2 empty CTAs; projections-only fix in this sprint.

**Deferred:** Dashboard card when `canShowPartial` (user has assets/income but missing age fields) — low priority; see ROADMAP backlog and NEXT_SESSION § Queued next.

**Tests:** `tests/unit/projectionReadiness.spec.ts` (5 cases); `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` adds `/scenarios` link (profile + scenarios, not merged with TIER3).

---

## Attorney tier model — B2B2C (2026-05-29)

**Decision:** Add `profiles.attorney_tier` (0 = free read-only, 1 = Attorney Starter, 2 = Attorney Growth). Same adoption pattern as advisor B2B2C: free tier for trial access, paid tiers for practice-level features.

**Gating:**
- **Tier 0 (free):** Up to **3 client households** visible; document vault read/upload; **no** intake summary PDF export; **no** multi-client doc health dashboard (blurred preview + upgrade prompt as of monetization sprint).
- **Tier 1+:** Intake summary PDF (`ExportPDFButton` attorney variant); Document Gaps card; multi-client doc health table on attorney home; higher client caps (15 / 50 per `lib/attorney/attorneyTierLimits.ts`).

**Stripe:** Checkout wired (`/api/stripe/attorney-checkout`); webhook sets `attorney_tier`. **Manual step:** create products/prices and set `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` + `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY` in Vercel.

**Connection lookup fix:** `attorney_clients.attorney_id` stores `attorney_listings.id` (not `auth.uid()`). Portal APIs and client detail page updated to resolve listing by `profile_id` first.

**Docs:** [SPRINT_IMPORT_ATTORNEY.md](./archive/sprints/SPRINT_IMPORT_ATTORNEY.md), migrations `20260529120000_sprint_import_attorney.sql`, `20260529130000_attorney_drip_columns.sql`.

---

## Import expansion — normalization + multi-sheet (2026-05-29)

**Decision:** Extend Sprint F-1/F-2 import with type normalization at commit, multi-sheet Excel orchestration, persona workbooks, `real_estate` as fifth import target, and import-first onboarding fork on wizard step 1.

**Reasoning:** HNW users ($2M–$30M) often arrive with Excel workbooks; single-table-per-upload and raw type strings were the main remaining friction after Tier 1 import unlock.

**Locked UX:**
- Human-readable spreadsheet labels map to canonical slugs via `lib/import/type-normalizer.ts` (review UI shows amber "Mapped to …" + override dropdown).
- Multi-sheet workbooks: per-sheet tabs, single **Commit All** with progress.
- Onboarding: primary CTA "Upload a spreadsheet" → `/import?onboarding=true` → `/dashboard?setup=imported` toast after commit.

**Docs:** [SPRINT_IMPORT_ATTORNEY.md](./archive/sprints/SPRINT_IMPORT_ATTORNEY.md), [CONSUMER_FLOWS.md § Bulk import](./CONSUMER_FLOWS.md).

---

## Partial PATCH merge on profile API (2026-05-27)

**Decision:** `PATCH /api/consumer/profile` merges incoming partial bodies with the user's existing household payload (`loadProfileSavePayloadForUser` + `mergeProfilePatch`) before validation and `buildHouseholdRow`. Inline `ProfileFieldPrompt` sends only the fields in the prompt plus `householdId`.

**Reasoning:** Sprint assumed pass-through from `buildHouseholdPayload` alone; without merge, partial PATCH fails validation ("Your name is required…"). Merge keeps full-profile saves unchanged while enabling deferred-field prompts on `/social-security` and `/scenarios`.

**Deduction prompt:** `needsDeductionMode()` is true only when `deduction_mode` is null/unset — explicit `standard` is a user choice and must not re-prompt.

**Verification:** `consumer-profile-save.spec.ts` (3 partial PATCH shapes) + `consumer-profile-field-prompt.spec.ts` (UI save/dismiss/deduction/PIA). Pre-flip bundle: `npm run test:e2e:go-live-profile` — [GO_LIVE_E2E.md](./GO_LIVE_E2E.md).

---

## Import at Tier 1 — intentional (2026-05-27)

**Decision:** Lower `FEATURE_TIERS.import` from **2 → 1** so all Financial-tier consumers can upload and commit CSV/XLSX without upgrading. Import **job history** UI remains Tier 2+ (`showImportHistory` on `/import`).

**Reasoning:** Spreadsheet import is the fastest onboarding path for HNW users (business owners, executives). Gating upload behind Tier 2 added friction without protecting revenue — import depth is a retention feature, not a paywall. Prior onboarding-only bypass (`allowOnboardingImport`) was inconsistent with `POST /api/ingest` tier checks.

**Audit trail:** `lib/tiers.ts` (inline comment), `tests/e2e/consumer/consumer-import-access.spec.ts`, `docs/CONSUMER_NAV_MAP.md`, `docs/archive/sprints/SPRINT_FRICTION_REDUCTION.md`.

---

## Advisor billing handoff — automated on connect (2026-05-27)

**Decision:** Centralize consumer billing transfer when an advisor connection activates in `lib/advisor/applyAdvisorConnectionBilling.ts`. Called from invite accept, link-pending fallback, and advisor accept-request.

**Behavior:** Sets `consumer_tier = 3`, `subscription_status = 'advisor_managed'`, `subscription_plan = 'advisor_managed'`, records `previous_consumer_tier` on `advisor_clients`, and sets Stripe `cancel_at_period_end` when an active subscription exists.

**Invite completion:** Signup with `?invite=` uses `emailRedirectTo` → `/auth/callback?next=/invite/{token}`. Immediate session redirects to invite page. Dashboard mount calls `POST /api/advisor/link-pending` as email-confirmation fallback.

**Consumer-initiated connect:** `POST /api/consumer/invite-advisor` replaces mailto on onboarding and `/my-advisor`. Registered advisors get `consumer_requested` + in-app notification; unregistered advisors get Resend email with `/signup?role=advisor&connect={token}` → `/advisor/connect/[token]`. Migration `20260527140000` allows nullable `advisor_id` for pre-registration invites.

**P1 (2026-05-27):** `restoreConsumerBillingOnDisconnect` on consumer disconnect + advisor remove-client; seat limits via `advisorClientLimits.ts`; advisor empty-state + first-connection playbook; consumer `AdvisorConnectedBanner`; meeting prep email via `POST /api/advisor/share-meeting-prep`. Stripe firm products still manual — see LAUNCH_CHECKLIST § Stripe Advisor & B2B2C.

**Advisor activation + positioning (2026-05-27):** Three-step advisor drip on `profiles.advisor_drip_*` columns; `AdvisorValuePropBanner` on `/advisor` frames MWM vs PDF-first portals (eMoney-class) and B2B2C client dashboard value.

---

## Advisor Billing — Deferred to post-launch (2026-05-28)

**Decision:** No Stripe advisor products at launch. First advisors onboarded and billed manually. Advisor-connected consumers get Tier 3 via existing `getUserAccess()` `advisor_clients` check.

**What already works (no code needed):**
- `advisor_clients` connected status → automatic Tier 3 on all API/page gates
- `subscription_status = 'advisor_managed'` → Tier 3 treatment
- `isAdvisor = true` → all features unlocked in advisor portal

**What was fixed this sprint:**
- `_dashboard-body.tsx` now uses `getUserAccess().tier` (not raw `consumer_tier`) so advisor-connected consumers see correct Stage 3 dashboard behavior

**Manual process at launch:**
- Set `profiles.role = 'advisor'` for advisor accounts
- Invoice advisors directly
- Pause consumer Stripe subscription manually when advisor takes them on
- Set `subscription_status = 'advisor_managed'` in Supabase

**Recommended advisor pricing for launch conversations:**
- 1–10 clients: $149/mo
- 11–50 clients: $349/mo
- 50+: custom / enterprise

**Post-launch scope (Advisor adoption package):**
- Stripe products for advisor tiers
- Automated subscription pause/resume on advisor connect/disconnect
- Seat count enforcement
- Advisor billing portal

**Rationale for deferral:**
First advisor cohort is small and high-touch. Manual billing gives flexibility to experiment with pricing before committing to Stripe product structures. Advisor connection already grants correct access — billing automation is an ops improvement, not a blocker.

---

## Pricing — Sprint 4 (2026-05-28)

**Decision:** $29/$79/$149/mo (monthly) with $290/$790/$1,490/yr (annual, 2 months free). 14-day free trial on Estate tier (Tier 3) only.

**Context:** Pricing was never live — clean slate, no grandfathering needed.

**Rationale:**
- Previous $9/$19/$34 signaled consumer budgeting app, not professional planning infrastructure. Target segment ($2M–$30M) pays $5K–$50K/yr in attorney fees.
- $149/mo annual cost ($1,788) = 3–6% of a single estate attorney engagement. This is a price point the segment can justify and that signals professional value.
- Trial on Tier 3 only: the estate tax snapshot and execution checklist are the product's core value proof. 14 days is enough to see a personalized tax number and complete 2–3 checklist items. Tier 1 at $29 is low enough friction that a trial adds complexity without benefit.
- Annual option: 2 months free (16.7% discount). Improves cash flow, reduces monthly churn, gives a pricing anchor for the monthly option.

**Alternatives considered:**
- $49/$99/$199: Higher signal but may reduce trial conversion from life-event funnel
- Keep $9/$19/$34: Confirmed wrong for segment positioning
- Usage-based: Too complex for this stage

**Revisit:** After 90 days of live data — conversion rate by tier, trial-to-paid conversion, churn by tier.

**Go-live ops:** Stripe test mode (Phase 1) must pass before live keys (Phase 2). Annual billing UI requires all three annual price env vars — documented in [LAUNCH_CHECKLIST.md § Stripe Setup](./LAUNCH_CHECKLIST.md#stripe-setup-required-before-public_signup_opentrue).

---

## Terms acceptance + post-checkout flow — TERMS-2/3/5 (2026-05-29)

**Decision:** Stripe success redirects to `/dashboard` or `/profile` (not `/terms/accept`). Estate trial checkouts use `payment_status = no_payment_required`; dashboard grants access for `subscription_status = trialing`.

**Shipped (2026-05-27):** TERMS-1 — record `terms_accepted_at` at signup via checkbox; Section F — soft backfill banner for existing users without acceptance timestamp.

**Ops:** `npm run repair:orphaned-user -- <email>` when auth user exists without `profiles` row (`handle_new_user` missed).

---

## Golden Path — unified progress model (2026-05-29)

**Decision:** Replace buried `SetupProgressCard` as the primary progress UX with `PlanProgressBar` driven by `determinePlanStage()` — four stages (Financial Foundation → Retirement & Estate Setup → Estate Planning → Plan Complete). One `progressPct`, one `nextActionHref`. Dashboard sections gated by stage; conflicts and life events always visible.

**Show all tools:** Client toggle persists `mwm_show_all_tools` in `localStorage` (default expanded for stage 3+). Power users bypass stage gating without changing tier gates.

**Deleted:** `lib/dashboard/setupProgress.ts` (`buildDashboardSetupProgress` had zero callers; superseded by `determinePlanStage` + existing `setupProgressCounts`).

**Unchanged:** `/onboarding/wizard`, `WizardOnboardingGate`, `/unlock-estate`, `getCompletionScore`, tier gates, `EstateExecutionChecklist` (Sprint 2).

---

## Estate execution checklist — persisted consumer tasks (2026-05-28)

**Decision:** Add `estate_checklist_items` (mirrors `domicile_checklist_items` pattern) and assemble dashboard checklist from existing tables — `estate_documents`, `trusts`, `estate_health_check`, `beneficiary_conflicts`, plus consumer toggles. **No new RPCs.**

**Status hierarchy:** `flagged` (beneficiary conflicts) > `incomplete` > `complete`. Completion = auto-detected **or** consumer-checked (checkbox persists as override).

**Tier links:** `resolveEstateActionHref()` — tier 1/2 deep links route to `/estate-tax` upgrade wall; tier 3 → planning routes.

**Trust tab:** Action Checklist checkboxes map via `TRUST_TASK_TO_CHECKLIST_KEY`; unmapped tasks stay UI-only.

**Alternatives considered:** Reuse `trust-will-rules` checklist only (rejected — not persisted). New `generate_estate_checklist` RPC (rejected — sprint constraint).

---

## Estate preview UX — dashboard + upgrade wall (2026-05-28)

**Decision:** Move `EstateCalloutCard` immediately after `DashboardIntroSection`; strengthen tax headline and tier-aware CTA; personalize `/estate-tax` `UpgradeBanner` with tax exposure + named conflict; tier-aware estate/conflict links on dashboard sections via `estateDetailsHref` / `estateUpgradeHref`.

**Note:** Sidebar “Estate Summary” remains `/dashboard` (no `/estate-summary` route). Tier 1/2 still see estate tax figures on dashboard; `/estate-tax` is the upgrade wall for deep planning.

---

## Flow & perf program K–O — closed (2026-05-28)

**Decision:** Ship consumer/advisor flow consistency, bundle splits, dashboard Suspense, advisor roster alert batching, route shells, and composition `revalidateTag` on `main` before go-live flip.

**Commit anchors:** K `90d167a` · L `5da71b0` · M `c5186ca` · N `615d496` · O `3524581`.

**Deferred:** Advisor `?tab=` URL still triggers full server page load — Parallel Routes / per-tab cache is a post–go-live sprint, not a launch blocker.

---

## Sprint 19a — deferred review fixes (2026-05-28)

**Decision:** Three quick wins from codebase review without advisor tab architecture change.

| Fix | Approach |
|-----|----------|
| Allocation save | `router.refresh()` after PATCH; drop redundant GET `/api/asset-allocation` |
| Assessment history | `loadAssessmentHistory` on dashboard server; widget skips client fetch when hydrated |
| Meeting Prep | Seed brief from server props; “Refresh from latest data” for explicit regen |

**Commit:** `b7a15dd`. Full Meeting Prep query dedupe remains deferred.

---

## Post-launch perf program — closed (2026-05-27)

**Decision:** Close engineering perf sprints B–J on `main`. Sprint 18 shifts focus to remaining planning route shells (J), manual RLS isolation smoke, and Sprint 17 legal/ops go-live blockers.

**Sprint summary:** B prefetch → C lazy scenarios → D advisor code-split → E/F form refresh + profile gates → G billing links → H/I loading/error on five hot routes → J complete/estate-tax shells.

---

## Post-launch perf — error boundaries on hot routes (2026-05-27)

**Decision:** Add `error.tsx` on the same five hot prefetch routes; extract shared `RouteErrorFallback` for consistent retry UX (matches dashboard / trust-strategy pattern).

---

## Post-launch perf — loading skeletons on hot routes (2026-05-27)

**Decision:** Add route-level `loading.tsx` for server-prefetch consumer pages: monte-carlo, allocation, scenarios, social-security, projections. Skeletons mirror each page layout (dashboard / trust-strategy pattern).

**Reasoning:** Server prefetch eliminated client waterfalls but left a blank shell during slow `loadProjectionData` / Monte Carlo parallel fetches.

---

## Post-launch perf — sidebar tier-locked billing links (2026-05-27)

**Decision:** Tier-locked sidebar leaves and locked Retirement/Estate group items navigate to `/billing?returnTo={href}` instead of non-interactive greyed divs.

**Reasoning:** Dead-end lock icons blocked upgrade conversion; attorney-access items already linked to billing — extend pattern to all feature gates.

---

## Post-launch perf — profile gate consistency (2026-05-27)

**Decision:** Add `requireHouseholdRecord(fromPath)` alongside `requireMinimumViableProfile`. All consumer pages that need a household row redirect to `/profile?required=true&missing=…&from=…` instead of bare `/profile` or inline empty states.

**Reasoning:** Inconsistent gates broke the profile required banner and post-save return flow (`from` param).

**Docs:** [lib/estate/requireMinimumProfile.ts](../lib/estate/requireMinimumProfile.ts), [CONSUMER_FLOWS.md § Profile](./CONSUMER_FLOWS.md).

---

## Post-launch perf — insurance/businesses form refresh (2026-05-27)

**Decision:** Replace `window.location.reload()` on `/insurance` and `/businesses` with optimistic local state updates + `router.refresh()` after API success (matches `/assets` pattern).

**Reasoning:** Full page reloads discarded client state and added unnecessary latency after every save/delete.

---

## Post-launch perf — advisor tab code-split + domicile dedupe (2026-05-27)

**Decision:** Lazy-load all advisor client workspace tabs via `next/dynamic` in `_client-view-shell.tsx` (Overview, Estate, Retirement, Tax, Notes join existing Strategy/Domicile/Documents/Meeting Prep splits). Remove `DomicileTab` mount refetch of `/api/domicile-analysis` — server page already passes `domicileAnalysis` from loaders.

**Reasoning:** Static imports pulled every tab bundle into the client shell chunk; domicile tab duplicated data the server already fetched on tab navigation.

**Docs:** [app/advisor/clients/[clientId]/_client-view-shell.tsx](../app/advisor/clients/[clientId]/_client-view-shell.tsx), [MASTER_ARCHITECTURE.md § Advisor portal](./MASTER_ARCHITECTURE.md).

---

## Post-launch perf — Scenarios lazy B/C projection fetch (2026-05-27)

**Decision:** Defer Scenario B and C `/api/projection` calls until the user edits B/C inputs (`bActivated` / `cActivated` gates). Returning users with localStorage overrides auto-activate so saved scenarios still recalculate on load.

**Reasoning:** Every `/scenarios` visit fired two projection runs (~600ms after mount) even when users only viewed Base Case — unnecessary compute and API load.

**Docs:** [app/(dashboard)/scenarios/_scenarios-client.tsx](../app/(dashboard)/scenarios/_scenarios-client.tsx), [CONSUMER_FLOWS.md § Retirement modeling](./CONSUMER_FLOWS.md).

---

## Post-launch perf — Monte Carlo + Allocation server prefetch (2026-05-27)

**Decision:** Extract shared loaders for `/monte-carlo` and `/allocation` (same pattern as Social Security): `loadMonteCarloPrefill`, `loadMonteCarloHistory`, `loadMonteCarloAdvisorAssumptions`, `loadAssetAllocationData`. Server pages prefetch in `Promise.all`; client components initialize state from props and skip mount-time API waterfalls when hydrated.

**Reasoning:** `/monte-carlo` fired three client fetches on mount (prefill, history, advisor assumptions); `/allocation` always fetched `/api/asset-allocation` despite partial server props for targets/risk only.

**Docs:** [lib/monte-carlo/](../lib/monte-carlo/), [lib/allocation/loadAssetAllocationData.ts](../lib/allocation/loadAssetAllocationData.ts), [SCHEMA_CHANGELOG.md § Post-launch perf Sprint B](./SCHEMA_CHANGELOG.md).

---

## Post-launch perf — advisor tab loader alignment (2026-05-27)

**Decision:** `advisorDatasetIncludeForTab()` must load `scenario`, `strategyLineItems`, and `stateTax` on every tab where `needsStrategyVm` builds `advisorHorizons` (estate, tax, domicile, meeting-prep, strategy). Strategy tab uses a single dedicated line-item fetch (`strategyLineItems: false` in loader) to avoid duplicate queries.

**Reasoning:** Estate/Tax tabs showed empty or wrong horizon numbers because accepted advisor strategies were excluded from the dataset include flags.

**Docs:** [lib/advisor/loaders.ts](../lib/advisor/loaders.ts), [SCHEMA_CHANGELOG.md § Post-launch perf Sprint A](./SCHEMA_CHANGELOG.md).

---

## Post-launch perf — StrategyTab server hydration (2026-05-27)

**Decision:** When advisor client workspace loads with `?tab=strategy`, server prefetches advisor + consumer `strategy_line_items`, `strategy_configs`, and gifting summary (`calculate_gifting_summary`). Pass as `initialAdvisorLineItems`, `initialConsumerLineItems`, `initialStrategyConfigs`, `initialGiftingActuals` through `ClientViewShell` → `StrategyTab`. Client state initializes from props; `loadConsumerData(false)` on mount fetches only missing slices; `loadConsumerData(true)` after inline recommend refreshes all.

**Reasoning:** `loadConsumerData()` on every StrategyTab mount duplicated 4+ client round trips (line items ×2, configs, estate-composition) despite server already loading composition and line items for horizons.

**Docs:** [MASTER_ARCHITECTURE.md § Advisor portal](./MASTER_ARCHITECTURE.md), [SCHEMA_CHANGELOG.md § Post-launch perf](./SCHEMA_CHANGELOG.md).

---

## Post-launch perf — estate composition cache (2026-05-27)

**Decision:** Add `estate_composition_cache` (unique per `household_id` + `source_role`). `/api/recompute-estate-health` upserts consumer + advisor composition after health/conflicts/recommendations. Read path uses `getCachedComposition` (cache hit → jsonb; miss → live `classifyEstateAssets` RPC). Applied on dashboard, estate-tax, my-estate-strategy, my-estate-trust-strategy, advisor client page, `POST /api/estate-composition`.

**Reasoning:** P-2 cached recommendations; composition RPC remained on every high-traffic page load. Materializing at recompute aligns with existing `afterHouseholdWrite` pipeline.

**Migration:** `20260527180000_estate_composition_cache.sql`

**Docs:** [DATABASE_SCHEMA_REFERENCE.md § estate_composition_cache](./DATABASE_SCHEMA_REFERENCE.md), [MASTER_ARCHITECTURE.md § Estate health recompute](./MASTER_ARCHITECTURE.md#estate-health-recompute--operations).

---

## Post-launch perf — server prefetch + render-path fixes (2026-05-27)

**Decision:** (1) Social Security page calls `loadSocialSecurityData` server-side; client skips fetch when hydrated. (2) Dashboard passes `initialSetupProgress` from server counts. (3) Trust-strategy prefetches charitable summary; `CharitableGivingDashboard` accepts `initialCharitableSummary`. (4) `ConsumerStrategyPanel` dynamic import on trust-strategy. (5) Advisor strategy notification INSERT moved to `POST /api/consumer/advisor-strategy-notifications` on client mount; add `loading.tsx` / `error.tsx` for trust-strategy and dashboard.

**Reasoning:** Eliminate useEffect waterfalls and remove side-effect INSERT from trust-strategy server render path.

---

## Pre-launch tier gating — pages are authority (2026-05-27)

**Decision:** `FEATURE_TIERS` in `lib/tiers.ts` must match each gated page’s `hasFeatureAccess` check (pages are authority, not sidebar guesses). Sidebar `isLocked()` and every consumer `UpgradeBanner` gate use `hasFeatureAccess(feature, tier, isAdvisor, isTrial)` + `featureUpgradeTier(feature)` for banner copy. Drift fixed before `PUBLIC_SIGNUP_OPEN`: `real-estate`, `allocation`, `digital-assets` → tier 2; `business-succession` → tier 3; added `my-estate-strategy` / `my-estate-trust-strategy` keys.

**Reasoning:** Tier-1 users could click sidebar links that immediately hit `UpgradeBanner` (e.g. Real Estate showed unlocked at tier 1 in nav but gated at tier 2 on the page). Single helper prevents future drift.

**Docs:** [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md), [MASTER_ARCHITECTURE.md § Consumer Billing](./MASTER_ARCHITECTURE.md#consumer-billing--access-contract).

---

## Pre-launch cache revalidation on strategy writes (2026-05-27)

**Decision:** After successful `POST`/`PATCH`/`DELETE` on `/api/strategy-line-items`, call `revalidatePath` for `/my-estate-trust-strategy`, `/my-estate-strategy`, `/dashboard`, `/estate-tax` (same pattern as gift-history). Also revalidate `/scenarios` + `/projections` on growth-assumptions writes and `/allocation` + `/projections` on allocation-targets writes.

**Reasoning:** Strategy confidence changes affect server-rendered composition on multiple routes; clients were relying on `router.refresh()` alone.

**Docs:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md), [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md).

---

## Strategy reversal — logged withdraw, consumer-owned (2026-05-31)

**Decision:** Consumers can reverse confirmed strategies without hard-deleting rows. `PATCH /api/strategy-line-items` actions: `return_to_sandbox` (probable → illustrative), `withdraw` (`is_active=false`, `consumer_withdrawn`, optional `reversal_reason`), `demote` (certain → probable). Only `households.owner_id` may reverse. Gifting: deleting a synced gift log warns before leaving orphan plan rows; optional withdraw in same step.

**Reasoning:** Gift history and plan commitment are separate stores; delete gift alone left stale `outside_strategy_total`. Reversal preserves audit trail for advisors and compliance while restoring estate accuracy immediately via `is_active=false`.

**Docs:** [MASTER_ARCHITECTURE.md § Strategy reversal](./MASTER_ARCHITECTURE.md#consumer-and-advisor-interaction), [SCHEMA_CHANGELOG.md § Strategy reversal](./SCHEMA_CHANGELOG.md).

---

## Strategy sandbox → actuals — illustrative first, explicit promote (2026-05-27)

**Decision:** All consumer modeled strategy saves (SLAT, ILIT, charitable, GRAT/CRT/CLAT/Roth/Liquidity chips) write `confidence_level='illustrative'` first and appear in **Strategy Sandbox** on Transfer Strategies. Consumer moves a row into **In My Plan** with `PATCH /api/strategy-line-items` `{ id, promoteConfidence: true }` (`illustrative` → `probable`, consumer-owned only). Advisor recommendations still use `PATCH /api/consumer/strategy-recommendation` for accept/decline; accepted advisor rows show in **In My Plan** via `consumer_accepted`. Annual gifting and explicit charitable **Save to my plan →** may still write `probable` directly. Roth optimizer adds **Use in Transfer Strategies →** (illustrative row + deep link `?openPanel=roth`).

**Reasoning:** Prior SLAT/ILIT default `probable` bypassed review and immediately reduced taxable estate in composition. Sandbox matches advisor “model then commit” mental model and aligns chip-modeled strategies with the same promote step.

**Alternatives considered:** Auto-promote on save (rejected — no user confirmation). Single combined list without sandbox section (rejected — unclear what affects tax). Advisor promote via same PATCH (rejected — keep accept path and audit fields).

**Docs:** [MASTER_ARCHITECTURE.md § Strategy sandbox contract](./MASTER_ARCHITECTURE.md#consumer-and-advisor-interaction), [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md), [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md).

---

## Profile layout E2E — spouse toggle and live headers (2026-05-27)

**Decision:** Add `consumer-profile-spouse-layout.spec.ts` (UI) and `consumer-growth-assumptions-api.spec.ts` (API) instead of extending `consumer-api-writes`. Person-1 name uses `getByRole('textbox', { name: 'Jane', exact: true })` to avoid matching Full Name placeholder `Jane Doe`.

**Reasoning:** Profile layout refactor (`61a8130`) changed DOM only; prior Playwright suite had no coverage for smoke §3.1b–3.1c or PROF-2 growth PATCH. Split specs keep API contract tests discoverable next to Scenarios save path.

**Skipped by default:** Growth round-trip requires `PLAYWRIGHT_HOUSEHOLD_ID` from `npm run seed:e2e` ([E2E_TEST_RESET.md](./E2E_TEST_RESET.md)).

---

## Profile page layout — two-column people, brand section headers (2026-05-27)

**Decision:** Refactor `/profile` client layout only (`_profile-client.tsx`). `max-w-2xl` form width; gold left-border `ProfileSectionHeader`; sections **Household** (identity), side-by-side **people** columns when `hasSpouse` (`grid-cols-1 sm:grid-cols-2`), **Household Planning** (tax/domicile/deduction). Column headers bind to `person1Name` / `person2Name` live (`trim() || 'You'` / `'Spouse / Partner'`). Spouse toggle sits **below** the person grid (not a card header). Paired fields inside each column (birth year + retirement age; SS claiming + longevity); PIA full width. Single callout links to Scenarios + Asset Allocation. No field, validation, save path, or API changes.

**Reasoning:** PROF-1/2 removed planning-assumption inputs but left a long vertical form; two-column person layout and live names make spouse entry obvious and scannable. Narrower page width avoids sparse 1280px forms.

**Alternatives considered:** Keep separate “Your Information” and spouse cards with header checkbox (rejected — toggle read as section label). Use shared `SectionHeader` primitive (deferred — profile uses local `ProfileSectionHeader` with audit gold `#C9A84C`).

**Docs:** `CONSUMER_FLOWS.md` Profile row; `MASTER_ARCHITECTURE.md` Profile UI layout.

---

## Pre-launch RLS household scope — six tables (2026-05-27)

**Decision:** Migration `20260527150000` drops permissive `auth.uid() IS NOT NULL` policies and replaces with household owner + `advisor_clients` (via `households.owner_id = client_id`, `status = 'active'`, `accepted_at IS NOT NULL`). GST advisor writes use `/api/advisor/gst-entry` with server-side link validation and `createAdminClient` (mirrors `strategy-recommendation` / `gap-status` pattern). `SLATILITPanel` no longer inserts to `gst_ledger` from the browser.

**Reasoning:** Permissive policies OR'd with scoped policies, exposing cross-household reads/writes before public signup.

**Shipped:** `1f41ce1` (migration + docs), `7cab1be` (GST API), `35b0738` (MIGRATION_TEMPLATE advisor join). Applied on prod; `verify-loose-rls-policies.sql` returns zero rows.

---

## Security — explicit GRANTs in migrations; grant vs RLS audits (2026-05-27)

**Decision:** Add `supabase/MIGRATION_TEMPLATE.sql` requiring explicit `GRANT` + RLS in every new table migration. Prod grant audit (119 tables) shows all API roles already granted and RLS enabled — **no backfill migration**. Policy audit CSV exported for pre-launch review (`signed_in_only` advisor/consumer policies flagged separately from reference-table `USING (true)`).

**Reasoning:** PostgREST access (grants) and row isolation (policies) are different questions. Future Supabase defaults may skip auto-grants; baking grants into migrations prevents regressions. Reference tables may use `USING (true)` for authenticated read; household PII must not.

**Alternatives considered:** One-shot `GRANT ALL` migration on prod (rejected — audit shows nothing missing). Defer policy audit until post-launch (rejected for launch gate — tracked in LAUNCH_CHECKLIST as review item).

---

## PROF-1/2 — Profile cleanup: canonical homes for planning assumptions (2026-05-27)

**Decision:** Remove financial growth rates, inflation, and risk tolerance from `/profile`. **Scenarios** is the single editor for `growth_rate_accumulation`, `growth_rate_retirement`, `growth_assumptions` (RE/business), and `inflation_rate`. **Asset Allocation** (`/allocation`) edits `risk_tolerance` plus target stocks/bonds/cash. Profile save uses pass-through in `buildHouseholdRow` + fetch of existing household so PATCH profile does not overwrite Scenarios/Allocation values.

**Reasoning:** Profile should hold identity and demographic facts; planning assumptions belong with the surfaces that explain them (what-if scenarios, allocation benchmarks). Duplicating editors caused confusion after ENG-2A/2B (RE/business no longer grow at inflation).

**Alternatives considered:** Keep inflation on Profile (rejected — same “planning assumption” bucket as growth). Partial profile save API omitting household columns (rejected — pass-through is simpler for one save endpoint).

**Docs:** `MASTER_ARCHITECTURE.md` — Projection Engine Assumption Reference; `DATABASE_SCHEMA_REFERENCE.md` — households field ownership table.

---

## ENG-2 — Per-asset-class growth assumptions and post-deploy staleness bump (2026-05-27)

**Decision:** Store real estate and business growth rates in `households.growth_assumptions` jsonb (defaults 4.5% / 7.0%); keep financial accumulation/retirement on existing columns. Fix engine to use dedicated RE/business rates (not inflation). Estate MC reads advisor/consumer return mean from request, not hardcoded 7%/12% in the edge function.

**Staleness:** Migration-only backfill does not bump `households.updated_at`. A follow-up migration (`20260527130400`) sets `updated_at` for households with a saved base case so `isProjectionStale` fires and `generateBaseCase` runs on next dashboard, my-estate-strategy, or advisor client load. Saving on Scenarios (`PATCH /api/consumer/growth-assumptions`) also touches `updated_at` via `afterHouseholdWrite`.

**Alternatives considered:** One-off admin script to call `generateBaseCase` for all households (rejected — same outcome as staleness bump with less ops risk). Leaving stale rows until user edits data (rejected — confusing Projections/horizons after deploy).

**One-off QA script:** `scripts/compare-user-estate-data.ts` was not committed — service-role email comparison against production; delete rather than ship in repo.

---

## Purpose

This document records significant product, UX, and strategy decisions — what was decided, why, and what alternatives were considered. It exists so decisions made in one session don't get relitigated in the next. If a decision is here, it was made deliberately. If you want to revisit it, add a new entry rather than editing the old one.

**How to add an entry:** Date · Topic · Decision · Reasoning · Alternatives considered.

---

### May 2026 — Nav consistency: homepage uses PublicNav; billing and utility pages get brand chrome

**Decision:** Move marketing homepage into `(public)` so `/` uses the same `PublicNav` as `/pricing` and `/assess`. Add `MinimalAuthNav` for billing (authenticated, no sidebar). Add `WordmarkOnly` on token/utility layouts (invite, beneficiary, share, confirm-email, claim-listing, attorney-invite). Do not change dashboard sidebar, advisor nav, education layout, or auth login/signup (no nav is intentional).

**Reasoning:** Three surfaces had inconsistent or missing brand presence: duplicate inline homepage nav, billing with only inline back links, and utility flows with no wordmark. Attorney portal header remains a separate surface (no MWM wordmark today) — logged for a future sprint.

**Alternatives considered:** Extract homepage-only `HomepageNav` without center links (rejected — marketing consistency favors full `PublicNav`). Add full `PublicNav` to billing (rejected — wrong chrome for post-auth checkout).

---

### May 2026 — Client Summary PDF: match Attorney Summary standard

**Decision:** Upgrade `ConsumerEstatePlanPDF` to the same navy/gold structure as `AttorneyEstatePlanPDF` (brand label, purpose callout, household profile grid, gold section headers). Remove letter-grade display for consumer readiness; use `N / 100 — Early Stage` (etc.) with progress bar. Document checklist uses **Not on file** (not **Action Needed**). Enable tax + assets in `/api/export-estate-plan` for consumer role so profile figures populate.

**Reasoning:** Client Summary looked like a different product (ESTATE PLANNER header, alarming **F** grade, advisor-oriented copy). Attorney Summary is the reference standard; consumer export should feel professional and self-owned, not punitive.

**Alternatives considered:** Keep letter grades (rejected — misleading for early-stage households). Green purpose bar like attorney (rejected — gold/navy differentiates client vs attorney-ready export).

---

### May 2026 — UX-5: Strategy tab layout — horizon below recommendations, impact panel

**Decision:** Remove redundant full-width SLAT/ILIT and Advanced panels below the three-step workflow; rename Combined Strategy View to **Strategy Horizon** and place it after Step 3; add `StrategyImpactPanel` (before/after tax delta) at the top of Step 3. Scroll targets point to Step 2 Opportunities (`#strategy-opportunities`).

**Reasoning:** UX-4 inline modeling made full-width panels duplicate entry points. Advisors need impact visibility at the moment of recommendation review, then the multi-horizon table — not modeling forms repeated below the fold.

**Alternatives considered:** Keep full-width panels as fallback (rejected after UX-4 — inline panels are sufficient). Single combined section without impact panel (rejected — advisors asked for tax delta before horizon table).

---

### May 2026 — UX-5b: Remove CompositeOverlay manual entry mode

**Decision:** Remove `custom` ("Enter Strategy Reductions") mode from `CompositeOverlay`. Default to `recommendations`, which reads `strategy_line_items` via the existing read API. Keep `30m` and `100m` archetype modes for illustration.

**Reasoning:** UX-4 inline modeling in Step 2 is the single entry point for client-specific strategies. Manual dollar entry duplicated that workflow, could drift from saved recommendations, and had no DB persistence. CompositeOverlay’s role is visualization of recommended strategies, not a second entry form.

**Alternatives considered:** Keep manual mode as fallback for households without recommendations (rejected — empty state + Step 2 modeling is sufficient). Wire manual amounts into `strategy_line_items` (rejected — out of scope, wrong data contract).

---

### May 2026 — ENG-1: Estate/Tax strategy inclusion via horizon actual set

**Decision:** For advisor Estate/Tax display parity, use horizon-derived actual-set values (`advisorHorizons.today`) instead of relying solely on `calculate_estate_composition` output for strategy inclusion. Additive override path (`horizonComposition`) is advisor-only; consumer composition calls stay unchanged.

**Reasoning:** `calculate_estate_composition` filters strategy rows by `p_source_role`, so it cannot represent `(consumer rows OR accepted advisor rows)` in a single call. `strategyMappers.ts` already defines the correct actual set and horizon outputs are consistent with advisor workflow expectations.

**Alternatives considered:** Add new RPC parameter (deferred to post-launch ENG-2). Keep current advisor Estate composition path (rejected — underreports accepted advisor strategy impact).

---

### May 2026 — UX-4: Inline strategy modeling in Opportunities panel

**Decision:** Wire Step 2 catalog rows to existing `SLATILITPanel` and `AdvancedStrategyPanel` inline (expand/collapse per row) without new engines, APIs, or migrations. Centralize catalog id → panel chip mapping in `catalogToPanel.ts`; **CST** uses catalog/API key `cst` but UI chip `credit_shelter_trust` (only asymmetric case). Remove scroll-only `ModelStrategyButton`. Keep full-width panels below the three-step workflow as fallback; `scrollToStrategyModules` unchanged.

**Reasoning:** UX-3 “Model this” scrolled away from the catalog; advisors lost context. Reusing existing panels preserves `strategy_source` contracts and `useRecommendAdvanced` / SLAT·ILIT POST paths. Grep-verified chip strings prevent silent no-op panel opens.

**Alternatives considered:** New inline forms per strategy (rejected — duplicate engines). Rename `credit_shelter_trust` to `cst` in UI state (rejected — breaks `PANEL_TO_STRATEGY_SOURCE` and saved-state mapping).

---

### May 2026 — UX-3: Strategy tab three-step workflow + severity system

**Decision:** Reorganize the advisor Strategy tab into three labeled steps — **Situation** (diagnostic metrics), **Opportunities** (strategy catalog + “Model this”), **Recommendations** (advisor `strategy_line_items` by client response + AF-1 questions) — without changing `calculateAdvisoryMetrics` or consumer surfaces. Replace `!!` / ad-hoc badges with `advisoryMetricSeverity` (`●`/`!`/`✓`/`—`, max 2 active). Show a red liquidity shortfall banner when coverage &lt; 1.0x, ordered before amber exemption warnings. Peer benchmarks stay behind `NEXT_PUBLIC_ADVISOR_BENCHMARKS` (default off).

**Reasoning:** One undifferentiated page mixed diagnosis, modeling, and client recommendations. Liquidity 0.0x was critical but visually equal to low-priority warnings. Advisors need a clear path from “what’s wrong” → “what to model” → “what we sent the client.”

**Alternatives considered:** New API for recommendations list (rejected — existing `strategy_line_items` + extended client fetch). Remove Combined Strategy / Advanced panels (rejected — still needed for modeling; moved below workflow).

---

### May 2026 — UX-2: Advisor portal UX + cached advisory metrics

**Decision:** (1) Ship advisor-only UX in two passes: brand/tab load/gap workflow (pass 1) then metrics cache, estate composition UX, strategy grid (continuation). (2) Cache six core advisory metrics server-side via `unstable_cache` + `household-metrics-{householdId}` tag; invalidate on `afterHouseholdWrite`. (3) Omit Best Strategy NPV and CST Crossover from the grid until `strategy_line_items` has active amounts — show a single CTA instead. (4) Persist gap discussion state in `advisor_gap_statuses` (advisor-private, not consumer-visible).

**Reasoning:** Strategy tab re-computed eight metrics on every client render; tab-scoped loading and cache cut repeat visits. Empty outside-estate panel and small tax chip wasted advisor attention on high-liability households. Warning badges on four cards diluted urgency — cap at two by priority.

**Alternatives considered:** Persist advisory metrics in DB on recompute (deferred — matches P-2 recommendations pattern but heavier than cache for advisor-only reads). Keep eight-card grid with “Not run” placeholders (rejected — noise).

---

### May 2026 — Advisor portal roster net worth (performance)

**Decision:** Advisor home (`/advisor`) uses `loadRosterNetWorthByOwner` (batched table reads) for roster net-worth columns. Client workspace (`/advisor/clients/[id]`) still uses `calculate_estate_composition` for engine-aligned Overview figures.

**Reasoning:** One composition RPC per client made roster load scale linearly with client count and dominated TTFB. Batched reads are approximate but sufficient for sort/display on the roster; full composition remains on the client detail page.

**Alternatives considered:** Keep N RPCs for accuracy (rejected — unacceptable at 5+ clients). Batch composition RPC via new Postgres function (deferred — post-launch per PERF_SPRINT_P1).

---

### May 2026 — NAV-1: Sidebar active route indicator

**Decision:** Active nav uses `isNavItemActive(href, pathname)` with path-prefix matching (except `/dashboard` exact). Planning groups auto-expand when `groupContainsActiveItem` is true, overriding default collapsed state for Financial Planning.

**Reasoning:** Financial Planning was in `DEFAULT_CLOSED_GROUPS` and the open predicate required `!DEFAULT_CLOSED_GROUPS.has(label)`, so the group stayed collapsed on `/income` etc. — children were unmounted and the active stripe never appeared.

**Alternatives considered:** Remove Financial Planning from `DEFAULT_CLOSED_GROUPS` only (rejected — partial fix; other groups need the same active-child rule).

---

### May 2026 — OB-3b: Financial Planning sidebar + layout household query

**Decision:** (1) Remove the legacy green dashboard setup checklist (`DashboardIntroSection`); `SetupProgressCard` is the only setup UI. (2) Set all Financial Planning `FEATURE_TIERS` keys to tier 1 and exempt that group from `isLockedUser`. (3) Never gate Security, My Advisor, or Manage Subscription on `isLockedUser`. (4) Stop selecting `households.date_of_birth_1` in `getDashboardLayoutContext` — use `person1_birth_year` only (profile gate still accepts legacy `date_of_birth_1` on in-memory types if ever populated elsewhere).

**Reasoning:** Tier 1 users (e.g. `test1@rolobe.resend.app`) saw the entire Financial menu locked because the layout household query failed on a non-existent column, so `hasHousehold` was always false. Separately, onboarding users must reach Income/Assets without a household row. Upgrade paths (Retirement/Estate) stay tier-gated.

**Alternatives considered:** Require household before any Financial nav (rejected — blocks data entry). Add `date_of_birth_1` migration (rejected — `person1_birth_year` is canonical).

---

## How to use this document at the start of a session

Skim the last 5 entries and the "Active constraints" section before starting any design or engineering work. This prevents re-opening settled questions and re-explaining context that was already worked out.

---

## Active constraints (summary of decisions that affect current work)

- **Complexity stays in.** GRAT/SLAT/ILIT forms keep their technical depth. Add guided context (tooltips, plain-language explanations) but do not hide parameters. This segment wants the depth.
- **Public nav and app nav are separate chrome components.** No planning app links on the public site. No public-site links in the app sidebar.
- **Tier structure is visible in the sidebar.** Locked tiers show representative items with lock icons and upgrade CTAs — they do not disappear.
- **Advisor and attorney connections are in the sidebar footer**, not a primary planning group. They are relationship tools, not planning tools.
- **Conflict alerts must be above the fold on the dashboard.** The specific named alerts are the highest-value content. They cannot be the last thing before the footer.
- **Pricing is positioned against professional fees**, not against consumer tools. Never price-compare to LegalZoom or Trust & Will in copy or positioning.
- **The assessment is the primary public conversion mechanism.** Score is visible without an account. Full breakdown requires account creation.
- **Advisor connection queries** must use `CONNECTED_ADVISOR_CLIENT_STATUSES` from `lib/advisor/clientConnectionStatus.ts` (`active` | `accepted`) — never hardcode a single status in new code.
- **Financial Planning sidebar is never `isLockedUser`-gated.** Tier 1 data entry must work before a household row exists. `hasHousehold` comes from layout `getDashboardLayoutContext` — do not SELECT `households.date_of_birth_1` (column does not exist; breaks the query).
- **Security, My Advisor, and Manage Subscription** are never household-gated in the sidebar (OB-3b).
- **Sidebar groups auto-expand when a child route is active** (NAV-1) — required for collapsed Financial Planning to show `NAV_ACTIVE` on the current page.
- **Advisor roster net worth** uses batched table reads (`loadRosterNetWorthByOwner`), not per-client composition RPC. Client workspace uses full `calculate_estate_composition`.
- **Tailwind v4 arbitrary colors:** `text-` / `border-` / `ring-` use `color:` prefix (`text-[color:var(--mwm-gold)]`); `bg-` uses `bg-[var(--mwm-navy)]` without `color:`. Wrong prefix fails silently.
- **Referral event attribution** is per-user via `funnel_events.event_slug` at signup; `referral_clicks` is anonymous (no `user_id`). Cross-device signup may not have funnel `event_slug` — see NEXT_SESSION.md known limitations.

---

## Decision log

### May 2026 — In-app copy audit: advisor-forward, scope not disclaimer (Sprint 12)

**Decision:** Replace hedging disclaimer patterns (“Educational tool only”, “not constitute advice”, “Always consult”) with product-positioning or scope copy across dashboard, public event/assess, upgrade gates, directories, and shared links. Keep `approximately` on derived estate figures in `UpgradeBanner`. Keep beneficiary-view “informational purposes” on third-party surfaces. Scenarios comparison footer uses **`Scope:`** not **`Disclaimer:`**.

**Reasoning:** Target segment ($2M–$30M) expects a planning tool that prepares them for professional relationships — not copy that implies numbers are untrustworthy before use.

**Alternatives considered:** Remove all disclaimer bars (rejected on beneficiary/share edge cases where audience lacks product context).

---

### May 2026 — Mobile: desktop-first planning app, drawer nav on phones (Sprint 12)

**Decision:** Consumer planning app is **desktop-first** (segment 50–65, complex modeling). On viewports below `lg`, the fixed sidebar becomes an off-canvas drawer (hamburger, overlay, closes on navigate). A short note in the mobile sidebar sets expectations. **Public routes** (`(public)/layout`, event pages) stay separate — acquisition on phone is the priority there; no planning sidebar on those routes. Full responsive audit deferred post-launch.

**Reasoning:** Matches eMoney-style complex tools; avoids landscape-only use of the app shell without a full mobile redesign. Event-page mobile is the real acquisition surface.

---

### May 2026 — Pre-launch A/B collapse: personalized + score_visible (Sprint 12)

**Decision:** With no live traffic, do not wait on `funnel_events` for A/B winners. Ship **`personalized`** upgrade copy only (`getEventUpgradeValueProp` always uses `EVENT_UPGRADE_COPY`). Ship **`score_visible`** assessment behavior only (logged-out users see scores; gap report gated behind signup). Remove `lib/analytics/abTests.ts`, branching code, and `app_config` rows `ab_upgrade_copy` / `ab_assessment_gate` (migration `20260531000000_remove_ab_test_app_config.sql`). Keep `app_config` for other keys. Post-launch A/B when baseline conversion exists.

**Reasoning:** Pre-launch split tests cannot reach significance; PRODUCT_STRATEGY favors specificity over generic upgrade copy; assessment conversion depends on demonstrating value (scores) before account creation.

**Alternatives considered:** Default to higher `tier_upgraded` variant without data (N/A). Keep flags until 4 weeks live (rejected — delays launch hygiene).

---

### May 2026 — Planning empty-state CTAs: profile-only on tier-1/2 surfaces (Sprint 12)

**Decision:** `/projections` and `/complete` use `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` (profile link only). The “Generate estate plan →” link stays on tier-3 `/my-estate-strategy` (inline `POST /api/consumer/generate-base-case`). Export `planningMissingProjectionActions(tier)` for callers that need tier-aware lists; do not merge TIER2 and TIER3 into one constant.

**Reasoning:** Lifetime snapshot and projections rows come from `computeCompleteProjection` on each server render once profile inputs exist — not from `projection_scenarios`. Sending tier-2 users to `/my-estate-strategy` hit a tier-3 upgrade wall and implied a manual generate step that does not apply.

**Alternatives considered:** Inline generate on `/complete` (rejected — redundant with server-side compute). Single shared CTA list (rejected — regresses tier-2 UX).

---

### May 2026 — A/B test exit criteria (Sprint 10, settled)

**Decision (superseded May 2026 Sprint 12):** Pre-launch there was no traffic to apply this
framework. Winners chosen by product strategy prior: **`personalized`** upgrade copy,
**`score_visible`** assessment gate. See entry “Pre-launch A/B collapse” above.

**Original framework (for post-launch tests):** Primary metric `tier_upgraded` in
`funnel_events`; 50 events per variant or 4 weeks; owner Alan; secondary metric on assess
gate: `event_assess_complete` → `account_created`.

**Alternatives considered:** Gut-feel winner selection (rejected). Indefinite dual variants at
launch (rejected).

---

### May 2026 — Business succession: Path A minimal intake (Sprint 10, settled)

**Decision:** **Path A — Ship minimal.** `/business-succession` is live in the sidebar (tier 3).
Minimum intake on `households`: `succession_plan_in_place`, `succession_key_person_identified`,
`succession_buy_sell_in_place`. Dashboard shows an above-the-fold amber alert when the user has
business interests and `succession_plan_in_place` is not true. Full `BusinessSuccessionDashboard`
remains available for advisor workflows; consumer page is the minimal three-question form only.

**Reasoning:** Business-owner persona ($3M–$15M) is a primary segment; succession is their
defining need. Minimal intake closes the persona gap without blocking launch on full planning UI.

**Alternatives considered:** Path B post-launch descope (rejected — leaves dead sidebar comment
and persona gap). Full dashboard for consumers at launch (rejected — scope).

---

### May 2026 — Invite-your-advisor: Path A post-profile onboarding (Sprint 10, settled)

**Decision:** **Path A — Launch gate.** After minimum viable profile save, consumers route to
`/onboarding/invite-advisor` (email invite via `mailto:`, find-advisor link, or skip). One column
only: `profiles.onboarding_invite_advisor_completed_at`. **Skip and continue both set the same
timestamp** (dismissed = seen; no separate `skipped` boolean). NULL means the layout gate is active.
`POST /api/consumer/onboarding-invite-advisor` is used for skip. Layout gate redirects consumers
with MVP profile who have not completed this step. `/my-advisor` retains the invite card for later.

**Deploy:** Column must exist via `20260530000000_sprint9_10_gates.sql` before first prod deploy of this gate.

**Reasoning:** Aligns with PRODUCT_STRATEGY principle 4 (advisor flywheel from day one) without
building in-app advisor messaging at launch.

**Alternatives considered:** Path B footer-only on `/my-advisor` (rejected for launch).

---

### May 2026 — Advisor client link status: `active` and `accepted` (Sprint 9/10)

**Decision:** Treat `advisor_clients.status` in `('active', 'accepted')` as a connected link on
both consumer and advisor surfaces. Canonical constant: `CONNECTED_ADVISOR_CLIENT_STATUSES` in
`lib/advisor/clientConnectionStatus.ts`. New accepts write `active`; legacy `link-pending` now
writes `active` (was `accepted`). Advisor client detail loader and advisor API access checks use
the shared constant so roster + client workspace stay symmetric with `/my-advisor`.

**Connection life event at accept:** Prefer `funnel_events.event_slug` (signup/event attribution),
then `referral_clicks.event_slug` for `profiles.referral_code`, then explicit `life_events`, then
calendar triggers — implemented in `pickConnectionLifeEvent()`.

---

### May 2026 — "Ask your advisor →" links to public directory for all users

**Decision (interim):** The "Ask your advisor about this →" CTA on Transfer Strategy education
cards links to `/find-advisor` for all users, including users with a connected advisor. This
means a connected advisor does not receive any signal when their client is reviewing a strategy
they recommended.

**This is a known gap in the advisor flywheel.** The full behavior should be: if the user
has a connected advisor, this CTA offers an in-app action (message, flag, or notification).
If no connected advisor, it links to `/find-advisor`.

**Deferred to post-launch** because implementing advisor messaging or flagging is a new feature
category (not a fix) and would land in Sprint 10 or later, which risks the launch timeline.

**Post-launch:** Add an in-app advisor flag action on strategy education cards for users with
`advisor_clients` rows in accepted status.

**Superseded (2026-05-25, Sprint AF-1 — `a255616`):** Connected consumers use
`POST /api/consumer/ask-advisor` → advisor notification `consumer_strategy_question`; advisor
sees **Client Strategy Questions** on client Overview. No connected advisor → `/find-advisor`.
Session-only “Your advisor has been notified” confirmation (refresh resets UI; notification persists).

---

### June 2026 — Sprint P-2 closed; recommendations cached at recompute

**Decision:** Sprint P-2 (`47a38f3`) shipped pre-launch: `estate_health_scores.recommendations` jsonb populated during `/api/recompute-estate-health`; dashboard reads cache on load (empty array before first recompute — never live RPC on hot path). Projections serve fresh `outputs_s1_first` via cache-first branch in `loadProjectionData`. Layout uses `getDashboardLayoutContext` (React `cache()`) for single auth/profile/household/notifications load per request.

**Remaining post-launch perf:** ~~Materialize `calculate_estate_composition` at recompute~~ — shipped 2026-05-27 (`estate_composition_cache`).

**Doc:** [PERF_SPRINT_P1.md § Sprint P-2](./archive/sprints/PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors) · Migration: `20260602130000_sprint_p2_recommendations_cache.sql`

---

### June 2026 — Sprint P-1 closed; first post-launch perf sprint = dashboard read model

**Decision:** Sprint P-1 (`5c24160`) shipped pre-launch quick wins: dashboard `Promise.all`, advisor conflict cache read, 3s recompute debounce, server-fetched notification count, `next/font`, and `idx_assets_owner_id` / `idx_liabilities_owner_id` (applied in production).

**Post-launch engineering priority (Sprint P-2):** Production `pg_stat_statements` (Query A) shows top load from `projection_scenarios` INSERTs and estate RPCs (`calculate_estate_composition`, `generate_estate_recommendations`) on the dashboard path. **Sprint P-2 addressed** recommendations cache + projections cache-first + auth dedup (`47a38f3`). **Remaining:** materialize `calculate_estate_composition` at recompute.

**Doc:** [PERF_SPRINT_P1.md](./archive/sprints/PERF_SPRINT_P1.md) · [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql)

---

### May 2026 — Sprint 14 manual smoke bugs (fix before launch)

**Decision:** Two issues from manual smoke §1–7 (2026-05-23) must be fixed before LAUNCH_CHECKLIST Section 1 is fully signed off:

1. **Admin Portal in consumer sidebar** — consumers must never see admin navigation; gate on profile `role` (or equivalent) in dashboard shell.
2. **Asset add form save button** — must be reachable without browser zoom; use scrollable form body and/or sticky footer for primary save action.

**Post-launch (not blocking):** Dashboard initial load and post-profile-save render slowness — track as performance work after launch.

**Completed same sprint:** `consumer-core-recompute.spec.ts` (`93aa6f5`); manual sign-off `1e092d7`.

---

### May 2026 — Sprint 13 smoke test purpose: find launch blockers before feature freeze ends

**Decision:** Sprint 13 success is measured by staging verification (migrations, E2E, acquisition smoke A–G),
not by shipping new pillars. Two blockers were found and fixed during Sprint 13 manual smoke: (1) `rmd-start-age`
event copy hardcoded age 73 despite `getRmdStartAge()` supporting 72/73/75; (2) `advisor_directory` lacked
`referral_code` auto-generation on insert (migration `20260601000000`).

**Sprint 14:** Feature freeze — planning smoke Core 1–7 on staging; fixes only from test failures.

---

### May 2026 — `rmd-start-age` event copy uses cohort range, not a single age

**Decision:** Public-facing copy for `/event/rmd-start-age` (hero, subhead, assessment, action plan,
drip emails, advisor/attorney newsletter labels) describes RMD start ages **72, 73, or 75** by birth
year. Do not state “RMDs begin at 73” in user-facing surfaces. **SEO** `title` / `seoDescription`
may still mention 73 where search intent targets that cohort.

**Reasoning:** `getRmdStartAge()` is cohort-accurate in engines; marketing copy that hardcodes 73
is wrong for born ≤1950 (72) and ≥1960 (75). Range copy prompts users to determine their age without
requiring household data on the event page.

**Age cron:** Still fires life events at 70 and 73 for urgency — separate from legal RMD start age in projections.

---

### May 2026 — Production environment variables are a Sprint 15 launch gate

**Decision:** Before Sprint 15 go-live (domain cutover), every Production env var in
[LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-required-before-sprint-15-go-live)
must be verified in the Vercel dashboard. `NEXT_PUBLIC_APP_URL` switches from the preview URL to
`https://mywealthmaps.com`. `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is set at launch only.
`RECOMPUTE_SECRET` must match the value in `.env.local` (shell-source `.env.local` with quoted values
if the secret contains `!` or `#`).

**Not in Vercel Production:** `SUPABASE_URL` — used only by local/staging seed scripts
(`seed-test-attorney`, `seed-test-consumer-estate`). Vercel’s Supabase integration sets URL/keys for deploys.

**Reasoning:** Missing `RECOMPUTE_SECRET` or wrong `NEXT_PUBLIC_APP_URL` silently breaks estate health
recompute and drip/referral links. A single checklist prevents ops drift between preview and production.

---

### May 2026 — "Referral loop proven" requires exact verification queries, not prose

**Decision:** The LAUNCH_CHECKLIST items "Advisor referral loop proven" and "Attorney referral
loop proven" must have exact Supabase verification queries documented before Sprint 14 begins.
Prose criteria ("a click has resolved correctly") are not sufficient for a launch gate.

**Advisor referral verified query (add to CONSUMER_RELEASE_SMOKE_TEST.md § Sprint 13):**

```sql
select rc.id, rc.referral_code, rc.listing_type, rc.advisor_directory_id, rc.created_at
from referral_clicks rc
where rc.listing_type = 'advisor'
order by rc.created_at desc
limit 5;
```

Pass = at least one row with a non-null `advisor_directory_id` and `referral_code` matching
an active row in `advisor_directory`.

**Attorney referral verified query:**

```sql
select rc.id, rc.referral_code, rc.listing_type, rc.attorney_listing_id, rc.created_at
from referral_clicks rc
where rc.listing_type = 'attorney'
order by rc.created_at desc
limit 5;
```

Pass = at least one row with non-null `attorney_listing_id`.

**Signup attribution verified query:**

```sql
select p.id, p.referral_code, p.attorney_referral_code, p.created_at
from profiles p
where p.referral_code is not null or p.attorney_referral_code is not null
order by p.created_at desc
limit 5;
```

Pass = at least one row with referral code matching a test signup.

---

### May 2026 — Event assessments separate from general assess; email capture before drip

**Decision:** Each life event page has its own 5-question assessment at `/event/[slug]/assess` (not the generic 20-question `/assess`). Anonymous users can submit email via `POST /api/email-capture` to receive a checklist; logged-in users persist to `assessment_results` with event metadata in `answers` JSONB. Email drip sequences deferred until ESP is chosen.

**Reasoning:** Event-specific questions increase relevance and conversion from SEO landing pages. Separating routes keeps the general assess as the full planning readiness funnel while event pages stay focused. Email capture stores leads immediately without blocking on drip infrastructure.

**Alternatives considered:** Single `/assess` with event query param (rejected — harder to share/bookmark per event). Dedicated `event_slug` column on `assessment_results` (deferred — JSONB metadata sufficient for Sprint 2).

---

### May 2026 — Target segment defined as $2M–$30M specifically

**Decision:** Focus exclusively on households with $2M–$30M in assets. Do not optimize for mass-market simplicity (under $500K) or ultra-HNW complexity (over $30M).

**Reasoning:** This is the only segment that is genuinely underserved today. Below $2M, LegalZoom and consumer robo-advisors are adequate. Above $30M, family offices and private banks serve the need expensively. The $2M–$30M band has complex enough finances to need real planning but no coordinated tool built for them. Over 50% have no will or plan at all. The complexity of the product (GRAT/SLAT modeling, state estate tax calculations, horizon projections) is a competitive advantage in this segment, not a UX problem.

**Alternatives considered:** Building for the mass market and growing upmarket (rejected — the product's complexity would feel overwhelming to simple-estate users, and the competitive field is crowded). Building for $30M+ (rejected — family office needs are fundamentally different and the competitive resources required are much larger).

**Implication for UX:** Never simplify features to the point of removing depth. Add guided context instead.

---

### May 2026 — Complexity is a feature, not a bug

**Decision:** Retain full technical depth in Transfer Strategy forms (GRAT §7520 Rate, Death Year, Rolling GRATs #, etc.). Add guided context (tooltips explaining what each field means, current IRS rates auto-populated where possible) but do not hide parameters behind "Advanced settings" or remove them for consumer-facing views.

**Reasoning:** A business owner modeling a GRAT before a $12M business sale wants to understand the mechanism. They've been paying $500/hour for attorneys to explain this. A tool that lets them model it themselves and bring the model to their advisor for refinement is worth real money. Hiding the depth would make the tool feel like it was built for a different audience.

**Alternatives considered:** Hiding advanced parameters behind "Advanced settings" disclosure (rejected — this segment will leave a tool that feels dumbed down). Advisor-only access to modeling depth (rejected — self-guided modeling is our core differentiation).

---

### May 2026 — Public site and app are separate navigation zones

**Decision:** Public site (education, assessment, find advisor/attorney, pricing) uses a clean top nav with no sidebar. Authenticated app uses a sidebar with planning groups only and zero public-site links.

**Reasoning:** The two zones serve fundamentally different audiences and goals. The public site has one goal: convert visitors to accounts. The app has one goal: help subscribers plan. Mixing them creates a sidebar with 30+ items that dilutes both experiences. Public content (Education Guide, Planning Assessment, Find an Advisor) does not belong in the planning nav for a paid subscriber who is in the middle of modeling their estate tax.

**Alternatives considered:** Keeping everything in one sidebar (rejected — overcrowded, confuses the planning experience, makes tier structure harder to see). Moving public content to a separate subdomain (acceptable but not required — route group separation in Next.js is sufficient).

---

### May 2026 — Advisor and attorney are distribution partners, not competitors

**Decision:** Position advisor and attorney relationships as the primary professional network that the product serves, not as alternatives to the product. "Invite your advisor" is a primary onboarding step. Advisors receive event context on new client connections. Attorneys get attorney-ready exports.

**Reasoning:** This segment already has or wants relationships with advisors and attorneys. A client who arrives with a completed household data profile and specific questions about GRAT vs SLAT timing can do a $3,000 meeting in 90 minutes instead of 3 hours. That advisor becomes our best salesperson. The referral flywheel (advisor refers client → client connects advisor → advisor recommends strategies → estate health improves → advisor looks good → advisor refers more clients) is the moat that competitors can't easily replicate.

**Alternatives considered:** Treating advisor/attorney as peripheral connection features (rejected — misses the primary distribution opportunity and the retention mechanism). Competing with advisors by providing advice (rejected — we are a planning and coordination tool, not a licensed advisor).

---

### May 2026 — Life events are the primary acquisition mechanism

**Decision:** Build event-specific landing pages for the 8 highest-priority life events (business sale, death of spouse, serious diagnosis, inheritance, divorce, approaching retirement, large RSU vest, new child). Each page targets "$2M–$30M" consequences specifically, has a 5-question event-specific assessment, and gates the full result behind account creation.

**Reasoning:** Nobody wakes up wanting estate planning software. They wake up having just sold a business or lost a parent. Life event searches ("estate planning after selling a business," "what happens to my estate if I get divorced") have high intent and low competition from mass-market tools that don't address this segment's complexity. The assessment creates personalized urgency using the user's own answers before they've created an account.

**Alternatives considered:** Generic content marketing (lower conversion intent). Paid acquisition only (no organic compounding). Building the event system after launch (rejected — life events are the front door; the public site without them is just another generic wealth management landing page).

---

### May 2026 — Dashboard conflict alerts must be above the fold

**Decision:** The "1 critical · 3 warnings" conflict alert system must be visible on the dashboard without scrolling. **Current (2026-05-30):** severity pill chips in **`DashboardIntroSection`** under the greeting — single above-the-fold surface; mid-page dismissible banner removed as duplicate. Titling badges in **`EstateSummarySection`** collapsible link to `/titling` for detail.

**Reasoning:** The named conflict alerts ("4 accounts missing beneficiaries: Yukon Denali 2019, Kubota Tractor and Accessories…") are the most valuable content on the dashboard and in the product. They demonstrate immediately that the tool understands the user's specific situation. Currently they require 3–4 scrolls to reach, which means most users never see them. No new feature is needed — just surfacing.

**Alternatives considered:** Keeping the current scroll order (rejected — the most valuable content is hidden). Replacing the score card with conflicts (rejected — the score provides important orientation context; both can coexist with the banner approach).

---

### May 2026 — Horizons page layout: cards → comparison table

**Decision:** Redesign the Estate Value and Tax Horizons page from a card-per-column layout to a comparison table with labels on the left and four value columns (Today / In 10 Years / In 20 Years / At Death). "Est. total estate tax liability" moves to a hero row at the top of the table, not the bottom.

**Reasoning:** The four columns currently repeat 8–9 identical labels four times. A user comparing across columns has to read the same label four times to find the values they want. The Scenarios page already uses the correct pattern (labels once on left, values in columns, best value highlighted) — this is a proven pattern in the product. The total tax liability number is the single most important number on the page and should not be the last item the user reads.

**Alternatives considered:** Keeping the card layout with summary numbers at the top of each card (partially implemented in revised design — hero cards show only the tax liability number, table handles the detail). Removing the column breakdown entirely in favor of a single timeline chart (rejected — the specific year breakdowns are important for planning decisions).

---

### June 2026 — ingestion_jobs column consolidation (Sprint F-1 cleanup)

**Decision:** Consolidate `ingestion_jobs` to a single 14-column schema: `file_name` and `file_type` (NOT NULL) replace legacy `original_filename` / `source_format` duplicates. Production cleanup applied via SQL; migration file rewritten to match.

**Reasoning:** Dual column names caused Postgres 23502 (NOT NULL on legacy columns) and PGRST204 (updates referencing columns missing on patched tables). One canonical name per concept simplifies code and PostgREST schema cache.

---

### June 2026 — Financial data import: CSV/XLSX only (Sprint F-1)

**Decision:** Ship bulk financial import at `/import` for **CSV and Excel only** (`.csv`, `.xlsx`, `.xls`). Defer PDF/DOCX parsing post-launch.

**Reasoning:** Tabular formats produce reliable header detection and field mapping. PDF/DOCX require best-effort text extraction with unreliable column structure — bad UX for a data-entry accelerator aimed at retirement-tier users getting data in quickly.

**Implication:** Tier 2 gate. Final schema uses `file_name` + `file_type` (NOT NULL). Smoke verified: 4 asset rows committed.

---

### May 2026 — Do not delete data on consumer→advisor plan change (Sprint C-6)

**Decision:** When Stripe fires `customer.subscription.deleted` on a cancelled consumer subscription, do **not** schedule WCPA deletion if (1) the same Stripe customer has another active or trialing subscription, or (2) the profile role is `advisor`, `financial_advisor`, `attorney`, or `admin`. The daily `process-deletions` cron re-checks both conditions and cancels pending schedules instead of executing.

**Reasoning:** Plan upgrades cancel the old subscription while a new one is created on the same customer. Scheduling deletion would destroy a paying advisor’s household data.

**Implication:** `lib/compliance/deletionGuards.ts`, `scheduleDeletionOnCancel.ts`, webhook + cron. Documented in [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) and [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

---

### May 2026 — Compliance cron alerts + privacy intake (Sprint C-7)

**Decision:** Daily `compliance-reminders` cron emails `COMPLIANCE_EMAIL` (`avoels@comcast.net`) only when checks fail (overdue deletions, deletion failures in 7d, privacy requests due within 7d) or on the 1st of the month (monthly summary). All-clear days send no email. WCPA requests tracked in `privacy_requests` with 45-day SLA; consumer intake at `/settings/security`.

**Reasoning:** Alert fatigue undermines compliance culture; a single ops inbox is sufficient pre-scale. `due_at` uses column DEFAULT not GENERATED — Postgres rejects `(received_at + interval)` as non-immutable.

**Implication:** `ddbf079`, `1ce9110`. Manual cron tests must use `https://www.mywealthmaps.com` — apex 307 to www drops `Authorization` on redirect.

---

### May 2026 — Cron tests use www host (ops)

**Decision:** Document and use `https://www.mywealthmaps.com` for manual cron `curl` tests, not the apex domain.

**Reasoning:** Vercel redirects apex → www; curl does not resend `Authorization` on cross-host redirect → spurious 401.

---

### May 2026 — Import commit succeeds when all rows are duplicates (Sprint F-2)

**Decision:** When `skip_duplicates` is true and every row matches an existing record, `POST /api/import/commit` returns **200** with `success: true`, `committed: 0`, and `skipped` count — not 400.

**Reasoning:** User explicitly chose to skip duplicates; an empty insert is a valid outcome, not a mapping failure.

**Implication:** Covered by `consumer-import.spec.ts` (`a344032`).

---

### June 2026 — Education fully public; double sticky nav fix

**Decision:** `/education/*` is fully public (no login redirect). Marketing `PublicNav` and footer are skipped on education routes; education layout provides its own sticky header. Unpublished modules (`published: false`) return 404 via `getEducationModule()`. Decision-tree suggested paths link to real module URLs.

**Reasoning:** Auth gate blocked anonymous catalog browse and broke sidebar → education flow for logged-out visitors. Stacking marketing nav + education header (both `position: sticky; top: 0; z-index: 100`) pushed education chrome below the fold on scroll, made back navigation unreachable on mobile, and intercepted clicks on module cards.

**Implication:** Run `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs` after education content changes. See [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) P.4, P.10.

---

### May 2026 — Sprint 1: public routes in `(public)` route group, not dashboard sidebar

**Decision:** Move `/education`, `/assess`, `/find-advisor`, and `/find-attorney` to `app/(public)/` with a passthrough layout (no dashboard sidebar). Remove those links from the app sidebar Overview group. Keep education auth-gated in its nested layout.

**Reasoning:** Public discovery and planning app are different mental models. Mixing them in the sidebar made the app feel like a marketing site. URLs stay the same; only layout grouping changes. Marketing top nav on `(public)` is deferred to Sprint 2 — education and directories already render their own headers.

**Alternatives considered:** Leaving routes at `app/` root and `app/(education)/` (rejected — inconsistent route groups). Deleting page components (rejected — breaks bookmarks and SEO).

**Implication:** `CONSUMER_NAV_MAP.md` and `middleware.ts` `PUBLIC_PATHS` must stay aligned. `/education` is in `PUBLIC_PATHS` (anonymous catalog browse allowed). Education auth gate removed 2026-06 — see entry above.

---

### May 2026 — Life event content in TypeScript, not MDX (v1)

**Decision:** Ship Sprint 2 event pages with content in `lib/events/content.ts` (typed `EventContent` records), not MDX files under `content/events/`.

**Reasoning:** Faster to ship eight complete pages with actions, assessment questions, and SEO fields in one reviewable module. No `@next/mdx` setup required. Matches education’s pattern (markdown elsewhere, app-layer rendering).

**Alternatives considered:** MDX per `ROADMAP.md` original spec (deferred). CMS / database-driven events (deferred to Sprint 3+ in-app logging).

---

### May 2026 — `advisor_directory` is the canonical advisor listing table

**Decision:** All advisor listing, connection, and referral resolution uses `advisor_directory` keyed by `profile_id` (professional's auth user id). Do not introduce or query `advisor_listings`.

**Reasoning:** Find-advisor, register, my-advisor, and referral tracking were split across table names; a single canonical table prevents ghost schema and broken referral FKs.

**Implementation:** Migration `20260522000000_advisor_referrals.sql`; `referral_clicks.listing_id` → `advisor_directory(id)`.

**Implication:** All listing/referral queries use `profile_id`, not `advisor_id`, on `advisor_directory`.

---

### May 2026 — Dual analytics: Vercel page views + custom `funnel_events`

**Decision:** Use `@vercel/analytics` for automatic route page views and a separate `funnel_events` table + `/api/analytics/funnel` for conversion steps (assess, email, signup, tier, advisor connect).

**Reasoning:** Vercel Analytics does not capture custom funnel steps or join to `referral_code` / `event_slug`. Product needs SQL-queryable events for A/B analysis and advisor attribution. Client capture is fire-and-forget (`captureFunnelEvent`) so analytics never blocks UX.

**Alternatives considered:** Vercel only (rejected — insufficient for funnel). PostHog/Mixpanel (deferred — Supabase keeps data in-house).

---

### May 2026 — A/B tests via `app_config`, not feature flags service

**Decision:** Store `ab_upgrade_copy` and `ab_assessment_gate` in `app_config`. Toggle values in Supabase dashboard without deploy.

**Reasoning:** Two experiments for Sprint 5; no need for LaunchDarkly-style infra. `getAssessmentGateVariant()` / `getUpgradeCopyVariant()` read at request time on server paths.

**Measurement:** Compare `funnel_events` and conversion rates grouped by variant (store variant in `properties` when needed).

---

### May 2026 — Event content split: `content.ts` + `content-sprint5.ts`

**Decision:** Keep original 8 events in `lib/events/content.ts`; add 16 Sprint 5 events in `lib/events/content-sprint5.ts`; merge via spread into `EVENT_CONTENT`.

**Reasoning:** Single 3k-line file is hard to review and merge. `EVENT_SLUGS = Object.keys(EVENT_CONTENT)` still drives SSG without code changes to `generateStaticParams`.

---

### May 2026 — Idempotent RLS policies in migrations

**Decision:** Wrap `create policy` statements in `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_policies …)` blocks for `life_events`, `referral_clicks`, and `funnel_events`.

**Reasoning:** Migrations were applied manually in Supabase before `supabase db push`; re-run must not fail on duplicate policy names. Tables/indexes already use `IF NOT EXISTS`.

---

### May 2026 — `/assess` server wrapper for assessment A/B gate

**Decision:** Split `app/(public)/assess/page.tsx` into server page (reads `ab_assessment_gate`) + `_assess-client.tsx` (client UI).

**Reasoning:** Gate variant must be read server-side from `app_config`; the assess UI is a large client component. `full_gate` hides scores for logged-out users; `score_visible` keeps current behavior.

---

### May 2026 — `NEXT_PUBLIC_APP_URL` as canonical public base URL

**Decision:** Use `NEXT_PUBLIC_APP_URL` for sitemap, robots, drip links, and new email CTAs. Production value: `https://estate-planner-gules.vercel.app` until domain cutover to `https://mywealthmaps.com`.

**Reasoning:** One env var avoids drift between `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` in emails and SEO metadata.

**Alternatives considered:** Hardcoding production URL in sitemap (rejected — breaks preview/staging). Keeping both env vars forever (accepted short-term; converge on `NEXT_PUBLIC_APP_URL` for new code).

---

### May 2026 — Resend drip with `INTERNAL_API_KEY`

**Decision:** Implement 3-email drip via Resend: step 1 immediately on `POST /api/email-capture`; steps 2–3 in daily notifications cron; templates in `lib/emails/drip-templates.ts` (default + 3 event-specific sequences). Internal calls authenticate with `x-internal-key: INTERNAL_API_KEY` (cron may also use `CRON_SECRET` on drip route).

**Reasoning:** ESP was deferred in Sprint 2; Resend already used for advisor/attorney connect emails. Non-blocking fetch on capture keeps API fast. `(email, source)` uniqueness drives per-capture drip state columns.

**Alternatives considered:** Dedicated drip cron route (deferred — folded into notifications cron job 7). Dedicated `event_slug` column on `email_captures` (deferred — parse from `source` prefix `event-assess-`).

---

### May 2026 — Admin funnel reads via service role

**Decision:** Admin funnel tab fetches `funnel_events` with `createAdminClient()`, not the user-scoped Supabase server client.

**Reasoning:** `funnel_events` RLS allows users to read only their own rows; admins would see empty data otherwise.

---

### May 2026 — Per-age calendar triggers use dedicated event slugs

**Decision:** Age cron (`/api/cron/age-triggers`) maps 62 → `social-security-timing`, 65 → `medicare-eligibility`, 70 and 73 → `rmd-start-age` instead of a single `approaching-retirement` slug for all milestones.

**Reasoning:** Dedicated event pages and drip/upgrade copy exist for each milestone; users see relevant content and advisors can share matching referral URLs.

**Alternatives considered:** Keep one slug and branch copy in-app only — rejected because 24-slug content model is already live.

---

### May 2026 — Advisor newsletter kit on portal (not email blast product)

**Decision:** Ship copy-paste newsletter kit in `app/advisor/_advisor-client.tsx` (grouped links, HTML email template, plain text) using `buildAllEventReferralUrls` for all 24 slugs. No automated email send from MWM to advisor list.

**Reasoning:** Advisors distribute through their own ESP; we provide assets and tracked links without storing advisor subscriber lists.

---

### May 2026 — One custom drip sequence per event slug (24 total)

**Decision:** Expand `DripEventSlug` and `EVENT_SEQUENCES` to cover all 24 life event pages. Keep `DEFAULT_SEQUENCE` only as fallback for unknown slugs.

**Reasoning:** Launch checklist required parity with public event content; age-milestone slugs (`rmd-start-age`, `medicare-eligibility`, `social-security-timing`) should match age-trigger cron messaging in drip emails.

**Implementation:** `lib/emails/drip-templates.ts` (Sprint 9).

---

### May 2026 — Signup persists both referral codes on `profiles`

**Decision:** On account creation, write `profiles.referral_code` (advisor `?ref=`) and `profiles.attorney_referral_code` (attorney `?aref=`) from sessionStorage once; mirror both in `funnel_events.properties` on `account_created`. Fire-and-forget profile update so navigation is never blocked. If both codes exist, persist both.

**Reasoning:** Funnel rows alone are hard to join for CRM-style reporting; profile columns enable durable joins to `advisor_directory` and `attorney_listings`.

**Implementation:** `20260529000000_profiles_referral_attribution.sql`; `app/(auth)/signup/_signup-form.tsx`.

---

### May 2026 — Attorney referrals use `?aref=` (separate from advisor `?ref=`)

**Decision:** Attorney event attribution uses query param `?aref=` and `referral_clicks.listing_type = 'attorney'`. Advisor `?ref=` behaviour is unchanged. Extend `referral_clicks` with `attorney_listing_id` and `attorney_profile_id` rather than a second click table.

**Reasoning:** Avoids overloading `?ref=` resolution (advisor vs attorney codes could collide). Mirrors `connection_requests.listing_type` pattern. Keeps one click ledger for admin SQL.

**Implementation:** `20260528000000_attorney_referrals.sql`; `POST /api/referral/track` with `type`; session keys `mwm_attorney_referral_code`.

---

### May 2026 — Centralized RMD start age (SECURE Act birth-year cohorts)

**Decision:** Single source of truth `getRmdStartAge(birthYear)` in `lib/calculations/rmdStartAge.ts`: age **72** (born 1950 or earlier), **73** (1951–1959), **75** (1960 or later). All engines and UI surfaces import this helper; advisor client Retirement tab uses **per-person** birth year (fixes hardcoded age 73).

**Reasoning:** Alan Voels (born 1960) and others in the 1960+ cohort must see RMD at **75**, not 73. Duplicated inline `>= 1960 ? 75 : 73` logic missed the pre-1951 age-72 cohort and left advisor Retirement messaging wrong.

**Implementation:** `rmdStartAge.ts`; consumers include `projection-complete.ts`, `lib/calculations/rmd.ts`, `lib/dashboard/calculations.ts`, `lib/monte-carlo.ts`, `app/(dashboard)/rmd/_rmd-client.tsx`, `app/advisor/clients/[clientId]/_tabs/RetirementTab.tsx`, `app/admin/debug-tab.tsx`.

**Note:** Age cron still fires `rmd-start-age` life events at ages **70** and **73** for marketing urgency; that is separate from when RMDs are **required** in projection math.

---

### May 2026 — Prospect Mode state tax path (no household RPC)

**Decision:** Prospect Mode (`/prospect`, `GET /api/advisor/prospect-pdf`) computes state estate tax via `calculateStateEstateTax` in `lib/calculations/stateEstateTax.ts` with rows from `state_estate_tax_rules`. It does **not** call the `calculate_state_estate_tax(p_household_id)` SQL RPC.

**Reasoning:** Prospect inputs are anonymous ranges — there is no household, so the RPC signature cannot apply. The TypeScript engine mirrors the RPC logic and is the same source used elsewhere for bracket-based state tax.

**Implementation:** `lib/prospect/calculateProspectSummary.ts`, `lib/prospect/getProspectTaxConfig.ts` (federal from `federal_tax_config` with OBBBA / sunset fallbacks).

---

### May 2026 — Prospect intake CTA reuses attorney send-intake route

**Decision:** Advisors send prospect intake invitations via existing `POST /api/attorney/send-intake-request`. Role guard accepts `advisor` in addition to attorney. Free-tier 5/month cap remains **attorney-only** (`attorney_tier === 0`).

**Reasoning:** Same email template, token flow, and `attorney_intake_requests` table; avoids duplicate route. Advisor name in email comes from `profiles.full_name`.

---

### May 2026 — Mobile review mode is additive (desktop-first)

**Decision:** Mobile changes are review-only: alert banner (`< lg`), stacked Accept/Decline on advisor recommendations, horizontal scroll on wide tables (projections, RMD, scenarios). No rebuild of planning surfaces for mobile.

**Reasoning:** Professionals and consumers primarily review numbers, alerts, and recs on phone; full modeling stays desktop-first.

**Implementation:** `_dashboard-client.tsx`, `StrategyRecommendationPanel.tsx`, table wrappers in projections/RMD/scenarios clients.

---

### May 2026 — Waitlist mode gates public signup pre-launch (Sprint 15)

**Decision:** While the marketing site is live but not yet accepting accounts, public signup is disabled via env flags. Visitors to `/signup` or public **Get started** CTAs see `/waitlist` (email capture only). Invite/token signup flows bypass the gate (`?invite=`, `?invite_token=` + `?firm_id=`, `?connectionToken=`).

**Reasoning:** Allow domain cutover, SEO prep, and drip testing without open self-serve signup. Runtime redirect in `middleware.ts` avoids stale static `/signup` when env vars change after build.

**Implementation:** `lib/waitlist-mode.ts`, `middleware.ts` (renamed from `proxy.ts` in `3ceb125`), `app/(public)/waitlist/`, `app/(auth)/signup/page.tsx` (`force-dynamic`), `getSignupHref()` on public CTAs, `POST /api/email-capture` skips drip for `source: 'waitlist'`. Default on when `VERCEL_ENV=production`.

**At go-live:** Set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production, redeploy, verify `/signup` open. To re-enable waitlist, remove the var and redeploy. See [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip).

---

### June 2026 — Private beta signup links while waitlist stays on

**Decision:** Allow selected friends to self-serve signup via a secret URL (`/signup?access=TOKEN&label=cohort`) without opening public signup (`PUBLIC_SIGNUP_OPEN`). Token is server-only (`BETA_SIGNUP_TOKEN`); optional `label` tags cohorts for monitoring.

**Reasoning:** Admin-created accounts (Option A) do not scale for a small friend beta. The legacy `?connectionToken=` bypass had no attribution. Secret links are shareable, revocable (rotate token), and instrumented in `funnel_events`.

**Implementation:** `lib/waitlist-mode.ts` (`isValidBetaSignupAccessToken`, cookies), `middleware.ts` (bypass + HttpOnly cookies), `app/(auth)/signup/_beta-signup-tracker.tsx`, `_signup-form.tsx` (`signup_source: beta_access_link`), admin **Funnel** tab cohort table + SQL cheat sheet. See [LAUNCH_CHECKLIST.md § Private beta signup](./LAUNCH_CHECKLIST.md).

**Revoke:** Change `BETA_SIGNUP_TOKEN` in Vercel and redeploy; existing cookies valid up to 30 days.

---

### May 2026 — Block all crawlers pre-launch

**Decision:** `app/robots.ts` returns `disallow: /` for `userAgent: *` and omits the `sitemap` URL until product launch. `app/sitemap.ts` stays in the codebase. Google Search Console setup deferred.

**Reasoning:** Avoid indexing staging/Vercel URL and incomplete public surfaces before `mywealthmaps.com` cutover. Sitemap and verification (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) are ready to enable in one launch checklist.

**At launch:** See [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) for the full task list.

---

### May 2026 — My Wealth Maps design system + Tailwind v4 color syntax

**Decision:** Brand UI uses `--mwm-*` CSS tokens in `app/globals.css`, shared primitives (`Button`, `Card`, `SectionHeader`, `form`), and authenticated sidebar chrome (navy active + gold left accent). Arbitrary Tailwind color classes must use the v4 `color:` prefix.

**Reasoning:** Replaces PlanWise/indigo leftovers; silent failure in Tailwind v4 without `color:` caused invisible gold borders and plain-text banner links.

**Alternatives considered:** Hardcoded hex in components (rejected); staying on Tailwind v3 syntax (not compatible with Next 16 stack).

**Implication:** Phase 3 page sweep must use `CURSOR_PROMPT_TEMPLATE.md` replacements with `color:` on every arbitrary color utility.

---

### May 2026 — Advisor Tax tab: horizon state tax is source of truth (not local recompute)

**Decision:** On the advisor Tax and Domicile tabs, current-law state estate tax in `FederalStateWaterfall` and the current-year row in `StateTaxPanel` must use `advisorHorizons.today.stateTax` when available. Year-by-year projection rows may use `outputs_s2_first` gross estate but must be labeled as the surviving-spouse timeline, with Today vs At death horizon callouts when horizons exist.

**Reasoning:** A local bracket recompute in the waterfall could return $0 while `buildStrategyHorizons` already computed correct WA tax via `calculateStateEstateTax`. MFJ was also mis-detected when DB stored `married_filing_jointly`. Users reported federal/state waterfall showing $0 state tax while State Tax Detail showed higher estimates.

**Alternatives considered:** Recompute everywhere in UI (rejected — duplicates engine, drifts from Strategy tab). Hide projection table (rejected — advisors need year context with clear labels).

**Implication:** New advisor tax UI must not add a third state-tax code path; extend horizons or `StateTaxPanel` props. See calculation audit table in [MASTER_ARCHITECTURE.md § Calculation consistency audit](./MASTER_ARCHITECTURE.md#calculation-consistency-audit-2026-05-26).

---

### May 2026 — Persona onboarding gate uses wizard-ready profile

**Decision:** `/onboarding/persona` server gate uses `isWizardReadyProfile` (state, filing status, birth year) — not full `isMinimumViableProfile` (which also requires `person1_name`).

**Reasoning:** Persona selection follows demographics capture; a partial household SELECT on the persona page caused false redirects to `/profile?required=true` when `person1_name` was omitted from the query object even though the DB row was complete.

**Implication:** Estate planning pages and `requireMinimumViableProfile` still require name; persona/wizard funnel uses wizard-ready checks. E2E: `tests/e2e/consumer/onboarding-persona.spec.ts`.

---

### May 2026 — Cross-household isolation tests accept 403 or 404

**Decision:** Playwright IDOR matrix specs treat **403 Forbidden** and **404 Not Found** as successful denial for foreign household reads (`gifting-summary`, `estate-composition`, `export-estate-plan`).

**Reasoning:** API routes return 404 when `access.reason === 'not_found'` to avoid leaking household existence; 403 when explicitly forbidden.

**Implication:** Do not treat prod 404s on these routes during isolation test runs as broken routes. Spec: `tests/e2e/security/cross-household-isolation.spec.ts`.

---

### May 2026 — App Router slug conflict CI guard

**Decision:** CI runs `npx tsx scripts/verify-app-route-slugs.ts` on every push; fails if conflicting dynamic segments exist at the same path depth (Next.js 16 may build while Vercel silently hangs all `/api/*` handlers).

**Reasoning:** Root cause of May 2026 prod outage — `[household_id]` vs `[id]` under `/api/documents/`.

**Implication:** New API routes must not introduce sibling dynamic param names at the same depth.

---

### June 2026 — State estate tax content: two data stores

**Decision:** Public `/learn/[state]-estate-tax` pages read from `state_estate_tax_content` (admin-editable, seeded for 13 states). Engine B household calculations continue using `stateEstateTax.ts` / `state_estate_tax_rules` — these are not merged.

**Reasoning:** Marketing/educational bracket copy and worked examples serve SEO and advisor leave-behinds; calculation engine needs tax-year precision and RPC integration. A single table would couple content edits to engine regressions.

**Implication:** Admin “State tax content” tab edits public pages only. Tax Rules tab + Engine B remain the calculation source of truth.

---

### June 2026 — WA estate tax SEO: `/learn` path (not `/blog`)

**Decision:** Washington estate tax explainer ships at `/learn/washington-estate-tax` with a `/learn` index — not under `/blog/*`. Cross-page internal links from homepage hero, `/assess`, and four estate-relevant event slugs (`death-of-spouse`, `receiving-inheritance`, `approaching-retirement`, `selling-a-business`). Sitemap priority 0.8 for the explainer; 0.7 for `/learn`. Cold-email leave-behind PDF links to `mywealthmaps.com/learn/washington-estate-tax`.

**Reasoning:** Pre-launch domain is not indexed yet; the page must exist at launch (not post-launch) with meta title/description targeting “Washington state estate tax 2026”, “WA estate tax exemption”, and “bypass trust Washington”. `/learn` signals durable educational content vs ephemeral blog posts — aligned with platform identity and advisor outreach sequencing.

**Alternatives considered:** `/blog/washington-estate-tax` (rejected — weaker evergreen authority signal). Post-launch page add (rejected — misses day-one indexing window).

**Implication:** Future state-specific explainers belong under `/learn/*`. `app/(public)/layout.tsx` skips `PublicNav` on `/learn/*` (same pattern as `/education/*`). `middleware.ts` `PUBLIC_PATHS` includes `/learn`.

---

### June 2026 — `/learn` discovery: separate nav link from `/education`

**Decision:** Add **State tax guides** → `/learn` in `PublicNav` alongside existing **Education** → `/education`. Homepage gets a state-estate-tax featured card (not WA-only hero copy). `/estate-tax` adds a single in-app text link to `/learn/[slug]` when `household.state_primary` is in `STATE_SLUG_MAP`. Extend `StateEstateTaxCallout` to all 13 estate-tax states.

**Reasoning:** `/education` (interactive modules) and `/learn` (state estate tax long-form guides) are different surfaces; users clicking Education never reached `/learn`. In-app link on `/estate-tax` is the natural advisor→client hand-off to plain-language guides.

**Alternatives considered:** Merge `/learn` into `/education` index (rejected — different content model and layout chrome). Geolocation for state (rejected — unreliable).

**Implication:** `STATE_SLUG_MAP` remains the only source of truth for which states have guides. No changes to Engine B or `state_estate_tax_content` schema.

---

### June 2026 — Pricing surfaces aligned to `lib/tiers.ts` + firm seat billing reconciliation

**Decision:** All public and in-app pricing surfaces read advisor/attorney/consumer prices from `lib/tiers.ts` and `lib/billing/stripePrices.ts`. Advisor firms bill **per seat** via `POST /api/stripe/firm-checkout` (not legacy client-count checkout). Enterprise advisor floor locked at **$89/seat/mo**. Attorney billing remains flat tier + client cap (no seat quantity).

**Reasoning:** `/pricing` still showed legacy $159/$299/$499 client-count advisor plans while checkout used firm per-seat IDs — a go-live blocker. Seat count must match Stripe quantity and `firms.seat_count` for ongoing invite/remove sync via `syncFirmStripeQuantity`.

**Checkout routing:**
- Consumer → `POST /api/stripe/checkout` (validates price ID against `STRIPE_PRICES` only)
- Advisor firm → `POST /api/stripe/firm-checkout` with `{ priceId, seatCount }`; tier-band max 10 / 50 / 250
- Attorney → `POST /api/stripe/attorney-checkout` with `{ planKey }` (quantity 1)

**Seat reconciliation:** On firm `checkout.session.completed`, webhook sets `firms.seat_count` from Stripe subscription line-item quantity. Ongoing roster changes update `firms.seat_count` on invite/remove and push to Stripe via `syncFirmStripeQuantity`.

**UI:** Seat pickers on `/pricing` (Starter/Growth) and `/billing` (firm owner pre-subscribe). Enterprise → mailto contact.

**Implication:** Wire `STRIPE_PRICE_ADVISOR_*` env vars and live price IDs before production. Legacy `lib/advisor/advisorClientLimits.ts` client-count caps may still apply to individual advisor invites — separate from firm seat billing; revisit post-launch.

---

### June 2026 — Legal entity: `lib/legal/company.ts` single source of truth

**Decision:** Centralize **My Wealth Maps LLC**, mailing address (22033 Echo Lake Rd, Snohomish, WA 98296), and registered agent (Alan Voels, same address) in `lib/legal/company.ts`. Terms, Privacy, and formal copyright lines import from this module. Consumer-facing brand copy remains **My Wealth Maps** (d/b/a in legal docs).

**Reasoning:** Replaces scattered `TODO: [COMPANY LEGAL NAME]` placeholders before go-live; one file to update if counsel revises address or agent.

**Implication:** Counsel sign-off on ToS §10/§11/§13 remains open in [LAUNCH_GATE.md](./LAUNCH_GATE.md). Do not edit historical migration `20260527120000` — live terms read from code.

---

### June 2026 — `/assess` state picker: dropdown + localStorage, not profile writes

**Decision:** Assessment intro shows a state picker (`StatePickerDropdown`) that drives `StateEstateTaxCallout`. Priority: `household.state_primary` (signed in) → `localStorage` key `mwm_selected_state` → null. Signed-in users with a profile state see static text + **change** link (dropdown hidden by default). Selection writes **localStorage only** — does not update `households.state_primary`.

**Reasoning:** Geolocation is unreliable. A dropdown early in the flow personalizes the callout without conflating assess exploration with profile updates. Static text + change link avoids confusing signed-in users who already set state in Profile.

**Alternatives considered:** Auto-write assess selection to profile (rejected — separate flows). Geolocation (rejected). Always show dropdown for signed-in users (rejected — profile confusion).

**Implication:** `useSelectedState` hook in `lib/learn/useSelectedState.ts`; full state list in `lib/learn/us-states.ts`. Future calculator surfaces can read the same `mwm_selected_state` key for anonymous users.

---

### June 2026 — Billing hardening: P0–P2 + polish + Playwright billing E2E

**Decision:** Three audit/fix cycles on consumer, advisor firm, and attorney billing — without changing locked price constants in `lib/tiers.ts` / `lib/billing/stripePrices.ts` (except `resolveConsumerTier` annual fallback and optional env overrides for advisor firm price IDs).

**Key behaviors:**
- Consumer checkout reuses Stripe customer; duplicate-sub guard when already active/trialing/canceling
- Firm seats billed on **join**, not invite; roster caps via `countFirmRosterSeats`
- Enterprise firm checkout API returns 403 (mailto-only in UI)
- Advisor **client** connections unlimited per B2B2C policy when firm sub active (not seat-tier client caps)
- Webhook: `canceling` state, firm `past_due` + owner profile sync, firm `subscription.updated` quantity/tier
- E2E: `npm run test:e2e:billing`; production signed webhook uses `PLAYWRIGHT_STRIPE_WEBHOOK_SECRET` (not local Stripe CLI secret)

**Reasoning:** Close gaps found in billing audits before go-live; keep Stripe quantity aligned with active roster; prevent double checkout and wrong-portal cancellations.

**Implication:** Re-run `npm run seed:e2e` so advisor has firm owner row. Deploy before billing E2E assertions pass on production.

---

### June 2026 — Billing E2E: production-safe assertions (not test-bundle price IDs)

**Decision:** Billing Playwright specs against production must let the **server** resolve Stripe price IDs — never send hardcoded test-mode `priceId` values from `getPriceConfig`. Consumer duplicate-sub uses `{ tier: 1, period: 'monthly' }`. Advisor firm starter uses `firmStarterPriceIdForE2e()` with optional `PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID` override; skip (not fail) when Stripe returns 500 or price ID mismatch. Attorney subscribe UI races `checkout.stripe.com` navigation vs in-page error — do not call `response.json()` after redirect.

**Reasoning:** Production E2E runs against live Stripe catalog on Vercel; test-bundle price IDs trigger `"Invalid plan"` or session-creation 500s unrelated to app guard logic.

**Alternatives considered:** Mock Stripe in E2E (rejected — smoke targets real deploy). Always fail on firm starter 500 (rejected — blocks suite when live price IDs need ops verification).

**Implication:** `tests/e2e/helpers/billing-e2e.ts`. Production `npm run test:e2e:billing`: 21 passed, 2 skipped (unsigned webhook + firm starter when Stripe rejects session).

---

### June 2026 — Production E2E smoke: `@production` tag subset

**Decision:** Tag 42 tests across 12 files with `@production` for post-deploy smoke against live production (`.env.test.prod`). Subset covers auth wiring, billing APIs, webhook signature, RLS isolation, critical public routes, and terms accept — not the full 395-test dev suite.

**Alternatives considered:** Run full `test:e2e:complete` on prod (rejected — slow, flaky, tests logic already covered locally). Separate prod spec files (rejected — duplicate maintenance).

**Implication:** `npm run test:e2e:prod:smoke` after every deploy; `npm run test:e2e:prod:billing` after Stripe config changes. Dry-run after Stripe review clears: fill `.env.test.prod`, `npm run seed:e2e:prod`, then smoke.

---

### June 2026 — Pre-launch DB perf: dashboard bundle loader (Phase 1)

**Decision:** Consolidate consumer dashboard server fetches into `loadDashboardBundle` (~22 parallel queries vs ~40+ scattered round trips). 60s per-household TTL cache; invalidate via single hook in `touchHousehold`. Household row passed from `page.tsx` — no module-level household singleton. Child loaders (`loadDashboardCoreInputs`, `loadDashboardRmdInputs`, `loadLatestInputChangeMs`) accept optional bundle slices for backward compatibility.

**Alternatives considered:** Postgres RPC single round-trip (deferred Phase 2). Module-level household state (rejected — prop pass + React `cache()` only).

**Implication:** Commits `523f28f`, `8776084`. Redeploy Vercel. Repeat dashboard loads within 60s on same instance skip refetch.

---

### June 2026 — Pre-launch DB perf: Monte Carlo `projection_inputs_hash`

**Decision:** Add `households.projection_inputs_hash` (nullable). On every `touchHousehold`, set hash to `NULL`. On successful `runEstateMonteCarloAsync`, write hash matching `computeProjectionInputsHash` (includes `person1_retirement_age`, `growth_rate_accumulation`, gross estate from projection, bypass trust, scenario id). Read path compares stored vs current hash; on mismatch serve stale `monte_carlo_results` + amber “updating” banner + background `triggerBackgroundBaseCaseAndRecompute`.

**Alternatives considered:** Compare only `assumption_hash` on `monte_carlo_results` row without household column (rejected — no hash before first precompute). Recompute hash on every write (rejected — null-on-write is cheaper and equally safe).

**Implication:** Migration `20260712120000`. Commit `5ad5622`. Existing rows: null hash → stale on first load → background regen (safe default).

---

### June 2026 — Go-live P1 performance (accuracy-safe)

**Decision:** Ship remaining launch-week perf items with explicit accuracy guards: scoped tax reference loader with prior-year fallback; shared `partitionStrategyLineItems` (same split as three legacy queries); debounced `triggerBackgroundBaseCaseAndRecompute` with in-flight lock; attorney recommendations cache-only with background recompute + banner (no silent empty state).

**Alternatives considered:** Materialized advisor staleness versioning (deferred post-launch).

**Implication:** Redeploy Vercel. Stale projection/composition may show briefly until background job completes — same contract as P0 projections path.

---

### June 2026 — Go-live P0 performance fixes (consumer / advisor / attorney)

**Decision:** Ship six P0 items from go-live perf audit: attorney server-prefetch composition + vault API access; export-estate-plan client `owner_id`; advisor lazy export payload API + tab-gated composition/MC/gifting; composition cache gift-usage invalidation; projections serve stale cache with background regen.

**Reasoning:** Attorney tax view and PDF export had accuracy bugs (403 / wrong owner queries). Advisor Strategy/Meeting Prep blocked TTFB on full export stack. Consumer pages paid full projection recompute and could serve stale composition after gifting changes.

**Implication:** Redeploy Vercel. Meeting Prep shows brief immediately; export panel loads client-side.

---

### June 2026 — Recompute dedupe: composition pass-through + alert batch upsert

**Decision:** (1) Reorder `/api/recompute-estate-health` to gifting → composition ×2 → `generate_estate_recommendations(p_composition)`; RPC reads `estimated_tax_federal` / `estimated_tax_state` from composition and drops nested `calculate_state_estate_tax`. (2) Add `upsert_household_alerts_batch`; inline `UPDATE` in `resolve_household_alerts_batch`. (3) Strategy/attorney planning loaders read `estate_health_scores.recommendations` cache (live RPC only on cold cache).

**Reasoning:** Recompute was calling `calculate_estate_composition` three times per household write (recommendations + consumer + advisor). Strategy and attorney client pages still hit live `generate_estate_recommendations` on every load. Conflict upserts were N HTTP RPCs per recompute.

**Alternatives considered:** Remove live RPC fallback entirely (deferred — cold-start empty state acceptable but needs UX copy). Vercel recompute coalescing (deferred — infra-heavy).

**Implication:** Migrations `20260709170000`, `20260709180000`, `20260709180100` applied via `db push`. Drop single-arg overload required for PostgREST. **Redeploy Vercel** for recompute route + `conflict-detector.ts` + `loadEstatePlanningDashboard.ts`.

---

### June 2026 — Supabase Disk IO: state tax RPC + batched alert resolve

**Decision:** Two migrations to cut Disk IO on hot paths: (1) optimize `calculate_state_estate_tax` with `idx_state_estate_tax_rules_state_tax_year` and indexed state+year filters instead of unfiltered year scans; (2) add `resolve_household_alerts_batch` and call it once from `detectConflicts` instead of six sequential `resolve_household_alert` HTTP RPCs.

**Reasoning:** Perf audit showed ~883 `calculate_state_estate_tax` calls with ~5 `state_estate_tax_rules` hits each, and ~24K `resolve_household_alert` client round trips from recompute. Batch RPC cuts network hops; state tax rewrite cuts redundant table access. Voels household verified post-migration (WA MFJ ~$261K state tax).

**Alternatives considered:** Full 9-index migration batch now (deferred — monitor Disk IO 24h first; `assets` seq scans may need separate investigation).

**Implication:** Migrations `20260709150000`, `20260709160000` applied via `db push`. Inline alert resolve shipped in `20260709180000`.

---

### June 2026 — E2E_SKIP_RECOMPUTE for local Playwright runs

**Decision:** Add `E2E_SKIP_RECOMPUTE=true` in `.env.test` to skip the debounced `/api/recompute-estate-health` HTTP call from `triggerEstateHealthRecompute`. Production and Vercel leave the flag unset. Playwright local `webServer` loads `.env.test` via dotenv so the Next server honors the flag.

**Reasoning:** Full local E2E (300+ tests) against staging Supabase was triggering recompute storms on every asset/strategy write, degrading Auth and Disk IO. Removing `RECOMPUTE_SECRET` entirely breaks recompute-specific tests; a dedicated skip preserves opt-in recompute verification.

**Alternatives considered:** Unset `RECOMPUTE_SECRET` in `.env.test` (too blunt). Split suite only (insufficient — write tests still hammer DB).

**Implication:** Day-to-day local runs use `E2E_SKIP_RECOMPUTE=true`. Recompute smoke specs run with flag `false` when explicitly needed.

---

### June 2026 — Import commit triggers household write hook

**Decision:** `POST /api/import/commit` calls `afterHouseholdWriteForOwner` after successful bulk insert, matching other financial write APIs.

**Reasoning:** Import was the only bulk financial write path that skipped `touchHousehold`, dashboard bundle invalidation, and background recompute — post-import dashboard showed stale composition.

**Alternatives considered:** Recompute-only without `touchHousehold` (rejected — bundle and `projection_inputs_hash` would stay stale).

**Implication:** Large spreadsheet imports now behave like manual asset saves for cache staleness.

---

### June 2026 — Security smoke: local vs prod API split

**Decision:** `npm run test:e2e:security-smoke` runs consumer RPC + advisor Monte Carlo against local/staging only. `npm run test:e2e:security-smoke:prod` adds `security-sprint-post-deploy.spec.ts` (production API + referral rate limit).

**Reasoning:** Local complete runs were hitting production API for referral rate-limit tests (65 POSTs) while also hammering staging DB — misleading failures and unnecessary prod load.

**Implication:** `release:preflight` and local gates use `security-smoke`; post-deploy checklist uses `security-smoke:prod`.

---

### June 2026 — Multi-state Privacy Policy (engineering draft)

**Decision:** Adopt unified all-U.S.-residents privacy posture — highest common denominator (CCPA/Virginia-model rights for everyone) with thin state addenda. Fix incorrect "Washington WCPA" attribution for privacy rights (WCPA = RCW 19.86 unfair practices, not privacy law).

**Reasoning:** HNW estate-planning audience; B2B2C across states; pre-launch below most thresholds but voluntary over-compliance reduces retrofit risk and builds trust. Washington-specific statutes retained where real: RCW 19.316 auto-renewal, RCW 19.255.010 breach notification.

**Implemented:** Policy rewrite + addenda, GPC cookie in middleware, assess capture notice, appeals status + denial email, counsel packet. **Not launch-ready** until counsel redline.

**Conditional engineering:** Counsel answers to Q1–Q10 may require additional work — see [PRIVACY_COUNSEL_ENGINEERING_MATRIX.md](./legal/PRIVACY_COUNSEL_ENGINEERING_MATRIX.md) (MHMD flows, consent checkbox, self-service export, GPC consumption, privacy re-acceptance, etc.).

**Alternatives considered:** State-by-state policies (rejected — operational drag); lowest common denominator (rejected — trust + threshold crossing).

**Implication:** Bump `PRIVACY_POLICY_VERSION` after counsel redline. Apply migration `20260720120000` before using `appealed` in prod. Do not publish MHMD-specific flows until Q1 resolved.

---

### June 2026 — Policy alignment (Batch A: text softening)

**Decision:** Soften published privacy/ToS claims to match honest current practice without changing runtime behavior.

**Changes:** GPC honoring is declarative (no sale/share to opt out of; we detect signals for future use); portability/access/correction fulfilled manually within the 45-day SLA; `deletion_audit_log` named as a compliance-retention exception under Privacy §6; deletion clock runs from account closure (period end), not cancel click.

**Implication:** `PRIVACY_POLICY_VERSION` bumped to `2026-06-21`.

---

### June 2026 — Self-serve account deletion (B1)

**Decision:** Ship ToS §14 "delete account from settings" via existing `deletion_schedule` + `process-deletions` cron (30-day pipeline after account closure).

**Implementation:** `scheduleUserAccountDeletion()` blocks active subscriptions and upgraded roles; schedules at period end + 30 days when canceling, else now + 30 days. UI at Settings → Security.

**Manual smoke:** Settings → Security → Delete account — **passed** (attest: Al / 2026-06-21).

**Implication:** Users must cancel at `/billing` before scheduling if still on an active paid plan.

---

### June 2026 — Privacy appeals SLA (B6)

**Decision:** Admin `appealed` status + `appeal_due_at` (+60 days); denial email includes appeal instructions; compliance cron alerts appeals due within 7 days.

**Manual smoke (prod):** Request `6e6a2b55-de50-41f5-ba3e-a6cb86f30873` (`avoels@comcast.net`, access) — consumer submit → admin **denied** (appeal email received) → **appealed** → **completed**. Final DB row: `status=completed`, `completed_at` set, `appeal_due_at` null (cleared on exit from appealed). **Attest: Al / 2026-06-21.**

---

### June 2026 — Terms single source of truth (B8)

**Decision:** Remove admin `app_config` ToS writes; canonical source = `lib/legal/terms-of-service-sections.ts` (`TERMS_OF_SERVICE_VERSION` `2026-06-02`). Admin T&C tab read-only + **Re-gate users** (`POST /api/admin/terms/regate`).

**Manual smoke (prod):** `/terms` + `/api/terms/content` → `2026-06-02`; admin T&C read-only preview matches public page; `POST /api/admin/terms/update` → 404; `terms_version` / `terms_sections` absent from app_config UI; Re-gate success. **Attest: Al / 2026-06-21.**

---

### June 2026 — Waitlist privacy notice (B2)

**Decision:** `/waitlist` email capture shows consent copy + Privacy Policy link **before** the email field (matches event assess capture order).

**Manual smoke (prod):** Privacy notice visible above “Email address” on `/waitlist`. Original #63 placement was after the input; corrected in PR #73. **Attest: Al / 2026-06-21.**

---

### June 2026 — Eligibility attestation (B3)

**Decision:** Launch 18+ / U.S.-resident attestation on the signup checkbox (embedded representation); record via existing `terms_accepted_at` + `terms_version` — no separate `age_attested_at` column pending counsel.

**Implication:** ToS §3 and Privacy §12 now backed by affirmative signup attestation, not passive "by using the Service" alone.

**Manual smoke (prod):** Signup checkbox includes 18+ / U.S. resident attestation (via beta access link while waitlist on). **Attest: Al / 2026-06-21.**

---

### June 2026 — Attorney billing disclosures (B4)

**Decision:** `BILLING_DISCLOSURES.preCheckout()` on `/attorney/billing` — renewal amount, frequency, auto-renewal, self-serve cancel path, ToS/Privacy — shown before Subscribe on paid attorney tiers (RCW 19.316 / FTC negative option).

**Manual smoke (prod):** Admin preview → Billing → Attorney plan picker; page-level RCW notice + per-plan `preCheckout` above Subscribe on Starter/Growth. **Attest: Al / 2026-06-21.**

---

### June 2026 — Trial checkout disclosures (B5)

**Decision:** Full RCW 19.316 / FTC pre-checkout disclosure on consumer trial tier at `/billing` and `/pricing` (same `BILLING_DISCLOSURES.preCheckout` pattern as attorney).

**Manual smoke (prod):** Trial tier cards show full billing disclosure before Subscribe on `/billing` + `/pricing`. **Attest: Al / 2026-06-21.**

---

### June 2026 — Renewal reminder single source (B7)

**Decision:** Remove dead backup renewal reminder from daily notifications cron (`profiles.subscription_renewal_date` was never populated). **Stripe `invoice.upcoming` webhook** is the sole consumer renewal-reminder path.

**Implication:** `profiles.subscription_renewal_date` column retained (unused); documented in BILLING_DISCLOSURES_CHECKLIST.

---

### June 2026 — Terms single source of truth (B8)

**Decision:** Remove admin `app_config` writes for ToS. Live pages and acceptance already read `lib/legal/terms-of-service-sections.ts` via `getCanonicalTerms()`. Admin Terms tab is read-only preview plus **Re-gate users** (`POST /api/admin/terms/regate`).

**Implication:** ToS changes require editing code, bumping `TERMS_OF_SERVICE_VERSION`, deploying, then re-gating. Legacy `app_config.terms_version` / `terms_sections` keys are unused and hidden from admin settings.

---

### June 2026 — GPC marketing suppression (B9)

**Decision:** When `Sec-GPC: 1` or `mwm_gpc_opt_out` cookie is present, `POST /api/email-capture` still records the lead but skips drip step 1 and sets `unsubscribed_at` to block follow-up cron sends.

**Implication:** GPC cookie set by middleware is now consumed for marketing enrollment; waitlist captures unchanged (already drip-free).

**Attestation:** Al / 2026-06-21 — staging `POST /api/email-capture` with GPC; `email_captures.unsubscribed_at` set, `drip_step_1_sent_at` null (query **mwm-staging**, not prod).

---

### June 2026 — Promotion schema gate (policy stack)

**Decision:** Add `assert-promotion-schema.sql` + `npm run release:promotion` — fail closed if production lacks `privacy_requests.appeal_due_at` or `appealed` status before staging→main promotion of #67+.

**Implication:** Converts manual migration remember-step into structural gate (same class as `assert-rls-coverage`).

---

### June 2026 — H5 terms re-acceptance hard-gate (parked)

**Decision:** **Not in B8 scope.** B8 fixed ToS source-of-truth (code constants, admin read-only). H5 = when to **hard-gate** re-acceptance vs soft banner on routine version bumps. Decide **material-change trigger** before first post-launch ToS edit; implement when a material change ships.

**Alternatives considered:** Hard gate on every `TERMS_OF_SERVICE_VERSION` bump (rejected for launch — too friction-heavy for immaterial fixes).

---

### June 2026 — Signup confirmation email after server-route hardening

**Decision:** Open-consumer signup sends **branded** confirmation via Resend (`generateLink` + `sendSignupConfirmationEmail`), linking to `/auth/confirm` where verification runs only on a human button POST (Outlook Safe Links prefetch hardening). Invite admissions unchanged (`createUser` + session).

**Reasoning:** Supabase default mailer on staging looked generic after the two-DB split; product mail already uses Resend. `createUser` + `/auth/v1/resend` fixed delivery but not branding. GET-verify links are burned by Microsoft Defender prefetch.

**Alternatives considered:** Supabase dashboard template parity only (rejected as sole fix — still generic sender on staging without SMTP). GET `/auth/confirm` verify (rejected — burned tokens on Outlook).

**Implication:** Branded resend for already-registered unconfirmed users stays on existing `/auth/confirm-email` Supabase resend (follow-up PR). Enable custom Resend SMTP on staging Supabase for non-signup auth emails.

**Attestation:** Al / 2026-06-24 — staging Outlook prefetch test passed (`avoels@outlook.com` confirm flow).

---

## Template for new entries

### [Date] — [Topic]

**Decision:** [What was decided — one clear sentence]

**Reasoning:** [Why this decision was made — the key arguments]

**Alternatives considered:** [What else was evaluated and why it was rejected]

**Implication:** [What this means for future work, if not obvious]
