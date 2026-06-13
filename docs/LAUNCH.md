# LAUNCH.md — single source of truth for go-live

**Last updated:** 2026-06-09 (B1 complete; B3 solo — no GitHub secrets)  
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

**Working tracker (manual attestations):** [LAUNCH_TRACKER_SYNC.md](./LAUNCH_TRACKER_SYNC.md) — browser UI at `tools/launch-tracker.html` (`npm run launch:tracker`); sync to this file via `npm run sync:launch-tracker`.

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

- [x] Vercel redeploy of latest `main` (attest: Al / 2026-06-09)
- [x] `npm run release:preflight` (verify: **green** — 2026-06-09; lint/build/unit + RLS JWT + go-live-profile **17/17** + security-smoke **5/5**; `--workers=1`)
- [x] `npm run test:e2e:go-live-profile` (verify: **17/17** — 2026-06-09; spouse field `id`s + `npm run build` before local run; `--workers=1`)
- [x] `npm run test:e2e:security-isolation` (verify: **10/10** — 2026-06-09; stray `advisor_clients` link to e2e-consumer pruned via `pruneStrayE2eAdvisorClientLinks` in seed/prune)
- [x] `npm run test:e2e:cross-role` (verify: green — 2026-06-09; `advisor-client-setup`)
- [x] `npm run release:post-deploy` (verify: **Voels 7/7 + RLS 3/3** — 2026-06-09; `SUPABASE_DB_URL` in `.env.local` only — Session pooler URI from Supabase **Connect → Copy**, must be `SUPABASE_DB_URL=postgresql://...`; region must match project e.g. `us-west-2`)
- [x] `npm run test:e2e:prod:smoke -- --workers=1` (verify: **40/42 passed, 2 advisory skips** — 2026-06-09; `.env.test.prod` live `PLAYWRIGHT_ADVISOR_FIRM_*` aligned with Vercel `STRIPE_PRICE_ADVISOR_*_MONTHLY`; skips: webhook (`PLAYWRIGHT_STRIPE_WEBHOOK_SECRET` unset) + referral 429 (in-memory limits without Upstash); `--workers=1`)

### B2. TERMS-1

- [x] Signup checkbox sets `terms_accepted_at` on account creation (verify: `app/(auth)/signup/_signup-form.tsx:64-67,73,101` — metadata on `signUp`; email-confirm path syncs profile via `app/auth/callback/route.ts:40-54` → `recordTermsAcceptance`)
- **Deferred (post-B&O-READY, not blocking launch):** persist `terms_version` at signup — checkbox/metadata today writes only `terms_accepted_at`; `recordTermsAcceptance` sets `terms_version` from `TERMS_OF_SERVICE_VERSION` (`lib/legal/terms-of-service-sections.ts:5`) on callback/accept page, not in signup metadata. Follow-up: add `terms_version` to signup metadata or call `recordTermsAcceptance` on immediate session path.

### B3. CI discipline (solo policy — no secrets in GitHub)

**Hard rule:** Do **not** add Supabase keys, service roles, `PLAYWRIGHT_*`, Stripe, Resend, cron secrets, or `SUPABASE_DB_URL` to GitHub Actions **while production and CI share one Supabase project**. Only `.github/workflows/ci.yml` (`verify`) runs in GitHub — no repository secrets.

**Enforcement (automated):** GitHub branch protection on `main` — require status check **`verify`** only; require PR before merge; no direct pushes to `main`.

**Enforcement (manual — mandatory):** See [ENVIRONMENT_TESTING.md § Release discipline](./ENVIRONMENT_TESTING.md#release-discipline--what-to-run-when) for commit-type → command matrix.

- [x] Branch protection on `main`: **`verify` required**; PR required; admins included (attest: Al / 2026-06-13)
- [x] Confirm **no** GitHub Actions secrets/variables for Supabase, Stripe, or E2E (attest: Al / 2026-06-13 — removed legacy `CRON_SECRET`; secrets/variables empty)
- [x] Local release discipline adopted: `release:local` before PR; `release:preflight` before merge when touching sensitive paths; `release:post-deploy` after prod deploy when required (attest: Al / 2026-06-13)

**Deferred until second Supabase exists:** restore E2E/RLS workflows from [docs/templates/github-workflows/](./templates/github-workflows/README.md).

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
- [ ] Optional: Upstash Redis for referral rate limits (falls back to in-memory; prod smoke skips 429 assertion until configured)

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
| Local minimum (any PR) | `npm run release:local` |
| Local full (sensitive paths — see ENVIRONMENT_TESTING) | `npm run release:preflight -- --workers=1` |
| Preview | Vercel Preview build green + spot-check if auth/billing touched |
| CI (GitHub — **no secrets**) | **`verify` only** — lint, build (placeholders), unit tests |
| Production (after deploy) | `npm run release:post-deploy` (+ optional `test:e2e:prod:smoke`) |

**Credential policy:** [ENVIRONMENT_TESTING.md § Hard rule — no secrets in GitHub](./ENVIRONMENT_TESTING.md#hard-rule--no-secrets-in-github). **Commit-type matrix:** [ENVIRONMENT_TESTING.md § Release discipline](./ENVIRONMENT_TESTING.md#release-discipline--what-to-run-when).

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

## Prompt 2 sweep scoreboard (2026-06-09)

**Bucket B:** **17 of 38** checked (21 open).

**Checked this sweep:** B1 Vercel redeploy · B1 release:preflight (full green) · B1 go-live-profile (17/17) · B1 security-isolation (10/10) · B1 cross-role · B1 post-deploy (Voels 7/7 + RLS 3/3) · B1 prod smoke (40/42, 2 advisory skips) · B2 TERMS-1 · B6 legal placeholders (prior) · B7 PROTECTED + purge guards · B8 robots/security/deletion/billing/prod harness (prior).

**Still open — verify (re-run locally):**

| Item | Action |
|------|--------|
| B1 prod smoke optional passes | Set `PLAYWRIGHT_STRIPE_WEBHOOK_SECRET` (live `whsec_`) in `.env.test.prod`; enable Upstash on Vercel for 429 test |
| B3 branch protection (`verify` only) | GitHub → Settings → Branches → `main` → require PR + `verify`; confirm no Action secrets |
| B5 Vercel Stripe env names | `vercel env ls production` |
| B8 signup defaults on prod | Fresh signup → `subscription_status = 'none'`, `consumer_tier = 1` |

**Still open — attest (Al):** B4 all 5 manual smokes · B5 live keys/catalog/C-4/card smoke · B6 counsel/LLC/bank/B&O/email · B7 purge execution (last).

**B&O/DOR note:** B6 B&O registration may be doable pre-ruling — confirm sequencing with accountant before filing.
