# BILLING_PAGE_COPY_SPEC.md
# Consumer `/billing` — capability matrix copy and layout
# Last updated: 2026-06-24

Canonical engineering reference for the consumer billing page matrix (shipped). Public marketing copy on `/pricing` may differ.

## Layout

1. **Trial banner** (when applicable) — `BillingPageTrialBanner`
2. **Monthly/annual toggle** (when annual prices configured)
3. **Capability matrix** — desktop table; mobile focused column + “Compare all plans”
4. **Subscribe / manage** actions per paid column
5. **Plan & Export** one-time SKU — below the subscription ladder (not a matrix column)

## Matrix structure

- **Four columns:** Free (tier 0) · Financial (1) · Retirement (2) · Estate (3)
- **Cumulative checks:** each column includes all capabilities with `minTier ≤ column tier`
- **Subheader:** “Each plan includes everything in the plans before it.”
- **Estate column:** subtle navy background tint only — no “For estate households” tag

## Tier headers

| Tier | Name | Question | Price display |
|------|------|----------|---------------|
| 0 | Free | Where do I stand? | $0 always |
| 1 | Financial | Will I be okay? | From `getConsumerPlanDisplay(1, period)` |
| 2 | Retirement | How confident can I be? | From `getConsumerPlanDisplay(2, period)` |
| 3 | Estate | What happens to what I leave? | From `getConsumerPlanDisplay(3, period)` |

One-liners live in `lib/billing/billingTierPresentation.ts` (`TIER_ONE_LINERS`).

## Capability rows

Source of truth: `BILLING_CAPABILITY_ROWS` in `lib/billing/billingCapabilityMatrix.ts`.

Groups: **Your finances** · **Planning** · **Confidence** · **Estate**

Rows must stay aligned with `FEATURE_TIERS` for listed feature keys. Tier 0-only keys (`net-worth-view`, `data-export`) are matrix presentation until tier-restructure gates ship.

## Trial banner

Resolved by `resolveBillingTrialBanner`:

1. `trial_ends_at` on profile (future app-managed trial)
2. Else Stripe `subscription_status === 'trialing'` + `subscription_period_end`

Estate checkout: **7-day** Stripe trial (`PRICE_META.trialDays`). Financial and Retirement charge immediately.

## Plan & Export block

Copy and CTA in `BillingPlanAndExportSection.tsx`. Shown when `shouldOfferPlanAndExportPurchase` returns true. Price from `ONE_TIME_SKU_META` ($1,490 derived from Estate annual).

## Related docs

- [MASTER_ARCHITECTURE.md § Consumer Billing](./MASTER_ARCHITECTURE.md)
- [DECISION_LOG.md § Consumer billing capability matrix](./DECISION_LOG.md)
- [TIER_RESTRUCTURE_PR_SEQUENCE.md](./TIER_RESTRUCTURE_PR_SEQUENCE.md) — enforcement PRs after this presentation layer
