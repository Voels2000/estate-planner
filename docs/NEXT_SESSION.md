# NEXT_SESSION.md
# Sprint 7 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — $2M–$30M estate/financial planning. Sprints 0–6 shipped: 24 life event
> pages, funnel analytics + admin Funnel tab, attorney PDF export, sitemap/robots, Resend
> 3-step email drip, A/B tests, advisor distribution. Canonical URL: `NEXT_PUBLIC_APP_URL`.
> **Current: Sprint 7** — funnel reporting, distribution; SEO blocked pre-launch (`robots.ts`).
> Today's task: [FILL IN BELOW].

---

## Current sprint — Sprint 7 (Weeks 23–26)

**Goal:** Deepen funnel reporting and distribution. **SEO / Search Console deferred until launch** — see [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

See [ROADMAP.md](./ROADMAP.md). Suggested order:

1. **Funnel reporting** — event → tier conversion; optional 30-day step counts in admin
2. **Distribution** — advisor newsletter kit; more drip sequences; attorney `?ref=` on events
3. **At launch only** — restore `robots.ts`, Search Console, submit `sitemap.xml`, domain cutover

---

## Sprint 6 completed ✅

| Area | What shipped |
|------|----------------|
| Admin funnel | `app/admin/funnel-tab.tsx` — conversion viz, by-slug/referral tables, recent feed, SQL cheat sheet; data via `createAdminClient()` |
| Attorney PDF | `AttorneyEstatePlanPDF` + `variant=attorney` in `/api/export-estate-plan` (conflicts, assets, tax) |
| SEO | `app/sitemap.ts` ready; `app/robots.ts` permissive version in git before pre-launch block |
| Proxy | `proxy.ts` — `/education`, `/sitemap.xml`, `/robots.txt` in `PUBLIC_PATHS` |
| Search Console | `app/layout.tsx` — `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (set at launch) |
| Email drip | Resend — `lib/emails/drip-templates.ts`, `POST /api/email/drip`, unsubscribe route, cron steps 2–3, step 1 on capture |
| Schema | `20260524000000_email_captures_drip.sql` — drip sent timestamps + `unsubscribed_at` |
| Auth | `INTERNAL_API_KEY` for internal drip calls; `CRON_SECRET` also accepted on drip route |

---

## Migrations (prod — safe to re-run)

| File | Purpose |
|------|---------|
| `20260521000000_create_life_events.sql` | `life_events` |
| `20260522000000_advisor_referrals.sql` | `referral_code`, `referral_clicks` |
| `20260523000000_funnel_events.sql` | `funnel_events` |
| `20260523000001_app_config_ab_tests.sql` | A/B seed rows |
| `20260524000000_email_captures_drip.sql` | Drip + unsubscribe columns on `email_captures` |

---

## Vercel / env (Production)

Set in dashboard before drip + sitemap go live:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://estate-planner-gules.vercel.app` (→ `https://mywealthmaps.com` at domain cutover) |
| `RESEND_API_KEY` | From resend.com |
| `INTERNAL_API_KEY` | Same hex as `.env.local` (must match for drip + cron) |
| `CRON_SECRET` | Already required for notifications cron |

Verify domain `hello@mywealthmaps.com` in Resend (or change `from` in drip route).

---

## Files you need for Sprint 7

### SEO (at launch only)

| File | Why |
|------|-----|
| `app/robots.ts` | Restore allow/disallow rules + uncomment sitemap (see `fb6aa9b` era) |
| `app/sitemap.ts` | Submit `/sitemap.xml` in Search Console |
| `app/layout.tsx` | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in Vercel |
| `proxy.ts` | `PUBLIC_PATHS` already includes `/education`, `/sitemap.xml`, `/robots.txt` |

### Funnel / reporting

| File | Why |
|------|-----|
| `app/admin/funnel-tab.tsx` | Extend step counts (full 30d query) or tier join |
| `app/api/analytics/funnel/route.ts` | Event contract |
| `supabase/migrations/20260523000000_funnel_events.sql` | Join to `profiles` for tier report |

### Email drip expansion

| File | Why |
|------|-----|
| `lib/emails/drip-templates.ts` | Add sequences for remaining top slugs |
| `app/api/email/drip/route.ts` | Send + log contract |
| `app/api/cron/notifications/route.ts` | Steps 2–3 timing |
| `app/api/email-capture/route.ts` | Step 1 trigger |

### Distribution

| File | Why |
|------|-----|
| `lib/events/referral.ts` | Advisor share URLs for newsletter kit |
| `app/(public)/event/[slug]/_referral-tracker.tsx` | Pattern for attorney `?ref=` |

---

## Pre-launch (SEO blocked)

`app/robots.ts` currently **disallows `/` for all crawlers**. `app/sitemap.ts` remains ready but is not linked from robots until launch. Search Console setup deferred.

**Launch tasks:** tracked in **[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)** (SEO, domain, Resend, ops confirmation). Update that file when items complete.

---

## Sprint 7 backlog

- [ ] ~~Google Search Console~~ — deferred to launch ([LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md))
- [ ] Admin funnel — full 30-day step counts (today viz uses last 50 events)
- [ ] Event → tier conversion report (`funnel_events` ↔ `profiles.consumer_tier`)
- [ ] Drip sequences for more event slugs (only 3 custom + default today)
- [ ] Advisor newsletter kit (copy + links from `lib/events/referral.ts`)
- [ ] Attorney `?ref=` on event pages (advisor-only `?ref=` today)
- [ ] `EVENT_UPGRADE_COPY` for 16 Sprint 5 slugs in `upgradeContext.ts`
- [ ] Per-age calendar trigger slugs (62/65/70/73) — today all `approaching-retirement`

---

## Known limitations (carry forward)

- Admin funnel bar chart counts from **last 50 events**; slug/referral tables use **30-day** data.
- Drip `from` address must be verified in Resend.
- `NEXT_PUBLIC_SITE_URL` still appears in some routes — prefer `NEXT_PUBLIC_APP_URL` for new work.

---

## How to end each session

Update this file, [ROADMAP.md](./ROADMAP.md), and master docs per [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md).
