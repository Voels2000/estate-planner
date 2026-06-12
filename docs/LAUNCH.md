# LAUNCH.md — single source of truth for go-live

**Last updated:** 2026-06-12 (Prompt 2 verification sweep)  
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

**Related (not absorbed):** [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [BILLING_DISCLOSURES_CHECKLIST.md](./BILLING_DISCLOSURES_CHECKLIST.md) · [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) · [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md)

**Migrations before flip:** run `npx supabase db push` / dashboard compare before flip — count not pinned in doc.

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

- [ ] Vercel redeploy of latest `main` (attest: __ / __)
- [ ] `npm run release:preflight` (verify: command green — includes `verify:rls` + go-live profile + security-smoke)
- [ ] `npm run test:e2e:go-live-profile` (verify: 17 passing — **2026-06-12 sweep:** 0/17 run; `consumer-setup` auth timeout 120s against `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` / staging Supabase; re-run after redeploy)
- [ ] `npm run test:e2e:security-isolation` (verify: green)
- [ ] `npm run test:e2e:cross-role` (verify: green)
- [ ] `npm run release:post-deploy` (verify: green — needs `SUPABASE_DB_URL` in `.env.local`; attest if prod credentials not loaded: __ / __)
- [ ] `npm run test:e2e:prod:smoke -- --workers=1` (verify: 42 `@production` — command: `PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com npm run test:e2e:prod:smoke -- --workers=1`; attest: __ / __)

### B2. TERMS-1

- [x] Signup checkbox sets `terms_accepted_at` on account creation (verify: `app/(auth)/signup/_signup-form.tsx:64-67,73,101` — metadata on `signUp`; email-confirm path syncs profile via `app/auth/callback/route.ts:40-54` → `recordTermsAcceptance`)
- **Deferred (post-B&O-READY, not blocking launch):** persist `terms_version` at signup — checkbox/metadata today writes only `terms_accepted_at`; `recordTermsAcceptance` sets `terms_version` from `TERMS_OF_SERVICE_VERSION` (`lib/legal/terms-of-service-sections.ts:5`) on callback/accept page, not in signup metadata. Follow-up: add `terms_version` to signup metadata or call `recordTermsAcceptance` on immediate session path.

### B3. CI discipline

- [ ] `E2E_SMOKE_IN_CI=true` + staging secrets (verify: job exists `.github/workflows/e2e-smoke.yml:14-15` — `if: vars.E2E_SMOKE_IN_CI == 'true'`; **repo variable value** attest: __ / __ — `gh` unavailable in sweep env)
- [ ] `RLS_VERIFY_IN_CI=true` (verify: job exists `.github/workflows/rls-verify.yml:14-15` — `if: vars.RLS_VERIFY_IN_CI == 'true'`; **repo variable value** attest: __ / __)
- [ ] Branch protection on `main`: `verify`, `e2e-smoke`, `rls-verify` (attest: __ / __ — run `gh api repos/Voels2000/estate-planner/branches/main/protection`)

### B4. Manual smokes (run before any DB purge)

- [ ] Prospect + Mobile (19 steps, Track 1 before Track 2) — [archived checklist § Prospect](./archive/LAUNCH_CHECKLIST.md) (attest: __ / __)
- [ ] Health Score + Advisor Playbook (18 steps) (attest: __ / __)
- [ ] PDF narrative engine (9 steps) (attest: __ / __)
- [ ] Drip production smoke (assess → step 1 → cron steps 2/3) (attest: __ / __)
- [ ] End-to-end fresh signup on production URL (consumer → drip → advisor) (attest: __ / __)

### B5. Stripe (code wired; live config is ops-attested)

- [ ] Live keys in Vercel Production (`sk_live_` / `pk_live_` / live `whsec_`) (attest: __ / __ — Confirm: `vercel env ls production` shows `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` with live values)
- [ ] Live catalog: 6 consumer + attorney starter/growth (+ advisor firm seats if billing firms at launch) (attest: __ / __ — Confirm: Stripe Dashboard → Products has 6 consumer prices + attorney starter/growth live)
- [ ] Live price IDs in env (`STRIPE_PRICE_*`, `STRIPE_PRICE_ATTORNEY_*`, `STRIPE_PRICE_ADVISOR_*`) (verify: code refs `lib/billing/stripePrices.ts:28-68` consumer 6 vars; `lib/tiers.ts:139-142` advisor firm; `lib/tiers.ts:167-169` attorney — **Vercel Production names populated** attest: __ / __ — `vercel env ls production` not available in sweep env)
- [ ] C-4 manual walkthrough on prod: signup → checkout → active → cancel → deletion schedule — [BILLING_DISCLOSURES_CHECKLIST.md](./BILLING_DISCLOSURES_CHECKLIST.md) (attest: __ / __)
- [ ] One real-card live smoke, smallest tier, refund/cancel after verify (attest: __ / __)

### B6. Legal / entity (ops-attested, ex-tax)

- [x] Legal placeholders in product (verify: `lib/legal/company.ts` → `/terms`, `/privacy`)
- [ ] Counsel sign-off ToS §10, §11 (attest: __ / __)
- [ ] WA LLC UBI / EIN / registered agent confirmed on SOS (attest: __ / __)
- [ ] Business bank account open (attest: __ / __)
- [ ] B&O / DOR account registered (attest: __ / __ — confirm w/ accountant OK pre-ruling)
- [ ] Email aliases `security@`, `legal@` live (`privacy@` routed) (attest: __ / __)

### B7. Pre-flip cleanup — RUN LAST, never now

**Run only immediately before Gate 2, after all B4 manual smokes pass and PROTECTED re-verified, to avoid re-seeding test junk.**

- [x] Verify PROTECTED list in `scripts/cleanup-test-accounts.ts` BEFORE running purge (verify: `scripts/cleanup-test-accounts.ts:70-95` — effective `PROTECTED` = `CANONICAL_PROTECTED` + `GO_LIVE_PROTECTED` + `ROLOBE_PROTECTED_FROM_LEGACY`: `e2e-consumer@`, `e2e-consumer-tier1@`, `e2e-golden-path@`, `e2e-advisor@`, `e2e-advisor-client@`, `e2e-attorney@`, `e2e-attorney-listing@`, `e2e-advisor-listing@`, `e2e-drip@` (all `@mywealthmaps.test`), `avoels@comcast.net`, `avoels@outlook.com`, `david@gmail.com`, `Stephen.a.voels@sbcglobal.net`, plus 13 `@rolobe.resend.app` in `ROLOBE_ACCOUNTS`. **`david@rolobe.resend.app` not protected** — eligible for `--purge-unprotected`. `david@gmail.com` stays protected.)
- [x] Confirm purge safety guards (verify: `package.json:47-48` loads `.env.local`; `--purge-unprotected --dry-run` exits before deletes; interactive `confirm()` without `--yes` at `scripts/cleanup-test-accounts.ts:350-359`; production guard `assertPurgeTargetSafe` at `:35-55`, called `:416` — aborts on ref `fnzvlmrqwcqwiqueevux` unless `--force`)
- [ ] Only then: `npm run cleanup:purge:dry-run` → `npm run cleanup:purge` → `npm run seed:e2e` → compliance SQL per [E2E_TEST_RESET.md § Go-live database cleanup](./E2E_TEST_RESET.md) (attest: __ / __)

### B8. Engineering gates (shipped on `main` — spot-check only)

- [x] `app/robots.ts` — public routes allowed, sitemap live (verify: `app/robots.ts:5-37`)
- [x] Security hardening manual smoke 4/4 (2026-05-30)
- [x] Deletion / WCPA / privacy compliance code (Sprint C-6/C-7)
- [x] Billing code + B2B2C handoff + pricing surfaces
- [x] Production `@production` smoke harness (`test:e2e:prod:smoke`, 42 tests)
- [ ] `handle_new_user` + signup defaults migrations applied on prod (verify: fresh signup → `subscription_status = 'none'`, `consumer_tier = 1`)
- [ ] Optional: Upstash Redis for referral rate limits (falls back to in-memory)

---

## Bucket C — Gate 2 flip sequence (DO NOT run until B&O-READY)

**Rule:** Do NOT set `PUBLIC_SIGNUP_OPEN=true` until every Bucket B box is checked (except B7 until immediately pre-flip).

### Gate 2 — Go-live day sequence (in order)

1. Verify Bucket B — every checkbox above is checked (B7 run last, immediately before this list)
2. Supabase Auth → confirm email-confirm flow is ON for production project
3. Verify `/auth/callback` works on production (sign in with existing account)
4. Set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production environment variables
5. Redeploy (trigger Vercel redeploy from dashboard or push empty commit)
6. Core smoke with a FRESH email address (not a test account):
   - Sign up → confirm email → profile → wizard → dashboard → billing upgrade
7. `npm run release:post-deploy` (Voels gate + RLS SQL verify)
8. Check Stripe Dashboard: new subscription appears under the fresh signup customer

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
| Local minimum | `npm run release:local` |
| Local full (pre-merge) | `npm run release:preflight` |
| Preview | Vercel build green + auth callback spot-check |
| CI | `verify`, `e2e-smoke`, `rls-verify` green on PR |
| Production | `npm run release:post-deploy` |

See [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md) for credential placement.

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

**References updated:** all non-archive docs except `MASTER_ARCHITECTURE.md`, `DECISION_LOG.md`, `ROADMAP.md`, `CALCULATION_ENGINES.md` (launch-only pass — update those separately if needed).

---

## Prompt 2 sweep scoreboard (2026-06-12)

**Bucket B:** **11 of 38** checked (29 open).

**Checked this sweep:** B2 TERMS-1 · B6 legal placeholders (prior) · B7 PROTECTED + purge guards · B8 robots/security/deletion/billing/prod harness (prior).

**Still open — verify (re-run locally):**

| Item | Action |
|------|--------|
| B1 preflight / E2E / post-deploy / prod smoke | `npm run release:preflight`; fix auth timeout then re-run go-live-profile; `npm run release:post-deploy`; prod smoke with `PLAYWRIGHT_BASE_URL` |
| B3 CI vars + branch protection | GitHub → Settings → Variables: `E2E_SMOKE_IN_CI`, `RLS_VERIFY_IN_CI` = `true`; branch protection required checks |
| B5 Vercel Stripe env names | `vercel env ls production` |
| B8 signup defaults on prod | Fresh signup → `subscription_status = 'none'`, `consumer_tier = 1` |

**Still open — attest (Al):** B1 redeploy · B4 all 5 manual smokes · B5 live keys/catalog/C-4/card smoke · B6 counsel/LLC/bank/B&O/email · B7 purge execution (last).

**B&O/DOR note:** B6 B&O registration may be doable pre-ruling — confirm sequencing with accountant before filing.
