# Pre-Flip Plan — using the B&O runway

The DOR B&O delay sets the timeline, not a flip date. Spend the runway on the
work that bites when *marketing traffic* arrives (the launch the ruling actually
gates), not on starting the explicitly-deferred pile. Three tracks, in order.

---

## Track 1 — Cheap pre-flip closes (hours, zero product risk)

| Action | Tool | Notes |
|---|---|---|
| De-red prod smoke (interim) | `playwright.config.ts` filter | Skip advisor projects under `TEST_ENV=production` until Track 2 lands. Tracked, reversible — same shape as `CUTOVER_PAUSE`. |
| Attest ledger + signups | `preflip-checks.sh` | Ledger drift empty both envs; `handle_new_user` fires on fresh signup. |
| Re-run post-deploy | `npm run release:post-deploy` | Cutover step 4 was partial; you've merged #144/#145 since. |
| Dead-code trim (safe half only) | `safe-dead-code-trim.sh` | Dry-run, verify zero callers, then `--apply`. Whole-file deletes only. |

Dead-code scope: trim only grep-confirmed zero-caller items
(`ensureMinEstateHealthScore` — your own gate change orphaned it — plus the
scaffold scripts, `test-engines.ts`, the deprecated billing fn, unused legal/form
exports). Do NOT touch anything tagged "consolidate, don't delete blindly" —
the dual `EstateFlowDiagram` especially. Pre-flip is not when a clever deletion
should surface a dynamic reference you missed.

---

## Track 2 — Advisor↔consumer connection (the build you asked for)

**This is the #107 bug's exact shape. Build it audit-first.** The risk is not
writing the link — it's writing it through a raw grant instead of the product's
real consent/link flow, which re-grants broad access and flips isolation tests
from 403/404 to 200 for every other household.

**Step 1 — Audit (now):** `audit-advisor-link.sh` surfaces the real linkage
table, the consent/invite flow, `getAccessContext` logic, and the RLS policies
that enforce isolation. Paste back sections 1–3 and 4a/4c.

**Step 2 — Seed through the real flow (after audit):** create a *new dedicated
consumer* (not the existing isolation-test consumer) and link an advisor to it
via the same path the product uses — invite → accept → link row — never a direct
membership INSERT. Keeping the linked consumer separate from the isolation
fixture is what preserves both behaviors at once.

**Step 3 — Prove isolation still holds:** the linked advisor sees ONLY its linked
consumer; every other household still returns 403/404. Add this as an explicit
assertion, not an assumption. This is the test #107 should have had.

**Step 4 — Validate on staging first**, where e2e runs. Get the advisor-views-
client flow green there before touching prod.

**Step 5 — Optional prod canary pair:** once staging is green, decide whether to
promote an advisor-canary + consumer-canary pair to prod. If you do, re-verify
RLS scoping in prod (the canary advisor must not see david/avoels/real
households), then **retire the Track 1 smoke filter** — the advisor smokes now
have a real pair to pass against, which is the complete fix for the always-red
runs. That's the better long-term answer; the filter was only the interim.

---

## Track 3 — Perf PR (pull forward from "post-flip")

The audit rated this "not a flip blocker" — correct under the old timeline. The
delay widens the gap to real traffic, and perf is exactly what bites a marketing
cohort. Three protected users won't feel any of it; a cohort will. These are
real per-file refactors (Cursor implements; not shell-scriptable), each its own
PR through `verify + e2e-smoke + rls-verify` — boundary splits can change
hydration/behavior, so the gates matter as much here as anywhere.

ROI order:
1. `_dashboard-body.tsx` — batch the serial post-bundle fetches (gifting,
   composition, RMD, checklist, auth user) with `Promise.all` / nested
   `<Suspense>`. Highest ROI, lowest behavior risk.
2. `_dashboard-client.tsx` (~989 lines) — server-render the static cards,
   `dynamic()` the modals and heavy panels. Shrinks the client boundary.
3. `sidebar-nav.tsx` + layout chrome — server-render links; client islands only
   for the bell/drawer. Stops every route hydrating ~670 lines + a browser
   Supabase client.

---

## Explicitly deferred — don't let runway pull you in

Free time is how scope creeps. One-PR-per-logical-unit says spend it on Track 3
and the cheap closes, not on starting these:

- Full `knip` pass (~200 exports — a rabbit hole that eats the window)
- `EstateFlowDiagram` consolidation (68 vs 701 lines — needs care, not pre-flip)
- Wiring `AdvisorAlertPanel` (product decision)
- Attorney `TODO_*` prices (only if the attorney portal opens at flip)

---

## Separately: the ruling is a different gate than "engineering ready"

A question for your tax counsel, not engineering: the ruling gates the *public*
launch, but whether it gates a *controlled* flip depends on whether you're
collecting revenue from a WA customer in that cohort. Two things worth doing now,
regardless of code: a polite status nudge to DOR (you're past the quoted 10 days),
and asking your accountant whether a conservative interim posture allows a limited
flip while the ruling pends. You likely have more control over the engineering
gate than the tax one — don't let the second silently block the first if it
doesn't have to.
