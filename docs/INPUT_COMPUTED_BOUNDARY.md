# Input vs computed boundary

**Owner:** Tier restructure PR 2 (authoritative for PR 6 export serializer).

**Principle:** All data entry is free (Tier 0). Everything the system *computes* from those inputs is paid.

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
