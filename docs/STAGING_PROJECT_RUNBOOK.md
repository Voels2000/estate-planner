# Staging project setup runbook — and closing Probe 1

**Goal:** a **dedicated staging Vercel project** with a stable URL and its own variable set, so Preview-scope / Development-scope confusion structurally disappears and Probe 1 closes on a surface you'll keep.

**Related:** [WAITLIST_HARDENING_SPEC.md §10 attestation](./WAITLIST_HARDENING_SPEC.md#10-attestation--closed-2026-06-16) · [MASTER_ARCHITECTURE.md § Infrastructure](./MASTER_ARCHITECTURE.md#infrastructure-and-environments-2026-06-13) · [DEPLOYMENT.md](./DEPLOYMENT.md) · `lib/env/manifest.ts`

**Status (2026-06-16):** Move 1 complete · §10 matrix **6/6 PASS** on `https://estate-planner-staging.vercel.app`

---

## Why this fixes the confusion

Tonight's whole mess came from one repo deploying as **Preview** while you reasoned about it as "staging," with values landing on the wrong Vercel *scope* (the service-role key on Development instead of Preview). A separate project removes the ambiguity: a staging project deploys to **its own Production scope**, so there is exactly one place values live. You stop asking "Preview or Development?" because the project boundary answers it.

| | Staging project (new) | Production project (current) |
|---|---|---|
| Vercel scope you set values on | that project's **Production** scope | its **Production** scope |
| Stable URL | `staging.mywealthmaps.com` | `mywealthmaps.com` |
| Supabase | staging (`cmzyxpxfyvdvbsykjvsg`) | prod (`fnzvlmrqwcqwiqueevux`) |
| Stripe | test keys + test price IDs | live keys + live price IDs |
| `PUBLIC_SIGNUP_OPEN` | `true` | `false` until flip |
| Protection | Vercel Auth (at Pro) | public |

> "Production scope" here means *each project's own normal scope* — the staging project's Production scope holds **test** values. Same word, two projects, never crossed. That per-project boundary is the cure.

---

## Phase 1 — Create the project

1. New Vercel project from the **same GitHub repo** (`Voels2000/estate-planner`).
2. **Production Branch** decision:
   - **Durable (recommended):** create a long-lived `staging` branch; set the staging project's Production Branch = `staging`. You test a feature by merging it into `staging` first, then into `main` (prod) after it passes. Stable URL never changes per feature branch.
   - **Quick (to close Probe 1):** point the staging project's Production Branch at the waitlist-hardening branch temporarily, then switch it to `staging` / `main` once merged.
3. Don't attach `mywealthmaps.com` here — that stays on the prod project.

---

## Phase 2 — Set variables (on the staging project's Production scope)

Canonical source of truth for names: `lib/env/manifest.ts`. Set **all** of these on the staging project; missing one is exactly what broke Probe 1.

**Must differ from prod — set to TEST/STAGING values:**

- Supabase: `NEXT_PUBLIC_SUPABASE_URL` → `https://cmzyxpxfyvdvbsykjvsg.supabase.co` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` (staging) · **`SUPABASE_SERVICE_ROLE_KEY` (staging)** ← the one that was missing; do not skip
- Stripe keys: `STRIPE_SECRET_KEY` (`sk_test_`) · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_`) · `STRIPE_WEBHOOK_SECRET` (test webhook on the staging URL) — **all three from the same Stripe sandbox** (named sandbox keys ≠ default test-mode keys; price IDs are not portable across sandboxes)
- All 11 price IDs (test): `STRIPE_PRICE_FINANCIAL_MONTHLY/ANNUAL`, `STRIPE_PRICE_RETIREMENT_*`, `STRIPE_PRICE_ESTATE_*`, `STRIPE_PRICE_ADVISOR_STARTER/GROWTH/ENTERPRISE_MONTHLY`, `STRIPE_PRICE_ATTORNEY_STARTER/GROWTH_MONTHLY` — set all so the legacy hardcoded fallback never fires; IDs must match the sandbox that issued the `sk_test_` above
- `NEXT_PUBLIC_APP_URL` → the staging URL (`https://estate-planner-staging.vercel.app` or `https://staging.mywealthmaps.com`), **never** gules — used for emails, recompute, sitemap; **checkout return URLs use `getOrigin(request)`** (PR #93/#94), not this env var
- `PUBLIC_SIGNUP_OPEN` = `true` · `REQUIRE_PRIVILEGED_MFA` = `false` (or omit)
- Email: `RESEND_API_KEY` (sandbox), `EMAIL_FROM` (staging from-address), `COMPLIANCE_EMAIL` (optional)

**Same name, generate fresh per project (do not copy prod's value):**

`ADMIN_VERIFY_TOKEN`, `CRON_SECRET`, `RECOMPUTE_SECRET`, `INTERNAL_API_KEY`, `BETA_SIGNUP_TOKEN`

**Feature flags — set explicitly so behavior is defined:**

`WAITLIST_MODE`, `NEXT_PUBLIC_WAITLIST_MODE`, `NEXT_PUBLIC_SIGNUP_OPEN`, `B2B2C_*`, `NEXT_PUBLIC_ADVISOR_BENCHMARKS`, `UPSTASH_*` (optional), `NEXT_PUBLIC_SITE_URL`

**NEVER put on Vercel (local/scripts only):**

`SUPABASE_DB_URL`, `DATABASE_URL`, `RLS_VERIFY_REQUIRE_SQL`, all `PLAYWRIGHT_*`, `E2E_SKIP_RECOMPUTE`, `E2E_CANARY_PASSWORD` (prod canary only)

**`SIGNUP_SKIP_EMAIL_CONFIRM`** — may be `true` on staging for E2E, but it must NEVER reach prod (`verify-env` asserts unset on prod).

After setting: **redeploy** (env changes don't apply to an already-built deployment — this is the step that was missed).

### After re-keying Stripe (new sandbox or new test keys)

Vercel env is only half the fix — **staging `profiles` rows may still hold `stripe_customer_id` / `stripe_subscription_id` from the old environment.**

```bash
# Staging Supabase only (ref guard in script)
npm run reset:staging-stripe
```

Clears Stripe billing columns on all `@mywealthmaps.test` and canonical E2E emails. Then smoke: log in as `e2e-consumer-tier1@mywealthmaps.test` → `/billing` → Subscribe → `checkout.stripe.com`.

Code guards (deployed with PR #93/#94): `getOrigin(request)` for return URLs; `processConsumerCheckout` self-heals stale customer ids on checkout.

---

## Phase 3 — Stable URL + protection

- Add `staging.mywealthmaps.com` (CNAME) so the URL stops changing per branch — this retires the per-branch-Preview-URL drift for good.
- Deployment Protection (Vercel Authentication) on the staging project: enable at **Pro** (Hobby can't protect a project's Production scope). Until Pro, keep the URL un-advertised.

---

## Phase 4 — Make verify-env the tiebreaker

`GET /api/admin/verify-env` returns a non-secret **`boot`** block so the deployment reports what it actually resolved — ending the "I set it / it's wrong" loop:

- resolved `scope`, `vercel_env`
- Supabase **project ref** (parsed from URL, not the key)
- `NEXT_PUBLIC_APP_URL` hostname
- `service_role_present` (boolean only — never exposes the key)
- with `?live=1`: `liveness.supabase` confirms the service role works against that project

First-boot check against the staging URL:

```bash
curl -s -H "x-admin-token: $STAGING_ADMIN_VERIFY_TOKEN" \
  'https://staging.mywealthmaps.com/api/admin/verify-env?live=1' \
  | jq '{scope, boot, liveness: .liveness | {supabase, supabase_reason}}'
```

Want: `scope:"production"` (of the **staging** Vercel project), `boot.supabase_project_ref:"cmzyxpxfyvdvbsykjvsg"`, `boot.app_url_hostname:"staging.mywealthmaps.com"`, `boot.service_role_present:true`, `liveness.supabase:"LIVE_OK"`.

---

## Phase 5 — Close Probe 1 (and re-confirm 7) on the staging URL

```bash
# Probe 7 — anon bypass: expect 422 signup_disabled
POST https://cmzyxpxfyvdvbsykjvsg.supabase.co/auth/v1/signup

# Probe 1 — bright open_consumer: expect 201 + needsEmailConfirmation:true, NO Set-Cookie
POST https://staging.mywealthmaps.com/api/auth/signup  (open_consumer, PUBLIC_SIGNUP_OPEN=true)

# Probe 4 — valid beta token: expect 201 + session
# plus the rest of the §10 matrix — WAITLIST_HARDENING_SPEC.md §10
```

When Probe 1 returns `201` + `needsEmailConfirmation:true` with no cookie on this URL, the signup-hardening gate is **closed** on the deployed artifact.

---

## Appendix — if the service-role key still won't resolve

You added it to Preview and still got `Missing ... SUPABASE_SERVICE_ROLE_KEY`. On the clean project, rule out all three causes explicitly so it doesn't recur:

1. **Redeploy didn't pick it up** — confirm the deployment you're probing was built *after* the var was added (check the deployment timestamp vs the var's "updated" time). This is the most common.
2. **Bad paste / wrong scope** — re-paste with no leading/trailing whitespace or newline; confirm it's on the staging project's **Production** scope, not Development.
3. **Different name in a second code path** — grep for every reader of the service-role key (`SUPABASE_SERVICE_ROLE_KEY` and any alias) in `createAdminClient()` and elsewhere; confirm they all read the same var name. The verify-env `boot` block makes this self-evident — it reports whether the running deployment sees the key at all.
