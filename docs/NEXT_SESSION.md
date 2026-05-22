# NEXT_SESSION.md
# Sprint 8 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — $2M–$30M estate/financial planning. Sprints 0–7 shipped: 24 event pages,
> admin funnel (30-day counts + tier conversion), advisor newsletter kit, 12 custom drip
> sequences, per-age calendar triggers, upgrade copy for all 24 slugs, attorney PDF, Resend drip.
> SEO blocked pre-launch — see [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).
> **Current: Sprint 8** — attorney referral attribution, launch ops, product polish.
> Today's task: [FILL IN BELOW].

---

## Current sprint — Sprint 8 (Weeks 27–30)

**Goal:** Attorney event attribution, optional launch execution, and remaining distribution/personalization gaps.

See [ROADMAP.md](./ROADMAP.md). Suggested order:

1. **Attorney `?ref=`** — `attorney_listings.referral_code` + track API + event tracker (no `attorney_directory` table exists today)
2. **Launch** — when ready: [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) (robots, Search Console, domain, Resend)
3. **Polish** — drip for remaining 12 event slugs; signup `mwm_referral_code` attribution; advisor connection life-event context

---

## Sprint 7 completed ✅

| Area | What shipped |
|------|----------------|
| Admin funnel depth | `funnelStepCounts` (30-day bar chart); `tierConversion` by `consumer_tier`; **By Tier** tab in `funnel-tab.tsx` |
| Advisor newsletter kit | `app/advisor/_advisor-client.tsx` — grouped links, email + plain-text templates; `buildAllEventReferralUrls` all **24** slugs |
| Email drip expansion | `EVENT_SEQUENCES` — **12** event-specific 3-email sequences (`DripEventSlug` union); other slugs use default |
| Upgrade copy | `EVENT_UPGRADE_COPY` — tier 2/3 copy for all **24** slugs in `upgradeContext.ts` |
| Age triggers | `app/api/cron/age-triggers/route.ts` — 62→`social-security-timing`, 65→`medicare-eligibility`, 70/73→`rmd-start-age` |

---

## Sprint 6 completed ✅ (reference)

| Area | What shipped |
|------|----------------|
| Admin funnel | `app/admin/funnel-tab.tsx` + `createAdminClient()` funnel fetch |
| Attorney PDF | `AttorneyEstatePlanPDF` + `variant=attorney` |
| SEO prep | `app/sitemap.ts`; `robots.ts` pre-launch block; `proxy.ts` public paths |
| Email drip | Resend + `20260524000000_email_captures_drip.sql` |
| Docs | [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) |

---

## Migrations (prod — safe to re-run)

| File | Purpose |
|------|---------|
| `20260521000000_create_life_events.sql` | `life_events` |
| `20260522000000_advisor_referrals.sql` | `advisor_directory.referral_code`, `referral_clicks` |
| `20260523000000_funnel_events.sql` | `funnel_events` |
| `20260523000001_app_config_ab_tests.sql` | A/B seed rows |
| `20260524000000_email_captures_drip.sql` | Drip + unsubscribe columns |

**Likely Sprint 8:** new migration for `attorney_listings.referral_code` (and optional `attorney_referral_clicks` or extended `referral_clicks`).

---

## Vercel / env (Production)

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | Vercel Production (→ `https://mywealthmaps.com` at launch) |
| `RESEND_API_KEY` | Required for drip |
| `INTERNAL_API_KEY` | Must match drip + cron internal calls |
| `CRON_SECRET` | Notifications + age-triggers crons |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Set at launch only |

---

## Files required for Sprint 8

### Attorney referral (start here)

| File | Why |
|------|-----|
| `supabase/migrations/` (new) | `attorney_listings.referral_code`; optional attorney click table |
| `app/api/referral/track/route.ts` | Branch: resolve `advisor_directory` vs `attorney_listings` |
| `app/(public)/event/[slug]/_referral-tracker.tsx` | Optional `?aref=` or shared `?ref=` with type discrimination |
| `lib/events/referral.ts` | `buildAttorneyReferralUrl`, attorney portal share UI |
| `app/(attorney)/attorney/page.tsx` (or shell) | Newsletter-style links for attorneys (mirror advisor kit) |
| `docs/DATABASE_SCHEMA_REFERENCE.md` | Document `attorney_listings` (not `attorney_directory`) |

### Launch (ops + small code)

| File | Why |
|------|-----|
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Single checklist — check off as done |
| `app/robots.ts` | Restore permissive rules + uncomment sitemap |
| `app/layout.tsx` | Verification meta via env |

### Distribution / attribution polish

| File | Why |
|------|-----|
| `lib/emails/drip-templates.ts` | Custom sequences for remaining 12 event slugs (Sprint 5-only pages still on `DEFAULT_SEQUENCE`) |
| `app/(auth)/signup/_signup-form.tsx` | Persist `mwm_referral_code` / slug on profile or funnel |
| `app/api/advisor/accept-request/route.ts` (or connect flow) | Life-event context when advisor accepts client |
| `lib/events/content.ts` | `EVENT_SLUGS` — 24 slugs reference |

### Funnel / admin (optional)

| File | Why |
|------|-----|
| `app/admin/funnel-tab.tsx` | Export CSV; funnel→paid tier SQL in admin UI |
| `app/admin/page.tsx` | Server-side tier join already wired |

### Still useful context

| File | Why |
|------|-----|
| `lib/events/lifeEventSlugs.ts` | Validates `life_events.event_type` against `EVENT_SLUGS` |
| `lib/events/upgradeContext.ts` | Personalized upgrade gates |
| `app/api/cron/age-triggers/route.ts` | Daily age milestone inserts |

---

## Pre-launch (unchanged)

`app/robots.ts` blocks all crawlers. Launch steps: **[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)**.

---

## Sprint 8 backlog

- [ ] Attorney referral — migration + API + portal share links
- [ ] Launch checklist execution (Search Console, domain, Resend domain verify)
- [ ] Drip sequences for 12 remaining event slugs (optional; default drip works today)
- [ ] Signup attribution from `mwm_referral_code` to profile/advisor link
- [ ] Life event context on new advisor connections
- [ ] Segment-specific dashboard alerts (business $5M, multi-state RE)

---

## Known limitations

- `attorney_listings` has no `referral_code`; `?ref=` on events only resolves advisors
- Drip `DripEventSlug` covers 12 slugs; other 12 event pages use `DEFAULT_SEQUENCE`
- `NEXT_PUBLIC_SITE_URL` still in some legacy routes — prefer `NEXT_PUBLIC_APP_URL`

---

## How to end each session

Update this file, [ROADMAP.md](./ROADMAP.md), [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) (launch items), and master docs per [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md).
