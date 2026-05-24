# ROADMAP.md
# My Wealth Maps — Sprint Roadmap
# Last updated: 2026-05-24 (Sprint 16 current; Sprint 15 closed 2026-05-24)

---

## How to use this document

**At the start of a session:** Read the "Current sprint" section and [NEXT_SESSION.md](./NEXT_SESSION.md) (task detail, file paths, paste block). Update the status of any items completed since the last session. This is the document that answers "where are we?"

**At the end of a session:** Update the status of any items worked on. Add any new items discovered. Move completed sprints to the "Completed" section at the bottom.

**Status key:**
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked — needs decision or dependency
- `[-]` Descoped — removed from this sprint, reason noted

---

## Current sprint

## ⚠️ Go-live gate

**No public go-live until all LAUNCH_CHECKLIST Section 1 gates are checked AND
CONSUMER_RELEASE_SMOKE_TEST manual pass completes.** Section 2 (domain, DNS, Resend,
Search Console) is ops-only and runs in Sprint 15 after Section 1 is fully verified.

### Sprint 12 — Conversion decisions & responsive UX (Weeks 43–46) ✅

**Goal:** Close A/B tests with data-driven decisions. Mobile audit. Copy pass.

**Persona alerts (first — deferred since Sprint 3; do not bury under A/B/mobile)**
- `[x]` Business $5M / $10M threshold alert on dashboard (`lib/dashboard/personaAlerts.ts`)
- `[x]` Multi-state real estate probate-risk alert on dashboard (`situs_state` in `loadDashboardCoreInputs`)
- `[x]` Planning empty-state CTAs — profile-only on `/projections` + `/complete` (`PLANNING_MISSING_PROJECTION_ACTIONS_TIER2`)

**A/B test decisions**

> ✅ Pre-launch: no traffic — shipped **personalized** + **score_visible**; removed A/B code and `app_config` rows (DECISION_LOG).

- `[x]` `ab_upgrade_copy` — personalized only; `EVENT_UPGRADE_COPY` verified (24/24 slugs)
- `[x]` `ab_assessment_gate` — score_visible only; logged-out assess shows scores

**UX**
- `[x]` Mobile nav — dashboard off-canvas drawer on `<lg` (`DashboardShell`); full route audit deferred post-launch
- `[x]` In-app copy audit — dashboard, public event/assess, planning surfaces, landing + share links; `DisclaimerBanner`; upgrade gates

**Success criteria**
- `[x]` A/B flags resolved; no split-test code at launch
- `[x]` Copy audit complete (hedging disclaimers removed or reframed; scenarios footer uses `Scope:`)

---

### Sprint 14 — Full test execution — feature freeze (Weeks 51–54) ✅ CLOSED 2026-05-23

- Manual smoke §1–11 passed
- §2.4 recompute automated (`93aa6f5`)
- Admin Portal hidden from consumers (`f4e9160`)
- Asset modal scrollable (`f4e9160`)
- E2E 41 passed; staging flakiness confirmed with `--workers=1`
- All Sprint 14 launch bugs resolved

**Commits:** `93aa6f5`, `1e092d7`, `f4e9160`

---

### Sprint 16 — Billing, open signups, drip verify (Weeks 59–62) **← CURRENT**

**Goal:** Stripe production billing ready, flip `PUBLIC_SIGNUP_OPEN`, verify drip step 2 on production, track post-launch perf.

| Item | Status | Notes |
|------|--------|-------|
| **Billing setup** | `[ ]` | Stripe production config — **required before opening signups** |
| **Open signups** | `[ ]` | Set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production + redeploy ([LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip)) |
| **Drip step 2 check** | `[ ]` | Verify `consumer21@rolobe.resend.app` receives drip step 2 on **2026-05-26** (day 3) |
| **Post-launch performance** | `[ ]` | Dashboard initial load slowness — track as perf ticket (not blocking open signups) |

**Cross-sprint (closed):** Sprint C-2b UX Language Audit — all `DISCLAIMER_STRINGS` surfaces wired; `audit-ux-language.sh` 0 findings (2026-05-24). Manual per-surface checklist QA still open in [UX_LANGUAGE_AUDIT_SPRINT.md](./UX_LANGUAGE_AUDIT_SPRINT.md).

**Section 1 remainder (non-blocking while waitlist active):** drip prod smoke steps 2–3; attorney referral prod test; full E2E path on production.

**Success criteria**
- Stripe checkout works on production for new consumer tier upgrade
- `/signup` open after env flip; Core §1–3 smoke passes again
- Drip step 2 confirmed for `consumer21@`

---

### Sprint 15 — Go-live (Section 2 ops) ✅ CLOSED 2026-05-24

**Goal:** Execute LAUNCH_CHECKLIST Section 2 — domain, DNS, Search Console, waitlist mode.

- `[x]` Domain live — `mywealthmaps.com` + SSL (2026-05-24)
- `[x]` DNS cutover + `NEXT_PUBLIC_APP_URL` → production URL (2026-05-24)
- `[x]` Vercel Production env vars verified (2026-05-24)
- `[x]` Resend domain verified — SPF/DKIM (2026-05-24)
- `[x]` Search Console — verified via **Cloudflare** (not meta tag); sitemap submitted (2026-05-24)
- `[x]` Waitlist mode active — `middleware.ts` redirect (`3ceb125`); Preview enabled (2026-05-24)
- `[x]` Post-cutover smoke §1–3 passed on production (2026-05-24)
- `[x]` Sitemap XML + middleware infra bypass — `/sitemap.xml`, `/robots.txt` never gated (`73648e5`)
- `[x]` Test account cleanup script — `scripts/cleanup-test-accounts.ts` (`3f732e3`)
- `[x]` Dev workflow — local → preview → production
- `[ ]` Open signups — **carried to Sprint 16** (billing setup first)

**Commits:** `7afaedb`, `bb9a191`, `3ceb125`, `729d411`, `b97f945`, `3f732e3`, `73648e5`

---

### Sprint 15 — Go-live (Section 2 ops only) (Weeks 55–58) — archived detail

**Waitlist mode (shipped)**

- `[x]` Waitlist page + email capture (`/waitlist`, `POST /api/email-capture`)
- `[x]` Runtime `/signup` → `/waitlist` redirect in `middleware.ts` (`3ceb125`; renamed from `proxy.ts`)
- `[x]` `getSignupHref()` wired on public CTAs; invite flows bypass gate
- `[x]` Default on for `VERCEL_ENV=production`; flip via `PUBLIC_SIGNUP_OPEN=true` at go-live

**Vercel Production environment variables — verified 2026-05-24**

See LAUNCH_CHECKLIST § “Vercel Production env vars”. `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` **not needed** — Search Console verified via Cloudflare.

---

## Completed sprints

### Sprint 13 — Pre-production hardening (Weeks 47–50) ✅

**Goal:** Stable staging, migrations verified, smoke test extended. Feature freeze begins.

**Shipped**
- `[x]` **67 migrations** applied (local + remote in sync, incl. `20260601000000` advisor referral trigger)
- `[x]` E2E staging — **51 passed, 0 failed, 1 skipped**
- `[x]` Seed scripts — `seed-test-attorney`, `seed-test-advisor`, `seed-test-consumer-estate`
- `[x]` Acquisition & attribution smoke **A–G passed** on staging
- `[x]` `INTERNAL_API_KEY` on Vercel Production
- `[x]` **`rmd-start-age` copy** — birth-year range 72–75 (was hardcoded 73 on event page)
- `[x]` **`advisor_directory_referral_code_trigger`** — was missing; added + migration

**Launch blockers found & fixed during Sprint 13 smoke:** RMD event copy inaccuracy; advisor `referral_code` not auto-generated on insert.

---

### Sprint 11 — Planning-app coherence (Weeks 39–42) ✅

**Goal:** Close cross-links and empty states that break the planning flow. No new feature pillars.

**Shipped**
- `[x]` Projections + Lifetime Snapshot — `PlanningSurfaceNav`; `loadProjectionData` on `/complete`
- `[x]` Scenarios discoverability — `ScenariosExploreCard` on `/projections`
- `[x]` Charitable Giving empty state — `buildPersonalizedCharitableTopics()` + profile note gate
- `[x]` `/complete` tier gate aligned to tier 2; pathname-based nav active pill
- `[x]` Planning empty states — tier-2 surfaces use profile-only CTA (Sprint 12 hardening shipped same release)

---

### Sprint 10 — Persona depth, advisor flywheel (Weeks 35–38) ✅
**Goal:** Close hard gates and log Sprint 10 decisions. Persona threshold alerts carry to Sprint 11.

**Shipped**
- `[x]` Business succession Path A — minimal intake (`households.succession_*`); `/business-succession` tier 3; dashboard alert
- `[x]` Invite-your-advisor Path A — `/onboarding/invite-advisor`; `profiles.onboarding_invite_advisor_completed_at` (skip = same timestamp)
- `[x]` A/B exit criteria in DECISION_LOG — `tier_upgraded`, 50 events/variant or 4 weeks, owner Alan
- `[x]` `CONNECTED_ADVISOR_CLIENT_STATUSES` — canonical `active` | `accepted` import; advisor APIs aligned
- `[x]` Life-event-on-connect verified — `pickConnectionLifeEvent()`; advisor Overview banner
- `[x]` Migration `20260530000000_sprint9_10_gates.sql`

**Carry-forward (shipped Sprint 12)**
- `[x]` Business $5M / $10M dashboard alert
- `[x]` Multi-state RE probate-risk dashboard alert

---

### Sprint 9 — Launch, signup attribution, growth polish (Weeks 31–34) ✅
**Goal:** Referral persistence, drip completeness, Sprint 9 hard gates.

**Shipped**
- `[x]` Signup attribution — `20260529000000_profiles_referral_attribution.sql`
- `[x]` Drip — all **24** event slugs in `lib/emails/drip-templates.ts`
- `[x]` RMD — `lib/calculations/rmdStartAge.ts` (72/73/75)
- `[x]` Life-event-on-connect — `connection_life_event_*` on `advisor_clients`; `accept-request` + advisor Overview
- `[x]` Digital Assets — `FEATURE_TIERS['digital-assets'] = 2`; page tier gate
- `[x]` URL audit — `lib/app-url.ts` `getAppUrl()` on email routes
- `[x]` `app/robots.ts` permissive rules in repo

**Launch ops (Sprint 15)** — Search Console, domain, prod drip smoke still open

---

### Sprint 8 — Attorney referral attribution (Weeks 27–30) ✅
**Goal:** Attorney event-page attribution parallel to advisor `?ref=` distribution.

**Shipped**
- `[x]` Migration `20260528000000_attorney_referrals.sql` — `attorney_listings.referral_code`; `referral_clicks` attorney columns + `listing_type`; attorney RLS
- `[x]` `POST /api/referral/track` — `type: 'attorney' | 'advisor'`; advisor path unchanged
- `[x]` `_referral-tracker.tsx` — `?aref=`; `mwm_attorney_referral_*` sessionStorage
- `[x]` `buildAttorneyReferralUrl` / `buildAllAttorneyEventReferralUrls` — 24 slugs
- `[x]` Attorney portal newsletter kit — three-tab UI (blue styling)

**Carried to Sprint 9**
- Launch checklist (partial — robots code done)
- Signup referral persistence (done)
- Drip for all 24 slugs (done)

---

### Sprint 7 — Funnel depth, distribution, personalization (Weeks 23–26) ✅
**Goal:** Improve funnel reporting, advisor distribution kit, expand drip and upgrade personalization.

**Shipped**
- `[x]` Admin funnel — 30-day `funnelStepCounts`; `tierConversion` by tier; By Tier tab
- `[x]` Advisor newsletter kit — 24 referral URLs, grouped UI, email + plain-text copy
- `[x]` `buildAllEventReferralUrls` — all 24 `EVENT_SLUGS`
- `[x]` Drip — custom `EVENT_SEQUENCES` for all **12** `DripEventSlug` union members
- `[x]` `EVENT_UPGRADE_COPY` — all 24 slugs, tier 2 and 3
- `[x]` Age triggers — per-age slugs (62/65/70/73)

**Carried to Sprint 8** (see Current sprint above)
- Launch / Search Console — [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)
- Drip for 12 slugs outside `DripEventSlug` union (listed under Sprint 8 Growth polish)
- Signup referral persistence

---

### Sprint 6 — Measurement, attorney PDF, growth distribution (Weeks 19–22) ✅
**Goal:** Act on funnel data, ship attorney-ready PDF content, begin outbound distribution.

**Shipped**
- `[x]` Admin funnel tab — `funnel-tab.tsx`; 30-day slug/referral data; SQL cheat sheet
- `[x]` Attorney PDF — `AttorneyEstatePlanPDF`; `variant=attorney` API branch (conflicts, assets, tax)
- `[x]` SEO — `app/sitemap.ts`, `app/robots.ts` (canonical `NEXT_PUBLIC_APP_URL`)
- `[x]` Resend drip — 3-step sequence; step 1 on capture; steps 2–3 in notifications cron; unsubscribe
- `[x]` Migration `20260524000000_email_captures_drip.sql`

**Deferred to Sprint 7+** (resolved or moved)
- `[ ]` Search Console verification → Sprint 8 launch checklist
- `[x]` Event → tier conversion report (Sprint 7)
- `[x]` Advisor newsletter kit (Sprint 7)
- `[x]` Attorney `?aref=` on event pages (Sprint 8 — `attorney_listings.referral_code`)

---

### Sprint 5 — Analytics, optimization, event pages (Weeks 15–18) ✅
**Goal:** Full funnel measured, A/B tests running, remaining event pages published.

**Shipped**
- `[x]` Vercel Analytics + `funnel_events` custom funnel + 6 instrumented steps
- `[x]` A/B via `app_config` — assess gate (`/assess` server + `_assess-client.tsx`) + upgrade copy toggle
- `[x]` 16 new event slugs in `lib/events/content-sprint5.ts` (24 total, SSG)
- `[x]` Idempotent migration policies for re-run safety

**Deferred to Sprint 6+**
- `[x]` Admin funnel dashboards (Sprint 6)
- `[x]` Content distribution — drip live; newsletter kit (Sprint 7); Search Console at launch
- `[ ]` Blended family as separate slug (optional; `remarriage-blended-family` covers today)

---

### Sprint 4 — Advisor/attorney network as distribution (Weeks 12–14) ✅
**Goal:** Advisors and attorneys become active referral sources.

**Shipped**
- `[x]` Invite your advisor — `mailto:` card on `/my-advisor` no-connection state
- `[x]` Advisor notification when client logs a life event — `POST /api/consumer/life-events` + cron job 6
- `[x]` Advisor referral links — `?ref=` on event pages, `referral_clicks`, portal copy UI (`lib/events/referral.ts`)
- `[x]` Attorney-ready export UI — `/print` dual mode; `ExportPDFButton` `variant=attorney` (PDF template follow-up)
- `[x]` Plan readiness on advisor client Overview — `PlanReadinessCard` + `estate_health_scores`
- `[x]` Canonical `advisor_directory` for listings/referrals (replaced `advisor_listings` references)

**Deferred**
- `[ ]` Life event context on new advisor connections (connection metadata)
- `[x]` Attorney `?aref=` on event pages (Sprint 8)
- `[ ]` Attorney portal readiness score (advisor-only today)
- `[ ]` Signup attribution from `mwm_referral_code` → Sprint 8 Growth polish

---

### Sprint 3 — In-app life event triggers (Weeks 9–11) ✅
**Goal:** Users can log life events in-app; plan recomputes with event-specific conflict generation.

**Shipped**
- `[x]` `life_events` table + RLS + consumer API + dashboard `LifeEventBanner`
- `[x]` Age-based trigger cron (`/api/cron/age-triggers`, 15:00 UTC)
- `[x]` Event-personalized upgrade gates (`lib/events/upgradeContext.ts`)

**Deferred**
- `[ ]` Event-specific dashboard alerts beyond banner
- `[x]` Per-milestone calendar slugs (62/65/70/73) — Sprint 7 age-triggers cron
- `[ ]` Segment-specific triggers (business $5M/$10M, multi-state RE, estate growth velocity)
- `[ ]` A/B on upgrade gates (moved to Sprint 5)

---

### Sprint 2 — Life event landing pages + public conversion (Weeks 6–8) ✅
**Goal:** 8 event pages live, SEO-ready, with event-specific assessments and email capture.

**Shipped**
- `[x]` 8 life event pages at `/event/[slug]` (SSG, action plans, professional CTAs)
- `[x]` schema.org Article JSON-LD on event pages
- `[x]` Event-specific assessments at `/event/[slug]/assess` (5 questions, scoring, gap detection)
- `[x]` `app/api/email-capture` + `email_captures` table (migration `20260520000000`)
- `[x]` Homepage social proof + trust bar (`app/page.tsx`)
- `[x]` General `/assess`: overall + pillar scores visible when logged out; gap report gated behind account
- `[x]` Pricing moved to `app/(public)/pricing/page.tsx` (shared public nav)
- `[x]` Sprint 2 Track A: public nav, segment homepage/pricing copy

**Deferred to Sprint 3+**
- `[ ]` Email drip sequence (3 emails per event type) — needs provider decision
- `[ ]` Event pages indexed in Google Search Console — post-deploy verification
- `[ ]` In-app copy audit; Transfer Strategy guided depth; Invite-your-advisor onboarding step
- `[ ]` Account creation: plan selector maps assessment tier gaps to subscription tiers

---

### Sprint 1 — App/public nav separation + upgrade gates (Weeks 3–5) ✅
**Goal:** Planning app sidebar contains planning tools only; public routes outside dashboard layout; tier gates personalized.

**Shipped (engineering)**
- `[x]` Remove public-site links from app sidebar Overview (Education, Assessment, Find Advisor, Find Attorney, Home)
- `[x]` Overview group: Profile + Estate Summary only
- `[x]` Move **My Attorney** to sidebar footer (tier 2+); remove **Attorney access settings** from sidebar
- `[x]` Sidebar footer: My Advisor · My Attorney (tier 2+) · Manage Subscription · Sign out
- `[x]` "Your plan" tier badge on active planning group header
- `[x]` `UpgradeBanner` `householdContext` on all tier-gated consumer pages (retirement + estate modules)
- `[x]` Social Security: tier 2 gate added (was missing)
- `[x]` Domicile Analysis: explicit tier 3 gate added
- `[x]` Public route group `app/(public)/` — education, assess, find-advisor, find-attorney (passthrough layout, no dashboard sidebar)
- `[x]` Projections income table: full first names via `displayPersonFirstName` in `_projections-client.tsx`

**Deferred to Sprint 2 (marketing / public chrome)** — completed in Sprint 2 except items listed under Sprint 2 deferred above

**Success criteria met (engineering slice)**
- Zero public-site links in app sidebar ✅
- Public routes render without dashboard chrome ✅
- Upgrade gates personalized with `state_primary` where household exists ✅

---

### Sprint 0 — In-app fixes (Weeks 1–2) ✅
**Goal:** Surface the most valuable content already built. No new infrastructure required.

**Dashboard fixes**
- `[x]` Add conflict alert banner above the fold — dismissible; links to `#estate-conflicts`
- `[x]` Add severity chips — critical/warnings in `DashboardIntroSection` (links to conflicts)
- `[x]` Move advisor links to sidebar footer — **My Advisor** + **Manage Subscription** in footer
- `[x]` Horizons page: comparison table + hero tax-liability summary cards
- `[x]` Horizons page: tier gate on `/my-estate-strategy`
- `[x]` Projections table: `title` tooltips on income column headers
- `[x]` Monte Carlo: single-column layout; labeled step stepper
- `[x]` Upgrade gates: `householdContext` on `/estate-tax` and `/my-estate-strategy`

**Retrospective:** UI-only sprint; no engine/API/DB changes. Sprint 1 completed nav separation and remaining upgrade-gate personalization.

---

## Backlog (not yet scheduled — confirmed post-launch)

The following items are explicitly deferred to post-launch. Each has a DECISION_LOG entry
(see DECISION_LOG.md) documenting the reasoning.

- **ATG / horizon wiring (IRC §2001(b))** — `adjusted_taxable_gifts` intake not designed;
  `calculate_estate_composition` ATG add-back removed Session 121. Post-launch design required.
  (MASTER_ARCHITECTURE.md Open Backlog #3)
- **Consumer Monte Carlo full parity** — inflation + simulation count accepted from advisor today;
  full assumption field parity deferred (MASTER_ARCHITECTURE.md Open Backlog #2)
- **`/api/businesses` + `/api/insurance` → `/api/consumer/*` rename** — canonical paths today;
  namespace cleanup deferred (MASTER_ARCHITECTURE.md Open Backlog #1, #4)
- **"Ask your advisor →" in-app action for connected advisors** — currently links to
  `/find-advisor` for all users including those with a connected advisor; see DECISION_LOG
- **Add `/education` to `proxy.ts` `PUBLIC_PATHS`** — only if education should be reachable
  without proxy login redirect; page layout still auth-gates

**Resolved in Sprint 10 (see DECISION_LOG):** business succession Path A minimal intake;
invite-your-advisor Path A onboarding; A/B exit criteria.

**Still backlog:** Blended family as separate slug (optional; `remarriage-blended-family` covers today)

---

## How this document relates to engineering docs

When a sprint item results in:
- Route/tier/gate change → update `CONSUMER_NAV_MAP.md`
- Journey/API/refresh behavior change → update `CONSUMER_FLOWS.md`
- Schema/RPC change → update `DATABASE_SCHEMA_REFERENCE.md` + `SCHEMA_CHANGELOG.md`
- Cross-cutting architecture change → update `MASTER_ARCHITECTURE.md`
- New decision made → add entry to `DECISION_LOG.md`

See `UPDATE_CHECKLIST.md` for the full pre-merge checklist.
