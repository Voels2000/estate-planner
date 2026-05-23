# NEXT_SESSION.md
# Sprint 12 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — $2M–$30M estate/financial planning. **Sprint 11 closed. Sprint 12 is current.**
> Persona dashboard alerts + planning empty-state CTAs shipped. Next: A/B winners, mobile nav audit, copy pass.
> Before coding: read **Known limitations** below (attribution edge case + `CONNECTED_ADVISOR_CLIENT_STATUSES`).
> A/B criteria settled in DECISION_LOG.md — implement winners and remove losing variants.
> Apply migration `20260530000000_sprint9_10_gates.sql` on staging/prod if not already applied.
> Today's task: [FILL IN BELOW].

---

## Current sprint — Sprint 12 (Weeks 43–46)

**Goal:** Close A/B tests with data-driven decisions. Mobile audit. Copy pass.

**Shipped this session:**
- Persona alerts on `/dashboard` — business $5M / $10M (`buildPersonaDashboardAlerts`); multi-state RE when ≥2 `situs_state` values
- `loadDashboardCoreInputs` — `situs_state` on `real_estate` select (no extra query)
- Planning empty states — `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` on `/projections` + `/complete` (profile only; no tier-3 generate link)

**Next (Sprint 12 remaining):**
- `[ ]` `ab_upgrade_copy` — pick winner; remove losing variant
- `[ ]` `ab_assessment_gate` — pick winner; remove losing variant
- `[ ]` `EVENT_UPGRADE_COPY` — prod smoke for winning personalized variant
- `[ ]` Mobile nav audit (consumer public + dashboard)
- `[ ]` In-app copy audit (Sprint 2 deferred)

See [ROADMAP.md](./ROADMAP.md).

---

## Sprint 11 completed ✅

| Area | What shipped |
|------|----------------|
| **Planning surfaces** | `PlanningSurfaceNav`; `ScenariosExploreCard`; `/complete` uses `loadProjectionData` |
| **Charitable** | `buildPersonalizedCharitableTopics()` + `charitableTopicsUseProfileData()` gate |
| **Tier / empty state** | `/complete` tier 2; profile-only empty CTAs on projections + lifetime snapshot |

---

## Known limitations (do not lose between sessions)

### Anonymous cross-device attribution

`referral_clicks` has **no `user_id`** — clicks are logged anonymously at event-page visit (`POST /api/referral/track`). Per-user attribution at signup uses `funnel_events.event_slug` (`account_created` / `event_page_view`) and `profiles.referral_code` written from sessionStorage.

**Edge case:** A user who visits `/event/selling-a-business?ref=` on device A, then signs up on device B without the same sessionStorage, may have `profiles.referral_code` but no matching funnel row with `event_slug`. `pickConnectionLifeEvent()` then falls back to the latest `referral_clicks.event_slug` for that code (weak signal — may not be that user's click). **Not a launch blocker;** document if product later needs cross-device event slug persistence (e.g. `profiles.referral_event_slug` at signup).

### Advisor connection status — canonical import

Any code that checks whether an advisor–consumer link is **live** must use:

```ts
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
```

Statuses: `active`, `accepted`. Do not hardcode status strings.

### Planning empty-state CTAs (do not regress)

- **`/projections`, `/complete`:** `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` only — rows come from `computeCompleteProjection` on server render.
- **`/my-estate-strategy` (tier 3):** inline `POST /api/consumer/generate-base-case` for `projection_scenarios` / horizons.
- Do **not** merge TIER2 and TIER3 lists — see comment block in `lib/planning/planningEmptyState.ts`.

---

## Files for Sprint 12

| Path | Notes |
|------|--------|
| `lib/dashboard/personaAlerts.ts` | Business thresholds + multi-state RE |
| `lib/dashboard/loaders.ts` | `situs_state` on `real_estate` |
| `lib/planning/planningEmptyState.ts` | TIER2 vs TIER3 CTAs |
| `app/(dashboard)/dashboard/page.tsx` | `personaAlerts` prop |
| `app/(dashboard)/_dashboard-client.tsx` | Alert banners |
| `lib/events/upgradeContext.ts` | A/B upgrade copy |
| `app/(public)/assess/` | A/B assessment gate |
