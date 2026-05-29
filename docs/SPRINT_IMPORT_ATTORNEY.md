# SPRINT — Import Expansion + Attorney Workflow Enhancement
# My Wealth Maps
# Status: Shipped · 2026-05-29

**Goal:** Reduce manual data entry via smarter import (normalization, multi-sheet, persona templates, RE table, onboarding fork) and give attorneys practice-level intake workflow (document lifecycle, gaps, intake PDF, doc health dashboard, tier model).

---

## Import (Phases 1–5) — COMPLETE

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| FEATURE | Asset & liability type normalization | COMPLETE | `lib/import/type-normalizer.ts` — 30+ aliases for asset types, liability types, property types. Custodian labels (Fidelity/Schwab/Vanguard) mapped to canonical slugs. Amber badge + override dropdown in review UI. |
| FEATURE | Multi-sheet workbook import | COMPLETE | `lib/import/multiSheet.ts` — sheet-name heuristics + CSV `record_type` split. Per-sheet tabs, Commit All with progress, batch summary. |
| FEATURE | Import-first onboarding fork | COMPLETE | Wizard step 1: Upload spreadsheet (primary) vs Add manually. `?onboarding=true` → redirects to `/dashboard?setup=imported` after commit. |
| FEATURE | Persona import templates | COMPLETE | `public/templates/template-business-owner.xlsx`, `template-real-estate.xlsx`, `template-executive.xlsx`. Template picker on import page. |
| FEATURE | Real estate import table | COMPLETE | `real_estate` added to import targets. Property type normalization. Uses existing `real_estate` schema (`name`, `property_type`, `current_value`, `situs_state`, …). |
| TEST | Type normalizer unit tests | COMPLETE | `tests/unit/import-type-normalizer.spec.ts` — included in `npm run test:import:unit` (19 tests total). |

### Key files

| Area | Paths |
|------|-------|
| Normalization | `lib/import/type-normalizer.ts`, `lib/import/reviewTypeHelpers.ts` |
| Multi-sheet | `lib/import/multiSheet.ts`, `app/api/ingest/route.ts` |
| Commit | `app/api/import/commit/route.ts`, `lib/import/ingestConfig.ts` |
| UI | `app/(dashboard)/import/_import-client.tsx`, `app/(dashboard)/onboarding/wizard/_wizard-client.tsx` |
| Templates | `scripts/generate-persona-import-templates.ts`, `public/templates/template-*.xlsx` |

---

## Attorney Workflow (Phases 6–7) — COMPLETE

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| DB | Document status lifecycle | COMPLETE | Migration `20260527120000_sprint_import_attorney.sql` — `doc_status`, `executed_date`, `status_notes` on `legal_documents`; `document_gap_dismissals` table. |
| FEATURE | Document vault enhancements | COMPLETE | Status dropdown (Draft/Pending Execution/Executed/Recorded), type filter bar, Document Gaps card with dismiss. |
| FEATURE | Attorney intake summary PDF | COMPLETE | Attorney variant of `ExportPDFButton` — household demographics, net worth, RE list, beneficiaries, documents on file, gaps, estate tax estimate. Gated at `attorney_tier ≥ 1`. |
| FEATURE | Multi-client doc health table | COMPLETE | Attorney home: estate value, docs on file count, missing docs, last updated per client. Gated at `attorney_tier ≥ 1`. |
| BUG | Attorney connection lookup | COMPLETE | Fixed to use `attorney_listings.id` not `auth.uid()` for `attorney_clients` joins. |
| FEATURE | Attorney tier model | COMPLETE | `profiles.attorney_tier` (0/1/2). `lib/attorney/attorneyTierLimits.ts`. Free: 3 clients, no doc dashboard, no PDF export. |
| FEATURE | Attorney billing page | COMPLETE | `/attorney/billing` — plan comparison UI. Stripe price TODOs documented (no products created yet). |

### Key files

| Area | Paths |
|------|-------|
| Migration | `supabase/migrations/20260527120000_sprint_import_attorney.sql` |
| Gaps / status | `lib/attorney/getMissingDocumentAlerts.ts`, `app/api/documents/[id]/status/route.ts`, `app/api/attorney/gap-dismissals/route.ts` |
| Vault / dashboard | `app/(attorney)/attorney/_attorney-client-vault.tsx`, `app/(attorney)/attorney/_attorney-dashboard-client.tsx` |
| Billing | `app/(attorney)/attorney/billing/page.tsx`, `lib/attorney/attorneyTierLimits.ts` |

---

## Locked decisions

- Attorney billing uses same B2B2C model as advisors — free read-only (tier 0) as adoption path, paid tiers (1/2) for practice-level features.
- Intake summary PDF gated at `attorney_tier ≥ 1` — primary upgrade driver.
- Multi-client doc health dashboard gated at `attorney_tier ≥ 1`.
- Free attorney tier capped at **3 client households**.

---

## Before deploy

1. Apply migration: `supabase/migrations/20260527120000_sprint_import_attorney.sql`
2. Create Stripe attorney prices and set `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` + `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY`
3. Optional: `npm run test:import:api` against staging after migration

---

## Verification

```bash
npm run test:import:unit   # 19 passed (import-parse + type-normalizer + wizard gate)
```
