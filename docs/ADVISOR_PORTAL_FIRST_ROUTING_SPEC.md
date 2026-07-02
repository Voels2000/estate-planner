# Advisor portal-first access — spec

Implements Options A + C from the advisor/attorney claim-flow audit (portal browse mode +
billing inside the portal shell). This **completes Path A as originally scoped** in PRs
#189–#202 — not a new relaxation of billing gating.

**Path A intent (unchanged):** advisor's own household is free; the client-connection
paywall stays exactly where it is (`getAdvisorClientCapacity` on connect/invite APIs).

**What went wrong:** middleware (`shouldRedirectAdvisorToBilling`) blocked the entire
`/advisor/*` shell when firm/profile subscription is null. That is stricter than Path A —
it gated "can you see the page" instead of "can you take the paid action." Claim success
already links to `/advisor?claimed=true`; that CTA is correct but broken until the
middleware redirect is removed.

**Attorney parity:** `/attorney` has no middleware subscription gate; `/attorney/billing` is
a nav tab. Advisors should match: portal shell always reachable; paid actions gated at API.

---

## Terminology — connection billing, not seats

The live firm billing model is **per connected household** (connection billing), not seats.
`firms.seat_count` still exists as a column but is **not** the active pricing unit (replaced
by connection billing in #189–#202).

All copy, flags, and CTAs in this work use **"connect your first client" / "connection
billing"** framing — not "upgrade seats" or seat count. Pull rates from
`lib/billing/connectionPricing.ts` (or existing connection-billing summary helpers); do not
hardcode dollar amounts in UI.

---

## Delivery — two PRs (required sequencing)

### PR 1 — Middleware gate + tests (merged #235)

### PR 2 — Portal shell empty/unpaid state (this branch)

**Scope:**

1. Remove advisor portal redirect from `middleware.ts`.
2. Remove `shouldRedirectAdvisorToBilling` — portal gating is API/action only.
3. Flip E2E: unpaid advisor `/advisor` renders; invite API still blocked.
4. Smoke: billing `← Advisor portal` back link no longer loops.

### PR 2 — Portal shell empty/unpaid state (follow-up)

Empty-state card, metrics, connect CTA, firm billing section — see full spec sections below.

### PR 3 (optional) — Callback consistency

`auth/callback` + `resolveAdvisorPostLoginPath` — defer.

---

## Testing checklist

| Check | PR |
|-------|-----|
| Unpaid advisor `GET /advisor` → 200 portal, not `/billing` redirect | 1 |
| `POST /api/advisor/invite` without firm sub → still blocked | 1 |
| Claim magic link → claim → "Go to advisor portal" → `/advisor` loads | 1 |
| `/billing` → "← Advisor portal" → `/advisor` (no loop) | 1 |
| Empty state card + metrics + connect CTA | 2 |

---

## References

- Path A: `lib/access/advisorBillingGate.ts`
- Connection billing: PRs #189–#202, `lib/billing/firmConnectionBilling.ts`
