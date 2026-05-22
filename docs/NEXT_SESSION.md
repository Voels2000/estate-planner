# NEXT_SESSION.md
# Sprint 9 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — $2M–$30M estate/financial planning. Sprints 0–8 shipped: 24 event pages,
> advisor + attorney referral (`?ref=` / `?aref=`), newsletter kits on both portals, admin funnel
> with tier conversion, 12 custom drip sequences, attorney PDF, Resend drip. SEO blocked
> pre-launch — see [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).
> **Current: Sprint 9** — launch ops, drip polish (signup attribution ✅).
> Today's task: [FILL IN BELOW].

---

## Current sprint — Sprint 9 (Weeks 31–34)

**Goal:** Go live when ready; persist referral attribution through signup; optional drip expansion.

See [ROADMAP.md](./ROADMAP.md). Suggested order:

1. **Launch** — [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) (robots, Search Console, domain, Resend)
2. **Polish** — drip for 12 slugs outside `DripEventSlug`; life-event context on advisor connections

---

## Sprint 9 partial ✅

| Area | What shipped |
|------|----------------|
| **Signup attribution** | `_signup-form.tsx` — reads/clears `mwm_referral_*` + `mwm_attorney_referral_*`; `profiles.referral_code` + `profiles.attorney_referral_code`; `account_created` funnel with both codes in `properties` (fire-and-forget profile write) |
| **Migration** | `20260529000000_profiles_referral_attribution.sql` |

---

## Sprint 8 completed ✅

| Area | What shipped |
|------|----------------|
| **Migration** | `20260528000000_attorney_referrals.sql` — `attorney_listings.referral_code`; `referral_clicks.listing_type`, `attorney_listing_id`, `attorney_profile_id`; attorney RLS read policy |
| **Track API** | `POST /api/referral/track` — `type: 'advisor' \| 'attorney'`; advisor path unchanged; attorney resolves `attorney_listings` |
| **Event pages** | `_referral-tracker.tsx` — `?aref=` + `mwm_attorney_referral_*` sessionStorage; `?ref=` unchanged |
| **Referral URLs** | `buildAttorneyReferralUrl`, `buildAllAttorneyEventReferralUrls` (24 slugs, `?aref=`) |
| **Attorney portal** | `page.tsx` loads `referral_code`; `_attorney-dashboard-client.tsx` — three-tab newsletter kit (blue styling) |

**Apply migration in prod** before attorney portal links work.

---

## Sprint 7 completed ✅ (reference)

| Area | What shipped |
|------|----------------|
| Admin funnel | 30-day counts + tier conversion; By Tier tab |
| Advisor newsletter kit | 24 `?ref=` URLs |
| Drip | All 12 `DripEventSlug` union members sequenced |
| Upgrade copy | All 24 slugs |
| Age triggers | Per-age event slugs (62/65/70/73) |

---

## Migrations (prod — safe to re-run)

| File | Purpose |
|------|---------|
| `20260521000000_create_life_events.sql` | `life_events` |
| `20260522000000_advisor_referrals.sql` | `advisor_directory.referral_code`, `referral_clicks` (advisor FK) |
| `20260523000000_funnel_events.sql` | `funnel_events` |
| `20260523000001_app_config_ab_tests.sql` | A/B seed rows |
| `20260524000000_email_captures_drip.sql` | Drip + unsubscribe columns |
| `20260528000000_attorney_referrals.sql` | `attorney_listings.referral_code`; attorney columns on `referral_clicks` |
| `20260529000000_profiles_referral_attribution.sql` | `profiles.referral_code`, `profiles.attorney_referral_code` |

---

## Vercel / env (Production)

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | Vercel Production (→ `https://mywealthmaps.com` at launch) |
| `RESEND_API_KEY` | Required for drip |
| `INTERNAL_API_KEY` | Drip + cron internal calls |
| `CRON_SECRET` | Notifications + age-triggers crons |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Set at launch only |

---

## Files required for Sprint 9

### Launch

| File | Why |
|------|-----|
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Go-live checklist |
| `app/robots.ts` | Restore allow rules + sitemap |
| `app/layout.tsx` | Search Console verification env |

### Drip expansion (optional)

| File | Why |
|------|-----|
| `lib/emails/drip-templates.ts` | Extend `DripEventSlug` + sequences for 12 non-union slugs |

### Advisor polish (optional)

| File | Why |
|------|-----|
| `app/api/advisor/accept-request/route.ts` | Life-event context on new connections |
| `app/admin/funnel-tab.tsx` | Attorney referral click reporting (SQL join on `listing_type`) |

---

## Pre-launch (unchanged)

`app/robots.ts` blocks all crawlers. **[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)**.

---

## Sprint 9 backlog

- [ ] Launch checklist (Search Console, domain, Resend, permissive robots)
- [x] Signup persistence for advisor + attorney referral session keys (Sprint 9)
- [ ] Drip sequences for 12 slugs outside `DripEventSlug` union
- [ ] Life event context on new advisor connections
- [ ] Segment-specific dashboard alerts
- [ ] Admin funnel: attorney click breakdown (`referral_clicks.listing_type = 'attorney'`)

---

## Known limitations

- **Signup:** Both referral codes persisted at account creation; join `profiles.referral_code` → `advisor_directory`, `profiles.attorney_referral_code` → `attorney_listings`
- **Drip:** 12 event pages outside `DripEventSlug` still use `DEFAULT_SEQUENCE`
- **Attorney listing:** Needs `profile_id` + migration-applied `referral_code` for portal kit to appear
- `NEXT_PUBLIC_SITE_URL` in some legacy email routes — prefer `NEXT_PUBLIC_APP_URL`

---

## Referral URL reference

| Role | Param | Example |
|------|-------|---------|
| Advisor | `?ref=` | `/event/selling-a-business?ref=abc12def` |
| Attorney | `?aref=` | `/event/selling-a-business?aref=xyz98wuv` |

---

## How to end each session

Update this file, [ROADMAP.md](./ROADMAP.md), [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md), and master docs per [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md).
