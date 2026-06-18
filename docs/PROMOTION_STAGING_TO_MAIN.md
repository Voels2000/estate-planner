# Promote staging → main (pre-launch hardening)

Promotes the accumulated security/correctness work on `staging` to production.
**This is a hardening deploy to a pre-launch production — it does not open prod to
real users and does not retire any flip blocker.**

39 commits / PRs #28–#38. Prod-side dependency surface is small: one already-applied
additive migration and three secrets that must be set on prod (below). No env-manifest
drift, no inter-migration ordering, no destructive schema changes. Code surfaces are
disjoint, so anything that surfaces post-deploy is traceable to a specific PR.

## Contents

| PR | Theme |
|----|-------|
| #28 | Pre-launch security fixes (fail-closed internal/cron auth) |
| #29 | Sentry error monitoring |
| #30 | CI cross-household isolation (security) |
| #31 | Doc reconciliation |
| #32 | Webhook failure alerting (Sentry on Stripe webhook) |
| #34 | trackTierUpgrade ordering fix |
| #35 | Recompute fail-closed auth (`RECOMPUTE_SECRET`) |
| #36 | Checkout API eligibility guards |
| #37 | Attorney unsubscribe routes to `profiles` (+ migration) |
| #38 | Notification hygiene runbook (docs) |

## Migration

- `supabase/migrations/20260718120000_attorney_drip_unsubscribed_at.sql`
- Additive only: nullable `timestamptz` on `public.profiles`, `add column if not exists`.
- **Already applied to production** (applied early; `IF NOT EXISTS` makes it re-apply-safe).
- Verify, don't assume: `supabase migration list` against prod confirms it's present before
  the code that writes it goes live. Attorney drip is not live, so window risk is ~zero.

## Pre-merge precondition — secrets must be set on PROD

Several routes were made fail-closed (#28/#35): they return 500 if their secret is unset.
The env manifest marks these `requiredInScopes: ALL_DEPLOYED`. Confirm all three are set on
the **production** Vercel project before promoting, or cron/internal/recompute routes will
500 in prod:

- [ ] `RECOMPUTE_SECRET` set on prod *(confirmed; all recompute callers send `x-recompute-secret`)*
- [ ] `CRON_SECRET` set on prod *(Vercel auto-injects `Authorization: Bearer $CRON_SECRET` to `/api/cron/*`)*
- [ ] `INTERNAL_API_KEY` set on prod *(outbound senders use `x-internal-key`; internal-email routes read it)*

Strongest single confirmation: cron runs (e.g. `post-deploy-verify`) have been firing
**green on staging since #28** — live proof the fail-closed auth works with the secrets as
configured. Staging green + prod secrets set = prod will behave identically.

## Promote

1. [ ] Confirm the three secrets above are set on prod.
2. [ ] Confirm staging crons are green post-#28 (code/auth proof).
3. [ ] Merge on green CI (`ci.yml` unit suite).
4. [ ] Watch the Vercel production deploy land green (deploy-failed alerts are on).

## Post-deploy smoke checks (prod)

Not a full regression — confirm changed surfaces behave. Where noted, **passive log checks**
are enough; no need to trigger writes or charges just for this promotion.

- [ ] **Recompute (#35) — passive:** After any natural household write (or wait for the next
      one), check prod logs for `/api/recompute-estate-health` — expect 200s, no 403/500 from
      the auth guard. Absence of skip-log warnings from `triggerEstateHealthRecompute` also
      confirms `RECOMPUTE_SECRET` + `NEXT_PUBLIC_APP_URL` are wired. Do not force a write
      solely for this check unless convenient.
- [ ] **Cron (#28) — passive:** Confirm at least one `/api/cron/*` run post-deploy reports
      success in Vercel cron logs or `post-deploy-verify` output — no 401/500 from
      fail-closed auth. Confirms `CRON_SECRET` in prod.
- [ ] **Internal email (#28):** An internal-email path (e.g. email-capture → drip step 1)
      sends — confirms `INTERNAL_API_KEY` in prod. *(Low-traffic; can also confirm from a
      recent successful drip send in logs if one occurred.)*
- [ ] **Checkout (#36) — block paths only:** Confirm managed / `past_due` / already-subscribed
      accounts get **403 or 409** from `POST /api/stripe/checkout` (no Stripe session, no
      charge). These paths are free to exercise in prod. **Defer eligible-consumer → Stripe
      happy path** to the dedicated real-card smoke test — unit tests already proved #36
      happy-path logic; a live charge validates Stripe end-to-end, not this PR.
- [ ] **Attorney unsubscribe (#37):** n/a — attorney drip not live; migration-present is
      the only prod-side concern, confirmed above.

## After a clean promotion

- [ ] DECISION_LOG: mark the pre-flip auth/compliance set closed in production.
- [ ] DECISION_LOG note: `unsubscribeToken.ts` signs HMACs with `CRON_SECRET` (fallback
      `INTERNAL_API_KEY`) — **rotating these secrets invalidates all previously-issued
      unsubscribe links.** Flag before any future secret-rotation task.
- [ ] Follow-up ticket: wire `RECOMPUTE_SECRET` into CI so `recompute-estate-health.spec.ts`
      runs at HTTP level (currently unit-tested only; E2E skips without the secret).
- [ ] Follow-up ticket: when the attorney drip *sender* is built, it must filter
      `.is('attorney_drip_unsubscribed_at', null)` (mirrors advisor cron) to honor the
      column #37 added.

## Not in scope / still blocking the flip

Vercel Pro upgrade · Supabase PITR confirmation · real-card Stripe smoke test ·
privacy-policy counsel accuracy pass. This promotion does not touch any of these.
