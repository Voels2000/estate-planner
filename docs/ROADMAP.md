# ROADMAP.md
# My Wealth Maps — Sprint Roadmap
# Last updated: May 2026 (Sprint 9 current; Sprints 10–15 plan added)

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

### Sprint 9 — Launch, signup attribution, growth polish (Weeks 31–34)
**Goal:** Execute launch checklist when ready; persist advisor/attorney referral codes through signup; close remaining drip and connection polish.

**Launch** ([LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md))
- `[x]` Restore permissive `app/robots.ts` (in repo; deploy + verify `/robots.txt`)
- `[ ]` Submit `sitemap.xml` in Search Console
- `[ ]` Search Console verify + `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
- `[ ]` Production `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com`; Resend domain verify

**Attribution**
- `[x]` Signup persistence — `mwm_referral_code`, `mwm_attorney_referral_code` → `profiles` + `funnel_events` (`20260529000000_profiles_referral_attribution.sql`)
- `[ ]` Admin funnel — optional attorney click report (`listing_type = 'attorney'`)

**Growth polish**
- `[x]` Drip custom sequences — all **24** event slugs in `lib/emails/drip-templates.ts`
- `[ ]` **[HARD GATE]** Life event context on new advisor connections — when advisor accepts
  a client who arrived via a life event page, the event type must be visible in the advisor
  portal Overview tab. This is a Sprint 9 hard requirement, not optional. It has been
  deferred since Sprint 4. Do not carry to Sprint 10.
  - File: `app/api/advisor/accept-request/route.ts`
  - Data: pass `life_events` context at connection-accept time into advisor client view
  - Test: manual verification in Supabase + advisor portal spot-check

**Quality gates (Sprint 9 — must not carry)**
- `[ ]` Digital Assets `FEATURE_TIERS` key addition (`lib/tiers.ts`) — currently missing; tier gate enforced only in `page.tsx`
- `[ ]` `NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_APP_URL` audit — find all remaining legacy references across email routes and replace

**Deferred from earlier sprints**
- `[ ]` Segment-specific dashboard alerts (business $5M, multi-state RE)
- `[ ]` Blended family as separate slug (optional)

**Sprint 9 shipped (partial)**
- `[x]` Signup referral attribution — `_signup-form.tsx` + profiles columns
- `[x]` RMD start age — `lib/calculations/rmdStartAge.ts`; advisor Retirement tab + engine alignment (72/73/75 by birth year)

**Success criteria for Sprint 9**
- Launch checklist complete when product goes live
- `[x]` Referral codes survive signup and appear in funnel/admin
- `[x]` All 24 event pages have custom drip sequences

---

### Sprint 10 — Persona depth, advisor flywheel, segment alerts (Weeks 35–38)

**Goal:** Close the three-persona coverage gap. Business owner and real estate accumulator
personas must have their defining dashboard signals before Sprint 11. Reframe internally
as "close persona gaps" not just "alerts."

**Persona: Business owner**
- `[ ]` Business $5M / $10M threshold alert on dashboard (doc ref: LAUNCH_CHECKLIST § Segment)
- `[ ]` Business succession page — final decision: ship minimal version OR formally descope to
  post-launch with a DECISION_LOG entry. Commented-out route must be resolved either way.
  Do not leave dead code in the sidebar.

**Persona: Real estate accumulator**
- `[ ]` Multi-state real estate probate-risk alert on dashboard (doc ref: LAUNCH_CHECKLIST § Segment,
  ROADMAP Sprint 3 deferred)

**Advisor flywheel**
- `[ ]` Confirm life-event-on-connect shipped and visible in advisor portal (carry-forward verify
  from Sprint 9; if not shipped, this becomes Sprint 10's first task before anything else)
- `[ ]` Evaluate: "Ask your advisor about this →" on Transfer Strategy education cards links to
  `/find-advisor` (public directory). For users with a connected advisor, this should offer
  an in-app action. Add to DECISION_LOG if deferred post-launch.
- `[ ]` Invite-your-advisor onboarding step — PRODUCT_STRATEGY principle 4 names this as primary
  onboarding, not buried in settings. Decision required: is this a launch gate or post-launch?
  Add DECISION_LOG entry either way. Do not let it slide silently again.

**Optional (sprint permitting)**
- `[ ]` Event-specific dashboard alerts beyond LifeEventBanner (Sprint 3 deferred)
- `[ ]` Attorney portal readiness score (Sprint 4 deferred)
- `[ ]` Admin funnel: attorney click breakdown by `listing_type` (NEXT_SESSION item)

**Success criteria**
- Business owner and RE accumulator personas each have at least one segment-specific signal on dashboard
- Business succession route: decision made and logged, dead code resolved
- Invite-your-advisor: decision logged
- Life-event-on-connect: verified in advisor portal

---

### Sprint 11 — Planning-app coherence (Weeks 39–42)

**Goal:** Close cross-links and empty states that break the planning flow. No new feature pillars.

- `[ ]` Projections + Lifetime Snapshot — merge into a single surface OR add clear navigation
  between them. Cross-links currently point in both directions with overlapping content.
  (doc ref: LAUNCH_CHECKLIST § Core planning, ROADMAP backlog)
- `[ ]` Scenarios discoverability — entry point from Projections summary cards is missing
  (doc ref: LAUNCH_CHECKLIST § Core planning, ROADMAP backlog)
- `[ ]` Charitable Giving empty state — personalized suggestions from household data instead of
  generic copy (doc ref: LAUNCH_CHECKLIST § Core planning, ROADMAP backlog)

**Success criteria**
- A consumer on `/projections` can navigate to `/scenarios` without knowing the URL
- Projections and Lifetime Snapshot have either merged or have explicit non-overlapping roles
- Charitable Giving empty state uses at least one household field (state, filing status, or asset type)

---

### Sprint 12 — Conversion decisions & responsive UX (Weeks 43–46)

**Goal:** Close A/B tests with data-driven decisions. Mobile audit. Copy pass.

**A/B test decisions — owner must define criteria NOW, before Sprint 12 begins**

> ⚠️ These tests cannot be decided in Sprint 12 if the data isn't ready. The decision
> criteria must be defined by the end of Sprint 10 so Sprint 11 can be the final
> measurement window. Document criteria in DECISION_LOG before Sprint 11 starts.

- `[ ]` `ab_upgrade_copy` — decide `personalized` vs `generic` winner; remove losing variant
  (doc ref: LAUNCH_CHECKLIST § A/B)
- `[ ]` `ab_assessment_gate` — decide `score_visible` vs `full_gate` winner; remove losing variant
  (doc ref: LAUNCH_CHECKLIST § A/B)
- `[ ]` `EVENT_UPGRADE_COPY` — confirm all 24 slugs render correctly in a production-like env
  for the winning `personalized` variant (doc ref: LAUNCH_CHECKLIST § A/B)

**UX**
- `[ ]` Mobile nav audit — responsive layout review across all consumer-facing routes, both
  public and dashboard (doc ref: LAUNCH_CHECKLIST § Core planning, ROADMAP backlog)
- `[ ]` In-app copy audit (Sprint 2 deferred)

**Optional (if A/B decisions land early)**
- `[ ]` Transfer Strategy guided depth (Sprint 2 deferred)
- `[ ]` Assessment → plan selector on signup (Sprint 2 deferred)

**Success criteria**
- Both A/B flags resolved; no split-test code in codebase at launch
- Mobile nav passes review on iPhone SE and standard Android viewport
- Copy audit complete with no "simple rule-of-thumb" or "illustrative mix" language remaining

---

### Sprint 13 — Pre-production hardening (Weeks 47–50)

**Goal:** Stable staging environment, all migrations verified, smoke test extended.
No new product pillars. Feature freeze starts here.

**Staging**
- `[ ]` Staging / production-like deploy with ALL migrations applied and verified
- `[ ]` `20260529000000_profiles_referral_attribution.sql` confirmed on staging
- `[ ]` All prior migrations confirmed (see LAUNCH_CHECKLIST § Supabase prod migrations)

**Smoke test extension — write BEFORE Sprint 14 begins**

Add the following test rows to CONSUMER_RELEASE_SMOKE_TEST.md (section "Public routes"
and a new "Acquisition & attribution" section):

- `?ref=` advisor referral link → click logs to `referral_clicks` (Supabase verify)
- `?aref=` attorney referral link → click logs to `referral_clicks` with `listing_type='attorney'`
- Signup with `?ref=` in session → `profiles.referral_code` populated (Supabase verify)
- Signup with `?aref=` in session → `profiles.attorney_referral_code` populated
- Drip step 1 fires on event assess email capture (Resend log or inbox verify)
- All 24 event slugs return 200 (not 404) — automated or spot-check list
- Event-specific assessment loads for at least 4 representative slugs across content files
- Life-event-on-connect: advisor portal shows event context after accept

> ⚠️ Define "referral loop proven" precisely before Sprint 14 begins:
> Supabase query: `select * from referral_clicks where listing_type='advisor' limit 5;`
> Pass = at least one row exists with a valid `advisor_directory_id` and correct `referral_code`.
> Same query for `listing_type='attorney'`.

**Automated**
- `[ ]` `npm run test:e2e:consumer` green on CI
- `[ ]` `npm run test:e2e:advisor` green on CI

**Success criteria**
- All migrations applied on staging and verified by spot-check (not assumed)
- Extended smoke test doc written and reviewed before Sprint 14 begins
- Both E2E suites green

---

### Sprint 14 — Full test execution — feature freeze (Weeks 51–54)

**Goal:** All LAUNCH_CHECKLIST Section 1 validation gates pass. No new features.
Fix failures only.

**Rule: No new features, no new migrations in Sprint 14. If a fix requires a new migration,
escalate — do not slip it into Sprint 14 without explicit sign-off.**

**Acquisition & growth (LAUNCH_CHECKLIST)**
- `[ ]` Advisor referral loop proven — Supabase query passes (definition from Sprint 13)
- `[ ]` Attorney referral loop proven — Supabase query passes
- `[ ]` Attorney referral production test — register test attorney, confirm `referral_code`
  auto-generated by trigger, portal newsletter kit renders, `?aref=` click logs correctly
- `[ ]` Drip steps 1–3 on production-like URL with Resend — inbox verify all 3 arrive on schedule
- `[ ]` End-to-end acquisition path: new consumer signup → household setup → assessment →
  email capture → drip step 1 → advisor connection → advisor portal view; all steps verified
  on the production-like URL

**Planning regression (CONSUMER_RELEASE_SMOKE_TEST)**
- `[ ]` Core sections 1–3: pass
- `[ ]` Estate planning sections 4–7: pass
- `[ ]` Optional sections 8–11 (run as time permits; flag any failures)
- `[ ]` New acquisition/attribution test rows from Sprint 13: pass
- `[ ]` Sign-off form completed with tester name, date, environment, deploy/commit

**Automated**
- `[ ]` `npm run test:e2e:consumer` green
- `[ ]` `npm run test:e2e:advisor` green

**Fix loop**
- Fix all Sprint 14 test failures; re-run affected smoke sections until pass
- If a fix touches a planning engine: re-run Core + Estate planning sections
- If a fix touches auth/signup: re-run acquisition path end-to-end

**Success criteria = LAUNCH_CHECKLIST Section 1 fully checked**

---

### Sprint 15 — Go-live (Section 2 ops only) (Weeks 55–58)

**Goal:** Execute LAUNCH_CHECKLIST Section 2. This is an ops sprint — no product features,
no code changes beyond environment variables and DNS.

- `[ ]` `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com` in Vercel Production
- `[ ]` Custom domain attached in Vercel; SSL active
- `[ ]` DNS cutover (A/CNAME → Vercel)
- `[ ]` Redeploy after `NEXT_PUBLIC_APP_URL` change (sitemap, drip links, referral URLs update)
- `[ ]` Resend domain verify — SPF/DKIM for `mywealthmaps.com`; `from` address confirmed
- `[ ]` `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` env var set; meta tag confirmed in `app/layout.tsx`
- `[ ]` Search Console property added; ownership verified; sitemap submitted
- `[ ]` Priority event URLs indexing requested: `/event/selling-a-business`,
  `/event/death-of-spouse`, `/event/approaching-retirement`, `/event/estate-tax-law-change`,
  `/event/serious-diagnosis`
- `[ ]` Short production smoke (Core sections 1–3 only, ~10 min) after domain cutover
- `[ ]` Completion log entry added to LAUNCH_CHECKLIST with date and verifier name

**Success criteria**
- `https://mywealthmaps.com` resolves to the app with SSL
- `robots.txt` returns permissive rules at the live domain
- Sitemap submitted in Search Console
- Post-cutover smoke passes

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

**Items requiring a Sprint 10 decision before they can be backlogged or scheduled:**
- Business succession planning page (currently commented out — must ship or remove dead code)
- Invite-your-advisor as primary onboarding step (PRODUCT_STRATEGY principle 4)
- Blended family as separate slug (optional; `remarriage-blended-family` covers today)

---

## How this document relates to engineering docs

When a sprint item results in:
- Route/tier/gate change → update `CONSUMER_NAV_MAP.md`
- Journey/API/refresh behavior change → update `CONSUMER_FLOWS.md`
- Schema/RPC change → update `DATABASE_SCHEMA_REFERENCE.md` + `SCHEMA_CHANGELOG.md`
- Cross-cutting architecture change → update `MASTER_ARCHITECTURE.md`
- New decision made → add entry to `DECISION_LOG.md`

See `UPDATE_CHECKLIST.md` for the full pre-merge checklist.
