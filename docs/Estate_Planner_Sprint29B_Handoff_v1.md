# ESTATE PLANNER

New Chat Handoff Document
Complete Context, Decisions, Schema & Sprint Status

*March 2026 | Confidential | Paste into new chat to continue*

---

## 1. How to Use This Document

| Step | Action |
|---|---|
| Step 1 | Open a new Claude chat. |
| Step 2 | Upload this document and say: 'Please read this handoff document — it contains the full context for the Estate Planner project. We are ready to continue.' |
| Step 3 | Claude will have everything it needs: all decisions, the full schema, RLS patterns, sprint history, and exactly where to start. |
| Step 4 | You do not need to re-upload any previous schema CSVs — the complete current schema is documented in Section 5. |
| Step 5 | For deploying database functions, use the psql method (see Section 9). The Supabase dashboard SQL editor has a metadata injection bug that breaks complex functions. |
| Step 6 | All file writing is done via Cursor agent — avoids heredoc corruption issues. Cursor agent is preferred for all files especially app/(dashboard)/ paths. |

---

## 2. Project Overview

This is the Estate Planner application — a financial planning platform serving two user types: consumers on progressive subscription tiers and financial advisors with full platform access. Sprints 11-A through 29B are complete as of March 2026.

### 2.1 Tech Stack

| Component | Details |
|---|---|
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth — profiles.id = auth.users.id |
| Billing | Stripe — stripe_customer_id on profiles table |
| Backend functions | Supabase Database Functions (SECURITY DEFINER) |
| Frontend | Next.js 16 (App Router, Turbopack) — deployed on Vercel |
| Domain | mywealthmaps.com |
| Email | Resend — hello@mywealthmaps.com |
| Function deployment | psql via terminal — Supabase dashboard SQL editor has injection bug for complex functions |
| File writing | Cursor agent for all files — especially app/(dashboard)/ paths |
| Codebase owner | Solo developer / novice — all work done together step by step |

### 2.2 Four-Tier Profile Model

| Role / Tier | Price |
|---|---|
| role=consumer, consumer_tier=1 — Financial Planning | $9/mo |
| role=consumer, consumer_tier=2 — Retirement Planning | $19/mo |
| role=consumer, consumer_tier=3 — Estate (Simplified) | $34/mo |
| role=advisor — Advisor Full Suite | $159+/mo |
| role=attorney — Attorney Portal | $159+/mo |

### 2.3 Sidebar Navigation — Current State

| Group | Items |
|---|---|
| Overview | Dashboard, Profile, Security |
| Financial Planning | Assets, Liabilities, Income, Expenses, Projections, Asset Allocation, Real Estate, Scenarios, Social Security |
| Retirement Planning | Lifetime Snapshot, RMD Calculator, Roth Conversion, Monte Carlo, Insurance Gap Analysis |
| Estate Planning | Titling & Beneficiaries, Domicile Analysis (minTier: 3), Incapacity Planning, Estate Tax, Gifting Strategy, Charitable Giving, Business Succession (advisor only), Trust & Will Guidance (tier 3+), Export Estate Plan (tier 3+) |
| Resources | Find an Advisor, Find an Attorney, Attorney Referrals (consumerOnly), My Advisor (consumerOnly), List Your Practice (advisorOnly — goes to choice page), Import Data, Export Estate Plan (advisor only) |
| Account | Billing, Security, Advisor Portal (advisors only), Attorney Portal (attorneys + is_attorney only), Admin Portal (admins only), Advisor Directory (admins only), Attorney Directory (admins only) |

### 2.4 Key Ownership & RLS Patterns

| Pattern | SQL |
|---|---|
| A — Direct ownership | auth.uid() = owner_id |
| B — Household-linked | EXISTS (SELECT 1 FROM households WHERE households.id = [table].household_id AND households.owner_id = auth.uid()) |
| C — Advisor access | EXISTS (SELECT 1 FROM advisor_clients WHERE advisor_clients.advisor_id = auth.uid() AND advisor_clients.client_id = [owner_id] AND advisor_clients.status = 'active') |

---

## 3. Sprint Status

| Sprint | Status |
|---|---|
| 11-A through 18 (original) | COMPLETE |
| Email / Resend setup | COMPLETE |
| Stripe webhook | COMPLETE |
| Routing fix | COMPLETE |
| 19 — Advisor Directory Enhanced | COMPLETE |
| 20 — Sidebar restructure + FEATURE_TIERS | COMPLETE — March 28, 2026 |
| Estate Planning menu gating | COMPLETE — March 28, 2026 |
| PDF Export page (/print) | COMPLETE — March 28, 2026 |
| NEW-10 — Trial period logic | COMPLETE — March 28, 2026 |
| NEW-11 — Admin email on listing | COMPLETE — March 28, 2026 |
| Sprint 11-A — Account Titling + Beneficiaries | COMPLETE — March 28, 2026 |
| Insurance Gap Analysis | COMPLETE — March 28, 2026 |
| 14-C — Advisor Connection & Client Portal | COMPLETE — March 28, 2026 |
| 21 — Attorney Referral Workflow | COMPLETE — March 28, 2026 |
| 22 — Multi-State Domicile Analysis | COMPLETE — March 28, 2026 |
| 23 — Two-Factor Authentication (MFA/TOTP) | COMPLETE — March 28, 2026 |
| 24 — Email Notifications + Stale Plan Alerts | COMPLETE — March 28, 2026 |
| 25 — Trust & Will Guidance | COMPLETE — March 29, 2026 |
| 26 — Referral Status Admin Flow | COMPLETE — March 30, 2026 |
| 27 — Completion-Based Tier 3 Unlock | COMPLETE — March 30, 2026 |
| 28 — Advisor Billing Transfer + Client Unlock | COMPLETE — March 30, 2026 |
| 29A — Consumer Request to Connect (Advisor) + Attorney Portal Foundation | COMPLETE — March 30, 2026 |
| 29B — Attorney Full Flow + Attorney Invite Acceptance | COMPLETE — March 30, 2026 |
| 30 — Next sprint (TBD) | PENDING |

---

## 4. Sprints 29A & 29B — What Was Built

### 4.1 Sprint 29A — Consumer Request to Connect (Advisor) + Attorney Portal Foundation

| File | Description |
|---|---|
| app/api/advisor-directory/request-connect/route.ts | POST. Consumer only. Inserts consumer_requested row into advisor_clients with request_message. Blocks duplicates. Fires notifications to advisor (email + in-app) and consumer (in-app confirmation). No subscription gate — any authenticated consumer can request. |
| app/api/advisor/accept-request/route.ts | POST. Advisor only. Converts consumer_requested → pending. Generates invite token (7 days). Sends invite email via Resend. Goes through existing /invite/[token] flow. |
| app/api/advisor/decline-request/route.ts | POST. Advisor only. Sets status=removed. Fires in-app notification to consumer. |
| app/(dashboard)/advisor-directory/_advisor-directory-client.tsx | Added Request to Connect button + message modal on each advisor card. Shows ✓ Request sent for existing/sent connections. All authenticated consumers can request. |
| app/(dashboard)/advisor/_advisor-client.tsx | Added Incoming Requests amber section above client table. Accept/Decline buttons. request_message displayed. incomingRequests / listedClients buckets prevent double rendering. |
| app/(dashboard)/attorney/page.tsx | Attorney portal server page. Role guard: role=attorney OR is_attorney=true. Loads attorney_clients with profiles. |
| app/(dashboard)/attorney/_attorney-client.tsx | Attorney portal UI. Incoming Requests section (stubs wired in 29B). Add Client tab with email invite. My Clients table. |
| sidebar-nav.tsx | Attorney Portal link added. Shown when role=attorney OR isAttorney=true. |
| lib/server-notifications.ts | Added fireAdvisorConnectionRequestNotification. Notifies advisor (email + in-app) and consumer (in-app confirmation). Cooldown 1 hour. |
| SQL | consumer_requested status + request_message added to advisor_clients. attorney role added to profiles. attorney_tier_config created + seeded. attorney_clients table created with RLS. is_attorney boolean added to profiles. 3 new notification types added to notification_type enum: consumer_connection_request, consumer_connection_request_sent, consumer_connection_declined. |

### 4.2 Sprint 29B — Attorney Full Flow

| File | Description |
|---|---|
| app/api/attorney/invite/route.ts | POST. Attorney only (role=attorney OR is_attorney). Checks for existing pending invite. Generates token via generateInviteToken(). Inserts into attorney_clients. Sends Resend email to /attorney-invite/[token]. |
| app/api/attorney/accept-request/route.ts | POST. Attorney only. Converts consumer_requested → pending. Generates invite token. Sends invite email via Resend to /attorney-invite/[token]. |
| app/api/attorney/decline-request/route.ts | POST. Attorney only. Sets status=removed. Fires in-app consumer_connection_declined notification. |
| app/attorney-invite/[token]/page.tsx | Acceptance page mirroring /invite/[token]. Looks up attorney_clients by invite_token + status=pending. Checks expiry. If logged in: sets status=accepted, client_id, fires notifications. No billing transfer (see product decisions). If not logged in: redirects to signup with type=attorney param. |
| app/(dashboard)/attorney/_attorney-client.tsx | Wired handleAcceptRequest → POST /api/attorney/accept-request. Wired handleDeclineRequest → POST /api/attorney/decline-request. |
| SQL | attorney_clients: added invited_email, invite_token, invite_expires_at columns. |

---

## 5. Locked Decisions

These are confirmed and must not be revisited:

| Decision | Details |
|---|---|
| Stripe webhook | Uses service role client (not cookie-based createClient) |
| New user redirect | New users → /profile after payment, returning users → /dashboard |
| Billing page | Shows Tier 1 only to non-active users, all tiers to active subscribers |
| Advisor directory | Listings require admin approval before going live (is_active=false on submit) |
| Attorney directory | Listings require admin approval. Any authenticated advisor can submit via /list-your-practice → attorney choice. |
| Admin notification | Immediate email to avoels@comcast.net on new advisor or attorney listing submission |
| Sidebar | Collapsible groups aligned to tier progression. List Your Practice goes to choice page. |
| File writing | Cursor agent for all files |
| Function deployment | psql method for all Supabase function deployment |
| MFA | Required for all users. TOTP only. Enforced in proxy.ts via AAL2 check. |
| MFA settings | Dedicated /settings/security page in Account group |
| MFA enrollment redirect | On successful enrollment: 3-second success message then redirect to /dashboard |
| Notifications delivery | Email via Resend + in-app bell. Both for most types, email-only for subscription renewal. |
| Notification dedup | create_notification() function with cooldown window prevents spam. Default 7 days. |
| Cron trigger | GitHub Actions (free) calls /api/cron/notifications daily. CRON_SECRET in all three: .env.local, Vercel, GitHub Secrets. |
| Admin client | createAdminClient() from @/lib/supabase/admin — used for all service-role operations including admin page data fetches |
| Fire-and-forget RPC | Async IIFE pattern: `;(async () => { try { await admin.rpc(...) } catch {} })()`. Never .then().catch() on Supabase RPC. |
| Domicile risk scoring | calculate_domicile_risk() — weighted factors. 0-20=low, 21-45=moderate, 46-70=high, 71-100=critical |
| Profiles array normalization | Array.isArray check before passing to client components |
| is_admin flag | is_admin boolean on profiles. Checked alongside role === admin everywhere. Developer account: role=advisor, is_admin=true. |
| is_attorney flag | is_attorney boolean on profiles. Checked alongside role === attorney everywhere. Developer account: role=advisor, is_admin=true, is_attorney=true. |
| Trust & Will Guidance | Advisory only (recommendations + checklist). Rule-based logic in lib/trust-will-rules.ts. Tier 3 + advisors. |
| Tier 3 unlock | Completion-based: 5 of 7 Retirement Planning checks. Progress shown on dashboard (amber widget) and /unlock-estate checklist page. Auto-upgrades consumer_tier to 3. |
| Advisor client billing transfer | On invite accept: consumer_tier upgrades to 3 immediately. Consumer Stripe sub cancels at period end. previous_consumer_tier stored for revert. billing_transferred=true on advisor_clients row. |
| Advisor client removal | Soft delete (status=removed). Reverts consumer_tier to previous_consumer_tier if billing_transferred. Consumer notified. |
| Attorney client billing | NO billing transfer for attorney connections. Consumer keeps their own subscription and pays independently. Attorney pays for portal seat via attorney_tier_config. See Product Decisions section. |
| Attorney client removal | Soft delete (status=removed). No tier reversion needed (no billing transfer). Consumer notified. |
| Advisor tier config | Stored in advisor_tier_config table (not hardcoded). Starter/10/$159, Growth/25/$249, Unlimited/999/$399. |
| Attorney tier config | Stored in attorney_tier_config table (not hardcoded). Starter/10/$159, Growth/25/$249, Unlimited/999/$399. stripe_price_id to be populated once Stripe products created. |
| Hydration safety | All date formatting uses UTC methods (getUTCMonth, getUTCDate, etc.) not toLocaleDateString — prevents server/client mismatch. |
| Notification panel width | w-56 in notification-panel.tsx — keeps panel under bell and fully on screen. |
| Consumer connection request | Any authenticated consumer can request to connect with an advisor or attorney. No subscription gate. |

---

## 6. Product Decisions & Notes
*(For user guide authoring and Stripe payment backend setup)*

### Advisor Model — Billing Transfer
- Advisors manage ongoing financial relationships
- On consumer invite acceptance: Stripe subscription cancels at period end, consumer upgraded to Tier 3, billing_transferred=true
- Advisor pays per-seat pricing via advisor_tier_config
- If advisor removes client: consumer tier reverts to previous_consumer_tier

### Attorney Model — No Billing Transfer
- Attorneys are typically engaged for a specific transaction (writing a will, estate settlement)
- On connection acceptance: NO billing transfer, consumer keeps their own subscription
- Consumer is NOT automatically upgraded — they keep their current tier
- Consumer data ownership is independent of attorney relationship
- If attorney relationship ends: consumer keeps everything, no reversion needed
- Attorney pays for portal seat via attorney_tier_config

### Stripe Setup Checklist (Before Launch)

| Table | Tier | Price | stripe_price_id status |
|---|---|---|---|
| advisor_tier_config | Starter | $159/mo | Needs population |
| advisor_tier_config | Growth | $249/mo | Needs population |
| advisor_tier_config | Unlimited | $399/mo | Needs population |
| attorney_tier_config | Starter | $159/mo | Needs population |
| attorney_tier_config | Growth | $249/mo | Needs population |
| attorney_tier_config | Unlimited | $399/mo | Needs population |

### Attorney-Initiated Invites
- Attorneys can invite clients who don't have accounts yet
- Client signs up via /attorney-invite/[token] and gets a standard consumer account
- Client subscribes normally — attorney does not cover their subscription
- Attorney gets linked read access to client estate data

---

## 7. Open Questions — Still Unresolved

| Question | Details |
|---|---|
| Q11 | Admin email notification when attorney listing is submitted — not yet wired (advisor listings send admin email, attorney listings do not yet). |
| Q12 | Advisor tier enforcement — check client count against advisor_tier_config.max_clients before allowing new clients. Not yet built. |
| Q13 | Attorney tier enforcement — same as Q12 but for attorney_tier_config. Not yet built. |
| Q14 | Attorney directory Request to Connect button — consumers can request to connect with advisors but not yet attorneys on /attorney-directory. Sprint 30 candidate. |

---

## 8. Where to Start — Next Session

| Priority | Action |
|---|---|
| 1 — FIRST | Sprint 30 candidates: Attorney directory Request to Connect button (Q14), admin email on attorney listing submission (Q11), advisor/attorney tier enforcement (Q12/Q13). |
| 2 | Decide Sprint 30 scope and sequence before writing any code. |

---

## 9. Function Deployment — psql Method

| Item | Value |
|---|---|
| Supabase project | fnzvlmrqwcqwiqueevux |
| Connection host | aws-0-us-west-2.pooler.supabase.com |
| Port | 6543 |
| User | postgres.fnzvlmrqwcqwiqueevux |
| psql command pattern | PGPASSWORD="PWD" psql -h aws-0-us-west-2.pooler.supabase.com -U postgres.fnzvlmrqwcqwiqueevux -d postgres -p 6543 -f "/Users/al/Desktop/function_name.sql" |

---

## 10. Local Dev Setup — How to Start Each Session

| Step | Command |
|---|---|
| Navigate to project | cd /Users/al/Estate |
| Start dev server | npm run dev |
| Open app | http://localhost:3000 |
| Type check | `npx tsc --noEmit --skipLibCheck 2>&1 \| head -30` |

---

## 11. User Management — SQL Quick Reference

| Action | SQL |
|---|---|
| Change consumer tier | UPDATE profiles SET consumer_tier = 3 WHERE email = 'user@example.com'; |
| Set to advisor | UPDATE profiles SET role = 'advisor' WHERE email = 'user@example.com'; |
| Set to attorney | UPDATE profiles SET role = 'attorney' WHERE email = 'user@example.com'; |
| Set to admin | UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com'; |
| Set back to consumer | UPDATE profiles SET role = 'consumer', consumer_tier = 1 WHERE email = 'user@example.com'; |
| Check user state | SELECT email, role, consumer_tier, subscription_status, is_admin, is_attorney FROM profiles WHERE email = 'user@example.com'; |
| Promote advisor + active | UPDATE profiles SET role = 'advisor', subscription_status = 'active' WHERE email = 'user@example.com'; |
| Set is_admin flag | UPDATE profiles SET is_admin = true WHERE email = 'user@example.com'; |
| Set is_attorney flag | UPDATE profiles SET is_attorney = true WHERE email = 'user@example.com'; |
| Delete stuck MFA factor | DELETE FROM auth.mfa_factors WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com') AND status = 'unverified'; |
| Check advisor_clients | SELECT id, status, billing_transferred, previous_consumer_tier FROM advisor_clients WHERE advisor_id = 'UUID'; |
| Check attorney_clients | SELECT id, status, billing_transferred, invite_token FROM attorney_clients WHERE attorney_id = 'UUID'; |
| Remove advisor client | UPDATE advisor_clients SET status = 'removed' WHERE id = 'UUID'; |
| Remove attorney client | UPDATE attorney_clients SET status = 'removed' WHERE id = 'UUID'; |

---

## 12. Environment Variables Reference

| Variable | Description |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key (server only) |
| NEXT_PUBLIC_APP_URL | https://mywealthmaps.com (used in email CTAs) |
| CRON_SECRET | Random hex string. Must match in .env.local, Vercel, and GitHub Secrets. |
| RESEND_API_KEY | Resend API key for email sending |
| STRIPE_SECRET_KEY | Stripe secret key |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret |

---

*Estate Planner Handoff Document | March 2026 | Confidential*
