# MWM — `/billing` Firm Page: Connection-Billing Rebuild Spec

**Owner:** Al Voels · **For:** Cursor · **Depends on:** #195 (sticky-floor backend, on staging)
**Status:** ✅ **Shipped #196** → `staging` (2026-07-01). Flag-gated rebuild live on `estate-planner-staging.vercel.app`.
**Closes two launch blockers at once:** (1) the display bug (page shows legacy `$149/advisor` seat math over new-model data) and (2) the missing raise/reset forms (the limit-reached modal links here but the action can't be completed).
**Flag-gated:** when `CONNECTION_BILLING_ENABLED` is OFF, the page renders exactly as today (legacy seat view). When ON, it renders the connection-billing view below. No change to flag-off behavior.

---

## The problem this fixes

Current `/billing` Firm Summary runs legacy math:
```ts
const perSeatRate = ADVISOR_FIRM_SEAT_RATES[firmTierKey]   // retired $149/$99/$89
const seatCount   = firmRow?.seat_count ?? 0               // now overloaded
const totalMonthly = perSeatRate * seatCount               // wrong model
```
So a firm on the connection price with `client_limit=2` sees "$149/mo per advisor · Active seats: 2 · $298/mo" — the retired model's vocabulary and numbers over correct new-model data. Stripe and the DB are right; the page is narrating the old model. Rebuild it to narrate the new one.

---

## Data the page must read (flag ON)

| Display field | Source |
|---------------|--------|
| Connected clients | `firmConnectedHouseholds(firmId)` (live count) |
| Client limit | `firms.client_limit` |
| Billing floor | `firms.billing_floor` (the sticky high-water-mark) |
| Billable now | `max(connected, billing_floor)` |
| Band | `bandForCount(billableQuantity, ADVISOR_BANDS)` |
| Per-client rate | `rateForCount(billableQuantity, ADVISOR_BANDS)` (band rate, ≥ floor) |
| Est. monthly | `billableQuantity × per-client rate` |
| Resets used | `firms.reset_count` (of 2 before admin) |

**Do NOT** read `ADVISOR_FIRM_SEAT_RATES` or compute `perSeatRate × seat_count` in the flag-ON path. Import rates/bands from `lib/pricing/connectionPricing.ts` (the single source of truth).

---

## Firm Summary — new copy (flag ON)

Replace the seat-centric summary with connection-centric:

```
FIRM SUMMARY
  Firm name        MWM E2E Empty Advisory  [Edit]
  Plan             Connection billing — Starter band (1–10 clients)
  Rate             $120 / connected client / month
  Connected now    0 of 2 client capacity
  Billing floor    2  (minimum you're billed for)
  Est. monthly     $240/mo   ← max(connected, floor) × band rate = 2 × $120
  [Manage payment method]   [Raise limit]   [Lower limit]
```

Key copy principles:
- "Connected client**s**", never "advisor seats." Advisors ≠ billing units now.
- Show **both** connected count and capacity: "0 of 2" makes the prepaid model legible.
- Name the floor explicitly ("minimum you're billed for") so the sticky behavior isn't a surprise when they disconnect and the bill holds.
- Est. monthly uses `max(connected, floor) × band rate` — the real billable quantity, not connected alone.

---

## The three states the page must render

**1. Below capacity (connected < client_limit)**
- Show "N of LIMIT client capacity."
- "Raise limit" available (adds headroom / may improve band).
- "Lower limit" available if `connected < client_limit` and `reset_count < 2` (can't lower below connected).

**2. At capacity (connected == client_limit)**
- "You've connected all LIMIT clients in your plan."
- Prominent "Raise limit to connect more" CTA — this is where the gate sends them.
- This is the state the limit-reached modal deep-links into; it must show the raise form, not a dead end.

**3. Floor above connected (disconnected below the high-water-mark)**
- "Billed for FLOOR (your capacity). Connected: N."
- Explain: "You're billed for your capacity, not current connections. Lower your limit to reduce your bill."
- "Lower limit" is the release valve — surfaced here specifically.

---

## Raise limit form

```
POST /api/firm/connection-limit/raise   { new_client_limit }
```
- Input: new limit (must be > current `client_limit`).
- **Preview before confirm:** show new band + new per-client rate + new est. monthly. Raising may move them into a *more favorable* band (lower per-client rate) — show that as the upside.
- On success: `client_limit` updated; `billing_floor` unchanged by the raise itself (ratchets as they connect into the new headroom); Stripe quantity unchanged until they actually connect.
- Owner-only (firm owner). Members see "ask your firm owner."

---

## Lower limit (reset) form

```
GET  /api/firm/connection-limit/reset   → preview (band change, new rate, resets remaining)
POST /api/firm/connection-limit/reset   { new_client_limit }
```
- Constraint: `new_client_limit >= connected` (cannot set below actual usage) — enforce in UI and trust server to re-check.
- Constraint: `reset_count < 2` — if at 2, disable the form and show "You've used your 2 self-serve limit reductions. Contact support to adjust further."
- **Re-band preview (mandatory):** "Lowering to N clients moves you from <Band A> ($X/client) to <Band B> ($Y/client). New monthly estimate: $Z. This is reset K of 2." — the rate going UP is the discount-protection consequence; show it honestly before confirm.
- On success: `client_limit = new`, `billing_floor = new`, `reset_count++`, Stripe quantity syncs to `max(connected, new)`.
- Owner-only.

---

## Member vs owner

- **Owner:** full summary + raise + lower + manage payment.
- **Member (sub-advisor):** read-only summary + "Your firm owner manages billing." No raise/reset/payment actions. (Matches the limit-reached modal's member path — "firm owner must enable billing.")

---

## Flag-OFF path (unchanged)

When `CONNECTION_BILLING_ENABLED` is off, render the existing legacy seat view verbatim. This page has two modes; the flag selects. The flag-off branch must be byte-identical to today (same guarantee as every other flag-gated change in this effort).

---

## Tests

| Test | Asserts |
|------|---------|
| Flag ON, below capacity | shows "0 of 2", rate $120, est $240 (2×120), NOT $149/$298 |
| Flag ON, at capacity | shows "raise to connect more" CTA; modal deep-link lands on raise form |
| Flag ON, floor > connected | shows "billed for floor" explanation + lower-limit valve |
| Raise preview | shows new band/rate/estimate before confirm |
| Reset preview | shows re-band (rate up), resets remaining |
| Reset at 2 used | form disabled, "contact support" message |
| Reset below connected | rejected in UI and server |
| Member view | read-only, no actions |
| Flag OFF | renders legacy seat view byte-identical to today |

---

## Definition of done
On staging, flag ON: the Firm page shows connected/capacity/floor/band-rate/correct-total (no legacy $149/seat math), the three states render correctly, raise and lower forms work with previews, the limit-reached modal deep-links to a working raise form, members see read-only. Flag OFF renders exactly as today. This closes both the display bug and the raise/reset-UI launch blockers — after which the advisor connection-billing track is UI-complete and launch-ready.

## Not in scope
- Attorney billing UI (Phase 6, parallel, listing-scoped, same pattern).
- Prod flag flip + checkout price repoint + `automatic_tax` (after staging green).
- Consumer billing page (separate, trivial pre-launch).
- **`/advisor/firm` legacy copy** — still shows per-seat math when flag ON; follow-up PR (see NEXT_SESSION.md).
