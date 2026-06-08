> **Archived sprint doc (shipped).** See [README.md](./README.md) for canonical references.

# SPRINT_IMPORT_EXPANSION.md
# Import Expansion — Acceptance Criteria & Reference
# Status: COMPLETE
# Shipped: 2026-05-29
# Related: [SPRINT_IMPORT_ATTORNEY.md](./SPRINT_IMPORT_ATTORNEY.md) (Phases 6–7 attorney workflow)

---

## Overview

This sprint expanded the import pipeline across five phases. No new financial-table migration was required for Phases 1–5 — `real_estate` uses the existing table from `supabase/migrations/20250317100000_real_estate.sql`.

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Asset & liability type normalization | COMPLETE |
| 2 | Multi-sheet workbook import | COMPLETE |
| 3 | Import-first onboarding fork | COMPLETE |
| 4 | Persona import templates | COMPLETE |
| 5 | Real estate import table | COMPLETE |

### Key files

| Area | Paths |
|------|-------|
| Normalization | `lib/import/type-normalizer.ts`, `lib/import/reviewTypeHelpers.ts` |
| Multi-sheet | `lib/import/multiSheet.ts`, `app/api/ingest/route.ts` |
| Commit | `app/api/import/commit/route.ts`, `lib/import/ingestConfig.ts` |
| UI | `app/(dashboard)/import/_import-client.tsx`, `app/(dashboard)/onboarding/wizard/_wizard-client.tsx` |
| Templates | `scripts/generate-persona-import-templates.ts`, `public/templates/template-*.xlsx` |
| Tests | `tests/unit/import-type-normalizer.spec.ts`, `tests/unit/import-parse.spec.ts` |

---

## Phase 1 — Type Normalization

### What was built

`lib/import/type-normalizer.ts` — maps human-readable strings and custodian export labels to canonical DB slugs at commit time.

Three exported functions:

- `normalizeAssetType(raw: string)` → `{ canonical, matched, displayLabel }`
- `normalizeLiabilityType(raw: string)` → `{ canonical, matched, displayLabel }`
- `normalizePropertyType(raw: string)` → `{ canonical, matched, displayLabel }`

Wired in:

- `app/api/import/commit/route.ts` — normalizes `type` (assets/liabilities) and `property_type` (real_estate) before insert
- `lib/import/reviewTypeHelpers.ts` — review UI badges and pre-commit row normalization
- `app/(dashboard)/import/_import-client.tsx` — amber “Mapped to …” badge, red “Unmapped — pick type”, override `<select>` on type columns

### Acceptance criteria

- [ ] `normalizeAssetType('Brokerage Account')` returns `{ canonical: 'taxable_brokerage', matched: true }`
- [ ] `normalizeAssetType('401(k)')` returns `{ canonical: 'traditional_401k', matched: true }`
- [ ] `normalizeAssetType('fidelity brokerage account')` returns `{ canonical: 'taxable_brokerage', matched: true }`
- [ ] `normalizeAssetType('schwab one account')` returns `{ canonical: 'taxable_brokerage', matched: true }`
- [ ] `normalizeAssetType('vanguard brokerage account')` returns `{ canonical: 'taxable_brokerage', matched: true }`
- [ ] `normalizeLiabilityType('HELOC')` returns `{ canonical: 'heloc', matched: true }`
- [ ] `normalizePropertyType('Primary Home')` returns `{ canonical: 'primary_residence', matched: true }`
- [ ] Unknown type returns `{ canonical: null, matched: false, displayLabel: <raw input> }`
- [ ] `npm run test:import:unit` passes (includes `import-type-normalizer.spec.ts` + parse + wizard gate + `projectionReadiness` — **24 tests**)
- [ ] Import commit route calls normalization before inserting rows
- [ ] Review UI shows “Type mapped” amber badge for auto-normalized rows
- [ ] Review UI shows override dropdown on type / property_type columns

### Custodian aliases covered

| Custodian | Aliases |
|-----------|---------|
| Fidelity | `fidelity brokerage account`, `fidelity account` |
| Schwab | `schwab one account`, `schwab brokerage` |
| Vanguard | `vanguard brokerage account`, `vanguard individual` |

### Adding new aliases

Edit `ASSET_TYPE_ALIASES`, `LIABILITY_TYPE_ALIASES`, or `PROPERTY_TYPE_ALIASES` in `lib/import/type-normalizer.ts`. Keys must be lowercase. Run `npm run test:import:unit` after adding.

---

## Phase 2 — Multi-Sheet Workbook Import

### What was built

- `lib/import/multiSheet.ts` — sheet-name heuristics, `parseAllExcelSheets()`, CSV `record_type` / `table` / `category` split via `splitCsvByRecordType()`
- `app/api/ingest/route.ts` — returns `multi_sheet: true` and `sheets[]` when multiple data sheets detected
- `app/(dashboard)/import/_import-client.tsx` — per-sheet tabs, **Commit All**, progress text (`Committing sheet N of M…`), batch summary by table

### Acceptance criteria

**Multi-sheet Excel (.xlsx)**

- [ ] Upload a workbook with sheets named e.g. Assets, Liabilities, Income, Expenses
- [ ] API returns `{ multi_sheet: true, sheets: [{ sheet_name, target_table, rows, field_map, confidence, row_count }, …] }`
- [ ] Import review UI shows one tab per detected sheet (name, table label, row count)
- [ ] Each tab has its own field mapping and editable rows
- [ ] **Commit All** commits sequentially with progress indicator
- [ ] Completion summary lists counts per table (e.g. “42 assets, 8 liabilities … imported”)
- [ ] One `ingestion_jobs` row per upload session (same `job_id` across sheet commits; job marked committed on success)

**Sheet name heuristics (case-insensitive)**

- [ ] Sheet name contains `asset` (and not real-estate context) → `assets`
- [ ] Sheet name contains `liab` or `debt` → `liabilities`
- [ ] Sheet name contains `income` or `earn` → `income`
- [ ] Sheet name contains `expense` or `spend` → `expenses`
- [ ] Sheet name contains `real`, `property`, or `estate` → `real_estate`
- [ ] Unrecognized sheet → fallback to column header analysis (`detectTable()` in `ingestConfig.ts`)
- [ ] Instruction sheets (`Instructions`, `Summary`, `Readme`, …) skipped

**CSV record_type column**

- [ ] CSV with `record_type`, `table`, or `category` column and values like `assets`, `liabilities` → split into virtual sheets
- [ ] Requires **more than one** distinct table group; otherwise treated as single-table CSV

**Single-sheet (regression)**

- [ ] Single-sheet Excel and single-table CSV still work
- [ ] `multi_sheet: false` (or absent) for single-table files
- [ ] Existing sheet picker still works when user forces single sheet (`single_sheet=true` on re-parse)

---

## Phase 3 — Import-First Onboarding Fork

### What was built

- `app/(dashboard)/onboarding/wizard/_wizard-client.tsx` — step 1 fork: **Upload a spreadsheet** (primary) vs **Add assets manually** (secondary)
- `app/(dashboard)/import/page.tsx` — passes `onboardingMode` when `?onboarding=true`
- `app/(dashboard)/import/_import-client.tsx` — after commit in onboarding mode, redirects to `/dashboard?setup=imported&import_summary=…`
- `app/(dashboard)/_dashboard-client.tsx` — gold toast: “Great start — … imported.”

### Acceptance criteria

- [ ] New user at wizard step 1 who clicks **Upload a spreadsheet** lands on `/import?onboarding=true`
- [ ] After successful **Commit All** (or single-table commit), redirect goes to `/dashboard?setup=imported` (not staying on `/import`)
- [ ] Dashboard shows success toast with import summary from query param
- [ ] Returning to `/onboarding/wizard` recalculates progress via `GET /api/consumer/setup-progress` — steps complete when `assets > 0` / `income > 0` (not a hard ≥3 assets rule in code)
- [ ] **Add assets manually** shows the original quick-add asset form on step 1
- [ ] Wizard **← Back to dashboard** still works from step 1

---

## Phase 4 — Persona Import Templates

### What was built

Three downloadable `.xlsx` templates in `public/templates/`:

- `template-business-owner.xlsx`
- `template-real-estate.xlsx`
- `template-executive.xlsx`

Template picker on `/import` upload step (Business Owner | Real Estate Portfolio | Executive / RSU | Blank CSV link).

Regenerate: `npx tsx scripts/generate-persona-import-templates.ts`

### Acceptance criteria

- [ ] Template picker shows four options: Business Owner | Real Estate Portfolio | Executive / RSU | Blank
- [ ] Clicking a persona template downloads the correct `.xlsx`
- [ ] Each persona workbook includes an **Instructions** sheet plus data sheets with human-readable headers
- [ ] Business Owner / Executive: Assets, Liabilities, Income, Expenses sheets with example rows
- [ ] Real Estate template: includes a **Real Estate** sheet (property rows) plus supporting sheets
- [ ] Example type values are covered by Phase 1 normalization aliases
- [ ] Upload zone remains visible below the picker

### Template content reference (shipped examples)

**Business Owner — Assets:** Family LLC Interest / Business Interest / 1200000  
**Real Estate — Real Estate sheet:** 123 Oak Street / Primary Home / 920000 / CA / mortgage  
**Executive — Assets:** Company RSU Account / Individual Stock / 320000  

---

## Phase 5 — Real Estate Import

### What was built

- `real_estate` added to `ImportTable` in `lib/import/ingestConfig.ts`
- Commit support in `app/api/import/commit/route.ts` — required fields: `name`, `property_type`, `current_value`
- Optional mapped fields: `situs_state`, `mortgage_balance`, `owner`, `is_primary_residence`
- Property type normalization via `normalizePropertyType()` — maps to DB check constraint values

**Schema (existing):** `name`, `property_type`, `current_value`, `mortgage_balance`, `situs_state`, `owner`, `is_primary_residence`, … — see `20250317100000_real_estate.sql`

**Note:** This sprint did **not** add new advisor/attorney RLS policies on `real_estate`. Owner-only RLS from the original migration remains.

### Acceptance criteria

**Import flow**

- [ ] CSV/XLSX with property rows → ingest can detect `real_estate` (sheet name or headers)
- [ ] Target table selectable as **Real Estate** in review UI
- [ ] Field map supports: `name` (incl. address alias), `property_type`, `current_value`, `situs_state`, `mortgage_balance`, `owner`, `is_primary_residence`
- [ ] Type normalization examples below
- [ ] Committed rows appear on `/real-estate`
- [ ] Duplicate detection: match on `name` + `current_value` for same owner

**Property types (DB + normalization)**

| Input | Canonical (`property_type`) |
|-------|------------------------------|
| primary home, primary residence, residence | `primary_residence` |
| vacation home, second home | `vacation` |
| rental, investment property, rental property | `rental` |
| commercial, commercial property, land | `commercial` |

Allowed DB values: `primary_residence`, `rental`, `vacation`, `commercial` (not `rental_residential` / `vacation_home`).

---

## Running Import Tests

### Unit tests (import-unit project)

```bash
npm run test:import:unit
```

Expected: **24 passed** (import-parse, import-type-normalizer, wizard-onboarding-gate, projectionReadiness).

Or targeted:

```bash
npx playwright test tests/unit/import-type-normalizer.spec.ts --project=import-unit
```

### API integration tests (after F-1/F-2 migrations applied)

```bash
npm run test:import:api
```

Requires `.env.test`, tier 2+ consumer, F-2 traceability migration on test DB.

### Manual end-to-end smoke test

1. Log in as a tier 1+ consumer
2. Navigate to `/import`
3. Download **Business Owner** template
4. Upload the filled workbook
5. Verify: multiple tabs (Assets, Liabilities, …) with row counts
6. Verify: type badges on “Business Interest” / “Brokerage Account” rows
7. Click **Commit All**
8. Verify batch summary counts
9. Check `/assets`, `/liabilities`, `/income` as applicable
10. For RE template: verify `/real-estate` after importing **Real Estate** sheet

---

## Known Limitations

- Real estate import does not auto-link mortgage rows to liability records (`mortgage_balance` stored on RE row only)
- Multi-sheet **Commit All** reuses one `ingestion_jobs` row per upload (not one job per sheet)
- Multi-sheet CSV requires `record_type` / `table` / `category` column with recognized table names
- PDF import not supported (deferred — see [ROADMAP.md](./ROADMAP.md))
- Trust / beneficiary / strategy data not importable (by design)
- Wizard step completion after import uses existing setup-progress thresholds (`assets > 0`, `income > 0`), not an explicit “≥3 assets” import rule

---

## Maintenance

### Adding a new import target table

1. Add table to `ImportTable` and `IMPORT_TABLES` in `lib/import/ingestConfig.ts`
2. Add `REQUIRED_FIELDS`, `TABLE_FIELD_KEYS`, `FIELD_ALIASES`, and `detectTable()` hints
3. Add `INSERT_COLUMNS` and transform logic in `app/api/import/commit/route.ts`
4. Add duplicate detection branch in `findDuplicates()` if needed
5. Extend multi-sheet heuristics in `lib/import/multiSheet.ts`
6. Update this document

### Updating custodian aliases

Edit `ASSET_TYPE_ALIASES` in `lib/import/type-normalizer.ts`. Verify against custodian “Download positions” CSV exports before adding.

### Template updates

```bash
npx tsx scripts/generate-persona-import-templates.ts
```

Output: `public/templates/template-business-owner.xlsx`, `template-real-estate.xlsx`, `template-executive.xlsx`.
