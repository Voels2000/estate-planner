# NEXT_SESSION.md
# Sprint 5 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — $2M–$30M estate/financial planning. Sprints 0–4 shipped
> (public funnel, 8 event pages, life events, advisor/attorney distribution batch).
> **Current: Sprint 5** — analytics, A/B tests, remaining 17 event pages.
> Run pending Supabase migrations if not applied in prod.
> Today's task: [FILL IN BELOW].

---

## Current sprint — Sprint 5 (Weeks 15–18)

**Goal:** Full funnel measured, A/B tests running, remaining 17 event pages published.

See [ROADMAP.md](./ROADMAP.md) for full checklist. Priority order:

1. **Analytics** — event page → assessment → email → account → tier → advisor connect → retention
2. **A/B** — event-personalized upgrade copy vs generic; assessment gate variants
3. **Content** — 17 event slugs in `lib/events/content.ts` + SSG pages (today: 8 published)

---

## Recently shipped (Sprint 4 — advisor/attorney distribution) ✅

| Task | Path / notes |
|------|----------------|
| Invite your advisor (no-connection) | `my-advisor/page.tsx`, `_my-advisor-client.tsx` |
| Advisor notified on client life event | `POST /api/consumer/life-events` + `create_notification` |
| Life event banner — share / find advisor | `LifeEventBanner.tsx`, `dashboard/page.tsx` |
| Event `?ref=` tracking | `_referral-tracker.tsx`, `/api/referral/track`, `lib/events/referral.ts` |
| Advisor referral links in portal | `app/advisor/page.tsx`, `_advisor-client.tsx` |
| Cron backup life-event advisor notify | Job 6 in `/api/cron/notifications` |
| Attorney-ready export UI | `print/_print-client.tsx`, `ExportPDFButton` `variant=attorney` |
| Plan readiness (advisor client view) | `PlanReadinessCard.tsx` → Overview tab |
| `advisor_directory` canonical table | All listing/referral queries; migration `20260522000000` |

## Recently shipped (Sprint 3) ✅

| Task | Path / notes |
|------|----------------|
| `life_events` + API + banner | `20260521000000`, `/api/consumer/life-events` |
| Age triggers cron | `/api/cron/age-triggers`, `vercel.json` 15:00 UTC |
| Event-personalized upgrade gates | `lib/events/upgradeContext.ts` |

---

## Pending migrations (run in Supabase if not applied)

1. `20260521000000_create_life_events.sql`
2. `20260522000000_advisor_referrals.sql` — `advisor_directory.referral_code`, `referral_clicks`

---

## Key paths (Sprint 5 work)

| Area | Path |
|------|------|
| Event content (add 17) | `lib/events/content.ts`, `lib/events/types.ts` |
| Event pages | `app/(public)/event/[slug]/page.tsx`, `assess/page.tsx` |
| Referral / attribution | `lib/events/referral.ts`, `app/api/referral/track/route.ts` |
| Upgrade A/B | `UpgradeBanner`, `lib/events/upgradeContext.ts` |
| Analytics (TBD) | instrument funnel events — no central module yet |
| Print / attorney PDF | `print/_print-client.tsx`, `components/pdf/ExportPDFButton.tsx`, `/api/export-estate-plan` |
| Advisor client readiness | `app/advisor/clients/[clientId]/_components/PlanReadinessCard.tsx` |

---

## Sprint 5 backlog (from ROADMAP)

- [ ] Full funnel instrumentation
- [ ] Event source attribution (conversion + LTV by slug)
- [ ] A/B: personalized upgrade copy vs generic
- [ ] A/B: assessment gate (score visible vs full gate)
- [ ] 17 remaining event pages (see ROADMAP list)
- [ ] Attorney PDF template for `variant=attorney`
- [ ] Signup attribution from `mwm_referral_code` / sessionStorage
- [ ] Per-age event slugs for age-triggers (62/65/70/73)
- [ ] Email drip; Search Console indexing

---

## How to end each session

Summarize completed work; update this file, `ROADMAP.md`, and master docs per [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md).
