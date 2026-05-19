# NEXT_SESSION.md
# Sprint 3 — Session Start Document
# Generated: May 2026 (Sprint 2 complete)

---

## Paste this as your FIRST MESSAGE in Cursor

> I am building My Wealth Maps, a self-guided estate and financial
> planning tool for households with $2M–$30M in assets. The engine
> is strong — we are doing UI and structural work only. Sprint 2
> is complete: public nav, homepage/pricing segment copy, 8 life
> event pages, event-specific assessments, email capture, and
> assessment gating. Sprint 3 goal: in-app life event logging,
> age-based calendar triggers, and segment-specific alerts.
> Today's task: [FILL IN FROM TASK LIST BELOW].

---

## Sprint 2 — What shipped

| Task | Status | Notes |
|------|--------|-------|
| Shared public top nav | ✅ Done | `app/(public)/layout.tsx` |
| Homepage $2M–$30M hero + life events entry | ✅ Done | `app/page.tsx` |
| Social proof section on homepage | ✅ Done | Illustrative — swap real quotes when available |
| Pricing vs professional fees | ✅ Done | Moved to `app/(public)/pricing/page.tsx` |
| `lib/events/types.ts` + `lib/events/content.ts` | ✅ Done | 8 events, typed schema |
| `/event/[slug]` dynamic route | ✅ Done | SSG, schema.org JSON-LD, action plan, CTAs |
| `/event/[slug]/assess` event-specific assessment | ✅ Done | 5 questions, scoring, gap detection, email capture |
| Assessment teaser → event-specific route | ✅ Done | |
| `app/api/email-capture` route | ✅ Done | Saves to `email_captures` table |
| `email_captures` table + RLS | ✅ Done | Run migration in Supabase |
| Assessment score visible without login | ✅ Done | Score + pillar breakdown public; gap report gated |
| `/pricing` moved under `(public)` | ✅ Done | Shared nav, no inline nav |

## Remaining Sprint 2 carryover → Sprint 3 backlog

| Task | Notes |
|------|-------|
| In-app copy audit | Remove "teaser," "simple," "rule-of-thumb" language |
| Transfer Strategy tooltips + IRS rate auto-populate | |
| "Invite your advisor" onboarding step | Sprint 4 core but can start here |
| Email drip sequence (3 emails per event type) | Needs provider decision first |
| Event pages indexed in Search Console | Post-deploy verification |

---

## Key file paths (post–Sprint 2)

| Area | Path |
|------|------|
| Public layout + nav | `app/(public)/layout.tsx` |
| Life event pages | `app/(public)/event/[slug]/page.tsx` |
| Event assessments | `app/(public)/event/[slug]/assess/page.tsx` |
| Event content | `lib/events/types.ts`, `lib/events/content.ts` |
| Email capture API | `app/api/email-capture/route.ts` |
| Email captures table | Supabase: `email_captures` |
| Marketing landing | `app/page.tsx` |
| Pricing | `app/(public)/pricing/page.tsx` |
| General assessment | `app/(public)/assess/page.tsx` |

---

## Sprint 3 — Task list (in order)

### Task 1 — `life_events` table + API

```sql
create table life_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  event_type text not null,
  event_date date,
  acknowledged boolean default false,
  source text default 'user', -- 'user' | 'calendar_trigger'
  created_at timestamptz default now()
);
alter table life_events enable row level security;
create policy "Users own their events"
  on life_events for all
  using (auth.uid() = user_id);
```

API: `POST /api/consumer/life-events` → insert row + trigger `afterHouseholdWrite`

### Task 2 — Dashboard life event banner

File: `app/(dashboard)/dashboard/_components/LifeEventBanner.tsx`

"Did something change in your life? Log a life event and we'll update your plan."
Event picker: dropdown of 8 slugs mapped to display labels.
On submit: POST to API, then `router.refresh()`.

### Task 3 — Age-based calendar triggers

File: `app/api/cron/age-triggers/route.ts`

Cron (daily): query `households` for birth years hitting milestone ages this calendar year.
Insert `life_events` rows with `source='calendar_trigger'` for:
- Age 62 → `approaching-retirement` (SS window opens)
- Age 65 → Medicare enrollment
- Age 70 → Roth conversion window closing
- Age 73 → RMD start

### Task 4 — Event-personalized upgrade gates

When a `life_events` row exists, inject event context into `UpgradeBanner` `valueProposition` on locked pages.

---

## Sprint 3 success criteria

- [ ] Life event banner on dashboard — engagement rate tracked
- [ ] Age triggers fire correctly in test environment
- [ ] Event-personalized upgrade copy live on at least 2 locked pages
- [ ] No regression on existing upgrade gates

---

## How to end each session

Ask: "Summarize what we completed today and update NEXT_SESSION.md with
remaining Sprint 3 tasks and any new file paths discovered."

Commit the updated NEXT_SESSION.md alongside code changes.
