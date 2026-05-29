# Cron routes (`/api/cron/*`)

All handlers require `Authorization: Bearer $CRON_SECRET` (Vercel Cron config).

## Supabase client pattern

Cron routes use `createAdminClient()` (service role). That is intentional:

- **RLS:** service role bypasses row-level security — every query must scope by explicit IDs from trusted cron logic, never from user input without validation.
- **Household RPCs:** `assert_household_caller_access()` in Postgres **skips the caller check when `auth.role() = 'service_role'`**. Any cron or server route that calls `calculate_estate_composition`, `calculate_gifting_summary`, or `generate_estate_recommendations` via the admin client will bypass household access guards automatically.

**When adding a new cron handler:**

1. Gate with `CRON_SECRET` (same as existing routes).
2. Do not accept arbitrary `household_id` from the request body unless the job is explicitly a trusted batch over a validated list.
3. Prefer existing patterns: load rows from DB with narrow filters, then call RPCs/admin updates per row.
4. If you need user-scoped access checks, use a user JWT client instead of `createAdminClient()`.

See also: `POST /api/recompute-estate-health` (uses `RECOMPUTE_SECRET`, not cron, but same service-role RPC bypass applies).
