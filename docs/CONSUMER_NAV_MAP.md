# Consumer navigation map

Canonical reference for **sidebar label**, **URL**, **page title** (`<h1>`), and **minimum tier**.  
Update this file when adding or renaming consumer routes (Phase A — Session 115).

**Tier legend:** 1 = Financial, 2 = Retirement, 3 = Estate (see `lib/tiers.ts`).

---

## Overview

| Sidebar label | Route | Page title | Tier | Feature key |
|---------------|-------|------------|------|-------------|
| Home | `/` | (marketing) | — | — |
| Education Guide | `/education` | — | — | — |
| Planning Assessment | `/assess` | — | — | — |
| Find an Advisor | `/find-advisor` | — | — | — |
| Find an Attorney | `/find-attorney` | — | — | — |
| My Attorney | `/my-attorney` | My Attorney | 2 | — |
| Attorney access settings | `/settings/attorney-access` | — | 2 | — |
| Profile | `/profile` | Your Profile | 1 | `profile` |
| Estate Summary | `/dashboard` | (dashboard sections) | 1 | `dashboard` |

---

## Financial Planning

| Sidebar label | Route | Page title | Tier | Feature key |
|---------------|-------|------------|------|-------------|
| Income | `/income` | Income | 1 | `income` |
| Expenses | `/expenses` | Expenses | 1 | `expenses` |
| Assets | `/assets` | Assets | 1 | `assets` |
| Real Estate | `/real-estate` | Real Estate | 1 | `real-estate` |
| Business Interests | `/businesses` | Business Interests | 1 | `businesses` |
| Digital Assets | `/digital-assets` | Digital Assets | 1 | — |
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
| Trust & Will Guidance | `/trust-will` | Trust & Will Guidance | 3 | `trust-will` |
| Incapacity Planning | `/incapacity-planning` | Incapacity Planning | 3 | `incapacity` |
| Domicile Analysis | `/domicile-analysis` | Domicile Analysis | 3 | `domicile-analysis` |
| Estate Tax Snapshot | `/estate-tax` | Estate Tax Snapshot | 3 | `estate-tax` |
| Estate Value and Tax Horizons | `/my-estate-strategy` | Estate Value and Tax Horizons | 3 | — |
| Gifting, Strategies & Trusts | `/my-estate-trust-strategy` | Gifting, Strategies & Trusts | 3 | — |

---

## Not in sidebar (linked from dashboard or flows)

| Route | Page title | Tier | Notes |
|-------|------------|------|--------|
| `/health-check` | Estate Health Check | — | Linked from dashboard / onboarding |
| `/import` | Import Data | 2 | |
| `/print` | Export Estate Plan | — | |
| `/my-advisor` | My Advisor | — | |
| `/my-advisor-directory` | Find a Financial Advisor | — | |
| `/unlock-estate` | — | — | Upgrade flow |
| `/business-succession` | — | 3 | Commented out of sidebar |
| `/referrals` | Attorney referral | — | |

---

## Advisor portal (separate app tree)

Consumer advisors use **`/advisor`** (not `(dashboard)`). Client workspace: `/advisor/clients/[clientId]?tab=…`.  
See `docs/MASTER_ARCHITECTURE.md` for advisor tab layout.
