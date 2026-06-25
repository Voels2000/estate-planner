# Test-Coverage Audit — Spec (review the map before touching any test)

Capstone after PR 8. **This pass produces a map and a kill/fix list — it changes
no tests.** You review the map, approve the cuts/fixes, *then* a second PR
executes. Audit-first, same discipline as everything else. Goal is **better, not
fewer** — count reduction is an output, never the target.

---

## Why count is the wrong target

"Fewer tests" reads identically whether you removed redundancy or removed
coverage — the number can't tell you which, same way "tier 0" couldn't tell a
failed read from a legitimate floor. So the success criterion is **not** a smaller
suite. It is:

> Every resolver/gate branch has at least one *faithful* guard, and no test exists
> that doesn't map to a real failure mode.

If that yields a smaller suite, good. If it yields "same size, but three tests
were lying," that's equally a win and won't show in the count.

---

## The unit of value

Not the test — the **failure mode it is the only guard for.** The question per
test is never "is this redundant?" It is:

> If I delete this, what production failure becomes undetectable — and is anything
> else catching it at the same fidelity and through the same call path?

- Two tests hitting the same branch through the **same call path** → genuine
  redundancy, candidate to cut.
- Two tests hitting the same branch through **different call paths** (unit on the
  gate, E2E through the route) → NOT redundant; they catch different regressions.
  Both stay.

---

## Pass 1 — Branch coverage map (the deliverable)

Build a table: every branch of the core decision surfaces × the tests that cover
it × the call path each uses. The branch set, from this sprint:

**`resolveEffectiveTier`** — the six branches now pinned by the persona matrix:
`advisor/attorney-managed → 3`, `active paid → consumer_tier`, `canceling → paid
tier`, `has_ever_subscribed → 0`, `app trial (trial_ends_at future) → 3`,
`inactive/none → 0`. Plus terminal states feeding 0: `canceled`, `past_due`,
`unpaid`.

**Deliverable OR-gate** (`hasDeliverableDownloadAccess`) — the four cells:
`active sub → allow`, `completed one-time purchase → allow`, `app trial alone →
refuse`, `purchase OR active → allow`. Each must show the test wires purchase via
`toPlanExportPurchaseContext` (production shape), not a hand-built flag.

**Input/computed boundary** (`inputComputedBoundary`) — per `EXPORT_INPUT_TABLES`
entry: input visible at tier 0; per computed surface: gated + structurally absent
from export. Plus the bidirectional set-equality and the isolation negative.

**`getUserAccess` resilience** — errored read → throw (not tier 0); no-row → clean;
read OK → correct tier.

**Stripe account guard** — mode mismatch, source/override, account mismatch,
fail-closed on API error.

For each branch, mark coverage as: **GAP** (zero tests — the real risk),
**SINGLE** (one faithful guard — ideal), **MULTI-SAME-PATH** (redundancy
candidate), **MULTI-DIFF-PATH** (keep all). The map's job is to make GAP and
MULTI-SAME-PATH visible objectively, instead of auditing by gut.

**Persona ground-truth:** `scripts/e2e-persona-matrix.ts` (`E2E_PERSONA_MATRIX`) —
six consumer resolver seeds + advisor-client bypass (separate).

---

## Pass 2 — The two lists

**List A — true duplicates (cut candidates).** Only MULTI-SAME-PATH entries.
A test is cut-eligible only if another test covers the *same failure mode at the
same fidelity through the same call path*. When in doubt, keep — a redundant test
costs a little maintenance; a deleted unique test costs a production incident.

**List B — false-confidence tests (fix or cut).** The higher-value pass. These are
green-for-the-wrong-reason tests — the class that cost this project days. Apply the
two DECISION_LOG rules as the rubric:

1. *Tests must match production call-site wiring.* Flag any test that invokes a
   gate/guard with arguments no real caller uses (the missing-`planExportPurchase`
   shape, the un-awaited guard, the assets-only isolation fixture were all this).
2. *Multi-source config must prove its resolution at the boundary.* Flag any test
   that asserts behavior without pinning which source/target it resolved against.

For each List B entry: **fix** (rewire to the production call path) if the branch
needs the coverage, or **cut** if it's both lying *and* redundant with a faithful
test. A lying test is worse than no test — it costs maintenance and pays nothing.

---

## Hard guardrails for the execution PR (after map approval)

- **No branch loses its last faithful guard.** Before cutting any test, confirm the
  branch it covers still has a SINGLE or MULTI entry remaining.
- **GAPs get filled before anything gets cut.** If the map surfaces an uncovered
  branch, that's a coverage hole — the audit *adds* there. Net count may go up, and
  that's correct.
- **Cuts and fixes are separate commits** so a wrong cut can be reverted without
  losing a fix.
- **Run the full suite before/after** and diff *which* tests run, not just the
  pass count — a dropped test that was silently skipped won't change the count.

---

## Deliverable order

1. Pass-1 map (table) — **review and approve before Pass 2.**
2. Pass-2 List A + List B with per-entry cut/fix/keep rationale — **review before
   execution.**
3. Execution PR(s): GAP-fills first, then fixes, then cuts, each its own commit.

The map is the product. The count change, if any, falls out of it.

**Pass 1 map:** [TEST_COVERAGE_AUDIT_PASS1.md](./TEST_COVERAGE_AUDIT_PASS1.md)
