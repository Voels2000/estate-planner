# SPRINT — Import Expansion + Attorney Workflow Enhancement
# My Wealth Maps
# Last updated: 2026-05-29

**Goal:** Reduce manual data entry via smarter import (normalization, multi-sheet, persona templates, RE table, onboarding fork) and give attorneys practice-level intake workflow (document lifecycle, gaps, intake PDF, doc health dashboard, tier model).

**Import Phases 1–5 acceptance criteria:** [SPRINT_IMPORT_EXPANSION.md](./SPRINT_IMPORT_EXPANSION.md)

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
| DB | Document status lifecycle | COMPLETE | Migration `20260529120000_sprint_import_attorney.sql` — `doc_status`, `executed_date`, `status_notes` on `legal_documents`; `document_gap_dismissals` table. |
| FEATURE | Document vault enhancements | COMPLETE | Status dropdown (Draft/Pending Execution/Executed/Recorded), type filter bar, Document Gaps card with dismiss. |
| FEATURE | Attorney intake summary PDF | COMPLETE | Attorney variant of `ExportPDFButton` — household demographics, net worth, RE list, beneficiaries, documents on file, gaps, estate tax estimate. Gated at `attorney_tier ≥ 1`. |
| FEATURE | Multi-client doc health table | COMPLETE | Attorney home: estate value, docs on file count, missing docs, last updated per client. Gated at `attorney_tier ≥ 1`. |
| BUG | Attorney connection lookup | COMPLETE | Fixed to use `attorney_listings.id` not `auth.uid()` for `attorney_clients` joins. |
| FEATURE | Attorney tier model | COMPLETE | `profiles.attorney_tier` (0/1/2). `lib/attorney/attorneyTierLimits.ts`. Free: 3 clients, no doc dashboard, no PDF export. |
| FEATURE | Attorney billing page | COMPLETE | `/attorney/billing` — Subscribe via `POST /api/stripe/attorney-checkout`; webhook sets `attorney_tier`. Returns 503 until `STRIPE_PRICE_ATTORNEY_*` env vars set. |
| FEATURE | Attorney upgrade prompts | COMPLETE | `AttorneyUpgradePrompt` at client cap, PDF export, doc dashboard (blurred preview on free tier). |
| FEATURE | Client cap enforcement | COMPLETE | 403 from `grant-access` + `accept-request` when free tier at 3 active clients. |
| FEATURE | Attorney onboarding drip | COMPLETE | 3-step sequence; `attorney_drip_step_*_sent_at` on `profiles`; migration `20260529130000_attorney_drip_columns.sql`. |

### Key files

| Area | Paths |
|------|-------|
| Migration | `supabase/migrations/20260529120000_sprint_import_attorney.sql` |
| Gaps / status | `lib/attorney/getMissingDocumentAlerts.ts`, `app/api/documents/[id]/status/route.ts`, `app/api/attorney/gap-dismissals/route.ts` |
| Vault / dashboard | `app/(attorney)/attorney/_attorney-client-vault.tsx`, `app/(attorney)/attorney/_attorney-dashboard-client.tsx` |
| Billing / checkout | `app/(attorney)/attorney/billing/`, `app/api/stripe/attorney-checkout/route.ts`, `lib/tiers.ts` |
| Upgrade prompts | `components/attorney/AttorneyUpgradePrompt.tsx`, `lib/attorney/attorneyClientCap.ts` |
| Drip | `lib/attorney/sendAttorneyDripStep.ts`, `lib/emails/attorney-drip-templates.ts`, `app/api/email/attorney-drip/route.ts` |

---

## Locked decisions

- Attorney billing uses same B2B2C model as advisors — free read-only (tier 0) as adoption path, paid tiers (1/2) for practice-level features.
- Intake summary PDF gated at `attorney_tier ≥ 1` — primary upgrade driver.
- Multi-client doc health dashboard gated at `attorney_tier ≥ 1`.
- Free attorney tier capped at **3 client households**.

---

## Before deploy

1. Apply migrations: `supabase/migrations/20260529120000_sprint_import_attorney.sql`, `20260529130000_attorney_drip_columns.sql`
2. Create Stripe attorney products (Starter $99/mo, Growth $249/mo) and set `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` + `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY`
3. Test checkout end-to-end in Stripe test mode; confirm webhook sets `attorney_tier`
4. Optional: `npm run test:import:api` against staging after migrations

---

## Post-ship ops

### Attorney drip — verify cron steps 2 & 3

After the first **real** attorney registers, check ~**3 days** later that step 2 populated (step 3 ~7 days after step 1).

```sql
SELECT email,
       created_at,
       attorney_drip_step_1_sent_at,
       attorney_drip_step_2_sent_at,
       attorney_drip_step_3_sent_at
FROM profiles
WHERE role = 'attorney' OR is_attorney = true
ORDER BY created_at DESC
LIMIT 10;
```

- **Step 1** should be non-null soon after activation.
- **Steps 2 & 3** depend on `GET /api/cron/notifications` (14:00 UTC) and elapsed time since **step 1 sent** (not account `created_at`).
- If step 2 is null after day 3: inspect cron logs, `CRON_SECRET`, and `role` / `is_attorney` filter in `app/api/cron/notifications/route.ts`.

---

## Verification

```bash
npm run test:import:unit   # 24 passed (import-parse + type-normalizer + wizard gate + projectionReadiness)
```
