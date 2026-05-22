# ROADMAP.md
# My Wealth Maps — Sprint Roadmap
# Last updated: May 2026 (Sprint 9 current)

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

### Sprint 9 — Launch, signup attribution, growth polish (Weeks 31–34)
**Goal:** Execute launch checklist when ready; persist advisor/attorney referral codes through signup; close remaining drip and connection polish.

**Launch** ([LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md))
- `[ ]` Restore permissive `app/robots.ts` + submit `sitemap.xml`
- `[ ]` Search Console verify + `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
- `[ ]` Production `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com`; Resend domain verify

**Attribution**
- `[x]` Signup persistence — `mwm_referral_code`, `mwm_attorney_referral_code` → `profiles` + `funnel_events` (`20260529000000_profiles_referral_attribution.sql`)
- `[ ]` Admin funnel — optional attorney click report (`listing_type = 'attorney'`)

**Growth polish**
- `[ ]` Drip custom sequences for 12 event slugs **not in `DripEventSlug`**
- `[ ]` Life event context on new advisor connections

**Deferred from earlier sprints**
- `[ ]` Segment-specific dashboard alerts (business $5M, multi-state RE)
- `[ ]` Blended family as separate slug (optional)

**Sprint 9 shipped (partial)**
- `[x]` Signup referral attribution — `_signup-form.tsx` + profiles columns

**Success criteria for Sprint 9**
- Launch checklist complete when product goes live
- `[x]` Referral codes survive signup and appear in funnel/admin
- Optional: all 24 event pages have custom drip sequences

---


## Completed sprints

### Sprint 8 — Attorney referral attribution (Weeks 27–30) ✅
**Goal:** Attorney event-page attribution parallel to advisor `?ref=` distribution.

**Shipped**
- `[x]` Migration `20260528000000_attorney_referrals.sql` — `attorney_listings.referral_code`; `referral_clicks` attorney columns + `listing_type`; attorney RLS
- `[x]` `POST /api/referral/track` — `type: 'attorney' | 'advisor'`; advisor path unchanged
- `[x]` `_referral-tracker.tsx` — `?aref=`; `mwm_attorney_referral_*` sessionStorage
- `[x]` `buildAttorneyReferralUrl` / `buildAllAttorneyEventReferralUrls` — 24 slugs
- `[x]` Attorney portal newsletter kit — three-tab UI (blue styling)

**Carried to Sprint 9**
- Launch checklist
- Signup referral persistence
- Drip for 12 non-union slugs

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

## Backlog (not yet scheduled)

- Projections + Lifetime Snapshot consolidation into single page
- Charitable Giving empty state — personalized suggestions from household data
- Mobile nav audit and responsive improvements
- Scenarios page discoverability — entry point from Projections summary cards
- Life event pages — 24 live (Sprint 2 + Sprint 5); see `lib/events/content-sprint5.ts`
- Business succession planning page (currently commented out of sidebar)
- Digital Assets feature key addition to FEATURE_TIERS
- Add `/education` to `proxy.ts` `PUBLIC_PATHS` if education should be reachable without proxy login redirect (page layout still auth-gates)

---

## How this document relates to engineering docs

When a sprint item results in:
- Route/tier/gate change → update `CONSUMER_NAV_MAP.md`
- Journey/API/refresh behavior change → update `CONSUMER_FLOWS.md`
- Schema/RPC change → update `DATABASE_SCHEMA_REFERENCE.md` + `SCHEMA_CHANGELOG.md`
- Cross-cutting architecture change → update `MASTER_ARCHITECTURE.md`
- New decision made → add entry to `DECISION_LOG.md`

See `UPDATE_CHECKLIST.md` for the full pre-merge checklist.
