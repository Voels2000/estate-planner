# NEXT_SESSION.md
# Sprint 3 — Session Start Document
# Generated: May 2026 (Sprint 3 core shipped)

---

## Paste this as your FIRST MESSAGE in Cursor

> I am building My Wealth Maps, a self-guided estate and financial
> planning tool for households with $2M–$30M in assets. The engine
> is strong — we are doing UI and structural work only. Sprint 3 core
> is shipped: life_events table + API, dashboard LifeEventBanner,
> age-triggers cron, and event-personalized upgrade gates on locked
> pages. Remaining: engagement tracking, copy audit, email drip.
> Today's task: [FILL IN FROM REMAINING LIST BELOW].

---

## Sprint 3 — What shipped

| Task | Status | Notes |
|------|--------|-------|
| `life_events` table + RLS | ✅ Done | `supabase/migrations/20260521000000_create_life_events.sql` — **run in Supabase** |
| `POST/GET/PATCH /api/consumer/life-events` | ✅ Done | POST triggers `afterHouseholdWriteForOwner` |
| `LifeEventBanner` on dashboard | ✅ Done | `app/(dashboard)/_components/LifeEventBanner.tsx` |
| `app/api/cron/age-triggers` | ✅ Done | Daily 15:00 UTC in `vercel.json`; ages 62/65/70/73 → `approaching-retirement` |
| `lib/events/upgradeContext.ts` | ✅ Done | `getEventUpgradeValueProp()` |
| Event-personalized upgrade gates | ✅ Done | SS, Roth, RMD, Complete, My Family, Titling, Incapacity, Domicile |

## Sprint 3 — Remaining / backlog

| Task | Notes |
|------|-------|
| Run `life_events` migration in Supabase | Required before banner/API work in prod |
| Life event banner engagement tracking | Analytics not wired |
| Age trigger copy per milestone (62 vs 65 vs 70 vs 73) | All map to `approaching-retirement` slug today |
| In-app copy audit | Sprint 2 carryover |
| Email drip sequence | Needs ESP |
| Event pages in Search Console | Post-deploy |

---

## Key file paths (post–Sprint 3)

| Area | Path |
|------|------|
| Life event banner | `app/(dashboard)/_components/LifeEventBanner.tsx` |
| Life events API | `app/api/consumer/life-events/route.ts` |
| Life events table | Supabase: `life_events` |
| Age triggers cron | `app/api/cron/age-triggers/route.ts`, `vercel.json` |
| Upgrade copy helper | `lib/events/upgradeContext.ts` |
| Event slug validation | `lib/events/lifeEventSlugs.ts` |
| Dashboard fetch | `app/(dashboard)/dashboard/page.tsx` |
| Notification cron | `app/api/cron/notifications/route.ts` |

---

## Sprint 3 success criteria

- [x] Life event banner on dashboard
- [ ] Age triggers verified in test environment (after migration + cron deploy)
- [x] Event-personalized upgrade copy on 8+ locked pages
- [ ] No regression on existing upgrade gates (manual smoke)

---

## How to end each session

Ask: "Summarize what we completed today and update NEXT_SESSION.md with
remaining tasks and any new file paths discovered."

Commit the updated NEXT_SESSION.md alongside code changes.
