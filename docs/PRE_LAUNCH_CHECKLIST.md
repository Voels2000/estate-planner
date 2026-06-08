# PRE_LAUNCH_CHECKLIST.md
# My Wealth Maps — Complete Pre-Launch Requirements
# Last updated: 2026-06-08
#
# HOW TO USE THIS FILE
# Work through each section in order. Mark items [x] as completed.
# Do NOT set PUBLIC_SIGNUP_OPEN=true until every 🔴 item is checked.
# Share this file with counsel when requesting sign-off.
#
# Related: [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) (product gates + go-live ops)
#          [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) (purge + re-seed detail)
#          [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) (deletion SOP + compliance tables)
#          [LEGAL_TODO.md](./LEGAL_TODO.md) · [BUSINESS_READINESS_PLAN.md](./BUSINESS_READINESS_PLAN.md)

---

## STATUS LEGEND
# 🔴 HARD BLOCKER — cannot go live without this
# 🟡 SHOULD DO — high risk if skipped at launch
# 🟢 CONFIRM — lower risk but must be documented

---

## SECTION 1 — LEGAL DOCUMENTS 🔴

### 1.1 Placeholder Replacement
Items that require your actual entity details. Replace in /privacy and /terms.

- [ ] Obtain entity legal name from WA Secretary of State filing
- [ ] Obtain registered business address
- [ ] Obtain registered agent name and address (if using a registered agent service)
- [ ] Run find-and-replace in codebase:
      Search:  TODO: [COMPANY LEGAL NAME]
      Replace: [Your LLC/Corp name exactly as filed]
      Files:   lib/legal/privacy-policy-sections.ts
               lib/legal/terms-of-service-sections.ts

- [ ] Run find-and-replace:
      Search:  TODO: [COMPANY ADDRESS]
      Replace: [Your business address]
      Files:   lib/legal/privacy-policy-sections.ts
               lib/legal/terms-of-service-sections.ts

- [ ] Run find-and-replace:
      Search:  TODO: [REGISTERED AGENT NAME AND ADDRESS]
      Replace: [Registered agent details]
      Files:   lib/legal/privacy-policy-sections.ts

- [ ] Commit: git commit -m "legal: replace TODO placeholders with actual entity details"
- [ ] Verify on production: /privacy and /terms show no TODO text

### 1.2 Counsel Review (send these four sections to your attorney)
Do not go live without written confirmation on each.

- [ ] ToS Section 10 — Financial disclaimers
      Issue: Must be strong enough to establish "not investment advice" under
      Investment Advisers Act publisher exclusion
      Action: Attorney confirms language sufficient + confirms no IA registration needed in WA

- [ ] ToS Section 11 — Liability cap dollar amount
      Issue: Currently blank — needs a specific dollar amount
      Action: Attorney recommends amount (typically 12 months of subscription fees)

- [ ] ToS Section 13 — Arbitration clause + class action waiver
      Issue: WA has specific requirements; some clauses are unenforceable in WA
      Action: Attorney confirms clause is enforceable under RCW + WA consumer protection law

- [ ] Privacy Policy Section 4 — WCPA legal basis for data processing
      Issue: Washington Consumer Protection Act (WCPA) and My Health MY Data Act (MHMD)
      may apply to incapacity planning data
      Action: Attorney confirms legal basis + confirms MHMD does not apply or is addressed

- [ ] Update /terms and /privacy in app_config with counsel's final language
- [ ] Commit final legal language before go-live

### 1.3 Regulatory Confirmation
- [ ] Counsel confirms in writing: platform's "planning preparation" framing +
      disclaimer language keeps product in publisher exclusion (not investment advice)
      under Section 202(a)(11) of Investment Advisers Act
- [ ] Counsel confirms: no WA DFI investment adviser registration required
- [ ] Document counsel's confirmation in DECISION_LOG.md

---

## SECTION 2 — WASHINGTON STATE BUSINESS FORMATION 🔴

### 2.1 Entity Formation
- [ ] WA LLC or Corp confirmed active with Secretary of State
      Verify at: https://ccfs.sos.wa.gov
      Look for: Active status, correct entity name, registered agent listed

- [ ] EIN (Employer Identification Number) obtained from IRS
      Required for: Stripe live mode activation, WA B&O tax account, banking
      Apply at: https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online

- [ ] UBI (Unified Business Identifier) number obtained
      Same as WA business registration number — shown on your SOS filing

- [ ] B&O (Business & Occupations) tax account open with WA DOR
      Register at: https://dor.wa.gov/open-business/apply-business-license
      Required before: collecting revenue from WA customers

### 2.2 Tax Determinations
- [ ] WA sales tax on SaaS — legal determination documented
      Issue: WA taxes some SaaS under "digital automated services" — subscription
      software may be taxable depending on how it is classified
      Action: Either obtain counsel opinion OR contact WA DOR for informal guidance
      OR register and collect as a conservative approach
      Document determination in DECISION_LOG.md

- [ ] Confirm: no other state nexus (if advisors/attorneys in other states use the
      platform, sales tax nexus rules in those states may apply after thresholds)
      Action: Monitor — not a day-1 issue but document the plan

---

## SECTION 3 — EMAIL ALIASES 🔴
# Required by WCPA — must be real working addresses, not placeholders

- [x] privacy@mywealthmaps.com — Resend verified 2026-05-25 ([LEGAL_TODO.md](./LEGAL_TODO.md))
      Forward to: avoels@comcast.net
      Verify: Send test email to privacy@mywealthmaps.com → confirm receipt

- [ ] security@mywealthmaps.com
      Action: Cloudflare dashboard → Email Routing → Add address
      Forward to: avoels@comcast.net
      Verify: Send test email → confirm receipt

- [ ] legal@mywealthmaps.com
      Action: Cloudflare dashboard → Email Routing → Add address
      Forward to: avoels@comcast.net
      Verify: Send test email → confirm receipt

- [ ] hello@mywealthmaps.com — confirm forwarding works (used in Resend sends)
- [ ] noreply@mywealthmaps.com — confirm forwarding or set up if replies expected

---

## SECTION 4 — SUPABASE AUTH SETTINGS 🔴
# Currently relaxed for testing — tighten before go-live
# Location: Supabase Dashboard → Authentication → Settings

- [ ] Email confirmations → ON
      Warning: Enabling this will require ALL new signups to confirm email before
      accessing the platform. Test with a fresh email before opening public signups.

- [ ] Secure email change → ON
      Requires users to confirm new email address before it takes effect

- [ ] Minimum password length → 12
      Currently likely set lower for testing convenience

- [ ] Verify after enabling: complete full signup flow with a fresh test email
      Sign up → receive confirmation email → click link → land on /dashboard
      Password reset → click link → land on /reset-password

---

## SECTION 5 — STRIPE PRODUCTION CONFIGURATION 🔴

### 5.1 Production Keys
- [ ] Confirm STRIPE_SECRET_KEY in Vercel starts with sk_live_ (not sk_test_)
- [ ] Confirm STRIPE_PUBLISHABLE_KEY starts with pk_live_ (not pk_test_)
- [ ] Confirm STRIPE_WEBHOOK_SECRET in Vercel matches production webhook (not test)
      Note: Test and live webhooks have different secrets

### 5.2 Webhook Events
- [ ] Enable invoice.upcoming webhook event
      Location: Stripe Dashboard → Developers → Webhooks → your production endpoint
      Click: "+ Add event" → search "invoice.upcoming" → add
      Required for: advance payment failure warnings

- [ ] Confirm checkout.session.completed is enabled (should already be)
- [ ] Confirm customer.subscription.updated is enabled (should already be)
- [ ] Confirm customer.subscription.deleted is enabled (should already be)

### 5.3 Customer Portal
- [ ] Enable cancellation in Customer Portal
      Location: Stripe Dashboard → Settings → Billing → Customer Portal
      Enable: Allow customers to cancel subscriptions

- [ ] Enable receipt emails
      Location: Stripe Dashboard → Settings → Emails
      Enable: Successful payment receipts

### 5.4 Attorney Billing (not yet live)
- [ ] Create Stripe product: "MyWealthMaps - Attorney Starter" → $99/month recurring
      Copy price ID → set in Vercel: STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY
- [ ] Create Stripe product: "MyWealthMaps - Attorney Growth" → $249/month recurring
      Copy price ID → set in Vercel: STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY
- [ ] Test attorney checkout end-to-end in Stripe test mode before live

---

## SECTION 6 — RESEND / EMAIL CLEANUP 🟡

### 6.1 Security Fix (do before launch)
- [ ] Add RESEND_WEBHOOK_SECRET signature verification to inbound route
      File: app/api/resend/inbound/route.ts
      Issue: Currently accepts any POST without verifying it came from Resend
      Fix: Verify webhook signature using Resend's signing secret
      Reference: https://resend.com/docs/api-reference/webhooks/verify-webhook-signature

- [ ] Remove GET handler from app/api/resend/inbound/route.ts
      Issue: GET handler is a public endpoint returning { ok: true }
      Fix: Delete the GET export entirely

### 6.2 Sending Domain
- [ ] Confirm mywealthmaps.com is verified sending domain in Resend dashboard
- [ ] Confirm all outbound emails use from: 'hello@mywealthmaps.com'
      Check: grep -r "onboarding@resend.dev" app lib --include="*.ts"
      Should return: 0 results
      **Current:** 1 hit in `app/api/resend/inbound/route.ts` (inbound auto-reply path)

### 6.3 Cleanup
- [ ] Remove consumer1/consumer3 PERSONA_LABELS from inbound route
      File: app/api/resend/inbound/route.ts
      These are test account labels, not needed in production

---

## SECTION 7 — DATABASE & COMPLIANCE CLEANUP 🔴

Run this **before** `PUBLIC_SIGNUP_OPEN=true` — not on go-live day under pressure.
Uses **production** Supabase via `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

**Do not** truncate `households`, `profiles`, or `auth.users` in SQL — use the WCPA deletion path
(`lib/compliance/deleteUser.ts`) so FKs, audit log, and verification stay correct.

**Canonical detail:** [E2E_TEST_RESET.md § Go-live database cleanup](./E2E_TEST_RESET.md#go-live-database-cleanup)

### 7.1 Protect accounts to keep

Edit `GO_LIVE_PROTECTED` in [scripts/cleanup-test-accounts.ts](../scripts/cleanup-test-accounts.ts)
before purge. These are **always** kept automatically:

| Category | Accounts |
|----------|----------|
| E2E automation | All `@mywealthmaps.test` (see [E2E_TEST_RESET.md](./E2E_TEST_RESET.md)) |
| Demo / personal | `avoels@comcast.net`, `avoels@outlook.com`, `david@gmail.com`, `stephen.a.voels@sbcglobal.net` |

- [ ] Add any other real beta users to `GO_LIVE_PROTECTED` in `cleanup-test-accounts.ts`
- [ ] Commit protected-list change if you added emails

### 7.2 Bulk auth + household purge (WCPA-safe)

- [ ] **Dry run** — review KEEP vs DEL list:
      ```bash
      npm run cleanup:purge:dry-run
      ```
      Expected: only protected + canonical E2E accounts in KEEP; all other test signups in DEL

- [ ] **Execute purge** (interactive or non-interactive):
      ```bash
      npm run cleanup:purge
      # or:
      npm run cleanup:purge -- --yes
      ```
      Each deletion uses `deleteUser.ts` + appends `deletion_audit_log`

- [ ] **Spot-check** one deleted email:
      ```bash
      npm run verify:deletion -- --email deleted-user@example.com
      ```
      Must show **PASS**

- [ ] **Auth table count** — Supabase SQL Editor:
      ```sql
      SELECT email, created_at FROM auth.users ORDER BY email;
      ```
      Expected after purge: protected real accounts + `@mywealthmaps.test` only (order of ~10)

- [ ] **No rolobe stragglers:**
      ```sql
      SELECT email FROM auth.users WHERE email LIKE '%rolobe%';
      ```
      Expected: **0 rows**

- [ ] **No soft-deleted Auth rows:**
      ```sql
      SELECT id, email FROM auth.users WHERE deleted_at IS NOT NULL;
      ```
      Expected: **0 rows**

### 7.3 Re-seed automation accounts

After purge, restore canonical Playwright / smoke fixtures:

- [ ] ```bash
      npm run seed:e2e
      npm run verify:estate:e2e
      ```
- [ ] Copy printed `.env.test` block from seed output (or update `PLAYWRIGHT_HOUSEHOLD_ID`)
- [ ] ```bash
      npm run test:e2e:go-live-profile
      ```

### 7.4 Compliance tables (admin cleanup)

Purge removes user data; **compliance** tables may still hold test noise. Clean in
**`/admin` → Data & Compliance** (or Supabase SQL for audit-log test rows only).

| Table | Action |
|-------|--------|
| `deletion_schedule` | Cancel any **pending** rows for deleted test users (prevents 2am cron retries) |
| `privacy_requests` | Mark test intake rows **completed** or **denied** |
| `deletion_audit_log` | **Append-only** — keep real audit history; optional: delete obvious test-only failure rows if daily compliance email reports stale `failureCount` |

- [ ] Admin → **Scheduled Deletions** — no pending rows for deleted test accounts
- [ ] Admin → **Privacy Requests** — no open test requests
- [ ] Admin → **Audit Log** — review; resolve or document any `success=false` test failures
- [ ] Compliance cron smoke (www only — apex strips auth):
      ```bash
      npx dotenv-cli -e .env.local -- bash -c '
        curl -sS -H "Authorization: Bearer $CRON_SECRET" \
          "https://www.mywealthmaps.com/api/cron/compliance-reminders"
      '
      ```
      HTTP **200**; `failureCount` should be 0 or only documented real issues

### 7.5 Single-account deletion (optional)

For one-off test users not caught by purge:

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/gdpr-delete-user.ts --email user@example.com --dry-run
npx dotenv-cli -e .env.local -- npx tsx scripts/gdpr-delete-user.ts --email user@example.com
npm run verify:deletion -- --email user@example.com
```

Or Admin → Execute Deletion (Look up by email → Dry run → Execute).

### 7.6 Legacy one-offs (only if purge missed specific emails)

```bash
npm run cleanup:rolobe
dotenv -e .env.local -- npx tsx scripts/cleanup-test-accounts.ts --legacy
```

Superseded by `cleanup:purge` for go-live; use only for named rolobe/legacy lists.

### 7.7 Sign-off

- [ ] Auth user list matches expected keepers (Section 7.2 SQL)
- [ ] E2E seed + `test:e2e:go-live-profile` passed
- [ ] Compliance admin tabs clear of test pending work
- [ ] Document purge date + final account count in [DECISION_LOG.md](./DECISION_LOG.md) or [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md)

**Prior partial purge (2026-06-07):** `test1@rolobe.resend.app` removed via `npm run cleanup:purge`.
Re-run Section 7.2 before flip if new test signups accumulated since then.

---

## SECTION 8 — DATA PROCESSING AGREEMENTS 🟡

- [ ] Supabase DPA confirmed signed
      Location: Supabase Dashboard → Organization Settings → Legal
      Or: https://supabase.com/privacy — DPA is part of their standard terms
      Document: note confirmation date in DECISION_LOG.md

- [ ] Vercel DPA confirmed signed
      Location: Vercel Dashboard → Settings → Legal
      Document: note confirmation date

- [ ] Resend DPA confirmed
      Location: Resend Dashboard → Settings or their privacy policy
      Document: note confirmation date

- [ ] Stripe DPA: covered by accepting Stripe Services Agreement ✅
      No action needed — document this in DECISION_LOG.md

---

## SECTION 9 — OBSERVABILITY 🟡

- [ ] Confirm error tracking is active (Sentry or equivalent)
      Issue: Silent failures in Monte Carlo, estate calculations, and RLS violations
      go undetected without this
      Check: Is SENTRY_DSN set in Vercel env vars?
      If no: Add Sentry integration before opening to public users

- [ ] Confirm uptime monitoring is set up
      Minimum: Monitor https://www.mywealthmaps.com/api/health
      Tools: Better Uptime (free tier), Checkly, or UptimeRobot
      **Current:** `/api/health` endpoint deployed (200 OK); external monitor not yet configured

- [ ] Confirm Stripe webhook delivery is monitored
      Location: Stripe Dashboard → Developers → Webhooks → your endpoint
      Check: No failed webhook deliveries in the past 7 days

---

## SECTION 10 — GO-LIVE DAY SEQUENCE

Execute in this exact order on go-live day. Do not skip steps.

**Prerequisite:** Section 7 (database & compliance cleanup) must be **complete** before this section.
Do not run first-time purge on go-live day — only a quick SQL confirm (Step 1 below).

### Step 1 — Final code check (30 min before go-live)
```bash
# Confirm no TODO placeholders remain
grep -r "TODO:.*COMPANY\|TODO:.*ADDRESS\|TODO:.*AGENT" lib/legal app --include="*.ts" --include="*.tsx"
# Expected: 0 results

# Confirm no test Stripe keys
grep -r "sk_test_\|pk_test_" app lib --include="*.ts" --include="*.tsx"
# Expected: 0 results (keys are in env vars, not code)

# Confirm from address is correct
grep -r "onboarding@resend.dev" app lib --include="*.ts"
# Expected: 0 results

# Confirm rolobe accounts are gone
# Run in Supabase SQL Editor:
# SELECT email FROM auth.users WHERE email LIKE '%rolobe%'
```

### Step 2 — Supabase Auth settings
- Supabase Dashboard → Authentication → Settings
- Email confirmations: ON
- Secure email change: ON
- Minimum password length: 12
- Save

### Step 3 — Verify auth callback with fresh test email
- Sign up at https://www.mywealthmaps.com/signup with a fresh email
- Confirm email arrives and link works
- Confirm redirect lands on /dashboard (not 404)

### Step 4 — Stripe final check
- Stripe Dashboard: confirm production keys active
- Webhooks: confirm invoice.upcoming is enabled
- Customer Portal: confirm cancellation enabled

### Step 5 — Set environment variable
- Vercel → Settings → Environment Variables → Production
- Add: PUBLIC_SIGNUP_OPEN = true
- Trigger redeploy

### Step 6 — Verify production
```
https://www.mywealthmaps.com      → nav says "Get started" (not "Join waitlist")
https://www.mywealthmaps.com/signup → shows signup form (not redirect)
https://www.mywealthmaps.com/login  → still works normally
https://www.mywealthmaps.com/privacy → no TODO text visible
https://www.mywealthmaps.com/terms   → no TODO text visible
```

### Step 7 — Run smoke tests
```bash
# Automated — passed 7/7 on prod 2026-05-30 (referral rate limit, telemetry 401,
# consumer RPC pages, Monte Carlo edge auth)
npm run test:e2e:security-smoke

# Manual: complete full consumer signup with a fresh email
# Verify: slim profile → /onboarding/persona → wizard → dashboard
# Verify: drip step 1 email arrives within 2 minutes (check avoels@comcast.net)
```

### Step 8 — Run cron endpoints manually
```bash
curl -X GET "https://www.mywealthmaps.com/api/cron/compliance-reminders" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X GET "https://www.mywealthmaps.com/api/cron/process-deletions" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Step 9 — Monitor first 24 hours
- Supabase Auth logs: watch for unusual signup patterns or auth errors
- Vercel logs: watch for 5xx errors
- Stripe Dashboard: confirm webhook delivery (no failures)
- Resend Dashboard: watch bounce/complaint rate (should stay below 2%)

---

## SECTION 11 — POST-LAUNCH ROADMAP (document now, execute after launch)

These are not day-1 blockers but must be tracked:

- [ ] Cyber liability insurance policy
      Trigger: Before 500 users OR $1M ARR (whichever comes first)
      Providers: At-Bay, Coalition, Cowbell, or through business insurer

- [ ] SOC 2 Type 1 readiness
      Trigger: Within 6 months of launch
      Action: Begin policies + access control documentation
      Platforms: Vanta, Drata, or Tugboat Logic

- [ ] WA My Health MY Data Act audit
      Trigger: Within 3 months of launch
      Action: Determine if incapacity planning data triggers MHMD obligations
      Requires: Counsel review

- [ ] Multi-state sales tax nexus monitoring
      Trigger: When advisors or attorneys in other states begin using the platform
      Action: Monitor economic nexus thresholds (typically $100K revenue or 200 transactions per state)

- [ ] Investment adviser registration review
      Trigger: If platform evolves to include personalized securities recommendations
      Action: Annual counsel review of product scope vs. IA registration requirements

---

## SECTION 12 — SIGN-OFF

Before flipping PUBLIC_SIGNUP_OPEN=true, confirm:

Legal:
  Signed: _________________ Date: _________
  All Section 1 items complete, counsel confirmation received

Business:
  Signed: _________________ Date: _________
  WA entity active, EIN obtained, B&O account open

Technical:
  Signed: _________________ Date: _________
  All 🔴 items checked, smoke tests passing, Supabase auth tightened

---
# END OF PRE_LAUNCH_CHECKLIST.md
# This file lives in docs/ alongside LAUNCH_CHECKLIST.md.
# Update it as items are completed.
# Do not delete it after go-live — it is the compliance record.
