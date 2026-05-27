# PERF_SPRINT_P1.md
# Sprint P-1 — Performance Quick Wins
# Completed: 2026-06-02
# Commit: 5c24160

---

## Changes shipped

| Change | File | Impact |
|--------|------|--------|
| Dashboard sequential → Promise.all | `app/(dashboard)/dashboard/page.tsx` | ~200–400ms TTFB reduction (6 parallel round trips) |
| Advisor detectConflicts → cache read | `lib/advisor/loaders.ts` | Removes write-on-read on advisor client page |
| Recompute debounce (3s) | `lib/estate/triggerEstateHealthRecompute.ts` | Prevents recompute storms on rapid saves |
| Notification count server-fetched | `app/(dashboard)/layout.tsx` + `notification-bell.tsx` | Removes client hydration fetch |
| next/font (self-hosted) | `app/layout.tsx` + `app/globals.css` | Removes render-blocking Google Fonts CDN |

## Indexes added (from SQL audit — Query B, 2026-06-02)

| Table | Column | Migration |
|-------|--------|-----------|
| `assets` | `owner_id` | `20260602120000_sprint_p1_indexes.sql` |
| `liabilities` | `owner_id` | `20260602120000_sprint_p1_indexes.sql` |

**Already indexed (no migration needed):** `households.owner_id` (`households_user_id_key`), `estate_health_scores.household_id`, `beneficiary_conflicts.household_id`, `notifications.user_id` + unread partial, `income.owner_id`, `expenses.owner_id`, etc.

**Optional follow-up:** Run Query D/E in `scripts/perf-diagnostic.sql` (now auto-resolves test household) for RPC timing baselines.

## Diagnostic SQL

See [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql) — run in Supabase SQL Editor.

## Validation

- `npm run build`: passed
- `audit-ux-language.sh`: 0 findings (run at ship time)
- `security-audit.sh`: 0 findings (run at ship time)

## Advisor portal quick wins (2026-05-26)

**Commit:** `8c526de`

| Change | File | Impact |
|--------|------|--------|
| Roster net worth: batched reads vs N× composition RPC | `lib/advisor/rosterNetWorth.ts`, `app/advisor/page.tsx` | **Largest win** — 5 queries total instead of one heavy RPC per client |
| Client load: parallel staleness + composition + datasets | `app/advisor/clients/[clientId]/page.tsx` | Removes sequential waterfall on client workspace |
| Scoped state tax / income bracket queries | `lib/advisor/loaders.ts` | No longer loads full national rule tables |
| Staleness: skip global tax-table timestamps on advisor client | `loadAdvisorProjectionStaleness` | −2 round trips per client view |
| Non-blocking access log + strategy-question mark-read | client `page.tsx` | Shaves latency off critical path |
| Parallel link + household fetch | client `page.tsx` | −1 sequential round trip |

**Note:** Roster net worth is approximate (batched assets/RE/liabilities/business/insurance). Client Overview still uses `calculate_estate_composition`.

## Advisor portal UX-2 — tab-scoped load + metrics cache (2026-05-26)

**Shipped with UX-2 (same commit as SCHEMA_CHANGELOG UX-2):**

| Change | File | Impact |
|--------|------|--------|
| Tab-scoped dataset flags | `advisorDatasetIncludeForTab()`, `loadAdvisorClientDatasets({ include })` | Overview/Notes/Documents/Estate/etc. skip unrelated queries |
| Conditional strategy VM + export | `app/advisor/clients/[clientId]/page.tsx` | Strategy view models only when tab needs them |
| Cached advisory metrics | `lib/advisor/cachedAdvisoryMetrics.ts`, Strategy tab | 120s `unstable_cache`; tag `household-metrics-{householdId}` |
| Cache invalidation | `lib/consumer/afterHouseholdWrite.ts` | `revalidateTag(..., 'max')` on household writes |

**Still deferred:** Per-tab Suspense server components; batch composition RPC for roster.

## Advisor portal UX-3 — Strategy tab UI (2026-05-26)

**No perf change to cache path** — `getCachedAdvisoryMetrics` unchanged. UX-3 reorganizes cached metrics in `StrategyTabContent` / `SituationMetricsGrid` and adds `advisoryMetricSeverity` for display caps (replaces `!!` badges in `AdvisoryMetricsDashboard`).

## Advisor portal UX-4 — Inline Opportunities modeling (2026-05-26)

**No perf change** — reuses existing panel components; inline instances mount on expand only (one row at a time). `router.refresh()` on recommend is intentional for Step 3 parity with server props.

## Advisor portal UX-5 — Strategy tab restructure (2026-05-26)

**Slight DOM reduction** — removed two full-width panel mounts below three-step workflow; `StrategyImpactPanel` derives from already-loaded `advisorHorizons` / `advisorHorizonsProjected` (no new fetches).

## Client Summary PDF brand upgrade (2026-05-27)

**Two additional RPCs on consumer export** — `calculate_federal_estate_tax`, `calculate_state_estate_tax`, and assets read when `profile.role === 'consumer'` (same as advisor/attorney-variant paths). One-time cost per PDF download; no change to advisor or attorney-variant fetch pattern.

## Advisor portal UX-5b — CompositeOverlay remove manual entry (2026-05-26)

**No perf change** — removes unused local state and form render path; recommendations fetch on mount unchanged (`useEffect` when `mode === 'recommendations'`).

## Advisor portal ENG-1 — Estate/Tax strategy inclusion audit (2026-05-26)

**No perf regression expected** — reuses already-built `advisorHorizons.today` values for advisor Estate/Tax display parity. No new RPCs or migrations; consumer composition path unchanged.

## Post-launch refactors (not in this sprint)

- Dashboard read model / materialized summaries *(partially addressed in P-2 — recommendations cache)*
- Background job queue for base-case regen (Inngest)
- Single staleness version field (replace 10 staleness queries)
- Streaming dashboard with Suspense boundaries
- Batch advisor estate composition RPC (roster could use cached `net_estate` column)

---

## Sprint P-2 — Pre-launch refactors

| Change | File | Impact |
|--------|------|--------|
| Recommendations cached on recompute | `app/api/recompute-estate-health/route.ts`, `app/(dashboard)/dashboard/page.tsx` | Removes `generate_estate_recommendations` from hot path |
| Projections cache-first | `lib/projections/loadProjectionData.ts` | Skip full recompute when projection is fresh |
| Auth dedup via React cache() | `lib/access/getDashboardLayoutContext.ts`, `app/(dashboard)/layout.tsx` | One profile+household query per request vs two |

### Migration applied

`20260602130000_sprint_p2_recommendations_cache.sql`
- `estate_health_scores.recommendations` jsonb column added

### Validation

- `npm run build`: passed
- `audit-ux-language.sh`: 0 findings
- `security-audit.sh`: 0 findings

---

*Sprint P-1 | My Wealth Maps | Performance Quick Wins*
