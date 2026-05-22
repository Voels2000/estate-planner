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

---

## Decision log

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
