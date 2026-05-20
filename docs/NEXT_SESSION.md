# NEXT_SESSION.md
# Sprint 6 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — $2M–$30M estate/financial planning. Sprints 0–5 shipped: 24 life event
> pages, Vercel + custom funnel analytics, A/B tests (assess gate + upgrade copy), advisor
> distribution, life events. Migrations are idempotent for re-run.
> **Current: Sprint 6** — reporting, attorney PDF, growth distribution.
> Today's task: [FILL IN BELOW].

---

## Current sprint — Sprint 6 (Weeks 19–22)

**Goal:** Measure and act on funnel data; finish attorney PDF export; start content distribution.

See [ROADMAP.md](./ROADMAP.md). Suggested order:

1. **Admin funnel views** — SQL or admin UI on `funnel_events` + `referral_clicks`
2. **Attorney PDF** — `variant=attorney` branch in `/api/export-estate-plan` + `EstatePlanPDF`
3. **SEO / distribution** — Search Console, email drip decision, advisor newsletter kit

---

## Sprint 5 completed ✅

| Area | What shipped |
|------|----------------|
| Vercel Analytics | `@vercel/analytics` + `<Analytics />` in `app/layout.tsx` |
| Custom funnel | `funnel_events`, `POST /api/analytics/funnel`, `lib/analytics/useFunnelEvent.ts` |
| Funnel steps | `event_page_view`, `event_assess_start/complete`, `email_captured`, `account_created`, `tier_upgraded`, `advisor_connected` |
| A/B tests | `app_config`: `ab_assessment_gate`, `ab_upgrade_copy`; `/assess` server gate; `upgradeContext` |
| Event content | 16 slugs in `lib/events/content-sprint5.ts` — **24 total** at `/event/[slug]` |
| Migrations | Idempotent RLS policies on `life_events`, `referral_clicks`, `funnel_events` |

---

## Migrations (prod — safe to re-run)

| File | Purpose |
|------|---------|
| `20260521000000_create_life_events.sql` | `life_events` |
| `20260522000000_advisor_referrals.sql` | `referral_code`, `referral_clicks` |
| `20260523000000_funnel_events.sql` | `funnel_events` |
| `20260523000001_app_config_ab_tests.sql` | A/B seed rows |

---

## Files you need for Sprint 6

### Analytics / reporting (start here)

| File | Why |
|------|-----|
| `app/api/analytics/funnel/route.ts` | Funnel insert contract |
| `lib/analytics/useFunnelEvent.ts` | Event names + client capture |
| `lib/analytics/abTests.ts` | `app_config` A/B readers |
| `supabase/migrations/20260523000000_funnel_events.sql` | Schema reference |
| `app/admin/page.tsx` | Extend or add funnel admin tab |
| `docs/DATABASE_SCHEMA_REFERENCE.md` | `funnel_events`, `referral_clicks` |

### Attorney PDF export

| File | Why |
|------|-----|
| `app/(dashboard)/print/_print-client.tsx` | Dual-mode UI |
| `components/pdf/ExportPDFButton.tsx` | Passes `variant=attorney` |
| `app/api/export-estate-plan/route.ts` | Add variant branch |
| `components/pdf/EstatePlanPDF.tsx` | Attorney summary layout |

### Growth / distribution (pick one track)

| File | Why |
|------|-----|
| `lib/events/content.ts` + `lib/events/content-sprint5.ts` | Event copy for newsletters |
| `app/(public)/event/[slug]/page.tsx` | SEO / JSON-LD |
| `app/api/email-capture/route.ts` | Drip hook point |
| `lib/events/referral.ts` | Advisor share URLs |

### Still useful context (Sprint 4–5)

| File | Why |
|------|-----|
| `app/advisor/page.tsx`, `_advisor-client.tsx` | Referral links |
| `app/(public)/event/[slug]/_referral-tracker.tsx` | `?ref=` + `event_page_view` |
| `app/(auth)/signup/_signup-form.tsx` | `account_created` funnel event |
| `app/api/stripe/webhook/route.ts` | `tier_upgraded` |
| `app/api/advisor/accept-request/route.ts` | `advisor_connected` |
| `lib/events/upgradeContext.ts` | Personalized upgrade copy |

---

## Sprint 6 backlog

- [ ] Admin funnel dashboard (conversion by `event_slug`, `referral_code`)
- [ ] Attorney PDF template for `variant=attorney`
- [ ] Email drip provider + sequences per event type
- [ ] Google Search Console indexing verification (24 event URLs)
- [ ] Per-age calendar trigger slugs (62/65/70/73) — today all `approaching-retirement`
- [ ] Life event context on new advisor connections
- [ ] Attorney `?ref=` on event pages (advisor-only today)

---

## How to end each session

Update this file, [ROADMAP.md](./ROADMAP.md), and master docs per [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md).
