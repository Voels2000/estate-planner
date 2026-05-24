# Consumer navigation map

Canonical reference for **sidebar label**, **URL**, **page title** (`<h1>`), and **minimum tier**.  
Update this file when adding or renaming consumer routes (Phase A — Session 115; trust merge — Session 116).

**User journeys (routes → APIs → gates → recompute):** see [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md).

**Tier legend:** 1 = Financial, 2 = Retirement, 3 = Estate (see `lib/tiers.ts`).

**Feature key legend:**

| Value | Meaning |
|-------|---------|
| `profile`, `dashboard`, … | Listed in `FEATURE_TIERS` (`lib/tiers.ts`); sidebar uses `getUserAccess().tier` vs minimum tier |
| — (dash) | **Intentionally no `FEATURE_TIERS` key** — route still tier-gated in `page.tsx` (e.g. `access.tier < 3` → `UpgradeBanner`) or not subscription-gated (marketing, connections) |
| Sub-tabs | Not separate routes — documented under parent in [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) (e.g. trust-strategy `?tab=`) |

---

## Sidebar footer (consumer layout)

Rendered in `app/(dashboard)/_components/sidebar-nav.tsx` **below** the main planning nav (`<nav>` scroll area), above Sign out. Sprint 1: **My Attorney** moved here from Overview.

| Link | Visible when | Target | Notes |
|------|----------------|--------|--------|
| 📖 Education Guide | `role === 'consumer'` **or** `isSuperuser` | `/education` | Platform resource; public (no login required); sidebar link when signed in. Education pages use **education header only** (marketing `PublicNav` skipped on `/education/*`). |
| 👤 My Advisor | `role === 'consumer'` **or** `isSuperuser` | `/my-advisor` | Connection management; lock when `isLockedUser` |
| ⚖️ My Attorney | `role === 'consumer'` **or** `isSuperuser`, **tier ≥ 2** | `/my-attorney` | Lock when `isLockedUser` or tier &lt; 2 |
| 💳 Manage Subscription | All signed-in users | `/billing` | Lock when `isLockedUser` |
| 🚪 Sign out | All signed-in users | (auth sign-out) | Second footer block, separated by border |

Locked accounts (`isLockedUser`): My Advisor, My Attorney, and Manage Subscription render disabled with 🔒. Education Guide stays enabled.

## Sidebar portal links (consumer layout)

Rendered at the **bottom** of the main `<nav>` scroll area (above the footer block).

| Link | Visible when | Target | Notes |
|------|----------------|--------|--------|
| 💼 Advisor Portal | `role === 'advisor'` **or** `isSuperuser` | `/advisor` | Professional users switching hats; not shown to consumer-only accounts |
| ⚖️ Attorney Portal | `role === 'attorney'` **or** `isAttorney` **or** `isSuperuser` | `/attorney` | Same pattern |
| ⚙️ Admin Portal | `role !== 'consumer'` **and** (`role === 'admin'` **or** `isAdmin` **or** `isSuperuser`) | `/admin` | Tabs include **Funnel** (conversion by slug/referral) |

Locked accounts (`isLockedUser`): portal links render disabled with 🔒.

**Consumers never see** Advisor, Attorney, or Admin portal links — including Playwright accounts that had `is_superuser` for tier unlocks (`scripts/seed-test-consumer-estate.ts` clears that flag).

---

## Overview (app sidebar only)

| Sidebar label | Route | Page title | Tier | Feature key |
|---------------|-------|------------|------|-------------|
| Profile | `/profile` | Your Profile | 1 | `profile` |
| Estate Summary | `/dashboard` | (dashboard sections) | 1 | `dashboard` |

**Not in app sidebar (public / marketing):**

| Label | Route | Layout | Notes |
|-------|-------|--------|--------|
| Home | `/` | Root `app/page.tsx` | Marketing landing; **own** inline nav (not `(public)` layout) |
| Pricing | `/pricing` | `(public)/pricing` | Shared `(public)` nav |
| Planning Assessment | `/assess` | `(public)/assess/page.tsx` + `_assess-client.tsx` | Logged-out: scores visible, gap report gated; `localStorage` pending assessment |
| Find an Advisor | `/find-advisor` | `(public)/find-advisor` | Shared `(public)` nav |
| Find an Attorney | `/find-attorney` | `(public)/find-attorney` | Shared `(public)` nav |
| Privacy Policy | `/privacy` | `(public)/privacy` | `LegalFooterLinks` in public footer; WCPA structure (Sprint C-5) |
| Terms of Service | `/terms` | `(public)/terms` | `LegalFooterLinks`; post-checkout accept at `/terms/accept` (Sprint C-5) |

**Life event pages (`app/(public)/event/[slug]/`):**

| Route | Page title (hero) | Tier | Notes |
|-------|-------------------|------|--------|
| `/event/selling-a-business` | Business sale | — | Public; SSG |
| `/event/death-of-spouse` | Death of a spouse | — | Public; SSG |
| `/event/serious-diagnosis` | Serious health diagnosis | — | Public; SSG |
| `/event/receiving-inheritance` | Receiving an inheritance | — | Public; SSG |
| `/event/divorce` | Divorce | — | Public; SSG |
| `/event/approaching-retirement` | Approaching retirement | — | Public; SSG |
| `/event/large-rsu-vest` | RSU / liquidity event | — | Public; SSG |
| `/event/new-child-grandchild` | New child or grandchild | — | Public; SSG |

Content: `lib/events/content.ts` + `lib/events/content-sprint5.ts` (24 slugs). Assessment teaser → `/event/[slug]/assess`. Funnel: `_referral-tracker.tsx` + `useFunnelEvent`.

| Route | Notes |
|-------|--------|
| `/event/[slug]/assess` | Event-specific readiness assessment; email capture when logged out; saves to `assessment_results` when logged in |

**Connections (footer, not Overview):**

| Label | Route | Tier | Notes |
|-------|-------|------|--------|
| My Attorney | `/my-attorney` | 2+ | Sidebar footer |
| Attorney access settings | `/settings/attorney-access` | 2 | Reachable from My Attorney / settings; not in sidebar |

---

## Financial Planning

| Sidebar label | Route | Page title | Tier | Feature key |
|---------------|-------|------------|------|-------------|
| Income | `/income` | Income | 1 | `income` |
| Expenses | `/expenses` | Expenses | 1 | `expenses` |
| Assets | `/assets` | Assets | 1 | `assets` |
| Real Estate | `/real-estate` | Real Estate | 1 | `real-estate` |
| Business Interests | `/businesses` | Business Interests | 1 | `businesses` |
| Digital Assets | `/digital-assets` | Digital Assets | 2 | `digital-assets` |
| Business Succession | `/business-succession` | Business Succession | 3 | `business-succession` |
| Liabilities | `/liabilities` | Liabilities | 1 | `liabilities` |
| Life & Estate Insurance | `/insurance` | Life & Estate Insurance | 1 | `insurance` |
| Property & Casualty | `/property-casualty` | Property & Casualty Insurance | 1 | `insurance` |
| Asset Allocation | `/allocation` | Asset Allocation | 2 | `allocation` |
| Projections | `/projections` | Projections | 1 | `projections` |
| Scenarios | `/scenarios` | Scenarios | 1 | `scenarios` |

**Redirects (legacy URLs):**

| Old route | Redirects to |
|-----------|----------------|
| `/asset-allocation` | `/allocation` |

---

## Retirement Planning

| Sidebar label | Route | Page title | Tier | Feature key |
|---------------|-------|------------|------|-------------|
| Social Security | `/social-security` | Social Security | 2 | `social-security` |
| RMD Calculator | `/rmd` | RMD Calculator | 2 | `rmd` |
| Roth Conversion | `/roth` | Roth Conversion | 2 | `roth` |
| Lifetime Snapshot | `/complete` | Lifetime Snapshot | 2 | `complete` |
| Monte Carlo | `/monte-carlo` | Monte Carlo Simulations | 2 | `monte-carlo` |

---

## Estate Planning

| Sidebar label | Route | Page title | Tier | Feature key |
|---------------|-------|------------|------|-------------|
| My Family | `/my-family` | My Family | 3 | `my-family` |
| Titling & Beneficiaries | `/titling` | Titling & Beneficiaries | 3 | `titling` |
| Incapacity Planning | `/incapacity-planning` | Incapacity Planning | 3 | `incapacity` |
| Domicile Analysis | `/domicile-analysis` | Domicile Analysis | 3 | `domicile-analysis` |
| Estate Tax Snapshot | `/estate-tax` | Estate Tax Snapshot | 3 | `estate-tax` |
| Estate Value and Tax Horizons | `/my-estate-strategy` | Estate Value and Tax Horizons | 3 | — (tier 3 + profile gate in `page.tsx`; no sidebar `FEATURE_TIERS` key) |
| Gifting, Strategies & Trusts | `/my-estate-trust-strategy?tab=trusts` | Gifting, Strategies & Trusts | 3 | — (tier 3 + profile gate; tabs via `?tab=` not feature keys) |

---

## Not in sidebar (linked from dashboard or flows)

| Route | Page title | Tier | Notes |
|-------|------------|------|--------|
| `/trust-will` | — | 3 | Redirects to `/my-estate-trust-strategy?tab=trusts` (trust list, recommendations, checklist) |
| `/health-check` | Estate Health Check | — | Linked from dashboard / onboarding |
| `/import` | Import Data | 2 | |
| `/print` | Export Estate Plan (full + attorney summary modes, tier 3+) | — | |
| `/my-advisor` | My Advisor | — | Connection UI; not tier-gated (sidebar link for `role === 'consumer'`) |
| `/my-advisor-directory` | Find a Financial Advisor | — | |
| `/unlock-estate` | — | — | Upgrade flow |
| `/onboarding/invite-advisor` | Invite your advisor | — | Post-profile gate; not in sidebar |
| `/referrals` | Attorney referral | — | |

---

## Advisor portal (separate app tree)

Consumer advisors use **`/advisor`** (not `(dashboard)`). Client workspace: `/advisor/clients/[clientId]?tab=…`.  
See `docs/MASTER_ARCHITECTURE.md` for advisor tab layout.
