# My Wealth Maps — Consolidated Pre-Flip Checklist

Status key: ✅ done · 🔄 partial / verify · ⬜ open · 🌐 external dependency

The flip action is a single env change (`PUBLIC_SIGNUP_OPEN=true`). Everything below is what should be true *before* that change.

Canonical companions: [LAUNCH.md](./LAUNCH.md) (Bucket B scoreboard) · [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) (ordered step-off list) · [DECISION_LOG.md](./DECISION_LOG.md) (pre-launch FOR ALL RLS timeline) · [NEGATIVE_AUTHZ_TEST_PLAN.md](./NEGATIVE_AUTHZ_TEST_PLAN.md) · [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md) (staging→main hardening batch).

---

## A. Hard blockers — broken product or serious exposure if skipped

- ⬜ **Stripe price IDs validated in test mode** — `GET /api/admin/verify-env?live=1` on Preview (`sk_test_`) runs `prices.retrieve` for advisor/attorney `STRIPE_PRICE_*` vars (catches `No such price` before checkout). Consumer unset on preview/local skipped (legacy fallbacks).
- ⬜ **Webhook failure visibility** — alert when a Stripe webhook fails/times out. Confirm handlers are **idempotent**.

### Pre-launch security (2026-06-17 · PR #28)
- ✅ **Beneficiary grant tokens** — capability tokens never logged (`beneficiary-grant-actions.ts`).
- ✅ **Cron/internal auth fail-closed** — `requireCronAuth` / `requireCronOrInternal` in `lib/api/internalApiAuth.ts`; missing `CRON_SECRET` → 500 (not `Bearer undefined` bypass).
- ✅ **Admin API MFA** — directory admin, referrals admin, terms update use `requireAdminApi()`.
- ✅ **Introduction emails** — session-bound sender; HTML escaped; advisor id/email validated.
- ✅ **Email capture** — 10/min/IP rate limit; raw email removed from logs.
- ⬜ **`CRON_SECRET` on `estate-planner-staging`** — required before staging crons run (fail-closed).
- ⬜ **`UPSTASH_REDIS_*` in prod** — recommended for durable email-capture rate limits across instances.

### Data integrity & isolation (on PROD, not just staging)
- ✅ **Structural RLS gate** — `scripts/assert-rls-coverage.sql` wired into `npm run verify:rls`; tenancy-column scope (not 21-table list); `PERMISSIVE_POLICY`, `MISSING_RLS`, `NO_POLICY`, and `NAME_ROLE_MISMATCH` all blocking.
- ✅ **Structural RLS gate in CI** — `rls-verify` on PR → `main` runs `npm run verify:rls -- --require-sql` against staging DB ([PR #27](https://github.com/Voels2000/estate-planner/pull/27)).
- ✅ **FOR ALL-to-public write leaks closed** — `estate_health_scores`, `household_alerts`, `beneficiary_conflicts` (integrity + availability, not read-only). Pre-launch; zero production customer rows affected ([DECISION_LOG](./DECISION_LOG.md)).
- ✅ **Apply RLS migrations on prod** (2026-06-15) — in order: `20260713130000` → `20260713140000` → `20260713150000`. `assert-rls-coverage` → **0 rows** on prod.
- ✅ **`verify:rls` on prod** — **27/27** (2 SQL + 25 JWT): `sql_invariants` + `rls_coverage_gate` PASS; full 21-table household JWT matrix PASS. Re-run after any policy migration: `npm run verify:rls -- --require-sql`.
- ⬜ **PITR / backups confirmed ON before real data exists** — Supabase PITR enabled, retention known, written rollback path for bad prod migration.

### Signup correctness (on PROD)
- [x] **Prod Supabase SMTP sender** — Authentication → Email → SMTP: Sender name = **My Wealth Maps**; Sender email = **noreply@mywealthmaps.com**. Resend activity log **200** on prod signup confirmation (attest: Al / 2026-06-27).
- ✅ **Waitlist hardening (staging §10)** — Layer 0 on prod + staging. Code on `main` (PR #25). **§10 matrix 6/6 PASS** on `https://estate-planner-staging.vercel.app` (2026-06-16) — [WAITLIST_HARDENING_SPEC §10 attestation](./WAITLIST_HARDENING_SPEC.md#10-attestation--closed-2026-06-16).
- ⬜ **`verify-env` prod gates** — `GET /api/admin/verify-env?live=1` on production must show **CRITICAL** if `SIGNUP_SKIP_EMAIL_CONFIRM` is set (auto-confirms self-serve signups); `PUBLIC_SIGNUP_OPEN` must be `false` until flip.
- ✅ **Open-consumer email confirm (staging)** — Probe 1: `201` + `needsEmailConfirmation: true`, no session cookie (`delivered@resend.dev`). **Delivery:** server `sendSignupConfirmationEmail` after `createUser` (fix 2026-06-24 — admin API does not send mail). **Prod:** verify at flip with fresh email.
- 🔄 **`handle_new_user` / signup defaults verified on prod** — `avoels@outlook.com` reset to `subscription_status='none'`, `consumer_tier=1` via `npm run reset:prod-voels-consumer -- --confirm` (2026-06-27). Re-walk onboarding via login (no fresh signup required).
- ⬜ **Apply WA estate migrations on prod** — Regime D + CST parity in timestamp order (`20260613120000`, `20260613130000`, `20260613140000`) if not already applied.

### Observability
- ✅ **Error monitoring live** (Sentry) — error-only, `sendDefaultPii: false`, tunnel `/monitoring`; preview event confirmed in Sentry dashboard; `SENTRY_AUTH_TOKEN` on both Vercel projects; per-DSN rate limit 150/12h (attest: Al / 2026-06-17 · [PR #29](https://github.com/Voels2000/estate-planner/pull/29) merged to staging).
- ✅ **`SENTRY_AUTH_TOKEN` verify-env REVIEW flag** — build-time source-map upload only; **keep on Vercel** (do not delete). `verify-env?live=1` REVIEW is expected (not in runtime manifest); no further action (attest: Al / 2026-06-21).

### Legal / disclaimers
- ✅ **WA estate-tax disclaimers** — consumer page, advisor panel, PDF (date-stamped, no-portability, snapshot caveat).
- ✅ **Privacy policy published** — live at `/privacy` and linked at signup (engineering draft #60).
- ✅ **"Not tax / legal / financial advice" disclaimers** beyond WA — household alerts passed; ToS §10/§11 counsel **TODO at first-state nexus** (not active pre-flip).
- ✅ **Household-alert copy (all six `estate_*` alerts)** — counsel review **complete — passed** for advice-vs-fact framing (attest: Al / 2026-06-19). Impl merged #51; gate on [LAUNCH.md § B6](./LAUNCH.md#b6-legal--entity-ops-attested-ex-tax).
- ⬜ **`PUBLIC_SIGNUP_OPEN=false`** until intentional flip; **`REQUIRE_PRIVILEGED_MFA=true`** confirmed in Vercel prod.

---

## B. Should clear before flip — real risk if skipped, not catastrophic

### Email
- ✅ **Deliverability** — DKIM/DMARC (`npm run check:email-dns`) + prod signup confirm + prospect intake in Gmail/Outlook (attest: Al / 2026-06-29).
- ✅ **BCC inbox smoke** (B4) — prospect step 10 to + BCC `avoels@comcast.net` (attest: Al / 2026-06-29).
- ✅ **Drip cron steps 2/3** — `npm run verify:drip-cron` on staging (2026-06-29).

### Billing depth (beyond the happy path)
- ✅ **C-4 billing walkthrough on prod** (B5) — attest: Al / 2026-06-27.
- ⬜ **Failed-renewal / dunning, card-decline, cancellation, refund, proration** — confirm defined behavior per path.

### WA tax — final loose ends
- ✅ **Confirm engine uses 19.5%** in the $7M–$9M band and $9M+ base = $1,490,000 (`waRegime.spec.ts` 30/30 · `npm run verify:item-8`, 2026-06-29).
- ✅ **Monte Carlo `isMFJ` follow-up** — `isMFJFilingStatus()` in async MC + edge fn (2026-06-29).

### Authz — hygiene
- ✅ **`funnel_events` + `referral_clicks`** — `TO service_role` grant alignment (`20260713150000`); advisory channel empty.
- ✅ **Revoked-link lifecycle** — E2E in `cross-household-isolation.spec.ts`.
- ✅ **Profiles advisor SELECT status gate** — `20260726130000` applied staging + prod (2026-06-26); post-revoke PostgREST profile leak closed; regression `advisor-profiles-revocation-rls.spec.ts` (RED pre-migration, GREEN after). [#150](https://github.com/Voels2000/estate-planner/pull/150)
- ✅ **Pending-link negative test** — `advisor-pending-link-authz.spec.ts`: pending→active transition on `e2e-consumer-linked`; PR gate via `test:e2e:security-smoke` (5b + 5c). Staging verified 2026-06-26 (Phase 2: profile + composition 200 + export payload keys).

### Security hygiene
- ✅ **Service-role / Supabase secret not in client bundle** — `npm run verify:security-hygiene` (2026-06-29).
- ✅ **Security headers / CSP** — prod attested via verify:security-hygiene (2026-06-29).

### Measurement & ops
- ✅ **Analytics / funnel instrumentation** — Vercel Analytics + funnel API + capture hooks (verify:security-hygiene, 2026-06-29).
- ✅ **Staging `verify-env?live=1`** — `LIVE_OK` · test mode · 12/12 prices active incl. advisor/attorney (attest: Al / 2026-06-29).
- ✅ **Vercel env name audit (`estate-planner`)** — `vercel env ls` Production vs Preview (names only, 2026-06-21): dead vars **`STRIPE_CUSTOMER_PORTAL_URL`** / **`RESEND_WEBHOOK_SECRET`** absent both scopes; two-DB split intentional (prod Supabase + live `STRIPE_PRICE_*` / `STRIPE_WEBHOOK_SECRET` Production-only; Preview `WAITLIST_MODE` + staging Supabase). **Attest: Al / 2026-06-21.**
- 🔄 **Vercel dashboard housekeeping (remainder)** — `PUBLIC_SIGNUP_OPEN`, `REQUIRE_PRIVILEGED_MFA`, `EMAIL_FROM` present on Production (`verify-env` OK); optional `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` rename if needed (B5).

### External (in flight, may not gate flip but track)
- 🌐 **WA B&O ruling** (Bucket A, P0-external).
- 🌐 **DOR written ruling on SaaS DAS sales-tax classification**.
- ✅ **Email aliases** `security@`, `legal@`, `privacy@` → monitored inbox (attest: Al / 2026-06-29).
- **TODO (first-state nexus):** Counsel ToS §10/§11 + privacy redline — not active pre-flip work.

---

## C. Fast-follow — tracked ticket, post-flip acceptable
- ⬜ **Accessibility pass** — quick smoke before flip; full pass after.
- ⬜ **Projection-aware CST refinements** beyond snapshot.
- ⬜ **Upstash Redis for referral rate limits**.
- ⬜ **Uptime / status monitoring**.
- ⬜ **CI invariant: every `deleteUser` table/column exists in migrations**.

---

## D. Tier-restructure prod cutover — steps 0–5 (then stop)

**Not the signup gate flip.** Gets tier-restructure code safely onto prod. `PUBLIC_SIGNUP_OPEN=true` is §E — separate day when B&O-READY clears.

**Before step 1:** PITR/backups ON (§A). Schema rollback snippets below — **pre-flip only**; after `PUBLIC_SIGNUP_OPEN`, PITR not column drops.

**Schema rollback** (verified vs forward files; reverse order = `20260724120000` then `20260624140000`):
```sql
ALTER TABLE public.profiles DROP COLUMN IF EXISTS trial_ends_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS has_ever_subscribed;
-- + restore handle_new_user() from 20260527130500_fix_signup_subscription_defaults.sql
DROP TABLE IF EXISTS public.one_time_purchases;
```
`one_time_purchases` reverse is complete (`DROP TABLE`). `trial_columns` forward also replaced `handle_new_user()` — column drops alone are not a full inverse. Step 2 fail → re-apply forward, don't reverse.

```
0. [x] Docs reconciliation (#128 merged)
1. [x] Apply prod migrations ONLY (no code deploy yet), timestamp order:
   …WA Regime D (20260613120000–140000) → one_time_purchases (20260624140000) →
   RLS fix (20260713130000) → coverage fixes (20260713140000) →
   service_role grants (20260713150000) → tier_restructure trial columns (20260724120000) →
   plan_export refund ack (20260726120000_one_time_purchases_refund_ack.sql)
   via: bash scripts/apply-migration.sh production <file>
   (attest: Al / 2026-06-25)
2. [x] Verify schema on PROD DB (gate — do not skip):
     SELECT trial_ends_at, has_ever_subscribed FROM profiles LIMIT 1;  -- no 42703
     SELECT 1 FROM one_time_purchases LIMIT 1;                          -- table exists
   (attest: Al / 2026-06-25)
3. [x] Promote staging → main (#130); CI green (verify + e2e-smoke + rls-verify); merge; Vercel prod deploy not skipped
   (attest: Al / 2026-06-25)
4. [x] Verify on prod immediately (partial — release:post-deploy still open):
     GET /api/admin/verify-env?live=1  → LIVE_OK, 12/12 prices active (2026-06-25)
     Three-account resolver: canary tier 3 · avoels superuser+consumer tier 3 (post-#134) · david tier 1
     Canary browser sign-in → dashboard (2026-06-25)
     Stripe account guard live (sk_live_ + correct account)
     [ ] npm run release:post-deploy (Voels + RLS) — not attested post-cutover
     PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com npm run test:e2e:prod:smoke
       (resolver/gate/boundary; no automated live charge)
5. [x] Real-card live smoke (smallest tier, refund/cancel after) + C-4 billing walkthrough
   (attest: Al / 2026-06-27)
── STOP. Cutover complete. Gate flip is §E. ──
```

---

## E. Gate flip runbook — separate day (B&O-READY + cutover §D complete)

```
1. Every §A hard blocker green (PITR, webhook alerting, verify-env gates)
2. verify-env on prod (?live=1) — re-run if env changed since cutover
3. Email: BCC smoke, drip steps 2/3, spam-placement check
4. Confirm live: PITR/backups · error monitoring · webhook-failure alerting
5. ── only when Bucket A (B&O) + §D cutover complete ──
   PUBLIC_SIGNUP_OPEN=true → redeploy → fresh-email signup E2E smoke
   (full sequence: LAUNCH.md Bucket C Gate 2)
```

---

## Resolved this cycle (for the record)

- ✅ **WA estate tax** — Regime D, RCW 83.100.040 attestation, bypass/CST/funding cap, projection-aware CST, golden vectors, disclaimers.
- ✅ **Cross-tenant authz** — structural `assert-rls-coverage` gate; full 21-table JWT matrix; revoked-link + attorney-cap tests; three `FOR ALL`-to-`public` write leaks closed; `businesses` omitted `WITH CHECK`; `estate_flow_share_links` → SECURITY DEFINER RPC; `funnel_events`/`referral_clicks` grant alignment; **DECISION_LOG** pre-launch timeline recorded.
- ✅ **PRs** — [#21](https://github.com/Voels2000/estate-planner/pull/21) negative authz plan · [#22](https://github.com/Voels2000/estate-planner/pull/22) RLS leaks + structural gate · [#23](https://github.com/Voels2000/estate-planner/pull/23) prod-apply doc record.
