# DECISION_LOG.md
# My Wealth Maps — Key Decisions and Reasoning
# Last updated: 2026-05-26 (UX-4 inline modeling; UX-3 Strategy tab; UX-2; advisor tax parity)

---

## Purpose

This document records significant product, UX, and strategy decisions — what was decided, why, and what alternatives were considered. It exists so decisions made in one session don't get relitigated in the next. If a decision is here, it was made deliberately. If you want to revisit it, add a new entry rather than editing the old one.

**How to add an entry:** Date · Topic · Decision · Reasoning · Alternatives considered.

---

### May 2026 — UX-4: Inline strategy modeling in Opportunities panel

**Decision:** Wire Step 2 catalog rows to existing `SLATILITPanel` and `AdvancedStrategyPanel` inline (expand/collapse per row) without new engines, APIs, or migrations. Centralize catalog id → panel chip mapping in `catalogToPanel.ts`; **CST** uses catalog/API key `cst` but UI chip `credit_shelter_trust` (only asymmetric case). Remove scroll-only `ModelStrategyButton`. Keep full-width panels below the three-step workflow as fallback; `scrollToStrategyModules` unchanged.

**Reasoning:** UX-3 “Model this” scrolled away from the catalog; advisors lost context. Reusing existing panels preserves `strategy_source` contracts and `useRecommendAdvanced` / SLAT·ILIT POST paths. Grep-verified chip strings prevent silent no-op panel opens.

**Alternatives considered:** New inline forms per strategy (rejected — duplicate engines). Rename `credit_shelter_trust` to `cst` in UI state (rejected — breaks `PANEL_TO_STRATEGY_SOURCE` and saved-state mapping).

---

### May 2026 — UX-3: Strategy tab three-step workflow + severity system

**Decision:** Reorganize the advisor Strategy tab into three labeled steps — **Situation** (diagnostic metrics), **Opportunities** (strategy catalog + “Model this”), **Recommendations** (advisor `strategy_line_items` by client response + AF-1 questions) — without changing `calculateAdvisoryMetrics` or consumer surfaces. Replace `!!` / ad-hoc badges with `advisoryMetricSeverity` (`●`/`!`/`✓`/`—`, max 2 active). Show a red liquidity shortfall banner when coverage &lt; 1.0x, ordered before amber exemption warnings. Peer benchmarks stay behind `NEXT_PUBLIC_ADVISOR_BENCHMARKS` (default off).

**Reasoning:** One undifferentiated page mixed diagnosis, modeling, and client recommendations. Liquidity 0.0x was critical but visually equal to low-priority warnings. Advisors need a clear path from “what’s wrong” → “what to model” → “what we sent the client.”

**Alternatives considered:** New API for recommendations list (rejected — existing `strategy_line_items` + extended client fetch). Remove Combined Strategy / Advanced panels (rejected — still needed for modeling; moved below workflow).

---

### May 2026 — UX-2: Advisor portal UX + cached advisory metrics

**Decision:** (1) Ship advisor-only UX in two passes: brand/tab load/gap workflow (pass 1) then metrics cache, estate composition UX, strategy grid (continuation). (2) Cache six core advisory metrics server-side via `unstable_cache` + `household-metrics-{householdId}` tag; invalidate on `afterHouseholdWrite`. (3) Omit Best Strategy NPV and CST Crossover from the grid until `strategy_line_items` has active amounts — show a single CTA instead. (4) Persist gap discussion state in `advisor_gap_statuses` (advisor-private, not consumer-visible).

**Reasoning:** Strategy tab re-computed eight metrics on every client render; tab-scoped loading and cache cut repeat visits. Empty outside-estate panel and small tax chip wasted advisor attention on high-liability households. Warning badges on four cards diluted urgency — cap at two by priority.

**Alternatives considered:** Persist advisory metrics in DB on recompute (deferred — matches P-2 recommendations pattern but heavier than cache for advisor-only reads). Keep eight-card grid with “Not run” placeholders (rejected — noise).

---

### May 2026 — Advisor portal roster net worth (performance)

**Decision:** Advisor home (`/advisor`) uses `loadRosterNetWorthByOwner` (batched table reads) for roster net-worth columns. Client workspace (`/advisor/clients/[id]`) still uses `calculate_estate_composition` for engine-aligned Overview figures.

**Reasoning:** One composition RPC per client made roster load scale linearly with client count and dominated TTFB. Batched reads are approximate but sufficient for sort/display on the roster; full composition remains on the client detail page.

**Alternatives considered:** Keep N RPCs for accuracy (rejected — unacceptable at 5+ clients). Batch composition RPC via new Postgres function (deferred — post-launch per PERF_SPRINT_P1).

---

### May 2026 — NAV-1: Sidebar active route indicator

**Decision:** Active nav uses `isNavItemActive(href, pathname)` with path-prefix matching (except `/dashboard` exact). Planning groups auto-expand when `groupContainsActiveItem` is true, overriding default collapsed state for Financial Planning.

**Reasoning:** Financial Planning was in `DEFAULT_CLOSED_GROUPS` and the open predicate required `!DEFAULT_CLOSED_GROUPS.has(label)`, so the group stayed collapsed on `/income` etc. — children were unmounted and the active stripe never appeared.

**Alternatives considered:** Remove Financial Planning from `DEFAULT_CLOSED_GROUPS` only (rejected — partial fix; other groups need the same active-child rule).

---

### May 2026 — OB-3b: Financial Planning sidebar + layout household query

**Decision:** (1) Remove the legacy green dashboard setup checklist (`DashboardIntroSection`); `SetupProgressCard` is the only setup UI. (2) Set all Financial Planning `FEATURE_TIERS` keys to tier 1 and exempt that group from `isLockedUser`. (3) Never gate Security, My Advisor, or Manage Subscription on `isLockedUser`. (4) Stop selecting `households.date_of_birth_1` in `getDashboardLayoutContext` — use `person1_birth_year` only (profile gate still accepts legacy `date_of_birth_1` on in-memory types if ever populated elsewhere).

**Reasoning:** Tier 1 users (e.g. `test1@rolobe.resend.app`) saw the entire Financial menu locked because the layout household query failed on a non-existent column, so `hasHousehold` was always false. Separately, onboarding users must reach Income/Assets without a household row. Upgrade paths (Retirement/Estate) stay tier-gated.

**Alternatives considered:** Require household before any Financial nav (rejected — blocks data entry). Add `date_of_birth_1` migration (rejected — `person1_birth_year` is canonical).

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
- **Financial Planning sidebar is never `isLockedUser`-gated.** Tier 1 data entry must work before a household row exists. `hasHousehold` comes from layout `getDashboardLayoutContext` — do not SELECT `households.date_of_birth_1` (column does not exist; breaks the query).
- **Security, My Advisor, and Manage Subscription** are never household-gated in the sidebar (OB-3b).
- **Sidebar groups auto-expand when a child route is active** (NAV-1) — required for collapsed Financial Planning to show `NAV_ACTIVE` on the current page.
- **Advisor roster net worth** uses batched table reads (`loadRosterNetWorthByOwner`), not per-client composition RPC. Client workspace uses full `calculate_estate_composition`.
- **Tailwind v4 arbitrary colors:** `text-` / `border-` / `ring-` use `color:` prefix (`text-[color:var(--mwm-gold)]`); `bg-` uses `bg-[var(--mwm-navy)]` without `color:`. Wrong prefix fails silently.
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

**Superseded (2026-05-25, Sprint AF-1 — `a255616`):** Connected consumers use
`POST /api/consumer/ask-advisor` → advisor notification `consumer_strategy_question`; advisor
sees **Client Strategy Questions** on client Overview. No connected advisor → `/find-advisor`.
Session-only “Your advisor has been notified” confirmation (refresh resets UI; notification persists).

---

### June 2026 — Sprint P-2 closed; recommendations cached at recompute

**Decision:** Sprint P-2 (`47a38f3`) shipped pre-launch: `estate_health_scores.recommendations` jsonb populated during `/api/recompute-estate-health`; dashboard reads cache on load (empty array before first recompute — never live RPC on hot path). Projections serve fresh `outputs_s1_first` via cache-first branch in `loadProjectionData`. Layout uses `getDashboardLayoutContext` (React `cache()`) for single auth/profile/household/notifications load per request.

**Remaining post-launch perf:** Materialize `calculate_estate_composition` at recompute — recommendations done; composition still on-demand on some surfaces.

**Doc:** [PERF_SPRINT_P1.md § Sprint P-2](./PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors) · Migration: `20260602130000_sprint_p2_recommendations_cache.sql`

---

### June 2026 — Sprint P-1 closed; first post-launch perf sprint = dashboard read model

**Decision:** Sprint P-1 (`5c24160`) shipped pre-launch quick wins: dashboard `Promise.all`, advisor conflict cache read, 3s recompute debounce, server-fetched notification count, `next/font`, and `idx_assets_owner_id` / `idx_liabilities_owner_id` (applied in production).

**Post-launch engineering priority (Sprint P-2):** Production `pg_stat_statements` (Query A) shows top load from `projection_scenarios` INSERTs and estate RPCs (`calculate_estate_composition`, `generate_estate_recommendations`) on the dashboard path. **Sprint P-2 addressed** recommendations cache + projections cache-first + auth dedup (`47a38f3`). **Remaining:** materialize `calculate_estate_composition` at recompute.

**Doc:** [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) · [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql)

---

### May 2026 — Sprint 14 manual smoke bugs (fix before launch)

**Decision:** Two issues from manual smoke §1–7 (2026-05-23) must be fixed before LAUNCH_CHECKLIST Section 1 is fully signed off:

1. **Admin Portal in consumer sidebar** — consumers must never see admin navigation; gate on profile `role` (or equivalent) in dashboard shell.
2. **Asset add form save button** — must be reachable without browser zoom; use scrollable form body and/or sticky footer for primary save action.

**Post-launch (not blocking):** Dashboard initial load and post-profile-save render slowness — track as performance work after launch.

**Completed same sprint:** `consumer-core-recompute.spec.ts` (`93aa6f5`); manual sign-off `1e092d7`.

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

### June 2026 — ingestion_jobs column consolidation (Sprint F-1 cleanup)

**Decision:** Consolidate `ingestion_jobs` to a single 14-column schema: `file_name` and `file_type` (NOT NULL) replace legacy `original_filename` / `source_format` duplicates. Production cleanup applied via SQL; migration file rewritten to match.

**Reasoning:** Dual column names caused Postgres 23502 (NOT NULL on legacy columns) and PGRST204 (updates referencing columns missing on patched tables). One canonical name per concept simplifies code and PostgREST schema cache.

---

### June 2026 — Financial data import: CSV/XLSX only (Sprint F-1)

**Decision:** Ship bulk financial import at `/import` for **CSV and Excel only** (`.csv`, `.xlsx`, `.xls`). Defer PDF/DOCX parsing post-launch.

**Reasoning:** Tabular formats produce reliable header detection and field mapping. PDF/DOCX require best-effort text extraction with unreliable column structure — bad UX for a data-entry accelerator aimed at retirement-tier users getting data in quickly.

**Implication:** Tier 2 gate. Final schema uses `file_name` + `file_type` (NOT NULL). Smoke verified: 4 asset rows committed.

---

### May 2026 — Do not delete data on consumer→advisor plan change (Sprint C-6)

**Decision:** When Stripe fires `customer.subscription.deleted` on a cancelled consumer subscription, do **not** schedule WCPA deletion if (1) the same Stripe customer has another active or trialing subscription, or (2) the profile role is `advisor`, `financial_advisor`, `attorney`, or `admin`. The daily `process-deletions` cron re-checks both conditions and cancels pending schedules instead of executing.

**Reasoning:** Plan upgrades cancel the old subscription while a new one is created on the same customer. Scheduling deletion would destroy a paying advisor’s household data.

**Implication:** `lib/compliance/deletionGuards.ts`, `scheduleDeletionOnCancel.ts`, webhook + cron. Documented in [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) and [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

---

### May 2026 — Compliance cron alerts + privacy intake (Sprint C-7)

**Decision:** Daily `compliance-reminders` cron emails `COMPLIANCE_EMAIL` (`avoels@comcast.net`) only when checks fail (overdue deletions, deletion failures in 7d, privacy requests due within 7d) or on the 1st of the month (monthly summary). All-clear days send no email. WCPA requests tracked in `privacy_requests` with 45-day SLA; consumer intake at `/settings/security`.

**Reasoning:** Alert fatigue undermines compliance culture; a single ops inbox is sufficient pre-scale. `due_at` uses column DEFAULT not GENERATED — Postgres rejects `(received_at + interval)` as non-immutable.

**Implication:** `ddbf079`, `1ce9110`. Manual cron tests must use `https://www.mywealthmaps.com` — apex 307 to www drops `Authorization` on redirect.

---

### May 2026 — Cron tests use www host (ops)

**Decision:** Document and use `https://www.mywealthmaps.com` for manual cron `curl` tests, not the apex domain.

**Reasoning:** Vercel redirects apex → www; curl does not resend `Authorization` on cross-host redirect → spurious 401.

---

### May 2026 — Import commit succeeds when all rows are duplicates (Sprint F-2)

**Decision:** When `skip_duplicates` is true and every row matches an existing record, `POST /api/import/commit` returns **200** with `success: true`, `committed: 0`, and `skipped` count — not 400.

**Reasoning:** User explicitly chose to skip duplicates; an empty insert is a valid outcome, not a mapping failure.

**Implication:** Covered by `consumer-import.spec.ts` (`a344032`).

---

### June 2026 — Education fully public; double sticky nav fix

**Decision:** `/education/*` is fully public (no login redirect). Marketing `PublicNav` and footer are skipped on education routes; education layout provides its own sticky header. Unpublished modules (`published: false`) return 404 via `getEducationModule()`. Decision-tree suggested paths link to real module URLs.

**Reasoning:** Auth gate blocked anonymous catalog browse and broke sidebar → education flow for logged-out visitors. Stacking marketing nav + education header (both `position: sticky; top: 0; z-index: 100`) pushed education chrome below the fold on scroll, made back navigation unreachable on mobile, and intercepted clicks on module cards.

**Implication:** Run `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs` after education content changes. See [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) P.4, P.10.

---

### May 2026 — Sprint 1: public routes in `(public)` route group, not dashboard sidebar

**Decision:** Move `/education`, `/assess`, `/find-advisor`, and `/find-attorney` to `app/(public)/` with a passthrough layout (no dashboard sidebar). Remove those links from the app sidebar Overview group. Keep education auth-gated in its nested layout.

**Reasoning:** Public discovery and planning app are different mental models. Mixing them in the sidebar made the app feel like a marketing site. URLs stay the same; only layout grouping changes. Marketing top nav on `(public)` is deferred to Sprint 2 — education and directories already render their own headers.

**Alternatives considered:** Leaving routes at `app/` root and `app/(education)/` (rejected — inconsistent route groups). Deleting page components (rejected — breaks bookmarks and SEO).

**Implication:** `CONSUMER_NAV_MAP.md` and `middleware.ts` `PUBLIC_PATHS` must stay aligned. `/education` is in `PUBLIC_PATHS` (anonymous catalog browse allowed). Education auth gate removed 2026-06 — see entry above.

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

### May 2026 — Waitlist mode gates public signup pre-launch (Sprint 15)

**Decision:** While the marketing site is live but not yet accepting accounts, public signup is disabled via env flags. Visitors to `/signup` or public **Get started** CTAs see `/waitlist` (email capture only). Invite/token signup flows bypass the gate (`?invite=`, `?invite_token=` + `?firm_id=`, `?connectionToken=`).

**Reasoning:** Allow domain cutover, SEO prep, and drip testing without open self-serve signup. Runtime redirect in `middleware.ts` avoids stale static `/signup` when env vars change after build.

**Implementation:** `lib/waitlist-mode.ts`, `middleware.ts` (renamed from `proxy.ts` in `3ceb125`), `app/(public)/waitlist/`, `app/(auth)/signup/page.tsx` (`force-dynamic`), `getSignupHref()` on public CTAs, `POST /api/email-capture` skips drip for `source: 'waitlist'`. Default on when `VERCEL_ENV=production`.

**At go-live:** Set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production, redeploy, verify `/signup` open. To re-enable waitlist, remove the var and redeploy. See [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip).

---

### May 2026 — Block all crawlers pre-launch

**Decision:** `app/robots.ts` returns `disallow: /` for `userAgent: *` and omits the `sitemap` URL until product launch. `app/sitemap.ts` stays in the codebase. Google Search Console setup deferred.

**Reasoning:** Avoid indexing staging/Vercel URL and incomplete public surfaces before `mywealthmaps.com` cutover. Sitemap and verification (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) are ready to enable in one launch checklist.

**At launch:** See [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) for the full task list.

---

### May 2026 — My Wealth Maps design system + Tailwind v4 color syntax

**Decision:** Brand UI uses `--mwm-*` CSS tokens in `app/globals.css`, shared primitives (`Button`, `Card`, `SectionHeader`, `form`), and authenticated sidebar chrome (navy active + gold left accent). Arbitrary Tailwind color classes must use the v4 `color:` prefix.

**Reasoning:** Replaces PlanWise/indigo leftovers; silent failure in Tailwind v4 without `color:` caused invisible gold borders and plain-text banner links.

**Alternatives considered:** Hardcoded hex in components (rejected); staying on Tailwind v3 syntax (not compatible with Next 16 stack).

**Implication:** Phase 3 page sweep must use `CURSOR_PROMPT_TEMPLATE.md` replacements with `color:` on every arbitrary color utility.

---

### May 2026 — Advisor Tax tab: horizon state tax is source of truth (not local recompute)

**Decision:** On the advisor Tax and Domicile tabs, current-law state estate tax in `FederalStateWaterfall` and the current-year row in `StateTaxPanel` must use `advisorHorizons.today.stateTax` when available. Year-by-year projection rows may use `outputs_s2_first` gross estate but must be labeled as the surviving-spouse timeline, with Today vs At death horizon callouts when horizons exist.

**Reasoning:** A local bracket recompute in the waterfall could return $0 while `buildStrategyHorizons` already computed correct WA tax via `calculateStateEstateTax`. MFJ was also mis-detected when DB stored `married_filing_jointly`. Users reported federal/state waterfall showing $0 state tax while State Tax Detail showed higher estimates.

**Alternatives considered:** Recompute everywhere in UI (rejected — duplicates engine, drifts from Strategy tab). Hide projection table (rejected — advisors need year context with clear labels).

**Implication:** New advisor tax UI must not add a third state-tax code path; extend horizons or `StateTaxPanel` props. See calculation audit table in [MASTER_ARCHITECTURE.md § Calculation consistency audit](./MASTER_ARCHITECTURE.md#calculation-consistency-audit-2026-05-26).

---

## Template for new entries

### [Date] — [Topic]

**Decision:** [What was decided — one clear sentence]

**Reasoning:** [Why this decision was made — the key arguments]

**Alternatives considered:** [What else was evaluated and why it was rejected]

**Implication:** [What this means for future work, if not obvious]
