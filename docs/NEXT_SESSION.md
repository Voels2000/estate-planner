# NEXT_SESSION.md
# Sprint 17 — Session Start Document
# Updated: 2026-05-27 (profile layout; pre-launch RLS shipped; PROF-1/2; Sprint 17 go-live prep)

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **Sprint 17 (go-live prep).** **Security (shipped):** Grant audit clean (119 tables). RLS fix `20260527150000` on prod; `verify-loose-rls-policies.sql` → 0 rows; commits `1f41ce1` (migration), `7cab1be` (GST API), `35b0738` (template). **PROF-1/2** + **ENG-2** + **profile layout** (`_profile-client.tsx` two-column people) shipped. Deploy app when ready. **Remaining (manual):** isolation smoke (2 consumers + advisor/client), legal, Stripe, `PUBLIC_SIGNUP_OPEN=true`, release smoke.
>
> **Before flip:** [LEGAL_TODO.md](./LEGAL_TODO.md) — send ToS to counsel with §10/§11/§13 flagged; one consolidated redline; batch placeholder find-and-replace with redlines in one commit; email aliases; Stripe Dashboard (invoice.upcoming, portal cancel, receipts).
>
> **Go-live day order:** [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip) — Supabase Auth ON → verify `/auth/callback` on staging → `PUBLIC_SIGNUP_OPEN=true` → Core §1–3 smoke with fresh email.
>
> **WCPA deletion principle:** Deletion is not done when `deleteUserData` returns `success: true`. Run `npm run verify:deletion -- --email …` — must show **PASS** before responding to the user.

---

## Sprint summary — 2026-05-26

| Sprint | Status | Commits |
|--------|--------|---------|
| Design system Phase 1–3 | ✅ | `d173b00`, `249bf85`, `7a1a121`, `a10299b`, `37f3f0a` |
| Onboarding wizard OB-1 | ✅ | `b1c7b49`, `fd00b69` |
| Tier-aware narrative OB-2 | ✅ | `bccef99` |
| Advisor flywheel AF-1 | ✅ | `a255616` |
| Setup progress OB-3 | ✅ | `3376134` |
| Superuser sidebar SU-1 | ✅ | `3c0d28b` |
| Sidebar + onboarding OB-3b | ✅ | `6d2bff3`, `1660f27`, `d50a982` |
| Active nav indicator NAV-1 | ✅ | `be92947` |
| Advisor portal perf | ✅ | `8c526de` |
| Advisor portal UX-2 | ✅ | `1ba93eb` |
| Advisor tax parity (Tax/Domicile/Strategy) | ✅ | `cb04d64` |
| Advisor portal UX-3 | ✅ | `06edb1a` |
| Advisor portal UX-4 | ✅ | `3c5c0ef` |
| Advisor portal UX-5 | ✅ | `d6e5c5e` |
| Advisor portal ENG-1 | ✅ | `b5cc8da` |
| Advisor portal UX-5b | ✅ | `4220c0a` |
| Brand consistency pass | ✅ | `fbaa709` |
| Client Summary PDF upgrade | ✅ | `0816f37` |
| Nav consistency (homepage, billing, utility) | ✅ | `b51eedd` |
| ENG-2A — RE/business + estate MC | ✅ | `5589b89` |
| ENG-2B — growth_assumptions UI | ✅ | `51fff01` |
| ENG-2C — insurance cash value growth | ✅ | `604b1b9` |
| ENG-2D — income growth rate | ✅ | `9101ac5` |
| ENG-2E — MC alignment surfacing | ✅ | `8e90fa4` |

---

## ENG-2 growth assumptions ✅ (2026-05-27)

| Area | Outcome |
|------|---------|
| **Engine** | RE at `reGrowthRate` (4.5% default); business at `bizGrowthRate` (7%); estate MC uses request `returnMeanPct`/`volatilityPct` |
| **Storage** | `households.growth_assumptions`; `income.annual_growth_rate`; `insurance_policies.cash_value_growth_rate` |
| **Consumer UI** | `/scenarios` edit + save; `/projections` read-only |
| **Advisor UI** | RE/business overrides + MC alignment note on Strategy tab |
| **Staleness** | Not save-only — dashboard/strategy/advisor auto-regen when stale; migration `20260527130400` bumps `updated_at` post-deploy |

**Deploy order:** migrations → `supabase functions deploy estate-monte-carlo` → app → verify test household on Scenarios save or dashboard visit.

**Detail:** [SCHEMA_CHANGELOG.md § ENG-2](./SCHEMA_CHANGELOG.md) · [MASTER_ARCHITECTURE.md § Growth assumptions](./MASTER_ARCHITECTURE.md)

---

## Nav consistency ✅ (2026-05-27)

| Area | Outcome |
|------|---------|
| **Homepage** | `app/(public)/page.tsx` — `PublicNav` + footer (removed inline nav) |
| **Billing** | `app/billing/layout.tsx` + `MinimalAuthNav` |
| **Utility** | `WordmarkOnly` on invite, beneficiary, share, confirm-email, attorney-invite, claim-listing |
| **Unchanged** | Dashboard sidebar, advisor, education, auth login/signup, admin |

**Detail:** [SCHEMA_CHANGELOG.md § Nav consistency](./SCHEMA_CHANGELOG.md) · [MASTER_ARCHITECTURE.md § Layout and Navigation](./MASTER_ARCHITECTURE.md)

---

## Client Summary PDF upgrade ✅ (2026-05-27)

| Area | Outcome |
|------|---------|
| **Consumer PDF** | Navy/gold header, purpose callout, household profile grid, readiness without letter grade |
| **Checklist** | Document Status — Not on file / On file |
| **Export API** | Consumer role receives tax + assets for profile figures |
| **Print page** | Updated card copy + data ownership note |
| **Attorney PDF** | Unchanged |

**Detail:** [SCHEMA_CHANGELOG.md § Client Summary PDF brand upgrade](./SCHEMA_CHANGELOG.md)

---

## Advisor portal — end-to-end workflow ✅ (2026-05-26)

| Step | What the advisor experiences |
|------|------------------------------|
| **Overview** | `PlanStatusCard` plan readiness; critical gaps above the fold with Discussed / Deferred / Resolved |
| **Strategy** | Severity banners → Step 1 Situation → Step 2 Opportunities (**Model this ↓** inline panels) → Step 3 Recommendations & Impact (tax delta) → Strategy Horizon (table + `CompositeOverlay`) → Monte Carlo |
| **Send** | Inline panel → `strategy_line_items` (`source_role='advisor'`) → `router.refresh()` → Step 3 + CompositeOverlay update → consumer `StrategyRecommendationPanel` |
| **Accept** | Actual horizon set → Estate/Tax tabs via `advisorHorizons.today` (ENG-1) |
| **Other tabs** | Tax, Domicile, Estate, Retirement — proactive alert banners for time-sensitive issues |

No duplicate entry points, no dead-end panels, no tab-hopping required to act.

**Architecture detail:** [MASTER_ARCHITECTURE.md § Advisor portal end-to-end workflow](./MASTER_ARCHITECTURE.md)

---

## Advisor portal UX-5 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Removed** | Full-width SLAT/ILIT + Advanced panels below three-step workflow |
| **Step 3** | Recommendations & Impact + `StrategyImpactPanel` (Current / Projected / With Accepted) |
| **Horizon** | Renamed Strategy Horizon; section below Step 3; scroll → `#strategy-opportunities` |
| **Impact data** | `outsideCertainProbableTotal + outsideIllustrativeTotal`, `stateTax` from horizons |

**Detail:** [SCHEMA_CHANGELOG.md § UX-5](./SCHEMA_CHANGELOG.md)

---

## Advisor portal UX-5b ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Removed** | `custom` mode, `customStrategies`, "Enter Strategy Reductions" form |
| **Default** | `recommendations` via `/api/advisor/strategy-recommendations-read` |
| **Modes** | `recommendations` \| `30m` \| `100m` |
| **Unchanged** | `StrategyHorizonTable`, archetypes, boundary snapshot, consumer paths |

**Detail:** [SCHEMA_CHANGELOG.md § UX-5b](./SCHEMA_CHANGELOG.md)

---

## Advisor portal ENG-1 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Audit** | Composition RPC `source_role` limitation documented; strategyMappers actual set confirmed |
| **Estate tab** | Advisor display uses horizon-derived composition override (`horizonComposition`) |
| **Tax tab** | Current-law already horizon-driven; accepted-strategy indicator added |
| **Outside strategy total** | Uses horizon `outsideCertainProbableTotal + outsideIllustrativeTotal` |
| **Consumer path** | `classifyEstateAssets(..., 'consumer')` unchanged |

**Detail:** [SCHEMA_CHANGELOG.md § ENG-1](./SCHEMA_CHANGELOG.md)

---

## Advisor portal UX-4 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Opportunities** | Per-row expand → `InlineStrategyPanel`; 11-strategy catalog; `isSent` from advisor line items |
| **Mapping** | `catalogToPanel.ts` — `cst` → chip `credit_shelter_trust`; `annual_gifting` catalog id fixed |
| **Recommend** | `onRecommend` → `loadConsumerData()` + `router.refresh()` + collapse row |
| **Below** | Combined Strategy, SLAT/ILIT, Advanced, Monte Carlo unchanged (full-width fallback) |

**Detail:** [SCHEMA_CHANGELOG.md § UX-4](./SCHEMA_CHANGELOG.md)

---

## Advisor portal UX-3 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Situation** | Six metric cards (+2 when modules run); `●`/`!`/`✓`/`—`; max 2 indicators |
| **Opportunities** | Strategy catalog with relevance highlighting; Run modules CTA |
| **Recommendations** | Pending / accepted / declined; client strategy questions in Step 3 |
| **Below** | Combined Strategy, SLAT/ILIT, Advanced, Monte Carlo unchanged |
| **Flags** | `NEXT_PUBLIC_ADVISOR_BENCHMARKS` off by default |

**Detail:** [SCHEMA_CHANGELOG.md § UX-3](./SCHEMA_CHANGELOG.md)

---

## Advisor tax parity ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Tax tab** | Waterfall uses horizon state tax; survivor-timeline labels on State Tax Detail |
| **MFJ** | `isMFJFilingStatus()` on Strategy, Tax, Domicile, `GET /api/advisor/strategy-tab` |
| **Meeting Prep** | `meetingPrepBriefFromHorizons` (shipped with UX-3) |
| **Follow-up** | Deprecated brackets in `estate-tax-projection` death rows |

**Detail:** [SCHEMA_CHANGELOG.md § Advisor tax parity](./SCHEMA_CHANGELOG.md) · [MASTER_ARCHITECTURE.md § Calculation consistency audit](./MASTER_ARCHITECTURE.md#calculation-consistency-audit-2026-05-26)

---

## Advisor portal UX-2 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Brand** | Navy header, gold tab underlines, status/complexity badges |
| **Load** | `advisorDatasetIncludeForTab()` — tab-scoped datasets on client workspace |
| **Overview** | `PlanStatusCard`, gap banner, `GapStatusSelector` + `advisor_gap_statuses` |
| **Estate** | Collapsed outside estate when empty; red tax callout; no-transfer amber banner |
| **Strategy** | `getCachedAdvisoryMetrics` (120s); 6-card grid + module CTA; ≤2 warning badges; exemption banner |
| **Migration** | `20260626120000_advisor_gap_statuses.sql` |

**Detail:** [SCHEMA_CHANGELOG.md § UX-2](./SCHEMA_CHANGELOG.md) · [PERF_SPRINT_P1.md § UX-2](./PERF_SPRINT_P1.md#advisor-portal-ux-2--tab-scoped-load--metrics-cache-2026-05-26)

---

## Advisor portal performance ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Roster `/advisor`** | `loadRosterNetWorthByOwner` — 5 batched queries instead of N× `calculate_estate_composition` RPC |
| **Client workspace** | Parallel staleness + composition + datasets; scoped tax rules; non-blocking access log |

**Commit:** `8c526de` · See [PERF_SPRINT_P1.md § Advisor portal](./PERF_SPRINT_P1.md#advisor-portal-quick-wins-2026-05-26).

---

## Active sidebar NAV-1 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Active match** | `isNavItemActive()` — `usePathname()`; sub-routes via `startsWith`; `/dashboard` exact only |
| **Group expand** | Financial / Retirement / Estate groups auto-open when any child route is active (was collapsed while active → no visible indicator) |
| **Chrome** | `NAV_ACTIVE` — navy fill + `border-l-[color:var(--mwm-gold)]` (Tailwind v4 `color:` prefix) |

**Commit:** `be92947`

---

## Sidebar + onboarding OB-3b ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Dashboard** | Removed `DashboardIntroSection` green checklist; `SetupProgressCard` only |
| **Financial Planning** | All sidebar features tier 1; group exempt from `isLockedUser` |
| **Footer / Security** | Security, My Advisor, Manage Subscription always navigable (not `isLockedUser`) |
| **My Advisor** | Onboarding note when unconnected + wizard incomplete + no pending request |
| **Bugfix** | `getDashboardLayoutContext` — do not select `households.date_of_birth_1` (column does not exist; broke `hasHousehold` for all users) |

**Commits:** `6d2bff3`, `1660f27`, `d50a982` · **Nav map:** [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md)

---

## Superuser sidebar SU-1 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Layout** | Pass `isSuperuser` to consumer `SidebarNav` |
| **Locks** | `isLockedUser` bypass for superuser, advisor, admin |
| **Advisor Portal** | Visible when `role === 'advisor' \|\| isAdmin \|\| isSuperuser` |

**Commit:** `3c0d28b`

---

## Setup progress OB-3 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Dashboard** | `SetupProgressCard` — 5-section data-inferred progress; collapses to one line when complete (does not disappear) |
| **API** | `GET /api/consumer/setup-progress` |
| **Wizard gate** | Redirect only when zero assets/income (`shouldRequireWizardOnboarding`); Financial Planning + `/import` exempt |
| **Wizard** | Data-inferred steps, free navigation, **← Back to dashboard** |
| **Import** | Tier 1 upload during onboarding; history/management stays Tier 2+ (UI gate only — no data deletion) |

**Commit:** `3376134` · **Tests:** `tests/unit/wizard-onboarding-gate.spec.ts` (`npx playwright test tests/unit/wizard-onboarding-gate.spec.ts --project=import-unit`)

---

## Design system — Phases 1–3 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Tokens** | `app/globals.css` — `--mwm-*` + aliases; body off-white |
| **Primitives** | `Button`, `Card`, `SectionHeader`, `form.ts`; `ExportPDFButton` on shared Button |
| **Sidebar** | Navy active fill, gold left accent, gold “M” + Playfair wordmark, YOUR PLAN badge gold/navy |
| **Banner** | `LifeEventBanner` — “Log a life event” gold link (`!text-[color:var(--mwm-gold)]`) |
| **Phase 3** | Indigo sweep across planning pages, retirement/estate, portals — `color:` prefix per `CURSOR_PROMPT_TEMPLATE.md` |

**Commits:** `d173b00`, `249bf85`, `7a1a121`, `a10299b`, `37f3f0a` (+ Phase 2d/2e shell fixes `76dc8b9`, `f58affe`)

---

## Onboarding wizard OB-1 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Wizard** | `/onboarding/wizard` — extended profile + guided first-data entry |
| **Migration** | `20260526000000_onboarding_wizard_fields.sql` — `onboarding_wizard_completed_at` |
| **Gates** | Layout wizard redirect (superseded by OB-3 `hasAnyData` check) + dashboard setup nudge |

**Commits:** `b1c7b49`, `fd00b69` (remove duplicate wizard name fields)

---

## Tier-aware narrative OB-2 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Copy** | Profile intro, wizard step previews, setup prompt (→ `SetupProgressCard` in OB-3), `EmptyStateCard`, `UpgradeBanner` tier-aware messaging |

**Commit:** `bccef99`

---

## Advisor flywheel AF-1 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Consumer** | Transfer Strategies **Ask your advisor about this →** — `POST /api/consumer/ask-advisor` when `advisor_clients` connected; else `/find-advisor` |
| **Advisor** | Client Overview **Client Strategy Questions** card — unread `consumer_strategy_question` notifications; mark read on client workspace load |

**Commit:** `a255616` · **Flow:** [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) Transfer Strategies table

---

## Sprint UX-1 closed ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Public hub** | `/events` — all 24 life events by category; links to `/event/[slug]` |
| **Public nav** | Life Events link; homepage “See all life events →” |
| **Dashboard picker** | `LifeEventBanner` modal — search, relevance ordering, logs `life_events`, → `/event/[slug]/assess` |
| **Logged events list** | “Events you've logged” with Review links below banner |
| **Shared catalog** | `lib/events/catalog.ts` — grouping, filter, relevance sort |

**Commit:** `6fb73e6`

---

## Auth cleanup + deleteUser hardening ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Auth table** | 9 accounts remain — 4 founder + 5 `@mywealthmaps.test` (see test account table below) |
| **Rolobe retirement** | All `@rolobe.resend.app` deleted via `npm run cleanup:rolobe` |
| **FK scan** | `firms`, `firm_members`, `change_log` added to `FK_TABLES_TO_USER` — blocked Auth hard-delete during cleanup |
| **Orphan Auth** | No profile → Auth delete + audit log (no early "Profile not found" return) |
| **Auth delete fallback** | Hard delete → soft delete with warning; monthly check for `deleted_at IS NOT NULL` |
| **Verification** | `npm run verify:deletion -- --email …` — PASS required before WCPA response |
| **Drip verify** | `npm run verify:drip` replaces manual `consumer21@rolobe` inbox check |

**Commits:** `84388ad` (rolobe tooling), `aea4bf6` (deleteUser hardening + verify-deletion), `3cdd9b5` (firms/firm_members/change_log FK scan)

### Auth accounts (production — 2026-05-25)

| Email | Purpose |
|-------|---------|
| avoels@comcast.net | Primary founder |
| avoels@outlook.com | Secondary founder |
| stephen.a.voels@sbcglobal.net | Personal |
| david@gmail.com | Personal |
| e2e-consumer@mywealthmaps.test | E2E consumer tier 3 |
| e2e-consumer-tier1@mywealthmaps.test | E2E consumer tier 1 |
| e2e-advisor@mywealthmaps.test | E2E advisor |
| e2e-attorney@mywealthmaps.test | E2E attorney |
| e2e-client.johnson@mywealthmaps.test | E2E advisor client |

---

## Compliance sprints — all closed ✅ (code complete)

| Sprint | Scope | Commit(s) | Status |
|--------|-------|-----------|--------|
| **C-2b** | UX language audit — 32 findings → 0 | `788aa08` | ✅ |
| **C-3** | RLS fixes (`236890c`); auth callback, MFA, security headers, PII logging (`56a4407`); Monte Carlo UX + docs (`cda2ccc`); audit artifacts gitignored (`d854c05`) | `236890c`, `56a4407`, `cda2ccc`, `d854c05` | ✅ |
| **C-4** | Billing disclosures — RCW 19.316, FTC Negative Option, renewal reminders | `462bda9` | ✅ code — manual Stripe walkthrough remains |
| **C-5** | Privacy Policy (`/privacy`), Terms of Service (`/terms`), footer links, sitemap | `2e1dff3`, `695a860` | ✅ — legal review + TODO placeholders remain |
| **C-6** | WCPA deletion — `deleteUser`, webhook schedule + plan-change guards, cron, admin UI, CLI | `4d9571e`, `01b997a` | ✅ live in prod |
| **C-7** | Compliance cron + `privacy_requests` intake | `ddbf079`, `1ce9110` | ✅ live in prod |

**Audit scripts (must stay 0):** `bash scripts/audit-ux-language.sh` · `bash scripts/security-audit.sh`

---

## Sprint C-6 closed ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Deletion core** | `lib/compliance/deleteUser.ts` — single path for CLI, admin, cron; FK scan; orphan Auth; hard/soft delete fallback; post-deletion verification |
| **Verification CLI** | `npm run verify:deletion -- --email …` — PASS required before WCPA response |
| **Guards** | `deletionGuards.ts` — no schedule on plan change (active Stripe sub) or upgraded role; cron re-check |
| **Webhook** | `customer.subscription.deleted` → 30-day schedule; `subscription.updated` active → cancel pending |
| **Cron** | `GET /api/cron/process-deletions` — 2am UTC (`vercel.json`) |
| **Admin UI** | `/admin` → **Data & Compliance** — schedule, audit log, execute (dry-run default) |
| **CLI** | `npx tsx scripts/gdpr-delete-user.ts --email … [--dry-run]` |
| **Docs** | [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) — right-to-delete SOP + monthly checks |

**Commits:** `4d9571e` (infra + guards), `01b997a` (admin UI + CLI)

**Production:** Migrations `20260625120000`, `20260625170000` applied. Crons verified via `https://www.mywealthmaps.com` (apex redirect strips `Authorization`).

---

## Compliance infrastructure — C-6 + C-7 ✅ LIVE (2026-05-25)

| What | How | Status |
|------|-----|--------|
| 30-day post-cancellation deletion | Stripe webhook → `deletion_schedule` → 2am cron | ✅ Live |
| Plan-change guard | Webhook + cron double-check (`deletionGuards.ts`) | ✅ Live |
| Deletion audit trail | `deletion_audit_log` append-only | ✅ Live |
| Admin deletion UI | `/admin` → Data & Compliance | ✅ Live |
| Daily compliance check | 8am cron → `avoels@comcast.net` if issues (`COMPLIANCE_EMAIL`) | ✅ Live |
| WCPA privacy requests | In-app form + 45-day SLA (`privacy_requests`) | ✅ Live |
| Email infrastructure | `hello@`, `noreply@`, `privacy@` → Comcast inbox (Resend verified) | ✅ Live |
| Migration history | **75** timestamped files in `supabase/migrations/`; through `20260625170000` | ✅ Clean |

**Cron manual test:** `curl -sS https://www.mywealthmaps.com/api/cron/compliance-reminders -H "Authorization: Bearer $CRON_SECRET"` → `{"sent":false,"message":"All clear — no email sent"}` when healthy.

---

## Sprint C-7 closed ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Table** | `privacy_requests` — five WCPA rights; `due_at` DEFAULT (+45 days) |
| **Cron** | `GET /api/cron/compliance-reminders` — 8am UTC; emails only on issues or monthly summary (1st) |
| **Consumer** | `/settings/security` → Privacy Rights; confirmation email with reference ID |
| **Admin** | Privacy Requests sub-view; PATCH status via `/api/admin/deletions` |
| **Ops email** | `COMPLIANCE_EMAIL=avoels@comcast.net` in Vercel Production |

**Commits:** `ddbf079`, `1ce9110` (migration `due_at` fix)

---

## Sprint P-1 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Dashboard Promise.all** | Parallelized sequential block — ~200–400ms TTFB improvement |
| **Advisor conflict cache read** | Removed `detectConflicts()` write-on-read on advisor client page |
| **Recompute debounce** | 3s per `householdId` in `triggerEstateHealthRecompute.ts` |
| **Notification count** | Server-fetched in layout; client refresh on panel actions only |
| **next/font** | Self-hosted Playfair Display + DM Sans (no CDN) |
| **Indexes (prod applied)** | `idx_assets_owner_id`, `idx_liabilities_owner_id` |

**Commit:** `5c24160` · **Doc:** [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) · **Diagnostics:** [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql)

---

## Sprint P-2 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Recommendations cache** | `estate_health_scores.recommendations` jsonb; persisted during recompute; dashboard reads cache (no RPC on load) |
| **Projections cache-first** | `loadProjectionData` serves fresh `outputs_s1_first`; skips 11-query load + `computeCompleteProjection` when not stale |
| **Auth dedup** | `getDashboardLayoutContext` via React `cache()` — one profile+household+notifications load per request in layout |

**Commit:** `47a38f3` · **Migration:** `20260602130000_sprint_p2_recommendations_cache.sql` — apply in prod before deploy if not already applied · **Doc:** [PERF_SPRINT_P1.md § Sprint P-2](./PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors)

**Remaining post-launch perf:** Materialize `calculate_estate_composition` at recompute (recommendations done; composition still on-demand on some surfaces).

---

## Education nav fix ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Double sticky nav** | Skip marketing `PublicNav`/footer on `/education/*`; education header only |
| **Unpublished modules** | `getEducationModule()` returns null → 404 (was reachable by direct URL) |
| **Decision tree** | Suggested learning paths link to real module URLs |
| **Link validation** | `scripts/validate-education-links.mjs` — run after content changes |

**Commits:** `a138608` (public access), `b41719f` (sidebar link), education nav fix (this session)

**Post-deploy:** `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs`

---

## Sprint F-2 shipped (2026-06-02) — apply migration before deploy

**Migration:** `20260602150000_sprint_f2_import_traceability.sql` — `ingestion_job_id` on assets/liabilities/income/expenses; `header_row_index`, `sheet_name` on `ingestion_jobs`.

**Features:** header row detection, Excel sheet picker, inline row editor, duplicate warnings, post-import deep link, richer aliases, pending job delete.

**Commits:** `9b524aa` (UX), `a344032` (tests + skip-all-duplicates success)

---

## Sprint F-2 tests ✅ (2026-05-25)

| Command | Coverage |
|---------|----------|
| `npm run test:import:unit` | Header detection, sheet list, alias matching (7 passed) |
| `npm run test:import:api` | Preamble parse, broker aliases, inline edit, duplicates, traceability (8 passed; `.env.test`, tier 2+) |

**Fix:** `POST /api/import/commit` returns success when `skip_duplicates` filters every row.

**Fixtures:** `tests/fixtures/import/` (`preamble.csv`, `broker-aliases.csv`, `import-sample.csv`, `two-sheets.xlsx`). Regenerate XLSX: `npx tsx scripts/generate-import-fixtures.ts`.

**Manual (optional):** [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) I.5–I.9 if not running API tests against prod.

---

## Sprint F-1 closed ✅ (2026-06-02) — verified in production

| Area | Outcome |
|------|---------|
| **Parse API** | `POST /api/ingest` — CSV/XLSX only; auto-detect table + field mapping |
| **Commit** | `POST /api/import/commit` — INSERT_COLUMNS allowlist; 4 assets rows smoke-tested |
| **Schema** | `ingestion_jobs` — final 14 columns: `file_name`, `file_type` (NOT NULL); legacy names removed |
| **Tier gate** | `/import` tier 2 via `hasFeatureAccess('import', …)` |
| **Templates** | `public/templates/import-sample*.csv` |

**Commits:** `d3400b1`, `0f8cf2d`, `b5bb0b1`, schema cleanup (this session)

**Smoke passed:** upload `import-sample.csv` → review → commit → `ingestion_jobs.status = committed`; import history correct.

---

## Sprint 17 — remaining (non-code)

| Item | Owner | Blocks open signups? |
|------|-------|----------------------|
| **LEGAL_TODO.md** — replace TODO placeholders (entity name, address, registered agent) | You | **Yes** |
| **Email aliases** — privacy@, security@, legal@ | You | **Yes** |
| **Counsel sign-off** — ToS §10 (disclaimers), §11 (liability cap), §13 (arbitration) | Counsel | **Yes** |
| **Stripe Dashboard** — invoice.upcoming webhook, Customer Portal cancel, receipt emails | You | **Yes** (manual verify) |
| **Stripe production billing** | You | **Yes** |
| **Supabase Auth** — email confirm ON, secure email change ON, min password 12 | You | Go-live day |
| **`PUBLIC_SIGNUP_OPEN=true`** + redeploy | You | Go-live day |
| **Core §1–3 smoke** — fresh email; signup → confirm → login → dashboard | You | Go-live day |
| **Drip step 2 check** | Ops | `npm run verify:drip -- --email e2e-drip@mywealthmaps.test` (day 3+) |

**Counsel handoff:** Send ToS with §10/§11/§13 flagged; ask for **one consolidated redline**. Apply redlines + TODO placeholder find-and-replace in **one final commit** before go-live — see [LEGAL_TODO.md § Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos).

### Go-live gate (exact order)

**Pre-flip (legal + config):** See [LEGAL_TODO.md](./LEGAL_TODO.md) and [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) manual checklist.

**Go-live day:** [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip):

1. Supabase Dashboard → email confirmations ON, secure email change ON, min password **12**
2. Verify `/auth/callback` + signup → confirm-email flow on **staging** (code on `main` since `56a4407`)
3. Vercel Production → `PUBLIC_SIGNUP_OPEN=true` → redeploy
4. Core §1–3 smoke on production ([CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)) with **fresh email**

**Note:** Supabase Auth dashboard switches stay **OFF** until go-live day — test accounts and seed scripts depend on current settings.

---

## Sprint 16 closed ✅

| Area | Outcome |
|------|---------|
| **Sprint C-2b UX Language Audit** | ✅ Complete — all `DISCLAIMER_STRINGS` surfaces wired; `audit-ux-language.sh` 0 findings (`788aa08`) |

**Commits:** `788aa08`

---

## Sprint C-3 closed ✅ (2026-06-02)

| Phase | Outcome | Commits |
|-------|---------|---------|
| **Phase 1 — RLS** | `20260602000000_sprint_c3_rls_fixes.sql` | `236890c` |
| **Phase 1b + Phase 3 — Auth/security** | `/auth/callback`, confirm-email, MFA middleware, security headers, PII logging, welcome route auth | `56a4407` |
| **Docs + Monte Carlo UX** | Master doc sync, Monte Carlo insight strings | `cda2ccc` |
| **Hygiene** | Audit artifacts gitignored | `d854c05` |

---

## Sprint C-4 closed ✅ (code)

| Area | Outcome |
|------|---------|
| **Billing disclosures** | `lib/compliance/billing-disclosures.ts`; pre-checkout on billing/pricing; cancel flow; `invoice.upcoming` renewal reminder | `462bda9` |

**Manual remaining:** Stripe Dashboard config + production walkthrough — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)

---

## Sprint C-5 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Privacy Policy** | `/privacy` — WCPA structure; TODO placeholders for entity/address/agent | `2e1dff3`, `695a860` |
| **Terms of Service** | `/terms` — RCW 19.316 billing terms; post-checkout accept at `/terms/accept` | `2e1dff3`, `695a860` |
| **Footer / SEO** | `LegalFooterLinks` on public + dashboard; sitemap + robots | `2e1dff3`, `695a860` |

**Manual remaining:** [LEGAL_TODO.md](./LEGAL_TODO.md)

---

## Sprint 15 closed ✅

| Area | Outcome |
|------|---------|
| **Domain / DNS / SSL** | `mywealthmaps.com` live (2026-05-24) |
| **Vercel Production env vars** | Verified (2026-05-24) |
| **Search Console** | Verified via Cloudflare domain provider; sitemap submitted (2026-05-24) |
| **Resend domain** | `mywealthmaps.com` verified (2026-05-24) |
| **Waitlist mode** | Active on Production (`middleware.ts`, `3ceb125`); Preview enabled (2026-05-24) |
| **Post-cutover smoke §1–3** | Passed on production (2026-05-24) |
| **Sitemap / crawl infra** | Middleware bypass for `/sitemap.xml`, `/robots.txt`, `/_next/`, `/api/` (`73648e5`) |
| **Test account cleanup** | `scripts/cleanup-test-accounts.ts` (`3f732e3`) |
| **Dev workflow** | local → preview → production |

**Commits:** `7afaedb`, `bb9a191`, `3ceb125`, `729d411`, `b97f945`, `3f732e3`, `73648e5`

### Dev deploy workflow (2026-05-24)

1. **Local** — `npm run dev` with `.env.local`
2. **Preview** — push branch → Vercel preview (`estate-planner-gules.vercel.app`); set `WAITLIST_MODE=true` on Preview to match production gating
3. **Production** — merge to `main` → `mywealthmaps.com`; flip `PUBLIC_SIGNUP_OPEN=true` on go-live day per checklist

---

## Sprint 14 closed ✅

| Area | Outcome |
|------|---------|
| **Manual smoke §1–3** | Passed 2026-05-23 |
| **Manual smoke §4–7** | Passed 2026-05-23 |
| **Manual smoke §8, §11** | Passed 2026-05-23 |
| **§9 advisor recommendation** | Skipped — needs linked advisor |
| **§10 Gifting/Strategies/Trusts** | E2E 19/19 confirmed |
| **§2.4 recompute automated** | consumer-core-recompute.spec.ts (`93aa6f5`) |
| **Admin Portal bug** | Fixed `f4e9160` |
| **Asset modal bug** | Fixed `f4e9160` |
| **E2E complete suite** | **253 tests** — see [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md); staging 2026-05-25: consumer 127 pass / 5 skip, advisor 45 pass, public 57 pass / 2 skip (`--workers=1`) |
| **Commits** | `93aa6f5`, `1e092d7`, `f4e9160` |

### Known staging E2E behaviour (do not lose)

`consumer-strategy-writes` and `dashboard` specs fail under parallel workers on staging — Supabase statement timeouts (`57014`) and `net::ERR_ABORTED`. Always re-run failures with `--workers=1` before treating as regressions. Production DB will not have this contention.

---

## Test account references

| Role | Email | Notes |
|------|-------|-------|
| **Consumer** | `e2e-consumer@mywealthmaps.test` | Estate tier 3 · `npm run seed:e2e` |
| **Consumer tier 1** | `e2e-consumer-tier1@mywealthmaps.test` | Upgrade-banner project |
| **Advisor (Playwright)** | `e2e-advisor@mywealthmaps.test` | Johnson client: `e2e-client.johnson@mywealthmaps.test` |
| **Attorney (portal)** | `e2e-attorney@mywealthmaps.test` | `?aref=e2eatt01` |
| **Referral codes** | `e2eadv01` / `e2eatt01` | Directory listings (no login) |
| *Legacy* | *(retired)* | All `@rolobe.resend.app` removed via `npm run cleanup:rolobe` — [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) |

### Drip smoke (DB verification)

| Email | Notes |
|-------|-------|
| `e2e-drip@mywealthmaps.test` | Capture on `/assess` or homepage; verify with `npm run verify:drip` |

*Historical:* drip was verified via `consumer21@rolobe.resend.app` inbox — replaced by `scripts/verify-drip-sequence.ts`.

### E2E fixture reset (go-live v2 — preferred)

```bash
npm run seed:e2e
# Copy printed block into .env.test (see docs/E2E_TEST_RESET.md)
npm run prune:e2e   # optional before full run
```

Canonical accounts: `e2e-consumer@mywealthmaps.test`, `e2e-advisor@mywealthmaps.test`, `e2e-attorney@mywealthmaps.test` — password `E2eTest!2026Mwm` ([scripts/e2e-test-identities.ts](../scripts/e2e-test-identities.ts)).

Legacy seeds (retire after cutover): `seed-test-attorney.ts`, `seed-test-consumer-estate.ts` — prefer `npm run seed:e2e`.

### Run E2E (always source env first)

```bash
set -a && source .env.local && source .env.test && set +a
npm run test:e2e:complete -- --workers=1
# Or per project:
npm run test:e2e:consumer -- --workers=1
npm run test:e2e:advisor -- --workers=1
npm run test:e2e:public
npm run test:e2e:attorney   # after: npx tsx scripts/seed-test-attorney.ts
npm run test:import:unit
npm run test:import:api
# If failures on staging: re-run with --workers=1 before investigating
npx playwright test [failing spec] --project=consumer --workers=1
```

Full spec index: [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts)

---

## Known limitations (do not lose between sessions)

### Anonymous cross-device attribution

`referral_clicks` has **no `user_id`** — clicks are logged anonymously at event-page visit (`POST /api/referral/track`). Per-user attribution at signup uses `funnel_events` and `profiles.referral_code` / `attorney_referral_code` from sessionStorage.

**Edge case:** Visit with `?ref=` on device A, signup on device B without sessionStorage — weak funnel match. Not a launch blocker.

### Advisor connection status — canonical import

```ts
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
```

Statuses: `active`, `accepted`. Do not hardcode status strings.

### Planning empty-state CTAs (do not regress)

- **`/projections`, `/complete`:** `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` only
- **`/my-estate-strategy` (tier 3):** `POST /api/consumer/generate-base-case`
- Do **not** merge TIER2 and TIER3 lists — `lib/planning/planningEmptyState.ts`

### Legal pages vs in-app terms accept

- **Public ToS:** `/terms` — full Terms of Service (Sprint C-5)
- **Post-checkout accept:** `/terms/accept` — dynamic `app_config.terms_sections` + accept button (sync with `/terms` after legal review per [LEGAL_TODO.md](./LEGAL_TODO.md))
