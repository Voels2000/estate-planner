# LAUNCH_GATE.md
# The single go-live sign-off checklist for My Wealth Maps
# Last updated: 2026-06-10
#
# This file absorbs: PRE_LAUNCH_CHECKLIST.md, LEGAL_TODO.md,
# BILLING_DISCLOSURES_CHECKLIST.md, and the non-code sections of LAUNCH_CHECKLIST.md.
# Engineering reference docs (RELEASE_ROUTINE, PLAYWRIGHT_E2E, CALCULATION_ENGINES,
# MASTER_ARCHITECTURE, SCORE_TAXONOMY) are NOT absorbed — they remain standalone.
#
# Rule: Do NOT set PUBLIC_SIGNUP_OPEN=true until every blocker in Gate 1 is checked.

---

## Gate 1 — Must be complete before PUBLIC_SIGNUP_OPEN=true

### Legal

[ ] WA LLC entity confirmed: UBI number on file, EIN confirmed, registered agent named
    (registered agent name/address in product: Alan Voels, 22033 Echo Lake Rd, Snohomish, WA 98296)
[ ] ToS §10 (Disclaimer of Warranties) — counsel sign-off
[ ] ToS §11 (Limitation of Liability) — counsel sign-off
[ ] ToS §13 (Governing Law / Dispute Resolution) — counsel sign-off
[x] Legal placeholders committed in `lib/legal/company.ts` → `/terms` and `/privacy`:
    **My Wealth Maps LLC** · 22033 Echo Lake Rd, Snohomish, WA 98296 · registered agent Alan Voels
[ ] WA SaaS sales tax position confirmed (DOR ruling or attorney opinion)
    — see June 2026 LLC session; this is the murkiest open compliance item

### Entity & banking

[ ] WA LLC UBI number confirmed active on WA SOS
[ ] EIN confirmed (IRS letter or online verification)
[ ] Business bank account open and linked
[ ] B&O tax account registered with WA DOR (required before first revenue)

### Stripe

[ ] Stripe production secret key set in Vercel Production env vars
[ ] Stripe production webhook secret set in Vercel Production env vars
[ ] Phase 2 live price catalog created in Stripe Dashboard:
    - Financial Monthly / Annual
    - Retirement Monthly / Annual
    - Estate Monthly / Annual (14-day trial)
    - Attorney Starter Monthly
    - Attorney Growth Monthly
[ ] Stripe price IDs set in Vercel Production:
    STRIPE_PRICE_FINANCIAL_MONTHLY, _ANNUAL
    STRIPE_PRICE_RETIREMENT_MONTHLY, _ANNUAL
    STRIPE_PRICE_ESTATE_MONTHLY, _ANNUAL
    STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY
    STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY
[ ] C-4 manual walkthrough completed on production:
    signup → select plan → checkout → confirm subscription active in Stripe
    → cancel → confirm cancellation webhook → confirm deletion scheduled +30d
    See BILLING_DISCLOSURES_CHECKLIST.md for the full walkthrough steps (retained as
    reference; this checkbox is the sign-off)

### Email aliases

[ ] security@mywealthmaps.com active and forwarding
[ ] legal@mywealthmaps.com active and forwarding
[ ] privacy@mywealthmaps.com active (already routes to avoels@comcast.net per COMPLIANCE_EMAIL)

### TERMS-1 signup checkbox

[ ] Signup form checkbox: "I agree to the Terms of Service and Privacy Policy"
    sets terms_accepted_at + terms_version on account creation
    (Section F soft banner on dashboard for existing users without terms_accepted_at is separate)

### Pre-flip smoke

[ ] npm run test:e2e:go-live-profile — PASS
[ ] npm run test:e2e:security-isolation — PASS (10/10)
[ ] npm run test:e2e:cross-role — PASS (12/12)
[ ] npm run release:preflight — PASS (lint + build + RLS + OpenAPI)
[ ] robots.txt updated: disallow: / removed; public routes allowed; sitemap URL uncommented

---

## Gate 2 — Go-live day sequence (in order)

1. Verify Gate 1 — every checkbox above is checked
2. Supabase Auth → confirm email-confirm flow is ON for production project
3. Verify /auth/callback works on production (sign in with existing account)
4. Set PUBLIC_SIGNUP_OPEN=true in Vercel Production environment variables
5. Redeploy (trigger Vercel redeploy from dashboard or push empty commit)
6. Core smoke with a FRESH email address (not a test account):
   - Sign up → confirm email → profile → wizard → dashboard → billing upgrade
7. npm run release:post-deploy (Voels gate + RLS SQL verify)
8. Check Stripe Dashboard: new subscription appears under the fresh signup customer

---

## Gate 3 — Post-launch ops (first 72 hours)

[ ] Day 1: Verify first real signup appears in Supabase auth.users
[ ] Day 1: Confirm drip step 1 email delivered (check Resend activity log)
[ ] Day 3+: npm run verify:drip -- --email [first real signup email] — confirms step 2 scheduled
[ ] Day 7: Attorney drip steps 2 & 3 — manual DB check once a real attorney has registered:
    SELECT attorney_drip_step_1_sent_at, attorney_drip_step_2_sent_at, attorney_drip_step_3_sent_at
    FROM profiles WHERE role = 'attorney' LIMIT 5;
[ ] Week 1: Check Vercel logs for any [triggerEstateHealthRecompute] errors
[ ] Week 1: Check compliance cron is running — COMPLIANCE_EMAIL inbox for any alerts

---

## Reference docs (not absorbed — read these for detail)

| Need | Go to |
|------|-------|
| Release gate sequence (local → preview → CI → prod) | RELEASE_ROUTINE.md |
| E2E test commands and spec inventory | PLAYWRIGHT_E2E.md |
| Post-deploy automated gate details | GO_LIVE_E2E.md |
| Stripe walkthrough steps (C-4 detail) | BILLING_DISCLOSURES_CHECKLIST.md |
| Tax engine rules — read before any calc change | CALCULATION_ENGINES.md |
| Full system architecture | MASTER_ARCHITECTURE.md |
| Score labels and surfaces | SCORE_TAXONOMY.md |
| UX language compliance rules | UX_LANGUAGE_POLICY.md |
| Compliance calendar (B&O, DPA, audits) | COMPLIANCE_CALENDAR.md |
| Session handoff / active sprint | NEXT_SESSION.md |

---

## Retired files (safe to delete after this sprint)

The following files are fully absorbed into LAUNCH_GATE.md.
Before deleting, grep for any references to these filenames in code or other docs
and update them to point to LAUNCH_GATE.md:

- docs/PRE_LAUNCH_CHECKLIST.md → absorbed
- docs/LEGAL_TODO.md → absorbed (legal items are now in Gate 1)
- docs/BUSINESS_READINESS_PLAN.md → absorbed (~88% complete items now in Gate 1)

The following files are RETAINED as standalone reference (do not delete):
- docs/BILLING_DISCLOSURES_CHECKLIST.md (C-4 walkthrough steps are too detailed to inline)
- docs/LAUNCH_CHECKLIST.md (product/technical go-live sequence; Gate 2 summarizes the flip)
- docs/GO_LIVE_E2E.md (pre-flip E2E test detail)
- docs/UPDATE_CHECKLIST.md (per-merge doc sync discipline)
