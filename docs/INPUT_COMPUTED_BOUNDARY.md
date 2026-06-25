# Input vs computed boundary

**Owner:** Tier restructure PR 2 (authoritative for PR 6 export serializer).

**Canonical index:** [TIER_RESTRUCTURE_INDEX.md](./TIER_RESTRUCTURE_INDEX.md) · **Test audit:** [TEST_COVERAGE_AUDIT_SPEC.md](./TEST_COVERAGE_AUDIT_SPEC.md) → [Pass 1 map](./TEST_COVERAGE_AUDIT_PASS1.md)

## Code source of truth

`lib/access/inputComputedBoundary.ts`

- `TIER_ZERO_DATA_ENTRY_FEATURES` — `FEATURE_TIERS` keys that must stay at `0`
- `COMPUTED_ANALYSIS_FEATURES` — paid analysis on shared pages
- `EXPORT_INPUT_TABLES` / `EXPORT_COMPUTED_DENYLIST` — PR 6 export contract
- `PAGE_INPUT_COMPUTED_SPLIT` — per-page field documentation

## Shared pages (PR 2)

| Page | Free (Tier 0) | Paid computed |
|------|---------------|---------------|
| `/insurance` | Policy list + amounts + flags | Gap analysis panel (`insurance-gap-analysis`, Tier 2) |
| `/real-estate` | Property CRUD + values/mortgage | Summary cards, equity/proceeds readouts, Section 121 banner (`real-estate-analysis`, Tier 2) |
| `/businesses` | Business CRUD + valuation inputs | `/business-succession` module (`business-succession-analysis`, Tier 3) |

## Modeling routes (whole-page gate)

| Route | Min tier |
|-------|----------|
| `/projections` | 1 |
| `/scenarios` | 1 |
| `/import` | 1 |

Tier 0 sees `UpgradeBanner`; data-entry routes remain editable.

## PR 6 export

Serialize **only** `EXPORT_INPUT_TABLES`. Never include `EXPORT_COMPUTED_DENYLIST` artifacts.

**Endpoint:** `GET /api/consumer/data-export` — JSON attachment, scoped to `auth.uid()` (no household id parameter).

## Staging spot-check (PR 2 merge gate)

Sign in as `e2e-consumer-canceled@mywealthmaps.test` (effective tier 0). Enter:

| Input | Values |
|-------|--------|
| Real estate | $1,000,000 value, $200,000 mortgage |
| Business | $250,000 estimated value |

**Dashboard net worth (if no other assets/liabilities):**

| Line | Expected |
|------|----------|
| Real estate (FMV/equity contribution) | **$800,000** ($1M − $200k mortgage) |
| Business interests | **$250,000** |
| **Total net worth** | **$1,050,000** |

Do not expect ~$1.05M on the RE line — that total is equity + business, not equity alone.

**Gated surfaces:** `/real-estate` and `/insurance` allow entry; analysis panels show upsell only (no gap cards, no equity summary cards).

See `docs/TIER0_DASHBOARD_PR3.md` staging spot-check (same fixture).

Gate 1 (no recompute): `npm run verify:tier0-no-recompute` after PR 3 deploy + `npm run seed:e2e`.

```bash
npm run seed:e2e
npx playwright test --project=consumer-tier0
```
