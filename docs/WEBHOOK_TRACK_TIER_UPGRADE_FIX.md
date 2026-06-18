# Webhook — `trackTierUpgrade` ordering fix (standalone)

**Status:** Ready to implement — **not a launch gate.** Small, isolated PR whenever there is a clean moment. **Do not** bundle with Option A (Sentry) or Phase 1 (dedup table).

## Problem (live today)

In `app/api/stripe/webhook/route.ts`, `checkout.session.completed` (consumer path):

1. Profile update runs (~225–236).
2. On Supabase `error`, handler logs + Sentry capture (Option A) and continues (~237–240).
3. **`trackTierUpgrade` still runs** (~242–247) if tier increased — including when step 1 failed.

**Impact:** `funnel_events` can record `tier_upgraded` while `profiles` was never updated. Analytics says upgraded; customer profile says otherwise. Option A alerts on the write failure but does not prevent the spurious event.

## Fix (minimal scope)

**Only change:** Call `trackTierUpgrade` when the profile update **succeeded** (no `error`).

```ts
// After profiles.update …
if (error) {
  console.error('Supabase update error:', error.message)
  captureStripeWebhookSupabaseFailure('consumer checkout profile update', error, event)
} else if (consumerTier && consumerTier > previousTier) {
  void trackTierUpgrade({ userId, tier: consumerTier, previousTier })
}
```

No dedup table. No status-code changes. No other handler paths. No refactor.

## Ground rules

- **One concern, one PR** — this hunk only.
- Do not touch deletion scheduling, Sentry helpers, or other event types.
- Preserve `void` fire-and-forget semantics on `trackTierUpgrade` (it never throws).

## Validate

1. **Unit/logic:** When `error` is set, `trackTierUpgrade` is not invoked (mock or code review).
2. **Manual (optional):** Force profile update failure on staging; confirm Sentry capture fires and no new `funnel_events` row for that checkout.
3. `npm run lint` · `npx tsc --noEmit` · `npm run build`.

## Branch / commit

- Branch: `chore/webhook-track-tier-upgrade-order` off `staging`
- Commit: `fix(webhook): only track tier upgrade after successful profile write`

## Out of scope

- Event-id dedup for `funnel_events` (Phase 1, if retry double-fire remains after this fix)
- Throwing on profile failure (Phase 2 / Option B)
- Firm checkout path (no `trackTierUpgrade` there today)

## Related

- [WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md](./WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md) — post-launch dedup + retry
- Option A PR #32 — Sentry on profile write failure
