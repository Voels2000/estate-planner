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

## Post-launch refactors (not in this sprint)

- Dashboard read model / materialized summaries
- Background job queue for base-case regen (Inngest)
- Projections cache-first (serve `outputs_s1_first` when fresh)
- Single staleness version field (replace 10 staleness queries)
- Streaming dashboard with Suspense boundaries
- Batch advisor estate composition RPC
- Middleware/layout auth dedup via React `cache()`

---

*Sprint P-1 | My Wealth Maps | Performance Quick Wins*
