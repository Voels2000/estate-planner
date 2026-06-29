# Pre-flip step-off list

**Last updated:** 2026-06-27 (prod smoke 34/34; post-deploy prod-once attested)
**Purpose:** Ordered items to work through one-by-one while waiting on the WA B&O ruling.  
**Not on this list:** Bucket A (B&O / Stripe Tax / ToS tax branch) · counsel ToS §10/§11 + privacy redline (TODO when revenue approaches first-state nexus) · fresh-email signup validation (manual re-walk on `avoels@outlook.com` is sufficient).

**Canonical scoreboard:** [LAUNCH.md](./LAUNCH.md) · [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md)

---

## Recently completed (2026-06-25 → 2026-06-27)

| Item | Evidence |
|------|----------|
| Tier-restructure cutover steps 0–4 | [PRE_FLIP_CHECKLIST §D](./PRE_FLIP_CHECKLIST.md#d-tier-restructure-prod-cutover--steps-05-then-stop) |
| Step 5 — real-card live smoke + C-4 billing walkthrough | Al / 2026-06-27 · [pre-billing-run-sheet §5](./pre-billing-run-sheet.md#5-live-billing-run) |
| Prod SMTP — signup/confirm emails deliver | Resend 200 on prod confirmation (Al / 2026-06-27) |
| Track 2 prod smoke fixes | [PR #170](https://github.com/Voels2000/estate-planner/pull/170) merged `63df4fa8` |
| **Prod smoke bank** | **34 passed · 0 skipped · 0 failed** (Al / 2026-06-27) |
| **Post-deploy prod attestation** | Voels 8/8 + RLS SQL 2/2 via `release:post-deploy:prod-once` (Al / 2026-06-27) |
| `avoels@outlook.com` reset for onboarding re-walk | `npm run reset:prod-voels-consumer -- --confirm` · `consumer_tier=1`, `subscription_status=none`, no household |

---

## Step off in order

Work top-to-bottom. Stop on any **STOP** gate in [pre-billing-run-sheet.md](./pre-billing-run-sheet.md) if re-running billing.

### 1. ~~Post-deploy attestation (prod, read-only)~~ ✅

```bash
npm run release:post-deploy:prod-once
```

- [x] Voels 8/8 + RLS SQL invariants + coverage gate (attest: Al / 2026-06-27)
- [x] Ref guard verified; behavioral JWT skipped on prod (isolation covered by prod smoke)

### 2. ~~Prod smoke bank (after #170)~~ ✅

```bash
npm run seed:prod-export-markers -- --confirm
PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com npm run test:e2e:prod:smoke -- --workers=1
```

- [x] 34 passed · 0 skipped · 0 failed (attest: Al / 2026-06-27)
- [x] Isolation probe: foreign 404 · linked 200 (attest: Al / 2026-06-27)

### 3. Manual onboarding re-walk (`avoels@outlook.com`)

Account is reset — log in at https://www.mywealthmaps.com/login (no new signup needed).

- [ ] Wizard / dashboard unlock path feels correct end-to-end (attest: __ / __)
- [ ] Optional: second billing path if you want to re-verify checkout after reset

### 4. Infrastructure hardening (pre-real-customers)

- [ ] **PITR / backups ON** on prod Supabase — `WALG=true` attested 2026-06-29; **`PITR=false`** — enable in Dashboard ([DEPLOYMENT §10](./DEPLOYMENT.md#10-production-backups-and-pitr-pre-flip-gate))
- [x] **`verify-env?live=1` prod gates** — `PUBLIC_SIGNUP_OPEN=false`, no `SIGNUP_SKIP_EMAIL_CONFIRM`, `REQUIRE_PRIVILEGED_MFA=true`, 12/12 prices active, `LIVE_OK` (attest: Al / 2026-06-29)
- [x] **Webhook failure visibility** — Sentry `captureStripeWebhookSupabaseFailure` on all Supabase write paths; prod endpoint enabled at `www.mywealthmaps.com/api/stripe/webhook` (attest: Al / 2026-06-29). Idempotency table deferred post-launch ([WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md](./WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md)).
- [ ] **`UPSTASH_REDIS_*` on prod** — not set (in-memory rate limits per instance); create Upstash Redis + add to Vercel **`estate-planner`** Production, redeploy
- [x] **`CRON_SECRET` on `estate-planner-staging`** — cron routes return 401 (not 500) when bearer wrong → secret present (attest: Al / 2026-06-29)

### 5. Email & comms (non-signup) ✅

- [x] **Deliverability — DNS** — SPF + Resend DKIM + DMARC (`p=none`, rua→comcast) verified via `npm run check:email-dns` (2026-06-29)
- [x] **Deliverability — inbox placement** — prod signup confirm + prospect intake deliver; Gmail/Outlook spot-check (attest: Al / 2026-06-29)
- [x] **BCC inbox smoke** — prospect step 10 → `avoels@comcast.net` (to + BCC) (attest: Al / 2026-06-29)
- [x] **Drip cron steps 2/3** — backdated staging run: `npm run verify:drip-cron` (e2e-drip step 2+3 sent, DB timestamps OK, restored) (2026-06-29)
- [x] **Email aliases** — `security@`, `legal@`, `privacy@` forward to monitored inbox (attest: Al / 2026-06-29)

### 6. Billing edge paths (beyond happy-path smoke)

- [x] **Failed-renewal / dunning** — `invoice.payment_failed` → `past_due`, tier 0, checkout blocked; Stripe Smart Retries (Dashboard); unit gate `npm run verify:billing-edges` 80/80 (2026-06-29)
- [x] **Cancellation** — C-4 portal cancel → webhook sync (attest: Al / 2026-06-27)
- [x] **Refund (Plan & Export)** — refund-ack gate + fulfillment in `oneTimePurchases` unit tests (verify:billing-edges)
- [ ] **Card-decline at checkout** — optional staging spot-check with `4000000000000002` (no prod charge)
- [ ] **Proration** — optional staging tier change in Customer Portal (Stripe-handled; app syncs via `subscription.updated`)

### 7. Security & measurement hygiene ✅

- [x] **Service-role / Supabase secret not in client bundle** — `npm run verify:security-hygiene` (no sk_live_/whsec_ values in chunks; server env not leaked) (2026-06-29)
- [x] **Security headers / CSP** — prod HSTS, X-Frame-Options DENY, CSP, Referrer-Policy, Permissions-Policy (verify:security-hygiene curl)
- [x] **Analytics / funnel instrumentation** — Vercel `<Analytics />` + `POST /api/analytics/funnel` + wizard/signup/event captures (verify:security-hygiene)
- [x] **Staging verify-env `?live=1`** — `estate-planner-staging` HTTP 200 · `liveness.stripe: LIVE_OK` · `stripe_key_mode: test` · **12/12** prices `active` incl. advisor/attorney · Supabase ref `cmzyxpxfyvdvbsykjvsg` (attest: Al / 2026-06-29)

### 8. Engineering follow-ups (lower urgency)

- [x] **Monte Carlo `isMFJ` alignment** — `run-estate-monte-carlo-async` + edge fn use `isMFJFilingStatus()` (`married_filing_jointly` alias); `npm run verify:item-8` (2026-06-29). **Deploy:** `supabase functions deploy estate-monte-carlo` on staging + prod when promoting.
- [x] **WA Regime D band attestation** — `waRegime.spec.ts` 30/30 incl. 19.5% band + $1.49M @ $9M taxable (`npm run verify:item-8`) (2026-06-29)
- [ ] **Optional Vercel housekeeping** — `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` rename if desired (defer)
- [x] **B3b staging→main** — #181 promoted to main; prod on `www.mywealthmaps.com` (2026-06-29). Re-promote only if `staging` diverges again.

### 9. CI / post-launch (park — not flip-blocking)

- [ ] **#156** parallel e2e-smoke — conflicting; park until after launch
- [ ] **#159** auth retry soak on staging — promote only after clean stretch
- [ ] Post-flip fast-follow: counsel ToS §10/§11 + privacy redline when approaching first-state nexus

---

## Flip gate (do not run until B&O clears)

When Bucket A resolves and every item above that you care about is green:

1. Re-run `GET /api/admin/verify-env?live=1` on prod
2. Confirm PITR + monitoring + webhook alerting live
3. **`PUBLIC_SIGNUP_OPEN=true`** → redeploy → fresh-email signup smoke ([LAUNCH Bucket C Gate 2](./LAUNCH.md#gate-2--go-live-day-sequence-in-order))

---

## Quick commands

| Task | Command |
|------|---------|
| Reset Voels consumer (prod) | `npm run reset:prod-voels-consumer -- --confirm` |
| Prod export markers | `npm run seed:prod-export-markers -- --confirm` |
| Prod smoke | `npm run test:e2e:prod:smoke -- --workers=1` |
| Post-deploy (prod, guarded) | `npm run release:post-deploy:prod-once` |
| Email DNS (SPF/DKIM/DMARC) | `npm run check:email-dns` |
| Drip cron steps 2/3 (staging) | `npm run verify:drip-cron` |
| Drip schedule (DB) | `npm run verify:drip -- --email <email>` |
| Billing edges (unit, no charges) | `npm run verify:billing-edges` |
| Security hygiene (item 7) | `npm run verify:security-hygiene` |
| Engineering follow-ups (item 8) | `npm run verify:item-8` |
| Post-deploy (legacy — needs .env.local) | `npm run release:post-deploy` |
| Canary re-seed | `npm run seed:prod-canary -- --confirm` |
