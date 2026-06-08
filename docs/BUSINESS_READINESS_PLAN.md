# BUSINESS_READINESS_PLAN.md
# My Wealth Maps — Washington State Business Readiness Plan
# Last updated: May 30, 2026
# Status: Pre-open-signup | Waitlist active | mywealthmaps.com live

---

## Executive summary

My Wealth Maps is a Washington State SaaS company providing financial planning
preparation tools for US households with $2M–$30M in assets. The platform is
live at mywealthmaps.com in waitlist mode. Five compliance sprints have been
completed since launch. This document is the current-state business readiness
reference — combining technical, legal, regulatory, and operational status in
one place.

**Overall readiness: ~88% complete** (engineering/security smoke verified 2026-05-30).
Remaining blockers are non-code: legal review of ToS, company entity
placeholders, Stripe Dashboard configuration, and Supabase auth settings
to enable on go-live day. See [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) for the full 🔴 gate list.

---

## Part 1 — Washington State business formation

### Entity and registration

| Requirement | Status | Action required |
|-------------|--------|-----------------|
| WA LLC or Corp formed with Secretary of State | ⚠️ Confirm | Verify Articles of Organization or Incorporation are filed; obtain confirmation number |
| UBI number (WA Dept. of Revenue) | ⚠️ Confirm | Required before conducting business; triggers B&O tax account |
| WA Business License (state) | ⚠️ Confirm | File at dor.wa.gov if not already done |
| City/local business license | ⚠️ Confirm | Required if registered address is in Seattle or another WA city |
| Registered agent with WA address | ⚠️ Confirm | Required for LLC/Corp; person or service with physical WA address |
| Founder/member operating agreement | ⚠️ Confirm | Defines ownership, IP assignment, roles — required before investors |
| EIN from IRS | ⚠️ Confirm | Required for business bank account, payroll, and tax filings |

**Note:** Three `TODO` placeholders remain in the live `/privacy` and `/terms`
pages: `COMPANY LEGAL NAME`, `COMPANY ADDRESS`, and `REGISTERED AGENT NAME
AND ADDRESS`. These must be replaced with actual entity information before
opening public signups. See `docs/LEGAL_TODO.md`.

---

### Washington tax obligations

| Obligation | Frequency | Status |
|------------|-----------|--------|
| WA B&O tax (Business & Occupation) — gross receipts | Monthly or quarterly per DOR | ⚠️ Register and begin filing once revenue starts |
| WA sales tax on SaaS ("digital automated services") | Per nexus | ⚠️ Requires legal determination — SaaS taxability in WA is a gray area; get CPA opinion before first subscriber |
| Federal income tax (pass-through or C-Corp) | Annual | ⚠️ Confirm entity election with CPA |
| Multi-state economic nexus | As triggered ($100K revenue or 200 transactions per state) | ⚠️ Configure Stripe Tax or TaxJar before reaching first nexus threshold |

---

## Part 2 — Compliance sprints completed

All five compliance sprints are code-complete and committed to main.

### Sprint C-2b — UX Language Audit ✅
**Commit:** `788aa08` | **Date:** 2026-05-24

**Problem solved:** Platform outputs were framed as financial directives rather
than educational calculations, creating investment adviser registration risk
under Section 202(a)(11) of the Investment Advisers Act of 1940.

**What was done:**
- Audited every consumer-facing surface against a safe/directive language rubric
- Resolved 32 flagged instances across Monte Carlo, Roth conversion, strategies
  tab, social security, domicile analysis, asset allocation, and 24 event pages
- Created `lib/compliance/language-policy.ts` — permanent codebase policy with
  `DISCLAIMER_STRINGS` object (dashboard, projections, Monte Carlo, Roth,
  estate tax, strategy panels, PDF export, assessment, footer, attorney relationship)
- Created `scripts/audit-ux-language.sh` — grep-based CI script that enforces
  the policy on every PR
- Added inline disclaimers to: dashboard, `/projections`, `/monte-carlo`,
  `/allocation`, `/roth`, `/assess`, `/my-attorney`
- Wired all four follow-up disclaimer surfaces: PDF export cover page,
  `/estate-tax`, `/my-estate-strategy`, global footer and homepage

**Ongoing:** `scripts/audit-ux-language.sh` runs in CI on every PR touching
consumer-facing files. Currently passing 0 findings.

**Legal basis:** Platform is positioned as a financial planning preparation tool,
not an investment adviser. Outputs are framed as calculations from user-entered
inputs, not professional recommendations. All strategy education is generic;
personalized recommendations come only from licensed advisors connected by the user.

---

### Sprint C-3 — Security and Data Compliance ✅
**Commits:** `236890c`, `56a4407`, `cda2ccc`, `d854c05` | **Date:** 2026-05-24 to 2026-06-02

**What was done:**

**RLS (Row-Level Security):**
- Confirmed RLS enabled on all 100+ tables in the public schema
- Fixed critical data leak: `businesses` advisor policy was `USING (auth.uid()
  IS NOT NULL)` — any signed-in user could read all business records. Fixed to
  proper `advisor_clients` join scoped to connected clients only
- Added policies to `monte_carlo_runs` (was zero policies — all non-service-role
  access blocked)
- Extended all advisor join policies to include `'accepted'` status, consistent
  with `CONNECTED_ADVISOR_CLIENT_STATUSES` in `lib/advisor/clientConnectionStatus.ts`
- Added read-only policies to 6 reference/config tables with RLS on but no policies
- Added `WITH CHECK` to `advisor_clients` ALL policy
- Added INSERT policy to `profiles`
- Migration: `20260602000000_sprint_c3_rls_fixes.sql` — applied to production
- Pre-launch (2026-05-27): `20260527150000_prelaunch_rls_household_scope.sql` — six tables (`gst_ledger`, `liquidity_analysis`, `monte_carlo_results`, `domicile_schedule`, `domicile_analysis`, `strategy_configs`); `verify-loose-rls-policies.sql` zero rows on prod; GST writes via `/api/advisor/gst-entry`

**Authentication:**
- Created missing `/auth/callback` route — email confirmation and password reset
  links were 404ing; now exchanges auth code for session and redirects correctly
- Created `/auth/confirm-email` page — shown after signup instead of auto-signing
  in; includes resend confirmation button
- Fixed signup form: removed `signInWithPassword` call that immediately bypassed
  email verification; users now land on confirmation pending screen
- Wired AAL2 MFA enforcement in middleware — users who have enrolled a TOTP
  factor are redirected to `/mfa-challenge` if they haven't verified this session
- MFA enrollment UI existed (`/mfa-enroll`) — now actually enforced at login

**Note:** Supabase Dashboard auth settings (email confirmations ON, secure email
change ON, minimum password 12 characters) are intentionally deferred to
go-live day to avoid breaking test accounts during development.

**Security hardening:**
- Added security headers to `next.config.ts`: HSTS, CSP, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Removed PII from `console.log` in signup form and Stripe webhook handler
- Added auth guard to `/api/email/welcome` (was unauthenticated)
- Created `scripts/security-audit.sh` — CI script checking for exposed keys,
  PII logging, missing webhook verification; currently passing 0 findings
- Created `scripts/gdpr-delete-user.ts` — WCPA right-to-delete implementation
- Created `docs/COMPLIANCE_CALENDAR.md` — weekly/monthly/quarterly/annual
  compliance routine schedule

**Encryption:** Supabase provides AES-256 at rest and TLS in transit (platform-managed).
No application-level field encryption needed for this stack at current scale.

---

### Sprint C-4 — Stripe Billing Disclosures ✅
**Commit:** `462bda9` | **Date:** 2026-06-02

**Regulatory basis:** Washington RCW 19.316 (automatic renewal law) and FTC
Negative Option Rule (2024).

**What was done:**
- Created `lib/compliance/billing-disclosures.ts` — central strings for
  pre-checkout disclosure, active subscription notice, cancellation confirmation,
  and renewal reminder email
- Wired pre-checkout disclosure above the payment CTA on billing and firm
  billing pages, and on the pricing page for logged-in users
- Added visible "Cancel subscription" button to `/billing` page (was not wired
  in UI despite the API existing)
- Fixed cancel route to resolve subscription via `stripe_customer_id` when
  `stripe_subscription_id` missing
- Webhook now persists `stripe_subscription_id` on consumer checkout session
- Added `invoice.upcoming` webhook handler — sends renewal reminder email 7
  days before each renewal via Resend, with dedup via Stripe subscription metadata
- Added Washington RCW notice to pricing page below consumer plan grid

**Remaining manual steps (Stripe Dashboard — do on go-live day):**
- Enable `invoice.upcoming` webhook event
- Enable Customer Portal cancellation
- Enable receipt emails

---

### Sprint C-5 — Privacy Policy and Terms of Service ✅
**Commit:** `695a860` | **Date:** 2026-06-02

**What was done:**
- Created `/privacy` — full 13-section Privacy Policy (WCPA compliant,
  Washington My Health MY Data Act aware, breach notification per
  RCW 19.255.010, 45-day right-to-delete response window)
- Created `/terms` — full 16-section Terms of Service (RCW 19.316 auto-renewal
  language in Section 5.2, Washington governing law, AAA arbitration, class
  action waiver)
- Moved post-checkout acceptance to `/terms/accept` (resolved route conflict
  with existing auth terms flow)
- Added `LegalFooterLinks` to public layout, homepage, and `DisclaimerBanner`
- Added `/privacy` and `/terms` to sitemap and robots.txt
- Updated billing disclosures to reference ToS and Privacy Policy
- Created `docs/LEGAL_TODO.md` — pre-go-live legal review checklist

**Remaining before go-live (legal, not code):**
- Replace 3 TODO placeholders with actual entity information
- Set up `privacy@`, `security@`, and `legal@` email aliases
- Legal review of ToS Sections 10 (disclaimers), 11 (liability cap),
  13 (arbitration clause and class action waiver)
- Legal review of Privacy Policy Sections 4 (WCPA legal basis) and
  10 (breach notification timeline)
- Sync `app_config.terms_sections` with `/terms` after counsel sign-off — **done 2026-05-27** (code is canonical; migration `20260527120000_sync_terms_app_config_mwm.sql` mirrors to DB)

---

## Part 3 — Security posture summary

| Area | Status | Detail |
|------|--------|--------|
| Encryption at rest | ✅ | AES-256 via Supabase (platform-managed) |
| Encryption in transit | ✅ | TLS 1.2+ enforced; HSTS header active |
| Row-level security | ✅ | All 100+ tables; household isolation verified |
| Authentication | ✅ Code-ready | Email verify + MFA code shipped; Dashboard settings deferred to go-live |
| MFA | ✅ Enforced | TOTP enrollment at `/mfa-enroll`; AAL2 middleware check active |
| Session management | ⚠️ Confirm | JWT expiry — verify in Supabase Dashboard (target: 3600s, not default 604800s) |
| Security headers | ✅ | HSTS, CSP, X-Frame-Options, X-Content-Type-Options live in `next.config.ts` |
| Stripe webhook | ✅ | `constructEvent` signature verification on all webhook endpoints |
| Service role key | ✅ | Server-only; never in client bundles or `NEXT_PUBLIC_` vars |
| PII logging | ✅ | Removed from signup form and Stripe webhook |
| API auth guards | ✅ | `/api/email/welcome` and all consumer routes require auth |
| Audit scripts | ✅ | `audit-ux-language.sh` and `security-audit.sh` both passing 0 findings |
| Cyber liability insurance | ⚠️ Not yet | Get policy before reaching 500 users or $1M ARR |
| SOC 2 | ⚠️ Roadmap | Begin Type 1 readiness within 6 months of launch |
| DPAs with processors | ⚠️ Confirm | Supabase, Vercel, Resend, Stripe DPAs — confirm signed |

---

## Part 4 — Go-live checklist (complete state)

### Non-code blockers (must complete before flipping `PUBLIC_SIGNUP_OPEN=true`)

**Legal:**
- [ ] Replace `TODO: [COMPANY LEGAL NAME]` in `/privacy` and `/terms`
- [ ] Replace `TODO: [COMPANY ADDRESS]` in `/privacy` and `/terms`
- [ ] Replace `TODO: [REGISTERED AGENT NAME AND ADDRESS]` in `/privacy`
- [ ] Set up `privacy@mywealthmaps.com` email alias
- [ ] Set up `security@mywealthmaps.com` email alias
- [ ] Set up `legal@mywealthmaps.com` email alias
- [ ] Counsel sign-off — ToS Section 10 (disclaimers)
- [ ] Counsel sign-off — ToS Section 11 (liability cap amount)
- [ ] Counsel sign-off — ToS Section 13 (arbitration, class action waiver)
- [ ] Counsel sign-off — Privacy Policy Section 4 (WCPA legal basis)

**Stripe Dashboard:**
- [ ] Enable `invoice.upcoming` webhook event
- [ ] Enable Customer Portal cancellation
- [ ] Enable receipt emails
- [ ] Confirm Stripe production keys are in Vercel env vars

**Business formation:**
- [ ] WA Secretary of State entity confirmed active
- [ ] UBI number obtained and B&O tax account open
- [ ] WA sales tax on SaaS — legal determination made

### Go-live day sequence (exact order)

1. Supabase Dashboard → Authentication → Settings:
   - Enable email confirmations → ON
   - Secure email change → ON
   - Minimum password length → 12

2. Verify `/auth/callback` route on staging with a fresh test email:
   - Sign up → receive confirmation email → click link → lands on `/dashboard`
   - Password reset → click link → lands on `/reset-password`

3. Vercel Production → add `PUBLIC_SIGNUP_OPEN=true` → redeploy

4. Verify on production:
   - `mywealthmaps.com/signup` shows signup form (not waitlist redirect)
   - Homepage "Get Started" → `/signup`
   - `/login` still works
   - New signup → confirm email → login → dashboard (full flow)

5. Run Core §1–3 smoke test on production
   (`docs/CONSUMER_RELEASE_SMOKE_TEST.md`)

6. Monitor for 24 hours:
   - Supabase Auth logs for unusual patterns
   - Vercel for 5xx errors
   - Stripe for webhook delivery failures
   - Resend for bounce/complaint rate

---

## Part 5 — Ongoing compliance calendar

### Every deployment
- `bash scripts/audit-ux-language.sh` — 0 findings required (CI enforced)
- `bash scripts/security-audit.sh` — 0 findings required (CI enforced)

### Weekly
- Review Supabase Auth logs for unusual login patterns
- Check Vercel deployment logs for 5xx errors on API routes
- Review Stripe webhook delivery failures

### Monthly
- Run `bash scripts/security-audit.sh` manually and review full output
- Confirm Supabase backups running (Dashboard → Database → Backups)
- Review Resend bounce/complaint rate — keep below 0.1%
- Run test deletion dry-run: `npx tsx scripts/gdpr-delete-user.ts --dry-run`

### Quarterly
- WA B&O tax return (file by DOR schedule)
- Review Privacy Policy and ToS against new state privacy laws
- RLS audit: run SQL queries from Sprint C-3 in Supabase SQL editor
- Rotate `RECOMPUTE_SECRET`, `INTERNAL_API_KEY`, `CRON_SECRET` in Vercel
- Review CAN-SPAM compliance for all 24 drip sequences

### Annually
- WA Annual Business License renewal (Washington SOS)
- Registered agent renewal
- Full ToS and Privacy Policy legal review
- SOC 2 readiness progress review
- Cyber liability insurance renewal
- Review all third-party DPAs (Supabase, Vercel, Resend, Stripe)
- Trademark renewal check for "My Wealth Maps"

### On-demand — user requests
- Right-to-delete: `npx tsx scripts/gdpr-delete-user.ts --email user@example.com`
  Respond within 45 days (WCPA requirement)
- Right-to-access: export household data from Supabase for that `household_id`
  Respond within 45 days
- Data breach: notify affected users within 30 days (RCW 19.255.010);
  if >500 WA residents, notify WA Attorney General

---

## Part 6 — Regulatory exposure summary

| Risk area | Exposure level | Mitigation |
|-----------|---------------|------------|
| Investment adviser registration | Low-Medium | Language audit complete; outputs framed as calculations not advice; no securities allocation recommendations; `language-policy.ts` enforced in CI |
| Attorney referral (WA RPC 7.2) | Low | Directory model (not per-referral fees); attorney agreements needed before network scales |
| Washington WCPA / data privacy | Low | Privacy Policy live; right-to-delete script built; MHMD review needed if health data scope expands |
| WA auto-renewal law (RCW 19.316) | Low | Disclosures wired pre-checkout; renewal reminder email; self-serve cancel live |
| FTC Negative Option Rule | Low | Click-to-cancel via Customer Portal; 7-day renewal reminder; no dark patterns |
| CAN-SPAM / Resend drip | Low | Unsubscribe in all 24 sequences; physical address required in footer |
| WA breach notification (RCW 19.255.010) | Low | 30-day notification window documented; `COMPLIANCE_CALENDAR.md` |
| Multi-state sales tax | Medium | No nexus yet; configure Stripe Tax before first threshold; legal determination on WA SaaS taxability needed |
| Employment (if hiring) | Not yet triggered | L&I, ESD registration required on first hire; ABC contractor test |
| Trademark | Low | Search recommended before significant brand investment |

---

## Part 7 — Document relationships

| Question | Document |
|----------|----------|
| What is our overall business and compliance readiness? | `docs/BUSINESS_READINESS_PLAN.md` |
| What is our product strategy and market position? | `docs/PRODUCT_STRATEGY.md` |
| What sprints are complete and what's next? | `docs/ROADMAP.md` |
| What is the current session working on? | `docs/NEXT_SESSION.md` |
| What needs to happen before go-live? | `docs/LAUNCH_CHECKLIST.md` |
| What legal items need counsel review? | `docs/LEGAL_TODO.md` |
| What compliance routines run on what schedule? | `docs/COMPLIANCE_CALENDAR.md` |
| How do consumers navigate the app? | `docs/CONSUMER_NAV_MAP.md` |
| How do specific features work end-to-end? | `docs/CONSUMER_FLOWS.md` |
| What are the platform language rules? | `docs/UX_LANGUAGE_POLICY.md` · `lib/compliance/language-policy.ts` |
| What are the billing disclosure strings? | `lib/compliance/billing-disclosures.ts` |
| How do we verify a release? | `docs/CONSUMER_RELEASE_SMOKE_TEST.md` |
| What performance work shipped pre-launch? | `docs/archive/sprints/PERF_SPRINT_P1.md` (P-1 + P-2) |
| What changed in which session? | `docs/SCHEMA_CHANGELOG.md` |
| What needs updating before a merge? | `docs/UPDATE_CHECKLIST.md` |

---

## Part 8 — Committed compliance artifacts

All of the following are committed to `main` and live on production:

| File | Purpose |
|------|---------|
| `lib/compliance/language-policy.ts` | Banned phrases, disclaimer strings, legal basis |
| `lib/compliance/billing-disclosures.ts` | RCW 19.316 disclosure strings, LEGAL_URLS |
| `scripts/audit-ux-language.sh` | CI language audit — 0 findings |
| `scripts/security-audit.sh` | CI security audit — 0 findings |
| `scripts/gdpr-delete-user.ts` | WCPA right-to-delete implementation |
| `app/auth/callback/route.ts` | Email confirmation + password reset handler |
| `app/(auth)/confirm-email/page.tsx` | Post-signup confirmation pending page |
| `app/(public)/privacy/page.tsx` | Privacy Policy (WCPA compliant) |
| `app/(public)/terms/page.tsx` | Terms of Service (RCW 19.316, WA law) |
| `supabase/migrations/20260602000000_sprint_c3_rls_fixes.sql` | RLS security fixes |
| `docs/COMPLIANCE_CALENDAR.md` | Ongoing compliance schedule |
| `docs/LEGAL_TODO.md` | Pre-go-live legal review checklist |
| `docs/BILLING_DISCLOSURES_CHECKLIST.md` | Stripe Dashboard manual checklist |
| `docs/archive/sprints/PERF_SPRINT_P1.md` | Sprint P-1 + P-2 performance refactors |
| `scripts/perf-diagnostic.sql` | Supabase performance diagnostic queries |
| `.github/workflows/ux-language-audit.yml` | CI enforcement on every PR |

---

*My Wealth Maps | Washington State | Business Readiness Plan*
*Last updated: June 2, 2026 | Next review: go-live day*
