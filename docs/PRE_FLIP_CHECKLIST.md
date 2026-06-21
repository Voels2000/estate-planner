# My Wealth Maps — Consolidated Pre-Flip Checklist

Status key: ✅ done · 🔄 partial / verify · ⬜ open · 🌐 external dependency

The flip action is a single env change (`PUBLIC_SIGNUP_OPEN=true`). Everything below is what should be true *before* that change.

Canonical companions: [LAUNCH.md](./LAUNCH.md) (Bucket B scoreboard) · [DECISION_LOG.md](./DECISION_LOG.md) (pre-launch FOR ALL RLS timeline) · [NEGATIVE_AUTHZ_TEST_PLAN.md](./NEGATIVE_AUTHZ_TEST_PLAN.md) · [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md) (staging→main hardening batch).

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
- ✅ **Waitlist hardening (staging §10)** — Layer 0 on prod + staging. Code on `main` (PR #25). **§10 matrix 6/6 PASS** on `https://estate-planner-staging.vercel.app` (2026-06-16) — [WAITLIST_HARDENING_SPEC §10 attestation](./WAITLIST_HARDENING_SPEC.md#10-attestation--closed-2026-06-16).
- ⬜ **`verify-env` prod gates** — `GET /api/admin/verify-env?live=1` on production must show **CRITICAL** if `SIGNUP_SKIP_EMAIL_CONFIRM` is set (auto-confirms self-serve signups); `PUBLIC_SIGNUP_OPEN` must be `false` until flip.
- ✅ **Open-consumer email confirm (staging)** — Probe 1: `201` + `needsEmailConfirmation: true`, no session cookie (`delivered@resend.dev`). **Prod:** verify at flip with fresh email.
- 🔄 **`handle_new_user` / signup defaults verified on prod** — fresh signup → `subscription_status='none'`, `consumer_tier=1`. (B8)
- ⬜ **Apply WA estate migrations on prod** — Regime D + CST parity in timestamp order (`20260613120000`, `20260613130000`, `20260613140000`) if not already applied.

### Observability
- ✅ **Error monitoring live** (Sentry) — error-only, `sendDefaultPii: false`, tunnel `/monitoring`; preview event confirmed in Sentry dashboard; `SENTRY_AUTH_TOKEN` on both Vercel projects; per-DSN rate limit 150/12h (attest: Al / 2026-06-17 · [PR #29](https://github.com/Voels2000/estate-planner/pull/29) merged to staging).
- ✅ **`SENTRY_AUTH_TOKEN` verify-env REVIEW flag** — build-time source-map upload only; **keep on Vercel** (do not delete). `verify-env?live=1` REVIEW is expected (not in runtime manifest); no further action (attest: Al / 2026-06-21).

### Legal / disclaimers (confirm with counsel)
- ✅ **WA estate-tax disclaimers** — consumer page, advisor panel, PDF (date-stamped, no-portability, snapshot caveat).
- ✅ **Privacy policy published** — live at `/privacy` and linked at signup (engineering draft #60; counsel redline **post-go-live**).
- 🔄 **"Not tax / legal / financial advice" disclaimers** beyond WA — household alerts passed; ToS §10/§11 counsel **post-go-live** (revenue approaching first-state nexus).
- ✅ **Household-alert copy (all six `estate_*` alerts)** — counsel review **complete — passed** for advice-vs-fact framing (attest: Al / 2026-06-19). Impl merged #51; gate on [LAUNCH.md § B6](./LAUNCH.md#b6-legal--entity-ops-attested-ex-tax).
- ⬜ **`PUBLIC_SIGNUP_OPEN=false`** until intentional flip; **`REQUIRE_PRIVILEGED_MFA=true`** confirmed in Vercel prod.

---

## B. Should clear before flip — real risk if skipped, not catastrophic

### Email
- ⬜ **Deliverability** — DKIM/DMARC + inbox placement at Gmail/Outlook (transactional + drip).
- ⬜ **BCC inbox smoke** (B4) and **drip cron steps 2/3** on a real timeline (B4).

### Billing depth (beyond the happy path)
- 🔄 **C-4 billing walkthrough on prod** (B5).
- ⬜ **Failed-renewal / dunning, card-decline, cancellation, refund, proration** — confirm defined behavior per path.

### WA tax — final loose ends
- 🔄 **Confirm engine uses 19.5%** in the $7M–$9M band and $9M+ base = $1,490,000 (Regime D attestation).
- ⬜ **Monte Carlo `isMFJ` follow-up** — align `estate-monte-carlo` with `isMFJFilingStatus()` so MC matches projection path.

### Authz — hygiene
- ✅ **`funnel_events` + `referral_clicks`** — `TO service_role` grant alignment (`20260713150000`); advisory channel empty.
- ✅ **Revoked-link lifecycle** — E2E in `cross-household-isolation.spec.ts`.
- ⬜ **Pending-link negative test** — advisor with pending (not accepted) link → estate-composition 403/404.

### Security hygiene
- ⬜ **Service-role / Supabase secret never in client bundle** — grep built output.
- ⬜ **Security headers / CSP** (HSTS, X-Frame-Options, etc.).

### Measurement & ops
- ⬜ **Analytics / funnel instrumentation live** before flip.
- ✅ **Vercel env name audit (`estate-planner`)** — `vercel env ls` Production vs Preview (names only, 2026-06-21): dead vars **`STRIPE_CUSTOMER_PORTAL_URL`** / **`RESEND_WEBHOOK_SECRET`** absent both scopes; two-DB split intentional (prod Supabase + live `STRIPE_PRICE_*` / `STRIPE_WEBHOOK_SECRET` Production-only; Preview `WAITLIST_MODE` + staging Supabase). **Attest: Al / 2026-06-21.**
- 🔄 **Vercel dashboard housekeeping (remainder)** — `PUBLIC_SIGNUP_OPEN`, `REQUIRE_PRIVILEGED_MFA`, `EMAIL_FROM` present on Production (`verify-env` OK); optional `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` rename if needed (B5).

### External (in flight, may not gate flip but track)
- 🌐 **WA B&O ruling** (Bucket A, P0-external).
- 🌐 **DOR written ruling on SaaS DAS sales-tax classification**.
- ⬜ **Email aliases** `security@`, `legal@`, `privacy@` (B6).
- **Post-go-live:** Counsel ToS §10/§11 + privacy redline when revenue approaches nexus in first state (Al / 2026-06-20).

---

## C. Fast-follow — tracked ticket, post-flip acceptable
- ⬜ **Accessibility pass** — quick smoke before flip; full pass after.
- ⬜ **Projection-aware CST refinements** beyond snapshot.
- ⬜ **Upstash Redis for referral rate limits**.
- ⬜ **Uptime / status monitoring**.
- ⬜ **CI invariant: every `deleteUser` table/column exists in migrations**.

---

## D. Flip runbook — run in this order

```
1. Apply prod migrations in timestamp order through latest:
   …WA Regime D (20260613120000–140000) → RLS fix (20260713130000) →
   coverage fixes (20260713140000) → service_role grants (20260713150000)
2. verify-env on prod (`?live=1`, live key): all `STRIPE_PRICE_*` → `prices.retrieve` active. Preview (`sk_test_`) validates advisor/attorney prices the same way — catches `No such price` before checkout.
3. npm run release:post-deploy            # Voels + RLS
4. npm run verify:rls -- --require-sql    # prod: 27/27 + coverage gate PASS
5. Deploy app (share page uses get_share_link_display_meta RPC)
6. Stripe real-card smoke + C-4 walkthrough (manual, card required)
7. Email: BCC smoke, drip steps 2/3, spam-placement check
8. Confirm live: PITR/backups · error monitoring · webhook-failure alerting
9. PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com npm run test:e2e:prod:smoke
10. ── only when every A item is green AND B&O-ready ──
    PUBLIC_SIGNUP_OPEN=true → redeploy → fresh-email signup E2E smoke
```

---

## Resolved this cycle (for the record)

- ✅ **WA estate tax** — Regime D, RCW 83.100.040 attestation, bypass/CST/funding cap, projection-aware CST, golden vectors, disclaimers.
- ✅ **Cross-tenant authz** — structural `assert-rls-coverage` gate; full 21-table JWT matrix; revoked-link + attorney-cap tests; three `FOR ALL`-to-`public` write leaks closed; `businesses` omitted `WITH CHECK`; `estate_flow_share_links` → SECURITY DEFINER RPC; `funnel_events`/`referral_clicks` grant alignment; **DECISION_LOG** pre-launch timeline recorded.
- ✅ **PRs** — [#21](https://github.com/Voels2000/estate-planner/pull/21) negative authz plan · [#22](https://github.com/Voels2000/estate-planner/pull/22) RLS leaks + structural gate · [#23](https://github.com/Voels2000/estate-planner/pull/23) prod-apply doc record.
