# MWM — Attorney Raise-and-Connect Flow: Parity Fix Spec

**Owner:** Al Voels · **Status:** ✅ Shipped staging PR [#201](https://github.com/Voels2000/estate-planner/pull/201) (2026-07-01)  
**Context:** Manual staging walk found dead “Confirm raise” and heavier at-capacity flow vs advisor. Billing math (free-client offset) unchanged.

**Flag:** `CONNECTION_BILLING_ENABLED`. Flag-off unchanged.

---

## Model (attorney == advisor + one free client)

- **Limit** = ceiling on **total** connected households (free client counts).
- **Below ceiling:** accept → connects → Stripe qty sync (prorated). No checkout.
- **At ceiling:** in-app raise (no checkout) → accept → connects → bills.
- **Checkout once:** free→paid (attorney 2nd client). After that, raise + background billing only.
- **Attorney offset:** `billable = max(0, connected − 1)`; limit 5 → 5 connectable, billed for 4.

---

## Shipped fixes (#201)

| Area | Change |
|------|--------|
| Shared raise | `ConnectionLimitRaiseForm` + `buildConnectionRaiseLimitPreview` |
| Dead button | Submit enabled when `newLimit > currentLimit` (not gated on preview) |
| Gate modal | Inline raise on `limit_raise_required` in requests accept |
| Attorney raise API | No Stripe sync on raise — qty changes on connect only |
| Billing copy | At-capacity legibility + free-client line |
| Tests | `connectionRaiseLimitPreview.spec.ts` + gate contract tests |

---

## Gate UI on all connect surfaces (#200 + #201)

| Path | Side | Handler | PR |
|------|------|---------|-----|
| `accept-request` | Attorney | `AttorneyConnectionBillingGateModals` + checkout/raise | #200, #201 |
| `attorney-invite` accept | Consumer | `useConsumerAttorneyBillingGateMessage` | #200 |
| `intake-complete` | Consumer | profile + login → `ConsumerAttorneyBillingBlockedBanner` | #200 |
| `grant-access` | Consumer API | `useConsumerGrantAttorneyAccess` hook only — **no production UI** (find-attorney uses request-connect) | #200 hook; API returns 402 |

---

## Staging proof (step 4)

At 2/2 → raise to 3 in modal → accept 3rd → qty 2, $150, no second checkout.

**Reset:** `npm run reset:staging-e2e-attorney-connection-billing`

---

## Definition of done

Staging: 2nd client one checkout; 3rd+ in-app raise + background connect; capacity screen legible; advisor unchanged; flag-off byte-identical.
