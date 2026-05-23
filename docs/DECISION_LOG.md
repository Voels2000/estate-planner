# DECISION_LOG.md
# My Wealth Maps — Key Decisions and Reasoning
# Last updated: May 2026

---

## Purpose

This document records significant product, UX, and strategy decisions — what was decided, why, and what alternatives were considered. It exists so decisions made in one session don't get relitigated in the next. If a decision is here, it was made deliberately. If you want to revisit it, add a new entry rather than editing the old one.

**How to add an entry:** Date · Topic · Decision · Reasoning · Alternatives considered.

---

## How to use this document at the start of a session

Skim the last 5 entries and the "Active constraints" section before starting any design or engineering work. This prevents re-opening settled questions and re-explaining context that was already worked out.

---

## Active constraints (summary of decisions that affect current work)

- **Complexity stays in.** GRAT/SLAT/ILIT forms keep their technical depth. Add guided context (tooltips, plain-language explanations) but do not hide parameters. This segment wants the depth.
- **Public nav and app nav are separate chrome components.** No planning app links on the public site. No public-site links in the app sidebar.
- **Tier structure is visible in the sidebar.** Locked tiers show representative items with lock icons and upgrade CTAs — they do not disappear.
- **Advisor and attorney connections are in the sidebar footer**, not a primary planning group. They are relationship tools, not planning tools.
- **Conflict alerts must be above the fold on the dashboard.** The specific named alerts are the highest-value content. They cannot be the last thing before the footer.
- **Pricing is positioned against professional fees**, not against consumer tools. Never price-compare to LegalZoom or Trust & Will in copy or positioning.
- **The assessment is the primary public conversion mechanism.** Score is visible without an account. Full breakdown requires account creation.
- **Advisor connection queries** must use `CONNECTED_ADVISOR_CLIENT_STATUSES` from `lib/advisor/clientConnectionStatus.ts` (`active` | `accepted`) — never hardcode a single status in new code.
- **Referral event attribution** is per-user via `funnel_events.event_slug` at signup; `referral_clicks` is anonymous (no `user_id`). Cross-device signup may not have funnel `event_slug` — see NEXT_SESSION.md known limitations.

---

## Decision log

### May 2026 — In-app copy audit: advisor-forward, scope not disclaimer (Sprint 12)

**Decision:** Replace hedging disclaimer patterns (“Educational tool only”, “not constitute advice”, “Always consult”) with product-positioning or scope copy across dashboard, public event/assess, upgrade gates, directories, and shared links. Keep `approximately` on derived estate figures in `UpgradeBanner`. Keep beneficiary-view “informational purposes” on third-party surfaces. Scenarios comparison footer uses **`Scope:`** not **`Disclaimer:`**.

**Reasoning:** Target segment ($2M–$30M) expects a planning tool that prepares them for professional relationships — not copy that implies numbers are untrustworthy before use.

**Alternatives considered:** Remove all disclaimer bars (rejected on beneficiary/share edge cases where audience lacks product context).

---

### May 2026 — Mobile: desktop-first planning app, drawer nav on phones (Sprint 12)

**Decision:** Consumer planning app is **desktop-first** (segment 50–65, complex modeling). On viewports below `lg`, the fixed sidebar becomes an off-canvas drawer (hamburger, overlay, closes on navigate). A short note in the mobile sidebar sets expectations. **Public routes** (`(public)/layout`, event pages) stay separate — acquisition on phone is the priority there; no planning sidebar on those routes. Full responsive audit deferred post-launch.

**Reasoning:** Matches eMoney-style complex tools; avoids landscape-only use of the app shell without a full mobile redesign. Event-page mobile is the real acquisition surface.

---

### May 2026 — Pre-launch A/B collapse: personalized + score_visible (Sprint 12)

**Decision:** With no live traffic, do not wait on `funnel_events` for A/B winners. Ship **`personalized`** upgrade copy only (`getEventUpgradeValueProp` always uses `EVENT_UPGRADE_COPY`). Ship **`score_visible`** assessment behavior only (logged-out users see scores; gap report gated behind signup). Remove `lib/analytics/abTests.ts`, branching code, and `app_config` rows `ab_upgrade_copy` / `ab_assessment_gate` (migration `20260531000000_remove_ab_test_app_config.sql`). Keep `app_config` for other keys. Post-launch A/B when baseline conversion exists.

**Reasoning:** Pre-launch split tests cannot reach significance; PRODUCT_STRATEGY favors specificity over generic upgrade copy; assessment conversion depends on demonstrating value (scores) before account creation.

**Alternatives considered:** Default to higher `tier_upgraded` variant without data (N/A). Keep flags until 4 weeks live (rejected — delays launch hygiene).

---

### May 2026 — Planning empty-state CTAs: profile-only on tier-1/2 surfaces (Sprint 12)

**Decision:** `/projections` and `/complete` use `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` (profile link only). The “Generate estate plan →” link stays on tier-3 `/my-estate-strategy` (inline `POST /api/consumer/generate-base-case`). Export `planningMissingProjectionActions(tier)` for callers that need tier-aware lists; do not merge TIER2 and TIER3 into one constant.

**Reasoning:** Lifetime snapshot and projections rows come from `computeCompleteProjection` on each server render once profile inputs exist — not from `projection_scenarios`. Sending tier-2 users to `/my-estate-strategy` hit a tier-3 upgrade wall and implied a manual generate step that does not apply.

**Alternatives considered:** Inline generate on `/complete` (rejected — redundant with server-side compute). Single shared CTA list (rejected — regresses tier-2 UX).

---

### May 2026 — A/B test exit criteria (Sprint 10, settled)

**Decision (superseded May 2026 Sprint 12):** Pre-launch there was no traffic to apply this
framework. Winners chosen by product strategy prior: **`personalized`** upgrade copy,
**`score_visible`** assessment gate. See entry “Pre-launch A/B collapse” above.

**Original framework (for post-launch tests):** Primary metric `tier_upgraded` in
`funnel_events`; 50 events per variant or 4 weeks; owner Alan; secondary metric on assess
gate: `event_assess_complete` → `account_created`.

**Alternatives considered:** Gut-feel winner selection (rejected). Indefinite dual variants at
launch (rejected).

---

### May 2026 — Business succession: Path A minimal intake (Sprint 10, settled)

**Decision:** **Path A — Ship minimal.** `/business-succession` is live in the sidebar (tier 3).
Minimum intake on `households`: `succession_plan_in_place`, `succession_key_person_identified`,
`succession_buy_sell_in_place`. Dashboard shows an above-the-fold amber alert when the user has
business interests and `succession_plan_in_place` is not true. Full `BusinessSuccessionDashboard`
remains available for advisor workflows; consumer page is the minimal three-question form only.

**Reasoning:** Business-owner persona ($3M–$15M) is a primary segment; succession is their
defining need. Minimal intake closes the persona gap without blocking launch on full planning UI.

**Alternatives considered:** Path B post-launch descope (rejected — leaves dead sidebar comment
and persona gap). Full dashboard for consumers at launch (rejected — scope).

---

### May 2026 — Invite-your-advisor: Path A post-profile onboarding (Sprint 10, settled)

**Decision:** **Path A — Launch gate.** After minimum viable profile save, consumers route to
`/onboarding/invite-advisor` (email invite via `mailto:`, find-advisor link, or skip). One column
only: `profiles.onboarding_invite_advisor_completed_at`. **Skip and continue both set the same
timestamp** (dismissed = seen; no separate `skipped` boolean). NULL means the layout gate is active.
`POST /api/consumer/onboarding-invite-advisor` is used for skip. Layout gate redirects consumers
with MVP profile who have not completed this step. `/my-advisor` retains the invite card for later.

**Deploy:** Column must exist via `20260530000000_sprint9_10_gates.sql` before first prod deploy of this gate.

**Reasoning:** Aligns with PRODUCT_STRATEGY principle 4 (advisor flywheel from day one) without
building in-app advisor messaging at launch.

**Alternatives considered:** Path B footer-only on `/my-advisor` (rejected for launch).

---

### May 2026 — Advisor client link status: `active` and `accepted` (Sprint 9/10)

**Decision:** Treat `advisor_clients.status` in `('active', 'accepted')` as a connected link on
both consumer and advisor surfaces. Canonical constant: `CONNECTED_ADVISOR_CLIENT_STATUSES` in
`lib/advisor/clientConnectionStatus.ts`. New accepts write `active`; legacy `link-pending` now
writes `active` (was `accepted`). Advisor client detail loader and advisor API access checks use
the shared constant so roster + client workspace stay symmetric with `/my-advisor`.

**Connection life event at accept:** Prefer `funnel_events.event_slug` (signup/event attribution),
then `referral_clicks.event_slug` for `profiles.referral_code`, then explicit `life_events`, then
calendar triggers — implemented in `pickConnectionLifeEvent()`.

---

### May 2026 — "Ask your advisor →" links to public directory for all users

**Decision (interim):** The "Ask your advisor about this →" CTA on Transfer Strategy education
cards links to `/find-advisor` for all users, including users with a connected advisor. This
means a connected advisor does not receive any signal when their client is reviewing a strategy
they recommended.

**This is a known gap in the advisor flywheel.** The full behavior should be: if the user
has a connected advisor, this CTA offers an in-app action (message, flag, or notification).
If no connected advisor, it links to `/find-advisor`.

**Deferred to post-launch** because implementing advisor messaging or flagging is a new feature
category (not a fix) and would land in Sprint 10 or later, which risks the launch timeline.

**Post-launch:** Add an in-app advisor flag action on strategy education cards for users with
`advisor_clients` rows in accepted status.

---

### May 2026 — Sprint 13 smoke test purpose: find launch blockers before feature freeze ends

**Decision:** Sprint 13 success is measured by staging verification (migrations, E2E, acquisition smoke A–G),
not by shipping new pillars. Two blockers were found and fixed during Sprint 13 manual smoke: (1) `rmd-start-age`
event copy hardcoded age 73 despite `getRmdStartAge()` supporting 72/73/75; (2) `advisor_directory` lacked
`referral_code` auto-generation on insert (migration `20260601000000`).

**Sprint 14:** Feature freeze — planning smoke Core 1–7 on staging; fixes only from test failures.

---

### May 2026 — `rmd-start-age` event copy uses cohort range, not a single age

**Decision:** Public-facing copy for `/event/rmd-start-age` (hero, subhead, assessment, action plan,
drip emails, advisor/attorney newsletter labels) describes RMD start ages **72, 73, or 75** by birth
year. Do not state “RMDs begin at 73” in user-facing surfaces. **SEO** `title` / `seoDescription`
may still mention 73 where search intent targets that cohort.

**Reasoning:** `getRmdStartAge()` is cohort-accurate in engines; marketing copy that hardcodes 73
is wrong for born ≤1950 (72) and ≥1960 (75). Range copy prompts users to determine their age without
requiring household data on the event page.

**Age cron:** Still fires life events at 70 and 73 for urgency — separate from legal RMD start age in projections.

---

### May 2026 — Production environment variables are a Sprint 15 launch gate

**Decision:** Before Sprint 15 go-live (domain cutover), every Production env var in
[LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-required-before-sprint-15-go-live)
must be verified in the Vercel dashboard. `NEXT_PUBLIC_APP_URL` switches from the preview URL to
`https://mywealthmaps.com`. `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is set at launch only.
`RECOMPUTE_SECRET` must match the value in `.env.local` (shell-source `.env.local` with quoted values
if the secret contains `!` or `#`).

**Not in Vercel Production:** `SUPABASE_URL` — used only by local/staging seed scripts
(`seed-test-attorney`, `seed-test-consumer-estate`). Vercel’s Supabase integration sets URL/keys for deploys.

**Reasoning:** Missing `RECOMPUTE_SECRET` or wrong `NEXT_PUBLIC_APP_URL` silently breaks estate health
recompute and drip/referral links. A single checklist prevents ops drift between preview and production.

---

### May 2026 — "Referral loop proven" requires exact verification queries, not prose

**Decision:** The LAUNCH_CHECKLIST items "Advisor referral loop proven" and "Attorney referral
loop proven" must have exact Supabase verification queries documented before Sprint 14 begins.
Prose criteria ("a click has resolved correctly") are not sufficient for a launch gate.

**Advisor referral verified query (add to CONSUMER_RELEASE_SMOKE_TEST.md § Sprint 13):**

```sql
select rc.id, rc.referral_code, rc.listing_type, rc.advisor_directory_id, rc.created_at
from referral_clicks rc
where rc.listing_type = 'advisor'
order by rc.created_at desc
limit 5;
```

Pass = at least one row with a non-null `advisor_directory_id` and `referral_code` matching
an active row in `advisor_directory`.

**Attorney referral verified query:**

```sql
select rc.id, rc.referral_code, rc.listing_type, rc.attorney_listing_id, rc.created_at
from referral_clicks rc
where rc.listing_type = 'attorney'
order by rc.created_at desc
limit 5;
```

Pass = at least one row with non-null `attorney_listing_id`.

**Signup attribution verified query:**

```sql
select p.id, p.referral_code, p.attorney_referral_code, p.created_at
from profiles p
where p.referral_code is not null or p.attorney_referral_code is not null
order by p.created_at desc
limit 5;
```

Pass = at least one row with referral code matching a test signup.

---

### May 2026 — Event assessments separate from general assess; email capture before drip

**Decision:** Each life event page has its own 5-question assessment at `/event/[slug]/assess` (not the generic 20-question `/assess`). Anonymous users can submit email via `POST /api/email-capture` to receive a checklist; logged-in users persist to `assessment_results` with event metadata in `answers` JSONB. Email drip sequences deferred until ESP is chosen.

**Reasoning:** Event-specific questions increase relevance and conversion from SEO landing pages. Separating routes keeps the general assess as the full planning readiness funnel while event pages stay focused. Email capture stores leads immediately without blocking on drip infrastructure.

**Alternatives considered:** Single `/assess` with event query param (rejected — harder to share/bookmark per event). Dedicated `event_slug` column on `assessment_results` (deferred — JSONB metadata sufficient for Sprint 2).

---

### May 2026 — Target segment defined as $2M–$30M specifically

**Decision:** Focus exclusively on households with $2M–$30M in assets. Do not optimize for mass-market simplicity (under $500K) or ultra-HNW complexity (over $30M).

**Reasoning:** This is the only segment that is genuinely underserved today. Below $2M, LegalZoom and consumer robo-advisors are adequate. Above $30M, family offices and private banks serve the need expensively. The $2M–$30M band has complex enough finances to need real planning but no coordinated tool built for them. Over 50% have no will or plan at all. The complexity of the product (GRAT/SLAT modeling, state estate tax calculations, horizon projections) is a competitive advantage in this segment, not a UX problem.

**Alternatives considered:** Building for the mass market and growing upmarket (rejected — the product's complexity would feel overwhelming to simple-estate users, and the competitive field is crowded). Building for $30M+ (rejected — family office needs are fundamentally different and the competitive resources required are much larger).

**Implication for UX:** Never simplify features to the point of removing depth. Add guided context instead.

---

### May 2026 — Complexity is a feature, not a bug

**Decision:** Retain full technical depth in Transfer Strategy forms (GRAT §7520 Rate, Death Year, Rolling GRATs #, etc.). Add guided context (tooltips explaining what each field means, current IRS rates auto-populated where possible) but do not hide parameters behind "Advanced settings" or remove them for consumer-facing views.

**Reasoning:** A business owner modeling a GRAT before a $12M business sale wants to understand the mechanism. They've been paying $500/hour for attorneys to explain this. A tool that lets them model it themselves and bring the model to their advisor for refinement is worth real money. Hiding the depth would make the tool feel like it was built for a different audience.

**Alternatives considered:** Hiding advanced parameters behind "Advanced settings" disclosure (rejected — this segment will leave a tool that feels dumbed down). Advisor-only access to modeling depth (rejected — self-guided modeling is our core differentiation).

---

### May 2026 — Public site and app are separate navigation zones

**Decision:** Public site (education, assessment, find advisor/attorney, pricing) uses a clean top nav with no sidebar. Authenticated app uses a sidebar with planning groups only and zero public-site links.

**Reasoning:** The two zones serve fundamentally different audiences and goals. The public site has one goal: convert visitors to accounts. The app has one goal: help subscribers plan. Mixing them creates a sidebar with 30+ items that dilutes both experiences. Public content (Education Guide, Planning Assessment, Find an Advisor) does not belong in the planning nav for a paid subscriber who is in the middle of modeling their estate tax.

**Alternatives considered:** Keeping everything in one sidebar (rejected — overcrowded, confuses the planning experience, makes tier structure harder to see). Moving public content to a separate subdomain (acceptable but not required — route group separation in Next.js is sufficient).

---

### May 2026 — Advisor and attorney are distribution partners, not competitors

**Decision:** Position advisor and attorney relationships as the primary professional network that the product serves, not as alternatives to the product. "Invite your advisor" is a primary onboarding step. Advisors receive event context on new client connections. Attorneys get attorney-ready exports.

**Reasoning:** This segment already has or wants relationships with advisors and attorneys. A client who arrives with a completed household data profile and specific questions about GRAT vs SLAT timing can do a $3,000 meeting in 90 minutes instead of 3 hours. That advisor becomes our best salesperson. The referral flywheel (advisor refers client → client connects advisor → advisor recommends strategies → estate health improves → advisor looks good → advisor refers more clients) is the moat that competitors can't easily replicate.

**Alternatives considered:** Treating advisor/attorney as peripheral connection features (rejected — misses the primary distribution opportunity and the retention mechanism). Competing with advisors by providing advice (rejected — we are a planning and coordination tool, not a licensed advisor).

---

### May 2026 — Life events are the primary acquisition mechanism

**Decision:** Build event-specific landing pages for the 8 highest-priority life events (business sale, death of spouse, serious diagnosis, inheritance, divorce, approaching retirement, large RSU vest, new child). Each page targets "$2M–$30M" consequences specifically, has a 5-question event-specific assessment, and gates the full result behind account creation.

**Reasoning:** Nobody wakes up wanting estate planning software. They wake up having just sold a business or lost a parent. Life event searches ("estate planning after selling a business," "what happens to my estate if I get divorced") have high intent and low competition from mass-market tools that don't address this segment's complexity. The assessment creates personalized urgency using the user's own answers before they've created an account.

**Alternatives considered:** Generic content marketing (lower conversion intent). Paid acquisition only (no organic compounding). Building the event system after launch (rejected — life events are the front door; the public site without them is just another generic wealth management landing page).

---

### May 2026 — Dashboard conflict alerts must be above the fold

**Decision:** The "1 critical · 3 warnings" conflict alert system (which names specific accounts with specific problems) must be visible on the dashboard without scrolling. A compact alert banner below the greeting and a severity chip row on the Planning Readiness Score card are the minimum. The full detail section can remain where it is.

**Reasoning:** The named conflict alerts ("4 accounts missing beneficiaries: Yukon Denali 2019, Kubota Tractor and Accessories…") are the most valuable content on the dashboard and in the product. They demonstrate immediately that the tool understands the user's specific situation. Currently they require 3–4 scrolls to reach, which means most users never see them. No new feature is needed — just surfacing.

**Alternatives considered:** Keeping the current scroll order (rejected — the most valuable content is hidden). Replacing the score card with conflicts (rejected — the score provides important orientation context; both can coexist with the banner approach).

---

### May 2026 — Horizons page layout: cards → comparison table

**Decision:** Redesign the Estate Value and Tax Horizons page from a card-per-column layout to a comparison table with labels on the left and four value columns (Today / In 10 Years / In 20 Years / At Death). "Est. total estate tax liability" moves to a hero row at the top of the table, not the bottom.

**Reasoning:** The four columns currently repeat 8–9 identical labels four times. A user comparing across columns has to read the same label four times to find the values they want. The Scenarios page already uses the correct pattern (labels once on left, values in columns, best value highlighted) — this is a proven pattern in the product. The total tax liability number is the single most important number on the page and should not be the last item the user reads.

**Alternatives considered:** Keeping the card layout with summary numbers at the top of each card (partially implemented in revised design — hero cards show only the tax liability number, table handles the detail). Removing the column breakdown entirely in favor of a single timeline chart (rejected — the specific year breakdowns are important for planning decisions).

---

### May 2026 — Sprint 1: public routes in `(public)` route group, not dashboard sidebar

**Decision:** Move `/education`, `/assess`, `/find-advisor`, and `/find-attorney` to `app/(public)/` with a passthrough layout (no dashboard sidebar). Remove those links from the app sidebar Overview group. Keep education auth-gated in its nested layout.

**Reasoning:** Public discovery and planning app are different mental models. Mixing them in the sidebar made the app feel like a marketing site. URLs stay the same; only layout grouping changes. Marketing top nav on `(public)` is deferred to Sprint 2 — education and directories already render their own headers.

**Alternatives considered:** Leaving routes at `app/` root and `app/(education)/` (rejected — inconsistent route groups). Deleting page components (rejected — breaks bookmarks and SEO).

**Implication:** `CONSUMER_NAV_MAP.md` and `proxy.ts` `PUBLIC_PATHS` must stay aligned. `/education` is not in `PUBLIC_PATHS` today — unauthenticated users hit proxy login redirect before the education layout; consider adding if marketing should allow anonymous catalog browse.

---

### May 2026 — Life event content in TypeScript, not MDX (v1)

**Decision:** Ship Sprint 2 event pages with content in `lib/events/content.ts` (typed `EventContent` records), not MDX files under `content/events/`.

**Reasoning:** Faster to ship eight complete pages with actions, assessment questions, and SEO fields in one reviewable module. No `@next/mdx` setup required. Matches education’s pattern (markdown elsewhere, app-layer rendering).

**Alternatives considered:** MDX per `ROADMAP.md` original spec (deferred). CMS / database-driven events (deferred to Sprint 3+ in-app logging).

---

### May 2026 — `advisor_directory` is the canonical advisor listing table

**Decision:** All advisor listing, connection, and referral resolution uses `advisor_directory` keyed by `profile_id` (professional's auth user id). Do not introduce or query `advisor_listings`.

**Reasoning:** Find-advisor, register, my-advisor, and referral tracking were split across table names; a single canonical table prevents ghost schema and broken referral FKs.

**Implementation:** Migration `20260522000000_advisor_referrals.sql`; `referral_clicks.listing_id` → `advisor_directory(id)`.

**Implication:** All listing/referral queries use `profile_id`, not `advisor_id`, on `advisor_directory`.

---

### May 2026 — Dual analytics: Vercel page views + custom `funnel_events`

**Decision:** Use `@vercel/analytics` for automatic route page views and a separate `funnel_events` table + `/api/analytics/funnel` for conversion steps (assess, email, signup, tier, advisor connect).

**Reasoning:** Vercel Analytics does not capture custom funnel steps or join to `referral_code` / `event_slug`. Product needs SQL-queryable events for A/B analysis and advisor attribution. Client capture is fire-and-forget (`captureFunnelEvent`) so analytics never blocks UX.

**Alternatives considered:** Vercel only (rejected — insufficient for funnel). PostHog/Mixpanel (deferred — Supabase keeps data in-house).

---

### May 2026 — A/B tests via `app_config`, not feature flags service

**Decision:** Store `ab_upgrade_copy` and `ab_assessment_gate` in `app_config`. Toggle values in Supabase dashboard without deploy.

**Reasoning:** Two experiments for Sprint 5; no need for LaunchDarkly-style infra. `getAssessmentGateVariant()` / `getUpgradeCopyVariant()` read at request time on server paths.

**Measurement:** Compare `funnel_events` and conversion rates grouped by variant (store variant in `properties` when needed).

---

### May 2026 — Event content split: `content.ts` + `content-sprint5.ts`

**Decision:** Keep original 8 events in `lib/events/content.ts`; add 16 Sprint 5 events in `lib/events/content-sprint5.ts`; merge via spread into `EVENT_CONTENT`.

**Reasoning:** Single 3k-line file is hard to review and merge. `EVENT_SLUGS = Object.keys(EVENT_CONTENT)` still drives SSG without code changes to `generateStaticParams`.

---

### May 2026 — Idempotent RLS policies in migrations

**Decision:** Wrap `create policy` statements in `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_policies …)` blocks for `life_events`, `referral_clicks`, and `funnel_events`.

**Reasoning:** Migrations were applied manually in Supabase before `supabase db push`; re-run must not fail on duplicate policy names. Tables/indexes already use `IF NOT EXISTS`.

---

### May 2026 — `/assess` server wrapper for assessment A/B gate

**Decision:** Split `app/(public)/assess/page.tsx` into server page (reads `ab_assessment_gate`) + `_assess-client.tsx` (client UI).

**Reasoning:** Gate variant must be read server-side from `app_config`; the assess UI is a large client component. `full_gate` hides scores for logged-out users; `score_visible` keeps current behavior.

---

### May 2026 — `NEXT_PUBLIC_APP_URL` as canonical public base URL

**Decision:** Use `NEXT_PUBLIC_APP_URL` for sitemap, robots, drip links, and new email CTAs. Production value: `https://estate-planner-gules.vercel.app` until domain cutover to `https://mywealthmaps.com`.

**Reasoning:** One env var avoids drift between `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` in emails and SEO metadata.

**Alternatives considered:** Hardcoding production URL in sitemap (rejected — breaks preview/staging). Keeping both env vars forever (accepted short-term; converge on `NEXT_PUBLIC_APP_URL` for new code).

---

### May 2026 — Resend drip with `INTERNAL_API_KEY`

**Decision:** Implement 3-email drip via Resend: step 1 immediately on `POST /api/email-capture`; steps 2–3 in daily notifications cron; templates in `lib/emails/drip-templates.ts` (default + 3 event-specific sequences). Internal calls authenticate with `x-internal-key: INTERNAL_API_KEY` (cron may also use `CRON_SECRET` on drip route).

**Reasoning:** ESP was deferred in Sprint 2; Resend already used for advisor/attorney connect emails. Non-blocking fetch on capture keeps API fast. `(email, source)` uniqueness drives per-capture drip state columns.

**Alternatives considered:** Dedicated drip cron route (deferred — folded into notifications cron job 7). Dedicated `event_slug` column on `email_captures` (deferred — parse from `source` prefix `event-assess-`).

---

### May 2026 — Admin funnel reads via service role

**Decision:** Admin funnel tab fetches `funnel_events` with `createAdminClient()`, not the user-scoped Supabase server client.

**Reasoning:** `funnel_events` RLS allows users to read only their own rows; admins would see empty data otherwise.

---

### May 2026 — Per-age calendar triggers use dedicated event slugs

**Decision:** Age cron (`/api/cron/age-triggers`) maps 62 → `social-security-timing`, 65 → `medicare-eligibility`, 70 and 73 → `rmd-start-age` instead of a single `approaching-retirement` slug for all milestones.

**Reasoning:** Dedicated event pages and drip/upgrade copy exist for each milestone; users see relevant content and advisors can share matching referral URLs.

**Alternatives considered:** Keep one slug and branch copy in-app only — rejected because 24-slug content model is already live.

---

### May 2026 — Advisor newsletter kit on portal (not email blast product)

**Decision:** Ship copy-paste newsletter kit in `app/advisor/_advisor-client.tsx` (grouped links, HTML email template, plain text) using `buildAllEventReferralUrls` for all 24 slugs. No automated email send from MWM to advisor list.

**Reasoning:** Advisors distribute through their own ESP; we provide assets and tracked links without storing advisor subscriber lists.

---

### May 2026 — One custom drip sequence per event slug (24 total)

**Decision:** Expand `DripEventSlug` and `EVENT_SEQUENCES` to cover all 24 life event pages. Keep `DEFAULT_SEQUENCE` only as fallback for unknown slugs.

**Reasoning:** Launch checklist required parity with public event content; age-milestone slugs (`rmd-start-age`, `medicare-eligibility`, `social-security-timing`) should match age-trigger cron messaging in drip emails.

**Implementation:** `lib/emails/drip-templates.ts` (Sprint 9).

---

### May 2026 — Signup persists both referral codes on `profiles`

**Decision:** On account creation, write `profiles.referral_code` (advisor `?ref=`) and `profiles.attorney_referral_code` (attorney `?aref=`) from sessionStorage once; mirror both in `funnel_events.properties` on `account_created`. Fire-and-forget profile update so navigation is never blocked. If both codes exist, persist both.

**Reasoning:** Funnel rows alone are hard to join for CRM-style reporting; profile columns enable durable joins to `advisor_directory` and `attorney_listings`.

**Implementation:** `20260529000000_profiles_referral_attribution.sql`; `app/(auth)/signup/_signup-form.tsx`.

---

### May 2026 — Attorney referrals use `?aref=` (separate from advisor `?ref=`)

**Decision:** Attorney event attribution uses query param `?aref=` and `referral_clicks.listing_type = 'attorney'`. Advisor `?ref=` behaviour is unchanged. Extend `referral_clicks` with `attorney_listing_id` and `attorney_profile_id` rather than a second click table.

**Reasoning:** Avoids overloading `?ref=` resolution (advisor vs attorney codes could collide). Mirrors `connection_requests.listing_type` pattern. Keeps one click ledger for admin SQL.

**Implementation:** `20260528000000_attorney_referrals.sql`; `POST /api/referral/track` with `type`; session keys `mwm_attorney_referral_code`.

---

### May 2026 — Centralized RMD start age (SECURE Act birth-year cohorts)

**Decision:** Single source of truth `getRmdStartAge(birthYear)` in `lib/calculations/rmdStartAge.ts`: age **72** (born 1950 or earlier), **73** (1951–1959), **75** (1960 or later). All engines and UI surfaces import this helper; advisor client Retirement tab uses **per-person** birth year (fixes hardcoded age 73).

**Reasoning:** Alan Voels (born 1960) and others in the 1960+ cohort must see RMD at **75**, not 73. Duplicated inline `>= 1960 ? 75 : 73` logic missed the pre-1951 age-72 cohort and left advisor Retirement messaging wrong.

**Implementation:** `rmdStartAge.ts`; consumers include `projection-complete.ts`, `lib/calculations/rmd.ts`, `lib/dashboard/calculations.ts`, `lib/monte-carlo.ts`, `app/(dashboard)/rmd/_rmd-client.tsx`, `app/advisor/clients/[clientId]/_tabs/RetirementTab.tsx`, `app/admin/debug-tab.tsx`.

**Note:** Age cron still fires `rmd-start-age` life events at ages **70** and **73** for marketing urgency; that is separate from when RMDs are **required** in projection math.

---

### May 2026 — Block all crawlers pre-launch

**Decision:** `app/robots.ts` returns `disallow: /` for `userAgent: *` and omits the `sitemap` URL until product launch. `app/sitemap.ts` stays in the codebase. Google Search Console setup deferred.

**Reasoning:** Avoid indexing staging/Vercel URL and incomplete public surfaces before `mywealthmaps.com` cutover. Sitemap and verification (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) are ready to enable in one launch checklist.

**At launch:** See [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) for the full task list.

---

## Template for new entries

### [Date] — [Topic]

**Decision:** [What was decided — one clear sentence]

**Reasoning:** [Why this decision was made — the key arguments]

**Alternatives considered:** [What else was evaluated and why it was rejected]

**Implication:** [What this means for future work, if not obvious]
