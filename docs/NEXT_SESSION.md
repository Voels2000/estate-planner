# NEXT_SESSION.md
# Sprint 9 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — $2M–$30M estate/financial planning. Sprints 0–8 shipped. Sprint 9
> partially shipped: signup attribution ✅, drip all 24 slugs ✅, permissive robots.ts ✅,
> RMD cohorts ✅. Sprint 9 **hard gates still open:** life-event-on-connect (advisor portal),
> Digital Assets FEATURE_TIERS key, SITE_URL audit.
> Sprint plan through Sprint 15 go-live now in ROADMAP.md.
> **Five decisions require Sprint 10 owner action** — see DECISION_LOG.md (A/B criteria,
> business succession, invite-your-advisor, "Ask your advisor" CTA, referral loop queries).
> Today's task: [FILL IN BELOW].

---

## Current sprint — Sprint 9 (Weeks 31–34)

**Goal:** Go live when ready; persist referral attribution through signup; optional drip expansion.

See [ROADMAP.md](./ROADMAP.md). Suggested order:

1. **Launch** — [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) (Search Console, domain, Resend, prod drip smoke test)
2. **Polish** — life-event context on advisor connections

---

## Sprint 9 partial ✅

| Area | What shipped |
|------|----------------|
| **Signup attribution** | `_signup-form.tsx` — reads/clears `mwm_referral_*` + `mwm_attorney_referral_*`; `profiles.referral_code` + `profiles.attorney_referral_code`; `account_created` funnel with both codes in `properties` (fire-and-forget profile write) |
| **Migration** | `20260529000000_profiles_referral_attribution.sql` |
| **Email drip** | `lib/emails/drip-templates.ts` — `DripEventSlug` + `EVENT_SEQUENCES` for all **24** event pages |
| **RMD cohorts** | `lib/calculations/rmdStartAge.ts` — 72/73/75 by birth year; advisor Retirement tab no longer hardcodes 73 |

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
| Drip (partial) | 12 custom sequences (expanded to 24 in Sprint 9) |
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

### Advisor polish (optional)

| File | Why |
|------|-----|
| `app/api/advisor/accept-request/route.ts` | Life-event context on new connections |
| `app/admin/funnel-tab.tsx` | Attorney referral click reporting (SQL join on `listing_type`) |

---

## Pre-launch

`app/robots.ts` allows public marketing routes + sitemap (deploy before Search Console). Remaining gates: **[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)** Section 1.

---

## Sprint 9 remaining hard gates (do not carry to Sprint 10)

- [ ] **Life-event context on advisor connect** — `app/api/advisor/accept-request/route.ts`;
  pass `life_events` context at accept time; verify in advisor portal Overview
- [ ] **Digital Assets `FEATURE_TIERS` key** — add to `lib/tiers.ts`; currently only `page.tsx` gate
- [ ] **`NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_APP_URL` audit** — find all remaining legacy
  references in email routes and replace

## Sprint 10 pre-work (owner decisions needed before Sprint 10 begins)

- [ ] **A/B decision criteria** — document metric + threshold + decision owner in DECISION_LOG
  for both `ab_upgrade_copy` and `ab_assessment_gate`. Must be set before Sprint 11.
- [ ] **Business succession** — choose Path A (ship minimal) or Path B (formal descope + remove
  dead code). Add DECISION_LOG entry. Remove commented-out sidebar route either way.
- [ ] **Invite-your-advisor** — choose launch gate or post-launch. Add DECISION_LOG entry.

## Sprint 10 backlog (after decisions above)

- [ ] Business $5M/$10M threshold alert (business owner persona)
- [ ] Multi-state RE probate-risk alert (RE accumulator persona)
- [ ] Confirm life-event-on-connect visible in advisor portal (if not shipped in Sprint 9)
- [ ] Event-specific dashboard alerts beyond LifeEventBanner (Sprint 3 deferred)
- [ ] Attorney portal readiness score (Sprint 4 deferred, optional)
- [ ] Admin funnel attorney click breakdown (optional, if time permits)

---

## Known limitations

- **Signup:** Both referral codes persisted at account creation; join `profiles.referral_code` → `advisor_directory`, `profiles.attorney_referral_code` → `attorney_listings`
- **Drip:** All 24 event slugs have custom sequences; `DEFAULT_SEQUENCE` only for unknown/null slugs
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
