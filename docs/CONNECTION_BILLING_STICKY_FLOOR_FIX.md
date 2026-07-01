# MWM — Connection Billing: Sticky-Floor (B2) Model Fix Spec

**Owner:** Al Voels · **For:** Cursor · **Replaces:** the `max(connected, seat_count)` one-liner (which silently produced a high-water-mark ratchet with no floor protection).
**Context:** Staging spine walk proved the re-meter machinery works (17/17). It also surfaced that the sync implements pure usage-metering, which conflicts with the intended model. This spec defines the correct model.
**Flag:** still behind `CONNECTION_BILLING_ENABLED`. Do not flip on prod until the new contract tests pass on staging.

---

## The model (B2 — sticky floor, gated ceiling)

The advisor/attorney sets a limit. Usage tracks up toward it (pay for what you use as you grow). Once usage climbs, the floor is **sticky** — disconnecting does not lower the bill. Exceeding the limit **gates** (prompt to raise) rather than auto-billing (no month-end surprise). A **self-serve reset** releases a genuinely-shrunk firm, with re-banding shown and a frequency limit to prevent gaming.

### Three distinct fields (none is the old `seat_count`)

| Field | Meaning | Who changes it |
|-------|---------|----------------|
| `client_limit` | The ceiling the pro sets. Connecting beyond it is gated. | Set at checkout; raised by explicit action; lowered only by reset. |
| `billing_floor` | High-water-mark of actual usage, capped at `client_limit`. Sticky. | **Ratchets UP automatically** via sync when connected exceeds it. **Only reset lowers it.** |
| `connected_count` | Live count of distinct connected households (`firmConnectedHouseholds`). | Floats with connect/disconnect. |

### Billable quantity (sent to Stripe)
```
billableQuantity = max(connected_count, billing_floor)   // always ≤ client_limit
```

### The load-bearing invariant
**The connection sync ratchets `billing_floor` UP (when connected exceeds it), and NEVER lowers it. Only the explicit reset action lowers `billing_floor`.**
If the sync can lower the floor, the model collapses back to pure usage-metering. This asymmetry is the whole design.

**Code review gate:** ask *"can anything except the reset action lower `billing_floor`?"* If no, the model holds.

---

## Behavior by action (flag ON)

### Connect
```
if (connected_count + 1) > client_limit:
    → GATE: return 402 { error: 'limit_raise_required', currentLimit, connected_count }
      Do NOT connect. Do NOT run consumer handoff. Prompt the pro to raise the limit.
else:
    → connect the household
    → connected_count increases
    → if connected_count > billing_floor: billing_floor = connected_count   // ratchet UP
    → sync Stripe quantity = max(connected_count, billing_floor)  (= billing_floor here)
```

### Disconnect
```
→ connected_count decreases
→ billing_floor UNCHANGED (sticky)
→ Stripe quantity = max(connected_count, billing_floor) = billing_floor   // bill holds
```

### Raise limit (explicit, self-serve)
```
→ pro sets new client_limit (> current client_limit)
→ may move them into a MORE favorable band (lower per-client rate)
→ show new rate before confirming
→ billing_floor unchanged by the raise itself; it ratchets as usage climbs into the new headroom
```

### Reset / lower limit (explicit, self-serve, with guardrails)
```
Constraints:
  - new_limit >= connected_count            // cannot set a limit below actual usage
  - reset_count < 2                         // max 2 self-serve resets before admin reset required
On reset:
  - client_limit = new_limit
  - billing_floor = new_limit               // floor drops to the new limit (releases the high-water-mark)
  - RE-BAND: recompute per-client rate for the new_limit's band
  - increment reset_count
Confirmation UI MUST show:
  - "Lowering to N clients moves you from <Band A> ($X/client) to <Band B> ($Y/client)."
  - "New monthly estimate: $Z."
  - "This is reset K of 2 before admin assistance is required."
```

### Frequency limit
- Track `reset_count` per firm/listing.
- After **2** self-serve resets, further resets require an **admin reset** (support-mediated). Surface: "You've used your 2 self-serve limit reductions. Contact support to adjust further."
- **Admin reset clears `reset_count`** (only way to reset the counter — see confirmed decisions below).

---

## Re-banding is the discount protection

Volume discounts are earned by **sustained** volume, not by briefly touching a number. Because `billing_floor` is sticky and reset re-bands:
- A firm that ramps to 55 (Practice, $84) then disconnects to 40 → **still billed 55 at $84** (floor sticky) until they reset.
- If they reset to 40 → **re-banded to Growth ($102)** — the per-client rate goes UP even though count went down.
- So "inflate to earn a discount, deflate to cut the bill" does not work: deflating requires a reset, and reset loses the discount.

This, plus the 2-reset frequency cap, closes discount gaming for v1. (If abuse appears later, add a hold period: a lowered limit must persist one full cycle before taking effect. NOT in v1.)

---

## Data model

Add to `firms` (advisor) and the attorney billing owner (listing-scoped):
```sql
alter table firms
  add column if not exists client_limit integer,        -- ceiling/gate
  add column if not exists billing_floor integer default 0, -- sticky high-water-mark
  add column if not exists reset_count integer default 0;
-- connected_count is derived (firmConnectedHouseholds), not stored, OR cached with care.
```
- **Do NOT reuse `seat_count`** for any of these — the connection sync must never overwrite the floor, and `seat_count` is still mutated by roster paths. Keep them separate.
- Set `client_limit` and `billing_floor` at checkout to the purchased/selected quantity.
- Attorney: same three-field model on the attorney billing entity (Phase 6). Identical mechanics; attorney rates/bands.

---

## Sync changes (`syncFirmQuantity` / `firmConnectionBilling`)

```
resolveFirmStripeBillableQuantity(firm):
  if !CONNECTION_BILLING_ENABLED: return seat_count ?? 1        // unchanged, flag-off inert
  connected = firmConnectedHouseholds(firmId)
  if connected > firm.billing_floor:
      firm.billing_floor = connected        // RATCHET UP (persist)
  return max(connected, firm.billing_floor) // == billing_floor after ratchet
```
- The ratchet-up write to `billing_floor` happens here (or in the connect path). It must be persisted.
- **Never** write `billing_floor` downward in the sync. Only the reset action does that.

---

## Contract tests (replace the "quantity == connected" tests)

| Test | Asserts |
|------|---------|
| Track up to limit | limit 5, connect 1→2→3 → quantity 1→2→3; billing_floor ratchets to 3 |
| Pin on disconnect | at 3 connected (floor 3), disconnect to 2 → quantity stays 3 (floor sticky) |
| Gate beyond limit | limit 5, at 5 connected, connect 6th → 402 limit_raise_required; NOT connected; consumer handoff NOT run |
| Raise unlocks | raise limit 5→10, connect 6th → succeeds, quantity 6, floor ratchets |
| Sync never lowers floor | disconnect repeatedly → billing_floor never decreases via sync |
| Reset lowers + rebands | floor 55 (Practice $84), reset to 40 → floor 40, rate = Growth $102, quantity 40 |
| Reset guard: below usage | connected 40, attempt reset to 30 → rejected (new_limit >= connected) |
| Reset frequency | 2 self-serve resets OK; 3rd → blocked, "contact support"; admin reset clears counter |
| Re-band shown | reset confirmation surfaces old band, new band, new rate, new estimate |
| Flag OFF unchanged | all paths behave exactly as pre-fix when flag off |
| Path A intact | 0-client unpaid advisor → dashboard OK; billing_floor 0 |

---

## Confirmed decisions (2026-07-01)

1. **`reset_count` window — lifetime until admin reset.** The 2 self-serve reset cap does **not** auto-clear each billing period. `reset_count` increments on each self-serve reset; only an **admin reset** clears it. Stronger anti-gaming; revisit if legit users are blocked.
2. **Attorney parallel — Phase 6.** Same three-field model on the attorney billing entity (listing-scoped). Identical mechanics with attorney rates/bands. Build after advisor track is proven on staging.

---

## Out of scope / carry-forward
- Prod flag flip + checkout price repoint — only after contract tests pass on staging.
- `automatic_tax` on connection checkout — wire at prod repoint (still required before prod billing).
- Hold-period anti-gaming (lowered limit must persist a cycle) — NOT v1; lever if abuse appears.
- Attorney track is Phase 6, parallel, after advisor proven.

## Definition of done
Staging, flag ON: connect tracks up to limit, disconnect holds the floor, exceeding gates, raise unlocks, reset lowers+rebands with confirmation, 3rd reset blocked, sync never lowers the floor — and flag-off behavior is byte-identical to today.

## Post-merge staging proof (live, in order)

1. **Core fix:** checkout 5 seats → connect 1 client → **Stripe quantity stays 5** (does not drop to connected count). Proves deployed sync path, not just unit tests.
2. **Gate + raise round-trip:** connect to 5 → 6th returns `402 limit_raise_required` (no `advisor_clients` row, no consumer handoff) → raise limit via API → 6th connects → qty ratchets to 6.
3. **Reset re-band:** ratchet across a band boundary (e.g. 11+), disconnect, bill holds at floor → reset with preview showing rate increase → floor drops and re-bands.
4. **Frequency cap:** 3rd self-serve reset blocked; admin `POST /api/admin/firm-connection-reset-count` clears counter.

**Fixture reset:** `TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/reset-staging-e2e-advisor-empty-billing.ts`

## Launch-required gap (not deferred)

**`/billing` raise + reset UI** must ship before real advisors use connection billing. The advisor workspace limit-reached modal links to `/billing`, but v1 is API-only — professionals cannot complete raise/reset in-product. Staging proof via API is fine; **prod launch to real advisors is blocked** until forms land (re-band confirmation copy required on reset).
