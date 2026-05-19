# ROADMAP.md
# My Wealth Maps — Sprint Roadmap
# Last updated: May 2026 (Sprint 2 Track A + B shipped)

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

### Sprint 2 — Life event landing pages (Weeks 6–8)
**Goal:** 8 event pages live, SEO-ready, with event-specific assessments.

**8 priority events**
- `[x]` /event/selling-a-business — GRAT/SLAT window, charitable timing, business valuation
- `[x]` /event/death-of-spouse — portability election, retitling urgency, 30-day checklist
- `[x]` /event/serious-diagnosis — incapacity planning, trust funding, healthcare directives
- `[x]` /event/receiving-inheritance — sudden estate complexity, first-time $2M+
- `[x]` /event/divorce — beneficiary reconstruction, QDRO, trust restructuring
- `[x]` /event/approaching-retirement — RMD, SS timing, Roth window, estate freeze
- `[x]` /event/large-rsu-vest — concentrated position, capital gains, gifting timing
- `[x]` /event/new-child-grandchild — trust for minors, guardianship, 529, beneficiary updates

**Infrastructure**
- `[x]` Dynamic route: `/event/[slug]` with TypeScript content (`lib/events/content.ts`; MDX deferred)
- `[x]` Event content schema: slug, category, urgency, linked features, assessment questions (`lib/events/types.ts`)
- `[~]` SEO: title, description, OG tags per event via `generateMetadata`; schema.org structured data still pending
- `[~]` Event-specific 5-question assessment: questions in content; interactive path on `/assess` still pending (teaser links to generic assess)
- `[ ]` Email capture → drip sequence (3 emails, 2-week cadence) per event type
- `[x]` Professional CTAs: attorney/advisor cards on event pages per `advisorCTA` / `attorneyCTA` flags

**Sprint 1 carryover (marketing / public chrome)**
- `[x]` Public top nav on `(public)` layout (`app/(public)/_components/public-nav.tsx`)
- `[x]` Homepage hero rewritten for $2M–$30M segment; life events quick-start entry (`app/page.tsx`)
- `[x]` Pricing page: position against professional fees (`app/pricing/page.tsx`)
- `[ ]` Add social proof section on marketing site
- `[ ]` Assessment: score visible without login, full breakdown gates account creation
- `[ ]` Account creation: assessment score carries through; plan selector maps to tiers
- `[ ]` Email capture on assessment result ("email me my full checklist")
- `[ ]` Audit in-app copy — remove "teaser," "simple," "rule-of-thumb" language
- `[ ]` Transfer Strategy form depth + guided context (tooltips, IRS rate auto-populate)
- `[ ]` "Invite your advisor" as primary onboarding step (Step 2 after profile)

**Success criteria for Sprint 2**
- 8 event pages indexed in Google Search Console
- Event page → assessment → account creation funnel measured
- Email capture rate on assessment results

---

## Upcoming sprints

### Sprint 3 — In-app life event triggers (Weeks 9–11)
**Goal:** Users can log life events in-app; plan recomputes with event-specific conflict generation.

**Event logging**
- `[ ]` life_events table: user_id, event_type, event_date, acknowledged, linked_features, source
- `[ ]` Dashboard banner: "Did something change? Log a life event" with event picker
- `[ ]` Event → recompute pipeline: logged event triggers estate health recompute + new conflicts
- `[ ]` Event-specific dashboard alerts: "You indicated a business sale. 5 things need updating."

**Calendar triggers**
- `[ ]` Age-based trigger service: cron checks DOB from profiles against milestone ages
- `[ ]` SS trigger at age 62: "Social Security claiming decisions start now — see your options"
- `[ ]` Medicare trigger at age 65
- `[ ]` Roth conversion window trigger at age 70½
- `[ ]` RMD trigger at age 73

**Segment-specific triggers**
- `[ ]` Business value threshold: when business input crosses $5M and $10M, surface estate tax change alert
- `[ ]` Multi-state property: when RE in 2+ states entered, flag probate risk
- `[ ]` Estate growth velocity: when gross estate grows 20%+ year-over-year, surface alert
- `[ ]` Event-personalized upgrade gates: logged event injects context into locked-page copy

**Success criteria for Sprint 3**
- Event banner engagement rate
- Calendar trigger → feature visit rate
- Event-personalized upgrade conversion vs generic gate baseline (A/B)

---

### Sprint 4 — Advisor/attorney network as distribution (Weeks 12–14)
**Goal:** Advisors and attorneys become active referral sources.

**Advisor integration**
- `[ ]` "Invite your advisor" primary onboarding step with pre-written email template
- `[ ]` Life event context on new advisor connections: "Alan connected after indicating a business sale"
- `[ ]` Advisor notification when client logs a life event: "Your client just recorded a marriage — 4 items need review"
- `[ ]` Advisor referral mechanic: shareable event page links with advisor referral tag

**Attorney integration**
- `[ ]` Attorney CTA prominent on high-urgency events (death of spouse, serious diagnosis, divorce)
- `[ ]` Attorney-ready export: one-click household summary formatted for attorney intake
- `[ ]` Attorney referral mechanic: shareable event page links with attorney referral tag
- `[ ]` Shared plan completeness visibility: advisor + attorney can see non-confidential readiness score

**Success criteria for Sprint 4**
- % new accounts from advisor/attorney referral (target: 20%+ within 60 days of launch)
- Advisor-referred LTV vs self-acquired
- Attorney export usage rate

---

### Sprint 5 — Analytics, optimization, remaining event pages (Weeks 15–18)
**Goal:** Full funnel measured, A/B tests running, remaining 17 event pages published.

**Analytics**
- `[ ]` Full funnel instrumentation: event page → assessment → email → account → tier → advisor connect → retention
- `[ ]` Event source attribution: which events convert at highest rate, which drive highest LTV tier
- `[ ]` A/B: event-personalized upgrade copy vs generic (expected 20–40% lift)
- `[ ]` A/B: assessment gate (score visible) vs full gate (nothing visible)

**Remaining event pages (17)**
- `[ ]` Getting married
- `[ ]` Remarriage / blended family
- `[ ]` Aging parent needs care
- `[ ]` Loss of a parent
- `[ ]` Starting a business
- `[ ]` Selling a home
- `[ ]` Multi-state real estate
- `[ ]` Child reaching adulthood
- `[ ]` Blended family / stepchildren
- `[ ]` Disability / early retirement
- `[ ]` Estate tax law change (federal exemption sunset)
- `[ ]` RMD start age (73)
- `[ ]` Medicare eligibility (65)
- `[ ]` Social security timing decision (62–70)
- `[ ]` First-time high net worth (crossed $2M threshold)
- `[ ]` Major job / income change
- `[ ]` 5-year plan review (calendar trigger)

**Content distribution**
- `[ ]` Advisor newsletters — provide event page content for advisors to share with their book
- `[ ]` Attorney referral program — co-branded event pages for estate planning attorneys
- `[ ]` LinkedIn targeting for $2M–$30M segment using life event targeting
- `[ ]` Partnership outreach to estate planning publications and podcasts

**Success criteria for Sprint 5**
- Monthly organic traffic from event pages (target: 5,000+ sessions/month)
- Event → paid tier conversion rate by source
- 6-month retention rate by acquisition source
- NPS segmented by persona type (business owner, RE accumulator, executive)

---

## Completed sprints

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

**Deferred to Sprint 2 (marketing / public chrome)**
- `[x]` Shared public top nav — shipped Sprint 2 Track A
- `[x]` Homepage hero and segment copy — shipped Sprint 2 Track A
- `[x]` Pricing positioning vs professional fees — shipped Sprint 2 Track A
- `[-]` Social proof section
- `[-]` Assessment conversion funnel enhancements
- `[-]` In-app copy audit; Transfer Strategy guided depth; Invite-your-advisor onboarding step

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
- Remaining 17 life event pages (scheduled for Sprint 5 but listed here for reference)
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
